"""Apply the visually reviewed Phase 1–4 manifest to a standalone catalog."""
import argparse
import hashlib
import io
import json
import sqlite3
from collections import Counter
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'data' / 'reviewed-product-photos.json'


def read_photos(db, entries, cache):
    photos = {}
    for item in entries:
        if item['decision'] != 'keep':
            continue
        digest = item['sha256']
        stored = db.execute('SELECT data FROM images WHERE sha256=?', (digest,)).fetchone()
        if stored:
            data = stored[0]
        elif item.get('asset'):
            data = (MANIFEST.parent / item['asset']).read_bytes()
        elif cache:
            data = (cache / (item['model'] + '.raw')).read_bytes()
        else:
            request = Request(item['photo'], headers={'Referer': item['source'], 'User-Agent': 'Mozilla/5.0'})
            with urlopen(request, timeout=30) as response:
                data = response.read()
        if hashlib.sha256(data).hexdigest() != digest:
            raise ValueError('검수 사진 변경 ' + item['model'])
        with Image.open(io.BytesIO(data)) as im:
            im.verify()
            mime = Image.MIME[im.format]
        photos[digest] = (data, mime)
    return photos


def apply(db, entries, photos):
    # Only discard images previously used by these rows and no longer in use.
    old_images = set()
    removed = {(i['category'], i['model']) for i in entries if i['decision'] == 'remove' and not i.get('onlyReviewedRows')}
    for cat, code, choices in db.execute('SELECT unit_category,unit_code,old_choices FROM retired_sale_keys'):
        if (cat, code) in removed or any(tuple(pair) in removed for pair in json.loads(choices)):
            raise ValueError('이전 배치의 단품 연결을 먼저 검수하세요 ' + code)
    for item in entries:
        key = (item['category'], item['model'])
        rows = db.execute("""SELECT product_id,image_id,sha256 FROM products JOIN images USING(image_id)
                             WHERE category=? AND model_name=? ORDER BY product_id""", key).fetchall()
        expected = {v['id']: {v['sha256'], v.get('reviewedSha256')} for v in item['before']}
        if item.get('onlyReviewedRows'):
            if not any(r[0] not in expected for r in rows):
                raise ValueError('보존할 대표 행이 없음 ' + key[1])
            rows = [r for r in rows if r[0] in expected]
        keep = item['decision'] == 'keep'
        if not rows and not keep:
            continue
        if {r[0] for r in rows} != set(expected):
            raise ValueError('검수 이후 제품 행 변경 ' + key[1])
        for row_id, image_id, digest in rows:
            if digest not in expected[row_id] and not (keep and digest == item['sha256']):
                raise ValueError('검수 이후 대표 사진 변경 ' + key[1])
            old_images.add(image_id)
        if keep:
            digest = item['sha256']
            data, mime = photos[digest]
            db.execute('INSERT OR IGNORE INTO images(sha256,mime_type,data) VALUES(?,?,?)', (digest, mime, data))
            db.executemany("""UPDATE products SET image_id=(SELECT image_id FROM images WHERE sha256=?),
                          image_filename=?,photo_review_status='확인',photo_review_note=?,photo_source=?
                          WHERE product_id=?""",
                       [(digest, key[1] + '.' + mime.split('/')[-1], item['reason'], item['source'], r[0]) for r in rows])
        else:
            db.executemany('DELETE FROM product_components WHERE product_id=?', [(r[0],) for r in rows])
            db.executemany('DELETE FROM products WHERE product_id=?', [(r[0],) for r in rows])
    for item in entries:
        if item['decision'] == 'remove' and item.get('retiredGroup'):
            group = item['retiredGroup']
            db.execute("""DELETE FROM appearance_groups WHERE group_id=?
                          AND NOT EXISTS (SELECT 1 FROM products WHERE group_id=?)
                          AND NOT EXISTS (SELECT 1 FROM product_components WHERE component_group_id=?)""",
                       (group, group, group))
    db.executemany("""DELETE FROM images WHERE image_id=?
                      AND NOT EXISTS (SELECT 1 FROM products WHERE products.image_id=images.image_id)""",
                   [(i,) for i in old_images])
    if db.execute('PRAGMA foreign_key_check').fetchone() or db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
        raise ValueError('DB 무결성 오류')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database', type=Path)
    parser.add_argument('--cache', type=Path, help='reviewed original files named MODEL.raw')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8-sig'))
    entries = manifest['models']
    if Counter(r['phase'] for r in entries) != {1: 1, 2: 3, 3: 87, 4: 26, '방문객 촬영': 1}:
        raise ValueError('검수 범위 불일치')
    if len({(r['category'], r['model']) for r in entries}) != len(entries):
        raise ValueError('중복 모델')
    if any(r['decision'] not in ('keep', 'remove') for r in entries):
        raise ValueError('알 수 없는 판정')
    entries = entries + manifest['secondaryRows']
    with sqlite3.connect(args.database.resolve().as_uri() + '?mode=rw', uri=True, timeout=30) as db:
        db.execute('PRAGMA foreign_keys=ON')
        photos = read_photos(db, entries, args.cache)
        db.execute('BEGIN IMMEDIATE')
        apply(db, entries, photos)
        print('models', dict(Counter(i['decision'] for i in manifest['models'])),
              'secondary rows', {d: sum(len(r['before']) for r in manifest['secondaryRows'] if r['decision'] == d) for d in ('keep','remove')},
              'catalog', db.execute('SELECT count(*) FROM (SELECT DISTINCT category,model_name FROM products)').fetchone()[0])
        if not args.apply:
            db.rollback()
            print('dry run')


if __name__ == '__main__':
    main()
