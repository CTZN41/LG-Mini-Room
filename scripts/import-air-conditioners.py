"""Import the reviewed November 2026 AC snapshot. Source and existing catalog rows are preserved."""
import argparse
from collections import Counter, defaultdict
from contextlib import closing
from hashlib import sha256
from pathlib import Path
import re
import sqlite3
import tempfile


SNAPSHOT = 'f40e9498f1af7b0975480f8a61d5fadd37d62ca828acd2b4981f9a75aba7f6c8'
ROLES = {
    '스탠드형': '스탠드 실내기', '벽걸이형': '벽걸이 실내기', '이동식': '이동식 본체',
    '창호형': '창호형 본체', '상업용 스탠드': '스탠드 실내기',
    '천장형 4Way': '천장형 실내기', '천장형 원형': '천장형 실내기',
}
TABLES = ('images', 'appearance_groups', 'products', 'product_components')


def connect(path, mode):
    conn = sqlite3.connect(path.resolve().as_uri() + '?mode=' + mode, uri=True, timeout=20)
    conn.execute('PRAGMA foreign_keys=ON')
    return conn


def checked(db):
    if list(db.execute('PRAGMA integrity_check')) != [('ok',)] or list(db.execute('PRAGMA foreign_key_check')):
        raise ValueError('SQLite integrity or foreign key error')


def select_units(src):
    parts = defaultdict(list)
    for part in src.execute('SELECT * FROM product_components ORDER BY rowid'):
        parts[part['product_id']].append(dict(part))
    stats, units = Counter(), {}
    for row in src.execute('''SELECT p.*,a.product_type FROM products p
                           JOIN ac_source a USING(product_id) ORDER BY p.product_id'''):
        kind, pid = row['product_type'], row['product_id']
        if kind not in ROLES or row['category'] != '에어컨':
            stats['세트·수집 범위 밖'] += 1
            continue
        if row['photo_review_status'] not in ('수정', '확인'):
            stats['사진 미확인'] += 1
            continue
        indoor = [p for p in parts[pid] if p['component_role'].endswith(('실내기', '본체'))]
        # A nominally single listing that also specifies another indoor appliance is ambiguous.
        if any(p['component_role'] != ROLES[kind] for p in indoor):
            stats['다른 실내기 동시 표기'] += 1
            continue
        codes = {}
        for part in indoor:
            if part['evidence'] == 'LG 공식 구성품':
                code = part['component_model'].rstrip('.').removesuffix('.AKOR')
                if not re.fullmatch(r'[A-Z0-9]+(?:\.[A-Z0-9]+)?', code):
                    raise ValueError('Unexpected component code: ' + code)
                codes.setdefault(code, part)
        if len(codes) != 1:
            stats['본체 코드 없음' if not codes else '본체 코드 불일치'] += 1
            continue
        code, part = next(iter(codes.items()))
        if code in units:
            stats['같은 본체의 판매 옵션'] += 1
            continue
        units[code] = (dict(row), part)
        stats[kind] += 1
    return units, stats


def insert(db, table, row):
    names = ','.join(row)
    marks = ','.join('?' for _ in row)
    db.execute(f'INSERT INTO {table} ({names}) VALUES ({marks})', tuple(row.values()))


def write_clean(src, dst):
    src.row_factory = sqlite3.Row
    for table in TABLES:
        dst.execute(src.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()[0])
    units, stats = select_units(src)
    groups, images = set(), set()
    for code, (p, part) in units.items():
        kind = p.pop('product_type')
        group, iid = p['group_id'], p['image_id']
        if iid not in images:
            img = dict(src.execute('SELECT * FROM images WHERE image_id=?', (iid,)).fetchone())
            if sha256(img['data']).hexdigest() != img['sha256']:
                raise ValueError(f'Image checksum mismatch: {iid}')
            insert(dst, 'images', img)
            images.add(iid)
        if group not in groups:
            g = dict(src.execute('SELECT * FROM appearance_groups WHERE group_id=?', (group,)).fetchone())
            g['title'] = p['appearance'] or kind
            insert(dst, 'appearance_groups', g)
            groups.add(group)
        name = p['product_name'].removesuffix(p['model_name']).strip()
        name = re.sub(r'\(2in1\)|\(연장키트 [^)]+\)|마감키트(?: 미포함)?|매립배관형|싱글', '', name, flags=re.I)
        name = ' '.join(name.split()) + (' 본체' if kind in ('창호형', '이동식') else ' 실내기')
        p.update(product_name=name, model_name=code, title_model=code, image_filename=code+'.jpg',
                 photo_advice='공식 구성표의 실내 본체 모델. 동일 사진을 공유할 수 있어 정확한 모델은 라벨 확인.')
        insert(dst, 'products', p)
        part['component_model'] = code
        insert(dst, 'product_components', part)
    dst.commit()
    checked(dst)
    return stats


def merge(target, clean):
    with closing(connect(target, 'rw')) as db:
        db.execute('ATTACH ? AS ac', (clean.resolve().as_uri() + '?mode=ro',))
        db.execute('BEGIN IMMEDIATE')
        # Detect a partial previous import, schema drift or any ID collision before committing.
        existing = db.execute("SELECT count(*) FROM main.products WHERE category='에어컨'").fetchone()[0]
        for table in TABLES:
            missing = f'SELECT * FROM ac.{table} EXCEPT SELECT * FROM main.{table}'
            if existing:
                if db.execute('SELECT 1 FROM ('+missing+') LIMIT 1').fetchone():
                    raise ValueError('Existing AC records differ from the reviewed snapshot')
            else:
                db.execute(f'INSERT INTO main.{table} SELECT * FROM ac.{table}')
        n = db.execute("SELECT count(*) FROM main.products WHERE category='에어컨'").fetchone()[0]
        if n != db.execute('SELECT count(*) FROM ac.products').fetchone()[0]:
            raise ValueError('AC model count mismatch')
        checked(db)
        db.commit()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ('source', 'catalog', 'clean'):
        parser.add_argument(arg, type=Path)
    args = parser.parse_args()
    if len({p.resolve() for p in (args.source, args.catalog, args.clean)}) != 3:
        parser.error('Use three distinct paths')
    if sha256(args.source.read_bytes()).hexdigest() != SNAPSHOT:
        parser.error('Source differs from the visually reviewed snapshot')
    with tempfile.TemporaryDirectory(dir=args.clean.parent) as tmp:
        clean = Path(tmp) / 'clean.db'
        stage = Path(tmp) / 'stage.db'
        with closing(connect(args.source, 'ro')) as src, closing(connect(clean, 'rwc')) as dst:
            checked(src)
            counts = write_clean(src, dst)
        if args.clean.exists() and args.clean.read_bytes() != clean.read_bytes():
            parser.error('Clean output already exists with different contents')
        with closing(connect(args.catalog, 'ro')) as src, closing(connect(stage, 'rwc')) as dst:
            src.backup(dst)
        merge(stage, clean)
        merge(stage, clean)  # Repeat on the staged copy to verify idempotency.
        merge(args.catalog, clean)
        if not args.clean.exists():
            clean.rename(args.clean)
        print(dict(counts))


if __name__ == '__main__':
    main()
