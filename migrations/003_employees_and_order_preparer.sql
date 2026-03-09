-- Add employees table and link to orders as current preparer

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE orders
  ADD COLUMN preparing_employee_id INTEGER REFERENCES employees(id);

CREATE INDEX IF NOT EXISTS idx_orders_preparing_employee
  ON orders(preparing_employee_id);

