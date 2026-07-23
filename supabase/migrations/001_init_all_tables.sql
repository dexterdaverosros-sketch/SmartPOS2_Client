-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id text primary key,
  store_name text not null,
  subdomain text not null unique,
  created_at timestamptz not null default now()
);

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id text primary key,
  tenant_id text not null,
  username text unique,
  email text unique,
  mobile text unique,
  password text not null,
  role text not null default 'owner',
  staff_id text,
  business_name text,
  owner_name text,
  location text,
  profile_image text,
  security_question_1 text,
  security_answer_1 text,
  security_question_2 text,
  security_answer_2 text,
  security_question_3 text,
  security_answer_3 text,
  failed_attempt_count int not null default 0,
  lockout_until timestamptz,
  created_at timestamptz not null default now()
);

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id text primary key,
  tenant_id text not null,
  name text not null unique,
  barcode text unique,
  price numeric not null,
  cost numeric default 0,
  quantity int not null default 0,
  category text default 'general',
  description text,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Variants table
CREATE TABLE IF NOT EXISTS public.variants (
  id text primary key,
  tenant_id text not null,
  product_id text not null,
  name text not null,
  barcode text,
  price numeric not null,
  cost numeric not null,
  quantity int not null default 0,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sales table
CREATE TABLE IF NOT EXISTS public.sales (
  id text primary key,
  tenant_id text not null,
  total numeric not null,
  payment_type text not null,
  payment_amount numeric not null,
  staff_id text,
  remitted boolean not null default false,
  created_at timestamptz not null default now()
);

-- Sale items table
CREATE TABLE IF NOT EXISTS public.sale_items (
  id text primary key,
  tenant_id text not null,
  sale_id text not null,
  product_id text not null,
  quantity int not null,
  price numeric not null,
  unit text default 'pieces',
  product_name text,
  is_non_inventory boolean not null default false
);

-- Staff table
CREATE TABLE IF NOT EXISTS public.staff (
  id text primary key,
  tenant_id text not null,
  user_id text,
  first_name text not null default '',
  middle_name text,
  last_name text not null default '',
  name text not null default '',
  staff_id text not null unique,
  passkey text,
  passhash text,
  role text not null default 'cashier',
  branch text,
  department text,
  employment_status text not null default 'active',
  email text,
  phone text,
  address text,
  birthdate text,
  gender text,
  date_hired text,
  assigned_shift text,
  profile_image text,
  username text unique,
  last_login timestamptz,
  password_last_changed timestamptz,
  permissions jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id text primary key,
  tenant_id text not null,
  staff_id text not null,
  date timestamptz not null,
  clock_in timestamptz,
  clock_out timestamptz,
  hours_worked numeric,
  is_late boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Login History table
CREATE TABLE IF NOT EXISTS public.login_history (
  id text primary key,
  tenant_id text not null,
  staff_id text not null,
  device_info text,
  ip_address text,
  login_time timestamptz not null,
  logout_time timestamptz,
  created_at timestamptz not null default now()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id text primary key,
  tenant_id text not null,
  description text not null,
  amount numeric not null,
  category text not null,
  date timestamptz not null
);

-- Purchases table
CREATE TABLE IF NOT EXISTS public.purchases (
  id text primary key,
  tenant_id text not null,
  product_name text not null,
  quantity int not null,
  cost numeric not null,
  supplier text,
  date timestamptz not null,
  description text,
  details text,
  expiration_date timestamptz
);

-- Non-inventory products table
CREATE TABLE IF NOT EXISTS public.non_inventory_products (
  id text primary key,
  tenant_id text not null,
  name text not null unique,
  price numeric not null,
  category text default 'general',
  description text,
  image text,
  barcode text unique,
  barcode_data text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Creditors table
CREATE TABLE IF NOT EXISTS public.creditors (
  id text primary key,
  tenant_id text not null,
  name text not null,
  amount numeric not null,
  description text,
  due_date timestamptz,
  reminder_date timestamptz,
  is_paid boolean not null default false
);

-- Customers table
CREATE TABLE IF NOT EXISTS public.customers (
  id text primary key,
  tenant_id text not null,
  name text not null,
  phone text not null,
  address text,
  credit_rating text not null default 'good',
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Credits table
CREATE TABLE IF NOT EXISTS public.credits (
  id text primary key,
  tenant_id text not null,
  customer_id text not null,
  amount numeric not null,
  due_date timestamptz,
  remarks text,
  created_at timestamptz not null default now()
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id text primary key,
  tenant_id text not null,
  customer_id text not null,
  amount numeric not null,
  payment_method text not null,
  remarks text,
  created_at timestamptz not null default now()
);

-- Remittances table
CREATE TABLE IF NOT EXISTS public.remittances (
  id text primary key,
  tenant_id text not null,
  staff_id text not null,
  staff_name text not null,
  amount numeric not null,
  transaction_count int not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id text primary key,
  tenant_id text not null,
  user_id text,
  type text not null,
  message text not null,
  data text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id text primary key,
  tenant_id text not null,
  event_type text not null,
  user_id text,
  store_id text,
  description text not null,
  metadata text,
  created_at timestamptz not null default now()
);

-- Security events table
CREATE TABLE IF NOT EXISTS public.security_events (
  id text primary key,
  tenant_id text not null,
  type text not null,
  severity text not null default 'medium',
  description text not null,
  ip_address text,
  location text,
  user_id text,
  metadata text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Error logs table
CREATE TABLE IF NOT EXISTS public.error_logs (
  id text primary key,
  tenant_id text not null,
  message text not null,
  stack text,
  route text,
  browser text,
  os text,
  user_id text,
  store_id text,
  timestamp timestamptz not null default now()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text primary key,
  tenant_id text not null,
  admin_id text,
  admin_name text,
  action text not null,
  staff_id text,
  staff_name text,
  changed_fields jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- Feature flags table
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id text primary key,
  name text not null unique,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);

-- System settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text primary key,
  value text not null,
  category text not null,
  updated_at timestamptz not null default now()
);

-- Developer sessions table
CREATE TABLE IF NOT EXISTS public.developer_sessions (
  id text primary key,
  developer_id text not null,
  token text not null,
  device_info text,
  ip_address text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Create helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_variants_tenant_id ON public.variants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_id ON public.sales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_tenant_id ON public.sale_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_staff_tenant_id ON public.staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_id ON public.attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_id ON public.attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_login_history_tenant_id ON public.login_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_login_history_staff_id ON public.login_history(staff_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON public.expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchases_tenant_id ON public.purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_non_inventory_products_tenant_id ON public.non_inventory_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_creditors_tenant_id ON public.creditors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credits_tenant_id ON public.credits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credits_customer_id ON public.credits(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_remittances_tenant_id ON public.remittances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_remittances_status ON public.remittances(status);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON public.notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_id ON public.activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_events_tenant_id ON public.security_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant_id ON public.error_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
