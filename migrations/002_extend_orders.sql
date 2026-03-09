-- Extend orders with customer info and display order number

ALTER TABLE orders
  ADD COLUMN customer_name TEXT NOT NULL DEFAULT '';

ALTER TABLE orders
  ADD COLUMN display_order_number TEXT NOT NULL;

ALTER TABLE orders
  ADD COLUMN delivered_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_display_order_number
  ON orders(display_order_number);

