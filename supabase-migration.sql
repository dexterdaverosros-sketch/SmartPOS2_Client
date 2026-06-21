-- ============================================
-- SmartPOS v2 Supabase Multi-Tenant Schema
-- ============================================

-- ============================================
-- Helper Function to get current tenant ID
-- ============================================
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
BEGIN
  -- Get tenant_id from auth.jwt() claims
  RETURN (auth.jwt() ->> 'tenant_id')::UUID;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Table: tenants
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: users (admins)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
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
    failed_attempt_count INTEGER DEFAULT 0,
    lockout_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: staff
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    staff_id TEXT UNIQUE NOT NULL,
    passkey TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: products
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    cost NUMERIC DEFAULT 0,
    barcode TEXT UNIQUE NOT NULL,
    category TEXT,
    image TEXT,
    quantity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: variants
-- ============================================
CREATE TABLE IF NOT EXISTS variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    barcode TEXT,
    price NUMERIC NOT NULL,
    cost NUMERIC NOT NULL,
    image TEXT,
    quantity INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: customers
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    credit_rating TEXT NOT NULL CHECK (credit_rating IN ('good','bad')),
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: credits (ledger)
-- ============================================
CREATE TABLE IF NOT EXISTS credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    due_date TIMESTAMPTZ,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: payments (ledger)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: reminders
-- ============================================
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: non_inventory_products
-- ============================================
CREATE TABLE IF NOT EXISTS non_inventory_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    category TEXT,
    description TEXT,
    image TEXT,
    barcode TEXT UNIQUE NOT NULL,
    barcode_data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: sales
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    total NUMERIC NOT NULL,
    payment_type TEXT NOT NULL,
    payment_amount NUMERIC NOT NULL,
    staff_id TEXT,
    remitted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: sale_items
-- ============================================
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC NOT NULL,
    unit TEXT DEFAULT 'pieces',
    product_name TEXT,
    is_non_inventory BOOLEAN DEFAULT FALSE
);

-- ============================================
-- Table: remittances
-- ============================================
CREATE TABLE IF NOT EXISTS remittances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    staff_id TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    transaction_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

-- ============================================
-- Table: notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: expenses
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    description TEXT,
    category TEXT,
    amount NUMERIC NOT NULL,
    date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: purchases
-- ============================================
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    product_name TEXT,
    supplier TEXT,
    amount NUMERIC,
    date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Table: settings
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, key)
);

-- ============================================
-- Disable Row Level Security (RLS) for all tables
-- since backend uses service_role key to bypass RLS
-- ============================================
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE credits DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE reminders DISABLE ROW LEVEL SECURITY;
ALTER TABLE non_inventory_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE remittances DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for tenants
-- ============================================
CREATE POLICY "Tenants can view their own data" 
  ON tenants 
  FOR SELECT 
  USING (id = current_tenant_id());

CREATE POLICY "Tenants can update their own data" 
  ON tenants 
  FOR UPDATE 
  USING (id = current_tenant_id());

-- ============================================
-- RLS Policies for users
-- ============================================
CREATE POLICY "Users can view their own tenant's users" 
  ON users 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Users can insert their own tenant's users" 
  ON users 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Users can update their own tenant's users" 
  ON users 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for staff
-- ============================================
CREATE POLICY "Staff can view their own tenant's staff" 
  ON staff 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Staff can insert their own tenant's staff" 
  ON staff 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Staff can update their own tenant's staff" 
  ON staff 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Staff can delete their own tenant's staff" 
  ON staff 
  FOR DELETE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for products
-- ============================================
CREATE POLICY "Products can view their own tenant's products" 
  ON products 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Products can insert their own tenant's products" 
  ON products 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Products can update their own tenant's products" 
  ON products 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Products can delete their own tenant's products" 
  ON products 
  FOR DELETE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for variants
-- ============================================
CREATE POLICY "Variants can view their own tenant's variants" 
  ON variants 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Variants can insert their own tenant's variants" 
  ON variants 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Variants can update their own tenant's variants" 
  ON variants 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Variants can delete their own tenant's variants" 
  ON variants 
  FOR DELETE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for customers
-- ============================================
CREATE POLICY "Customers can view their own tenant's customers" 
  ON customers 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Customers can insert their own tenant's customers" 
  ON customers 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Customers can update their own tenant's customers" 
  ON customers 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Customers can delete their own tenant's customers" 
  ON customers 
  FOR DELETE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for credits
-- ============================================
CREATE POLICY "Credits can view their own tenant's credits" 
  ON credits 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Credits can insert their own tenant's credits" 
  ON credits 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Credits can update their own tenant's credits" 
  ON credits 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Credits can delete their own tenant's credits" 
  ON credits 
  FOR DELETE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for payments
-- ============================================
CREATE POLICY "Payments can view their own tenant's payments" 
  ON payments 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Payments can insert their own tenant's payments" 
  ON payments 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Payments can update their own tenant's payments" 
  ON payments 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Payments can delete their own tenant's payments" 
  ON payments 
  FOR DELETE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for reminders
-- ============================================
CREATE POLICY "Reminders can view their own tenant's reminders" 
  ON reminders 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Reminders can insert their own tenant's reminders" 
  ON reminders 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Reminders can update their own tenant's reminders" 
  ON reminders 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Reminders can delete their own tenant's reminders" 
  ON reminders 
  FOR DELETE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for non_inventory_products
-- ============================================
CREATE POLICY "Non-inventory products can view their own tenant's data" 
  ON non_inventory_products 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Non-inventory products can insert their own tenant's data" 
  ON non_inventory_products 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Non-inventory products can update their own tenant's data" 
  ON non_inventory_products 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Non-inventory products can delete their own tenant's data" 
  ON non_inventory_products 
  FOR DELETE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for sales
-- ============================================
CREATE POLICY "Sales can view their own tenant's sales" 
  ON sales 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Sales can insert their own tenant's sales" 
  ON sales 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Sales can update their own tenant's sales" 
  ON sales 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for sale_items
-- ============================================
CREATE POLICY "Sale items can view their own tenant's data" 
  ON sale_items 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Sale items can insert their own tenant's data" 
  ON sale_items 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for remittances
-- ============================================
CREATE POLICY "Remittances can view their own tenant's data" 
  ON remittances 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Remittances can insert their own tenant's data" 
  ON remittances 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Remittances can update their own tenant's data" 
  ON remittances 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for notifications
-- ============================================
CREATE POLICY "Notifications can view their own tenant's data" 
  ON notifications 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Notifications can insert their own tenant's data" 
  ON notifications 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Notifications can update their own tenant's data" 
  ON notifications 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for expenses
-- ============================================
CREATE POLICY "Expenses can view their own tenant's expenses" 
  ON expenses 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Expenses can insert their own tenant's expenses" 
  ON expenses 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Expenses can update their own tenant's expenses" 
  ON expenses 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Expenses can delete their own tenant's expenses" 
  ON expenses 
  FOR DELETE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for purchases
-- ============================================
CREATE POLICY "Purchases can view their own tenant's purchases" 
  ON purchases 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Purchases can insert their own tenant's purchases" 
  ON purchases 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Purchases can update their own tenant's purchases" 
  ON purchases 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Purchases can delete their own tenant's purchases" 
  ON purchases 
  FOR DELETE 
  USING (tenant_id = current_tenant_id());

-- ============================================
-- RLS Policies for settings
-- ============================================
CREATE POLICY "Settings can view their own tenant's settings" 
  ON settings 
  FOR SELECT 
  USING (tenant_id = current_tenant_id());

CREATE POLICY "Settings can insert their own tenant's settings" 
  ON settings 
  FOR INSERT 
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY "Settings can update their own tenant's settings" 
  ON settings 
  FOR UPDATE 
  USING (tenant_id = current_tenant_id());
