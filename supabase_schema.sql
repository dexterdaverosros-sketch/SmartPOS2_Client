-- ==============================================
-- SmartPOS Supabase Database Schema
-- Run this in Supabase SQL Editor to create all tables
-- ==============================================

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (NOW())
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  cost NUMERIC DEFAULT 0,
  barcode TEXT UNIQUE NOT NULL,
  category TEXT,
  image TEXT,
  quantity INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 3. Variants Table
CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  barcode TEXT,
  price NUMERIC NOT NULL,
  cost NUMERIC NOT NULL,
  image TEXT,
  quantity INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 4. Staff Table (with both passkey and passhash for compatibility)
CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  staff_id TEXT UNIQUE NOT NULL,
  passkey TEXT,
  passhash TEXT,
  created_by TEXT,
  created_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 5. Users (Admins) Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  business_name TEXT,
  owner_name TEXT,
  mobile TEXT,
  profile_image TEXT,
  security_question_1 TEXT,
  security_answer_1 TEXT,
  security_question_2 TEXT,
  security_answer_2 TEXT,
  security_question_3 TEXT,
  security_answer_3 TEXT,
  created_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 6. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  credit_rating TEXT NOT NULL CHECK (credit_rating IN ('good','bad')),
  photo_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 7. Credits (Ledger) Table
CREATE TABLE IF NOT EXISTS credits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  due_date TEXT,
  remarks TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 8. Payments (Ledger) Table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  remarks TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 9. Reminders Table
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT,
  message_type TEXT,
  message TEXT,
  status TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- 10. Non-Inventory Products Table
CREATE TABLE IF NOT EXISTS non_inventory_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  category TEXT,
  description TEXT,
  image TEXT,
  barcode TEXT,
  barcode_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- 11. Sales Table
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  total NUMERIC NOT NULL,
  payment_type TEXT,
  payment_amount NUMERIC,
  staff_id TEXT,
  remitted BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

-- 12. Sale Items Table
CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  product_id TEXT,
  quantity INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  unit TEXT DEFAULT 'pieces',
  product_name TEXT,
  is_non_inventory BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- 13. Remittances Table
CREATE TABLE IF NOT EXISTS remittances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT,
  staff_name TEXT,
  amount NUMERIC NOT NULL,
  transaction_count INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

-- 14. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 15. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- ==============================================
-- Enable Row Level Security (optional but recommended)
-- ==============================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access (your backend uses service role key)
CREATE POLICY "Enable all for service role" ON tenants
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON products
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON variants
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON staff
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON users
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON customers
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON credits
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON payments
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON reminders
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON non_inventory_products
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON sales
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON sale_items
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON remittances
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON notifications
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for service role" ON settings
  FOR ALL USING (true) WITH CHECK (true);

-- ==============================================
-- Schema creation complete!
-- ==============================================
