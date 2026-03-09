-- Initial schema for product catalog and ordering

PRAGMA foreign_keys = ON;

-- Product categories / classes
CREATE TABLE IF NOT EXISTS product_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  ordering INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_classes_ordering
  ON product_classes(ordering);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_class_id INTEGER NOT NULL REFERENCES product_classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  ordering INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_products_class_ordering
  ON products(product_class_id, ordering);

CREATE INDEX IF NOT EXISTS idx_products_active_class
  ON products(active, product_class_id, ordering);

-- Customization options that can attach to a product OR a product_class
CREATE TABLE IF NOT EXISTS customization_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_class_id INTEGER REFERENCES product_classes(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  options TEXT,
  ordering INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_customization_options_product
  ON customization_options(product_id, ordering);

CREATE INDEX IF NOT EXISTS idx_customization_options_product_class
  ON customization_options(product_class_id, ordering);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON orders(status, created_at DESC);

-- Order line items
CREATE TABLE IF NOT EXISTS order_line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL,
  customizations_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_order_line_items_order
  ON order_line_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_line_items_product
  ON order_line_items(product_id);

