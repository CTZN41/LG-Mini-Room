-- SQLite expressions match the normalization used by both catalog clients.
CREATE INDEX IF NOT EXISTS products_by_scan_model ON products(upper(trim(model_name)), category, product_id);
CREATE INDEX IF NOT EXISTS retired_by_scan_code ON retired_sale_keys(upper(trim(sale_code)));
CREATE INDEX IF NOT EXISTS components_by_scan_code ON product_components(upper(trim(component_model)));
