-- Retire only standalone Mini Wash sales. Components of other products keep their IDs.
PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;
CREATE TEMP TABLE retired_mini_sales AS
SELECT p.product_id FROM products p JOIN appearance_groups g USING(group_id)
WHERE p.category='세탁기' AND g.photo_subject='미니워시'
  AND EXISTS (SELECT 1 FROM product_components c WHERE c.product_id=p.product_id
              AND c.component_role='미니워시' AND c.component_model=p.title_model)
  AND NOT EXISTS (SELECT 1 FROM product_components c WHERE c.product_id=p.product_id
                  AND (c.component_role<>'미니워시' OR c.component_model<>p.title_model));
DELETE FROM product_components WHERE product_id IN (SELECT product_id FROM retired_mini_sales);
DELETE FROM products WHERE product_id IN (SELECT product_id FROM retired_mini_sales);
DROP TABLE retired_mini_sales;
COMMIT;
