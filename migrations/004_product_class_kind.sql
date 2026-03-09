-- Add kind/type field to product_classes for future categorisation

ALTER TABLE product_classes
  ADD COLUMN kind TEXT;

