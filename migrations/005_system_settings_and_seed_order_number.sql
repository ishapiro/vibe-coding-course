-- Create system_settings key-value table and seed last_order_number

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO system_settings (key, value)
VALUES ('last_order_number', '0');

INSERT OR IGNORE INTO system_settings (key, value)
VALUES ('thank_you_message', 'Your order will be ready shortly');

