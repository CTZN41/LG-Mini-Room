"""Index verified body labels in the Mini Room SQLite catalogue. No new product rows."""
import argparse
import hashlib
import json
import re
import sqlite3
from pathlib import Path


def code(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError('Empty or invalid model code')
    return value.strip().upper()


def import_catalog(db, snapshot):
    data = snapshot.read_bytes()
    rows = json.loads(data)
    if not isinstance(rows, list) or not rows:
        raise ValueError('Expected a nonempty camera snapshot')
    by_code = {code(row['modelCode']): row for row in rows}
    if len(by_code) != len(rows):
        raise ValueError('Duplicate camera model codes')
    db.execute('PRAGMA foreign_keys=ON')
    with db:
        db.execute('BEGIN IMMEDIATE')
        products = list(db.execute('SELECT model_name,product_name FROM products'))
        known = {code(model) for model, _ in products}
        retired = {code(model) for model, in db.execute('SELECT sale_code FROM retired_sale_keys')}
        # A named combination is evidence of a sale package. AI+ or the marketing
        # name "컨버터블 패키지" alone says nothing about the number of appliances.
        def bundle(title):
            return re.search(r'\s\+\s|이동형 패키지', title or '') is not None

        held = set()
        for model, title in products:
            key = code(model)
            official = by_code.get(key)
            if bundle(official['displayName'] if official else title):
                held.add(key)
        aliases = set()
        for model in known.intersection(by_code).difference(held, retired):
            for raw in by_code[model].get('labelCodes', []):
                label = code(raw)
                if label.partition('.')[0] == model and label != model and label not in known | retired:
                    aliases.add((label, model))
        # Replace the former permissive index atomically. It contains derived
        # camera rows only. Original product IDs and historical sale keys survive.
        db.execute('DROP VIEW IF EXISTS scan_code_matches')
        db.execute('DROP TABLE IF EXISTS camera_label')
        db.execute('DROP TABLE IF EXISTS camera_reference')
        db.execute('CREATE TABLE camera_label(label TEXT PRIMARY KEY, model_code TEXT NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS camera_held(model_code TEXT PRIMARY KEY)')
        db.execute('DELETE FROM camera_held')
        db.executemany('INSERT INTO camera_held VALUES (?)', [(m,) for m in sorted(held)])
        db.executemany('INSERT INTO camera_label VALUES (?,?)', sorted(aliases))
        db.execute("""CREATE VIEW scan_code_matches AS
            SELECT DISTINCT upper(trim(model_name)) scanned_code, upper(trim(model_name)) model_code,
                'miniroom' evidence FROM products p WHERE NOT EXISTS
                (SELECT 1 FROM camera_held h WHERE h.model_code=upper(trim(p.model_name)))
            UNION ALL SELECT label,model_code,'alias' FROM camera_label""")
        db.execute('CREATE TABLE IF NOT EXISTS camera_import(id INTEGER PRIMARY KEY CHECK(id=1), source_sha256 TEXT NOT NULL)')
        db.execute('INSERT OR REPLACE INTO camera_import VALUES (1,?)',(hashlib.sha256(data).hexdigest(),))
    return len(known), len(held), len(aliases)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    parser.add_argument('--db', type=Path, default=Path(__file__).resolve().parents[1] / 'data/lg_appliances.db')
    args = parser.parse_args()
    db = sqlite3.connect(args.db.resolve().as_uri() + '?mode=rw', uri=True)
    try:
        known, held, aliases = import_catalog(db, args.snapshot)
        print(f'{known} existing model codes; {held} held from new collection; {aliases} exact label aliases')
    finally:
        db.close()
