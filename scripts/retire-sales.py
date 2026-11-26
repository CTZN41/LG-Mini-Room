"""Remove multi-appliance sales from the runtime DB. Dry-run unless --apply is set."""
import argparse
import collections
import json
import hashlib
import io
from PIL import Image
from urllib.request import urlopen
import sqlite3
from pathlib import Path

SET_SUBJECTS = {'여러 가전이 포함된 세트', '세탁기·건조기 세트'}
WASHERS = {'트윈워시', '워시타워', '워시콤보'}
# Both labels already have independent dryer records. Their sale component roles are incorrect.
DRYERS = {'RG18WN', 'RG19WN'}


# Official component lists on each LG product page identify the independently labelled body.
BASE_UNITS = {'FH25KAX':'FH25KA','FH25VAX':'FH25VA','FH25WAX':'FH25WA','FX23ENEF':'FX23ENE'}
# Corrections apply only to the exact official sales composition, not to model suffixes globally.
KIT_COMPONENTS = {('KX23GNRENER','RD20ENR'):'RD20ENER',('KX23WNR2WQR','RD22WSQR'):'RD20WSQR'}
EXCLUDED_SALE_LABELS = {'A948BWE','RD22WSQ'}
CORDED = {'K83IGY','K83WGY'}
ART = {
    'F19VDU':('전면도어 세탁·건조 가전','실버'), 'F24VDAP':('전면도어 세탁·건조 가전','실버'),
    'F24KDAP':('전면도어 세탁·건조 가전','블랙'), 'FX25GSGR':('전면도어 세탁·건조 가전','그린'),
    'RH18VTAN':('전면도어 세탁·건조 가전','실버'), 'AS064PBBAR':('에어로퍼니처','그라파이트')
}
PHOTOS = json.loads((Path(__file__).resolve().parents[1]/'data'/'verified-unit-photos.json').read_text(encoding='utf8'))
def roles_category(role):
    return '세탁기' if role in WASHERS else role


def verified_image(code, cache):
    source=PHOTOS[code]
    if cache:
        data=(cache/(code+'.jpg')).read_bytes()
    else:
        with urlopen(source['photo'],timeout=20) as response:
            data=response.read()
    if hashlib.sha256(data).hexdigest()!=source['sha256']:
        raise ValueError('공식 사진 변경 · 육안 재확인 필요 '+code)
    with Image.open(io.BytesIO(data)) as photo:
        output=io.BytesIO()
        photo.convert('RGB').save(output,format='JPEG',quality=96,subsampling=0)
    return output.getvalue()


def migrate(db, apply, cache):
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('BEGIN IMMEDIATE' if apply else 'BEGIN')
    products = list(db.execute('SELECT p.*,g.photo_subject FROM products p JOIN appearance_groups g USING(group_id) ORDER BY product_id'))
    sales = [r for r in products if r['photo_subject'] in SET_SUBJECTS]
    if not sales:
        print('판매 세트 0행')
        return
    families = {r['category'] for r in products}
    units = {(r['category'], r['model_name']) for r in products if r['photo_subject'] not in SET_SUBJECTS}
    components = collections.defaultdict(list)
    for row in db.execute('SELECT * FROM product_components ORDER BY rowid'):
        components[row['product_id']].append(row)
    redirects, missing = [], {}
    for sale in sales:
        source_id = sale['product_id']
        choices = []
        primary = None
        for c in components[source_id]:
            if c['evidence'] != '상품명에 표기된 구성 모델':
                continue
            role, code = c['component_role'], c['component_model']
            category = roles_category(role)
            if category not in families:
                continue
            if category == '세탁기' and code in DRYERS:
                category = '건조기'
            if code in EXCLUDED_SALE_LABELS or code in CORDED:
                continue
            key = (category, KIT_COMPONENTS.get((sale['model_name'],code),BASE_UNITS.get(code,code)))
            if code == sale['title_model']:
                primary = key
            if key in units:
                # Only old standalone rows could be selected through the former bundle picker.
                if key==(roles_category(role),code) and key not in choices:
                    choices.append(key)
            else:
                missing.setdefault(key, (role, source_id))
        if not primary:
            raise ValueError(f"대표 본체를 특정할 수 없음 {source_id}")
        redirects.append((source_id,sale['category'],sale['model_name'],*primary,json.dumps(choices,ensure_ascii=False)))
    print(f'판매 {len(sales)}행 / {len({(r[1],r[2]) for r in redirects})}코드, 단품 {len(units)}, 모델명 신규 보존 {len(missing)}')
    for family in sorted(families):
        print(family, '제거',len({r[2] for r in redirects if r[1]==family}), '보존 추가',sum(c==family for c,_ in missing))
    if {code for _,code in missing}!=set(PHOTOS):
        raise ValueError('추가 검토가 필요한 본체 코드가 있음')
    if not apply:
        return
    if units & {(r[1],r[2]) for r in redirects}:
        raise ValueError('판매 코드와 단품 코드가 겹침')
    # Old sale identifiers here are exclusively for migrating browser storage.
    db.execute('''CREATE TABLE retired_sale_keys(old_id INTEGER PRIMARY KEY, category TEXT NOT NULL,
        sale_code TEXT NOT NULL,unit_category TEXT NOT NULL,unit_code TEXT NOT NULL,old_choices TEXT NOT NULL)''')
    db.executemany('INSERT INTO retired_sale_keys VALUES(?,?,?,?,?,?)', redirects)
    next_id = max(r['product_id'] for r in products)+1
    next_group = int(db.execute('SELECT max(group_id) FROM appearance_groups').fetchone()[0][1:])+1
    for (category,code),(role,source_id) in sorted(missing.items()):
        subject,tone=ART[code]
        group=f'V{next_group:04d}'
        next_group+=1
        source=PHOTOS[code]
        image=verified_image(code,cache)
        digest=hashlib.sha256(image).hexdigest()
        db.execute('INSERT OR IGNORE INTO images(sha256,mime_type,data) VALUES(?,?,?)',(digest,'image/jpeg',image))
        image_id=db.execute('SELECT image_id FROM images WHERE sha256=?',(digest,)).fetchone()[0]
        db.execute('INSERT INTO appearance_groups VALUES(?,?,?,?)',(group,subject,role+' '+code,'LG 단품 사진 대조'))
        brand='LG전자 '+{'건조기':'트롬 건조기','공기청정기':'퓨리케어 오브제컬렉션 에어로퍼니처',
            '세탁기':'트롬 세탁기'}[category]
        db.execute('''INSERT INTO products(product_id,category,product_name,model_name,title_model,group_id,image_id,image_filename,
            photo_review_status,photo_review_note,photo_source,appearance,appearance_source)
            VALUES(?,?,?,?,?,?,?,?,'확인',?,?,?,?)''',(next_id,category,brand+' '+code,code,code,group,image_id,
            brand+'_'+code+'.jpg','공식 단품 사진 및 모델명 확인',source['page'],'본체 색상 '+tone,source['page']))
        component_group=next(c['component_group_id'] for c in components[source_id] if c['component_model']==code and c['component_role']==role)
        db.execute("INSERT INTO product_components VALUES(?,?,?,?,?,?,?)",(next_id,component_group,role,code,'상품 표기 모델',source['page'],''))
        next_id+=1
    db.execute('CREATE TEMP TABLE sale_art AS SELECT DISTINCT image_id,group_id FROM products JOIN retired_sale_keys ON old_id=product_id')
    db.execute('DELETE FROM product_components WHERE product_id IN (SELECT old_id FROM retired_sale_keys)')
    db.execute('DELETE FROM products WHERE product_id IN (SELECT old_id FROM retired_sale_keys)')
    db.execute('DELETE FROM images WHERE image_id IN (SELECT image_id FROM sale_art) AND NOT EXISTS(SELECT 1 FROM products WHERE products.image_id=images.image_id)')
    db.execute('DELETE FROM appearance_groups WHERE group_id IN (SELECT group_id FROM sale_art) AND group_id NOT IN (SELECT group_id FROM products) AND group_id NOT IN (SELECT component_group_id FROM product_components)')
    if db.execute('PRAGMA foreign_key_check').fetchone() or db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':
        raise ValueError('DB 무결성 검증 실패')
    if db.execute('SELECT count(*) FROM (SELECT DISTINCT category,model_name FROM products)').fetchone()[0]!=len(units)+len(missing):
        raise ValueError('단품 수 불일치')
    db.commit()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database',type=Path)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--photo-cache',type=Path,help='Directory containing the hash-verified source images')
    args=parser.parse_args()
    conn=sqlite3.connect(args.database.resolve().as_uri()+('?mode=rw' if args.apply else '?mode=ro'),uri=True,timeout=20)
    try:
        migrate(conn,args.apply,args.photo_cache)
    finally:
        conn.close()
