-- ==============================================
-- SMART POS MULTI-TENANT SUPABASE SETUP
-- ==============================================

-- 1. Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create users table with tenant isolation
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  username VARCHAR(100) UNIQUE,
  email VARCHAR(100) UNIQUE,
  mobile VARCHAR(20) UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  staff_id UUID,
  business_name VARCHAR(255),
  owner_name VARCHAR(100),
  location VARCHAR(255),
  profile_image TEXT,
  security_question_1 TEXT,
  security_answer_1 TEXT,
  security_question_2 TEXT,
  security_answer_2 TEXT,
  security_question_3 TEXT,
  security_answer_3 TEXT,
  failed_attempt_count INT DEFAULT 0,
  lockout_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create products table with tenant isolation
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  barcode VARCHAR(100) UNIQUE,
  price NUMERIC(10,2) NOT NULL,
  cost NUMERIC(10,2) DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  category VARCHAR(100) DEFAULT 'general',
  description TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create variants table
CREATE TABLE IF NOT EXISTS variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  barcode VARCHAR(100),
  price NUMERIC(10,2) NOT NULL,
  cost NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create staff table
CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  staff_id VARCHAR(100) NOT NULL UNIQUE,
  passhash VARCHAR(255) NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  total NUMERIC(10,2) NOT NULL,
  payment_type VARCHAR(50) NOT NULL,
  payment_amount NUMERIC(10,2) NOT NULL,
  staff_id UUID,
  remitted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create sale_items table
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'pieces',
  product_name VARCHAR(255),
  is_non_inventory BOOLEAN DEFAULT FALSE
);

-- 8. Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  date TIMESTAMPTZ NOT NULL
);

-- 9. Create purchases table
CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  cost NUMERIC(10,2) NOT NULL,
  supplier VARCHAR(255),
  date TIMESTAMPTZ NOT NULL,
  description TEXT,
  details TEXT,
  expiration_date TIMESTAMPTZ
);

-- 10. Create non_inventory_products table
CREATE TABLE IF NOT EXISTS non_inventory_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  description TEXT,
  image TEXT,
  barcode VARCHAR(100) UNIQUE,
  barcode_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Create creditors table
CREATE TABLE IF NOT EXISTS creditors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  reminder_date TIMESTAMPTZ,
  is_paid BOOLEAN DEFAULT FALSE
);

-- 12. Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address TEXT,
  credit_rating VARCHAR(20) NOT NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- 13. Create credits table
CREATE TABLE IF NOT EXISTS credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  due_date TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

-- 14. Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

-- 15. Create remittances table
CREATE TABLE IF NOT EXISTS remittances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  staff_id UUID NOT NULL,
  staff_name VARCHAR(255) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  transaction_count INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- 16. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ==============================================

-- Add tenant_id to users table if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenant_id') THEN
    ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;

-- Add tenant_id to products table if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='tenant_id') THEN
    ALTER TABLE products ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;

-- Add barcode to products table if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='barcode') THEN
    ALTER TABLE products ADD COLUMN barcode VARCHAR(100) UNIQUE;
  END IF;
END $$;

-- Add tenant_id to variants table if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='variants' AND column_name='tenant_id') THEN
    ALTER TABLE variants ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;

-- Add tenant_id to staff table if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='tenant_id') THEN
    ALTER TABLE staff ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;

-- Add tenant_id to sales table if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='tenant_id') THEN
    ALTER TABLE sales ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;

-- Add tenant_id to sale_items table if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='tenant_id') THEN
    ALTER TABLE sale_items ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;

-- Add tenant_id to customers table if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='tenant_id') THEN
    ALTER TABLE customers ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;

-- Add tenant_id to non_inventory_products table if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='non_inventory_products' AND column_name='tenant_id') THEN
    ALTER TABLE non_inventory_products ADD COLUMN tenant_id UUID REFERENCES tenants(id);
  END IF;
END $$;

-- ==============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
-- Only create barcode index if barcode column exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='barcode') THEN
    CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_variants_tenant ON variants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_id ON staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant ON sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_tenant ON sale_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credits_tenant ON credits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remittances_tenant ON remittances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);

-- ==============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE non_inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditors ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- NOTE ABOUT RLS POLICIES
-- ==============================================
-- IMPORTANT: Since you're using a backend (Express) to connect to Supabase,
-- you don't need strict RLS policies because your backend is the one making
-- requests to Supabase. However, if you want to secure your data, you can use:

-- Option 1: Disable RLS (recommended if using backend only)
-- ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
-- (repeat for other tables)

-- Option 2: Allow full access from backend using service_role
-- If you're using the service_role key (as you should for backend),
-- it bypasses RLS anyway! So no need for policies.

-- Option 3: If you want to use RLS for future frontend direct access:
-- (These are example policies)

-- -- Tenants: Allow public read, but only backend can write
-- CREATE POLICY "Enable read access for all users" ON tenants FOR SELECT USING (true);

-- -- Users: Only allow access to same tenant
-- CREATE POLICY "Tenant isolation for users" ON users USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- -- Products: Only allow access to same tenant
-- CREATE POLICY "Tenant isolation for products" ON products USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- But again, since your backend is using service_role, RLS won't affect it!

-- ==============================================
-- INSERT TEST DATA (OPTIONAL)
-- ==============================================

-- Uncomment below to add test tenant:

-- INSERT INTO tenants (store_name, subdomain)
-- VALUES ('Masing Bakery', 'masingbakery');
