"""Merge a reviewed LG AI Home snapshot into the room catalog."""
import argparse
from contextlib import closing
from hashlib import sha256
from pathlib import Path
import sqlite3


def merge(source, target):
    digest = sha256(source.read_bytes()).hexdigest()
    includes_hub = digest == 'd230602c31d3735fd2592e2da22d16a722d81ce0b972524f5e54162185b0ea7b'
    if not includes_hub and digest != 'feb42ce42c57295e4db982c64b257b2e71a2e4a6912c8479f85c0fda6b80869d':
        raise ValueError('Expected a reviewed LG AI Home database')
    with closing(sqlite3.connect(target.resolve().as_uri() + '?mode=rw', uri=True)) as db:
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('ATTACH ? AS incoming', (source.resolve().as_uri() + '?mode=ro',))
        with db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('''CREATE TABLE IF NOT EXISTS ai_home_source(
                product_id INTEGER PRIMARY KEY REFERENCES products, product_url TEXT NOT NULL UNIQUE,
                release_text TEXT NOT NULL, collected_on TEXT NOT NULL)''')
            if db.execute('''SELECT 1 FROM main.products p JOIN incoming.products i
                USING(category,model_name) WHERE i.product_id<>p.product_id LIMIT 1''').fetchone():
                raise ValueError('Model already exists under a different ID')
            for digest, blob in db.execute('SELECT sha256,data FROM incoming.images'):
                if sha256(blob).hexdigest() != digest:
                    raise ValueError('Source image checksum mismatch')
            tables = ['images', 'appearance_groups', 'products', 'product_components', 'ai_home_source']
            if includes_hub:
                db.execute('''CREATE TABLE IF NOT EXISTS install_options(
                    product_id INTEGER NOT NULL REFERENCES products, page_title TEXT NOT NULL,
                    product_url TEXT PRIMARY KEY)''')
                tables.append('install_options')
            for table in tables:
                db.execute(f'''INSERT INTO main.{table} SELECT * FROM incoming.{table}
                    EXCEPT SELECT * FROM main.{table}''')
            if db.execute('PRAGMA foreign_key_check').fetchone() or db.execute('PRAGMA integrity_check').fetchone() != ('ok',):
                raise ValueError('Catalog integrity check failed')
            print(f'{db.total_changes} rows added across catalog tables')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('catalog', type=Path)
    args = parser.parse_args()
    merge(args.source, args.catalog)
