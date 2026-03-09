-- Add customer_email to orders

ALTER TABLE orders
  ADD COLUMN customer_email TEXT;

