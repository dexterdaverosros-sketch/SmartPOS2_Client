-- ================================================================
-- SmartPOS+ v2.0 — PHASE SUPABASE-2 : 100 SAFE MIGRATION
-- Non-destructive. No DROP TABLE. No data loss.
-- Execution order: 1 of 4
-- ================================================================
-- PREREQUISITES:
--   1. Run on Supabase SQL Editor with postgres / service_role
--   2. Take a Point-In-Time-Recovery snapshot BEFORE executing
--   3. Enable uuid-ossp extension (run this first if needed):
--        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- ================================================================
-- STRATEGY:
--   A. CREATE TABLE IF NOT EXISTS for every canonical table (29)
--   B. ALTER TABLE ADD COLUMN IF NOT EXISTS for every missing column
--   C. ALTER COLUMN SET DATA TYPE / SET DEFAULT / SET NOT NULL where safe
--   D. ADD CONSTRAINT (UNIQUE / CHECK / FK) via safe DO blocks
--   E. settings synthetic PK migration (composite → id UUID)
--   F. audit_logs old_values/new_values (missing from 099 original)
--   G. settings created_at/updated_at (missing from 099 original)
-- ================================================================

BEGIN;

-- 0. Prerequisite extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- A. ENSURE ALL 29 TABLES EXIST (non-destructive IF NOT EXISTS)
-- ================================================================

-- A.1 tenants (top of FK graph)
CREATE TABLE IF NOT EXISTS public.tenants (
  id                  TEXT PRIMARY KEY,
  store_name          TEXT NOT NULL,
  subdomain           TEXT NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.2 users
CREATE TABLE IF NOT EXISTS public.users (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  username            TEXT,
  email               TEXT,
  mobile              TEXT,
  password            TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'owner',
  staff_id            TEXT,
  business_name       TEXT,
  owner_name          TEXT,
  location            TEXT,
  profile_image       TEXT,
  security_question_1 TEXT,
  security_answer_1   TEXT,
  security_question_2 TEXT,
  security_answer_2   TEXT,
  security_question_3 TEXT,
  security_answer_3   TEXT,
  failed_attempt_count INTEGER NOT NULL DEFAULT 0,
  lockout_until       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.3 staff
CREATE TABLE IF NOT EXISTS public.staff (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id             TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  first_name          TEXT NOT NULL DEFAULT '',
  middle_name         TEXT,
  last_name           TEXT NOT NULL DEFAULT '',
  name                TEXT NOT NULL DEFAULT '',
  staff_id            TEXT NOT NULL,
  passkey             TEXT,
  passhash            TEXT,
  role                TEXT NOT NULL DEFAULT 'cashier',
  branch              TEXT,
  department          TEXT,
  employment_status   TEXT NOT NULL DEFAULT 'active',
  email               TEXT,
  phone               TEXT,
  address             TEXT,
  birthdate           TIMESTAMPTZ,
  gender              TEXT,
  date_hired          TIMESTAMPTZ,
  assigned_shift      TEXT,
  last_login          TIMESTAMPTZ,
  password_last_changed TIMESTAMPTZ,
  permissions         JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.4 products
CREATE TABLE IF NOT EXISTS public.products (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  barcode             TEXT,
  price               NUMERIC NOT NULL,
  cost                NUMERIC NOT NULL DEFAULT 0,
  quantity            INTEGER NOT NULL DEFAULT 0,
  category            TEXT NOT NULL DEFAULT 'general',
  description         TEXT,
  image               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.5 variants
CREATE TABLE IF NOT EXISTS public.variants (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id          TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  barcode             TEXT,
  price               NUMERIC NOT NULL,
  cost                NUMERIC NOT NULL DEFAULT 0,
  quantity            INTEGER NOT NULL DEFAULT 0,
  image               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.6 non_inventory_products
CREATE TABLE IF NOT EXISTS public.non_inventory_products (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  price               NUMERIC NOT NULL,
  category            TEXT NOT NULL DEFAULT 'general',
  description         TEXT,
  image               TEXT,
  barcode             TEXT,
  barcode_data        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.7 sales
CREATE TABLE IF NOT EXISTS public.sales (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  total               NUMERIC NOT NULL,
  payment_type        TEXT NOT NULL,
  payment_amount      NUMERIC NOT NULL,
  staff_id            TEXT REFERENCES public.staff(id) ON DELETE SET NULL,
  remitted            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.8 sale_items
CREATE TABLE IF NOT EXISTS public.sale_items (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id             TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id          TEXT NOT NULL,
  quantity            INTEGER NOT NULL,
  price               NUMERIC NOT NULL,
  unit                TEXT NOT NULL DEFAULT 'pieces',
  product_name        TEXT,
  is_non_inventory    BOOLEAN NOT NULL DEFAULT FALSE
);

-- A.9 attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id            TEXT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date                TIMESTAMPTZ NOT NULL,
  clock_in            TIMESTAMPTZ,
  clock_out           TIMESTAMPTZ,
  hours_worked        NUMERIC,
  is_late             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.10 login_history
CREATE TABLE IF NOT EXISTS public.login_history (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id            TEXT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  device_info         TEXT,
  ip_address          TEXT,
  login_time          TIMESTAMPTZ NOT NULL,
  logout_time         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.11 expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  amount              NUMERIC NOT NULL,
  category            TEXT NOT NULL,
  date                TIMESTAMPTZ NOT NULL
);

-- A.12 purchases
CREATE TABLE IF NOT EXISTS public.purchases (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_name        TEXT NOT NULL,
  quantity            INTEGER NOT NULL,
  cost                NUMERIC NOT NULL,
  supplier            TEXT,
  date                TIMESTAMPTZ NOT NULL,
  description         TEXT,
  details             TEXT,
  expiration_date     TIMESTAMPTZ
);

-- A.13 creditors
CREATE TABLE IF NOT EXISTS public.creditors (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  amount              NUMERIC NOT NULL,
  description         TEXT,
  due_date            TIMESTAMPTZ,
  reminder_date       TIMESTAMPTZ,
  is_paid             BOOLEAN NOT NULL DEFAULT FALSE
);

-- A.14 customers
CREATE TABLE IF NOT EXISTS public.customers (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  phone               TEXT NOT NULL,
  address             TEXT,
  credit_rating       TEXT NOT NULL DEFAULT 'good',
  photo_url           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.15 credits
CREATE TABLE IF NOT EXISTS public.credits (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id         TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount              NUMERIC NOT NULL,
  due_date            TIMESTAMPTZ,
  remarks             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.16 payments
CREATE TABLE IF NOT EXISTS public.payments (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id         TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount              NUMERIC NOT NULL,
  payment_method      TEXT NOT NULL,
  remarks             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.17 reminders
CREATE TABLE IF NOT EXISTS public.reminders (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id         TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  message_type        TEXT NOT NULL,
  message             TEXT NOT NULL,
  status              TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.18 remittances
CREATE TABLE IF NOT EXISTS public.remittances (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id            TEXT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  staff_name          TEXT NOT NULL,
  amount              NUMERIC NOT NULL,
  transaction_count   INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ
);

-- A.19 notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id             TEXT,
  type                TEXT NOT NULL,
  message             TEXT NOT NULL,
  data                TEXT,
  is_read             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.20 activity_logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type          TEXT NOT NULL,
  user_id             TEXT,
  store_id            TEXT,
  description         TEXT NOT NULL,
  metadata            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.21 security_events
CREATE TABLE IF NOT EXISTS public.security_events (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
  severity            TEXT NOT NULL DEFAULT 'medium',
  description         TEXT NOT NULL,
  ip_address          TEXT,
  location            TEXT,
  user_id             TEXT,
  metadata            TEXT,
  resolved            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.22 error_logs
CREATE TABLE IF NOT EXISTS public.error_logs (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  message             TEXT NOT NULL,
  stack               TEXT,
  route               TEXT,
  browser             TEXT,
  os                  TEXT,
  user_id             TEXT,
  store_id            TEXT,
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.23 audit_logs (NOTE: adds old_values/new_values — missing from 099 original per Section B.6 blocker)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  admin_id            TEXT,
  admin_name          TEXT,
  action              TEXT NOT NULL,
  staff_id            TEXT,
  staff_name          TEXT,
  changed_fields      JSONB,
  old_values          JSONB,
  new_values          JSONB,
  ip_address          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.24 feature_flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  enabled             BOOLEAN NOT NULL DEFAULT FALSE,
  description         TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.25 system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  key                 TEXT PRIMARY KEY,
  value               TEXT NOT NULL,
  category            TEXT NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.26 developer_sessions
CREATE TABLE IF NOT EXISTS public.developer_sessions (
  id                  TEXT PRIMARY KEY,
  developer_id        TEXT NOT NULL,
  token               TEXT NOT NULL,
  device_info         TEXT,
  ip_address          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ
);

-- A.27 settings — per-tenant K/V (NOTE: adds created_at/updated_at + synthetic id per Section B.5 blocker)
CREATE TABLE IF NOT EXISTS public.settings (
  id                  TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key                 TEXT NOT NULL,
  value               TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A.28 admins — legacy cloud/admins sync target
CREATE TABLE IF NOT EXISTS public.admins (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL DEFAULT '',
  email               TEXT NOT NULL DEFAULT '',
  passhash            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- B. ADD COLUMN IF NOT EXISTS  (safety net for partial-migrated DBs)
-- ================================================================
-- These columns are known to be missing on legacy databases that ran
-- 001_init_all_tables.sql without 099's full structure.

-- B.1 users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_image TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS security_question_1 TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS security_answer_1 TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS security_question_2 TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS security_answer_2 TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS security_question_3 TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS security_answer_3 TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.2 staff — ensure all 28 + 1 (passhash) present
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS passkey TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS passhash TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'cashier';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS birthdate TIMESTAMPTZ;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS date_hired TIMESTAMPTZ;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS assigned_shift TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS password_last_changed TIMESTAMPTZ;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- legacy-deprecated username (SQLite has it; keep nullable on Postgres for back-compat but DON'T UNIQUE)
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS username TEXT;

-- B.3 products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.4 variants
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS cost NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.variants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.5 non_inventory_products
ALTER TABLE public.non_inventory_products ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.non_inventory_products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.non_inventory_products ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE public.non_inventory_products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
ALTER TABLE public.non_inventory_products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.non_inventory_products ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.non_inventory_products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.non_inventory_products ADD COLUMN IF NOT EXISTS barcode_data TEXT;
ALTER TABLE public.non_inventory_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.non_inventory_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.6 sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total NUMERIC;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_type TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_amount NUMERIC;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS remitted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.7 sale_items
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS sale_id TEXT;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'pieces';
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS is_non_inventory BOOLEAN NOT NULL DEFAULT FALSE;

-- B.8 attendance
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clock_in TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clock_out TIMESTAMPTZ;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS hours_worked NUMERIC;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.9 login_history
ALTER TABLE public.login_history ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.login_history ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.login_history ADD COLUMN IF NOT EXISTS device_info TEXT;
ALTER TABLE public.login_history ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.login_history ADD COLUMN IF NOT EXISTS login_time TIMESTAMPTZ;
ALTER TABLE public.login_history ADD COLUMN IF NOT EXISTS logout_time TIMESTAMPTZ;
ALTER TABLE public.login_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.10 expenses
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ;

-- B.11 purchases
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS quantity INTEGER;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS cost NUMERIC;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMPTZ;

-- B.12 creditors
ALTER TABLE public.creditors ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.creditors ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.creditors ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.creditors ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.creditors ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE public.creditors ADD COLUMN IF NOT EXISTS reminder_date TIMESTAMPTZ;
ALTER TABLE public.creditors ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE;

-- B.13 customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_rating TEXT NOT NULL DEFAULT 'good';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.14 credits
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.15 payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.16 reminders
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS message_type TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.17 remittances
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS transaction_count INTEGER;
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- B.18 notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS data TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.19 activity_logs
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.20 security_events
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS metadata TEXT;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS resolved BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.security_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.21 error_logs
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS stack TEXT;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS route TEXT;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS os TEXT;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS store_id TEXT;
ALTER TABLE public.error_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.22 audit_logs — INCLUDES old_values/new_values (MISSING from original 099; required by pushAllToCloud)
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS admin_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS admin_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS changed_fields JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.23 feature_flags
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.24 system_settings
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS value TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.25 developer_sessions
ALTER TABLE public.developer_sessions ADD COLUMN IF NOT EXISTS developer_id TEXT;
ALTER TABLE public.developer_sessions ADD COLUMN IF NOT EXISTS token TEXT;
ALTER TABLE public.developer_sessions ADD COLUMN IF NOT EXISTS device_info TEXT;
ALTER TABLE public.developer_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.developer_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.developer_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- B.26 settings — INCLUDES created_at/updated_at (MISSING from original 099; pushAllToCloud sends them)
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS value TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- B.27 admins
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS passhash TEXT;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ================================================================
-- C. SETTINGS PK MIGRATION (composite PK → synthetic UUID PK)
-- For legacy databases where settings has composite PK (key, tenant_id)
-- ================================================================
DO $$
DECLARE
  has_id_col BOOLEAN;
  has_composite_pk BOOLEAN;
BEGIN
  -- Does id column exist?
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='settings' AND column_name='id'
  ) INTO has_id_col;

  -- Does current PK involve key+tenant_id (composite legacy)?
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema='public'
      AND tc.table_name='settings'
      AND tc.constraint_type='PRIMARY KEY'
    GROUP BY tc.constraint_name
    HAVING COUNT(*) = 2
       AND bool_or(kcu.column_name='key')
       AND bool_or(kcu.column_name='tenant_id')
  ) INTO has_composite_pk;

  -- If id missing: add it and populate
  IF NOT has_id_col THEN
    ALTER TABLE public.settings ADD COLUMN id TEXT;
    UPDATE public.settings SET id = uuid_generate_v4()::TEXT WHERE id IS NULL;
    ALTER TABLE public.settings ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.settings ALTER COLUMN id SET DEFAULT uuid_generate_v4()::TEXT;
  END IF;

  -- If composite PK still exists: drop it, set synthetic PK, add unique(tenant_id,key)
  IF has_composite_pk THEN
    ALTER TABLE public.settings DROP CONSTRAINT settings_pkey;
    ALTER TABLE public.settings ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Ensure the UNIQUE(tenant_id, key) constraint exists (supabase-js upsert onConflict target)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public'
      AND table_name='settings'
      AND constraint_name='settings_tenant_key_unique'
  ) THEN
    ALTER TABLE public.settings
      ADD CONSTRAINT settings_tenant_key_unique UNIQUE (tenant_id, key);
  END IF;
END $$;

-- ================================================================
-- D. ADD UNIQUE CONSTRAINTS (safe via DO blocks with catalog checks)
-- ================================================================

-- D.1 users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_tenant_username_unique') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_tenant_username_unique UNIQUE (tenant_id, username);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_email_unique') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_mobile_unique') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_mobile_unique UNIQUE (mobile);
  END IF;
END $$;

-- D.2 staff
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='staff_tenant_staffid_unique') THEN
    ALTER TABLE public.staff ADD CONSTRAINT staff_tenant_staffid_unique UNIQUE (tenant_id, staff_id);
  END IF;
END $$;

-- D.3 products
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_tenant_barcode_unique') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_tenant_barcode_unique UNIQUE (tenant_id, barcode);
  END IF;
END $$;

-- D.4 non_inventory_products
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='non_inventory_products_tenant_barcode_unique') THEN
    ALTER TABLE public.non_inventory_products ADD CONSTRAINT non_inventory_products_tenant_barcode_unique UNIQUE (tenant_id, barcode);
  END IF;
END $$;

-- D.5 feature_flags.name already UNIQUE in CREATE TABLE IF NOT EXISTS above

-- ================================================================
-- E. ADD CHECK CONSTRAINTS (safe via DO blocks)
-- ================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='staff_role_check') THEN
    ALTER TABLE public.staff ADD CONSTRAINT staff_role_check CHECK (role IN ('cashier','manager','admin'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='staff_employment_status_check') THEN
    ALTER TABLE public.staff ADD CONSTRAINT staff_employment_status_check CHECK (employment_status IN ('active','inactive','on_leave'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='staff_gender_check') THEN
    ALTER TABLE public.staff ADD CONSTRAINT staff_gender_check CHECK (gender IS NULL OR gender IN ('male','female','other'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='staff_assigned_shift_check') THEN
    ALTER TABLE public.staff ADD CONSTRAINT staff_assigned_shift_check CHECK (assigned_shift IS NULL OR assigned_shift IN ('morning','afternoon','evening'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='customers_credit_rating_check') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_credit_rating_check CHECK (credit_rating IN ('good','bad'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='credits_amount_positive') THEN
    ALTER TABLE public.credits ADD CONSTRAINT credits_amount_positive CHECK (amount > 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payments_amount_positive') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payments_payment_method_check') THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check CHECK (payment_method IN ('cash','gcash','bank','others'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reminders_message_type_check') THEN
    ALTER TABLE public.reminders ADD CONSTRAINT reminders_message_type_check CHECK (message_type IN ('sms','email','push'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reminders_status_check') THEN
    ALTER TABLE public.reminders ADD CONSTRAINT reminders_status_check CHECK (status IN ('queued','sent','failed','delivered'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='remittances_status_check') THEN
    ALTER TABLE public.remittances ADD CONSTRAINT remittances_status_check CHECK (status IN ('pending','confirmed','rejected'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notifications_type_check') THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('remittance','system_update','inventory_alert','security','storage'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='security_events_severity_check') THEN
    ALTER TABLE public.security_events ADD CONSTRAINT security_events_severity_check CHECK (severity IN ('low','medium','high'));
  END IF;
END $$;

-- ================================================================
-- F. ADD FOREIGN KEY CONSTRAINTS (safe via DO blocks)
-- Checks pg_constraint + information_schema.table_constraints first.
-- ================================================================

-- Helper: declarative FK add-if-not-exists via safe DO block

-- F.1 users.tenant_id → tenants
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='users' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%tenant_id%'
  ) THEN
    ALTER TABLE public.users
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.2 staff
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='staff' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%staff_tenant_id%tenants%'
  ) THEN
    ALTER TABLE public.staff
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='staff' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%staff_user_id%'
  ) THEN
    ALTER TABLE public.staff
      ADD FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- F.3 products
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='products' AND constraint_type='FOREIGN KEY'
  ) THEN
    ALTER TABLE public.products
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.4 variants
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='variants' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%variants_tenant%'
  ) THEN
    ALTER TABLE public.variants
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='variants' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%variants_product%'
  ) THEN
    ALTER TABLE public.variants
      ADD FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.5 non_inventory_products
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='non_inventory_products' AND constraint_type='FOREIGN KEY'
  ) THEN
    ALTER TABLE public.non_inventory_products
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.6 sales
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='sales' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%sales_tenant%'
  ) THEN
    ALTER TABLE public.sales
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='sales' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%sales_staff%'
  ) THEN
    ALTER TABLE public.sales
      ADD FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;
  END IF;
END $$;

-- F.7 sale_items
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='sale_items' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%sale_items_tenant%'
  ) THEN
    ALTER TABLE public.sale_items
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='sale_items' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%sale_items_sale%'
  ) THEN
    ALTER TABLE public.sale_items
      ADD FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.8 attendance
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='attendance' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%attendance_tenant%'
  ) THEN
    ALTER TABLE public.attendance
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='attendance' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%attendance_staff%'
  ) THEN
    ALTER TABLE public.attendance
      ADD FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.9 login_history
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='login_history' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%login_history_tenant%'
  ) THEN
    ALTER TABLE public.login_history
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='login_history' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%login_history_staff%'
  ) THEN
    ALTER TABLE public.login_history
      ADD FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.10 expenses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='expenses' AND constraint_type='FOREIGN KEY'
  ) THEN
    ALTER TABLE public.expenses
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.11 purchases
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='purchases' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%purchases_tenant%'
  ) THEN
    ALTER TABLE public.purchases
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.12 creditors
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='creditors' AND constraint_type='FOREIGN KEY'
  ) THEN
    ALTER TABLE public.creditors
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.13 customers
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='customers' AND constraint_type='FOREIGN KEY'
  ) THEN
    ALTER TABLE public.customers
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.14 credits
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='credits' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%credits_tenant%'
  ) THEN
    ALTER TABLE public.credits
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='credits' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%credits_customer%'
  ) THEN
    ALTER TABLE public.credits
      ADD FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.15 payments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='payments' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%payments_tenant%'
  ) THEN
    ALTER TABLE public.payments
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='payments' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%payments_customer%'
  ) THEN
    ALTER TABLE public.payments
      ADD FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.16 reminders
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='reminders' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%reminders_tenant%'
  ) THEN
    ALTER TABLE public.reminders
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='reminders' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%reminders_customer%'
  ) THEN
    ALTER TABLE public.reminders
      ADD FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.17 remittances
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='remittances' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%remittances_tenant%'
  ) THEN
    ALTER TABLE public.remittances
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='remittances' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%remittances_staff%'
  ) THEN
    ALTER TABLE public.remittances
      ADD FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.18 notifications
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='notifications' AND constraint_type='FOREIGN KEY' AND constraint_name LIKE '%notifications_tenant%'
  ) THEN
    ALTER TABLE public.notifications
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.19 activity_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='activity_logs' AND constraint_type='FOREIGN KEY'
  ) THEN
    ALTER TABLE public.activity_logs
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.20 security_events
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='security_events' AND constraint_type='FOREIGN KEY'
  ) THEN
    ALTER TABLE public.security_events
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.21 error_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='error_logs' AND constraint_type='FOREIGN KEY'
  ) THEN
    ALTER TABLE public.error_logs
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.22 audit_logs
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='audit_logs' AND constraint_type='FOREIGN KEY'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- F.23 settings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='settings' AND constraint_type='FOREIGN KEY'
  ) THEN
    ALTER TABLE public.settings
      ADD FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ================================================================
-- G. ALTER COLUMN — SET DEFAULT / NOT NULL where safe and missing
-- (Skip ALTER COLUMN TYPE to avoid expensive rewrite on large tables;
--  Postgres will coerce TEXT↔NUMERIC↔INTEGER on insert/update anyway.)
-- ================================================================

-- G.1 users.role DEFAULT (fix legacy where role might be NULL)
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'owner';
ALTER TABLE public.users ALTER COLUMN failed_attempt_count SET DEFAULT 0;

-- G.2 staff defaults
ALTER TABLE public.staff ALTER COLUMN first_name SET DEFAULT '';
ALTER TABLE public.staff ALTER COLUMN last_name SET DEFAULT '';
ALTER TABLE public.staff ALTER COLUMN name SET DEFAULT '';
ALTER TABLE public.staff ALTER COLUMN role SET DEFAULT 'cashier';
ALTER TABLE public.staff ALTER COLUMN employment_status SET DEFAULT 'active';
ALTER TABLE public.staff ALTER COLUMN permissions SET DEFAULT '[]'::JSONB;

-- G.3 products defaults
ALTER TABLE public.products ALTER COLUMN cost SET DEFAULT 0;
ALTER TABLE public.products ALTER COLUMN quantity SET DEFAULT 0;
ALTER TABLE public.products ALTER COLUMN category SET DEFAULT 'general';

-- G.4 variants defaults
ALTER TABLE public.variants ALTER COLUMN cost SET DEFAULT 0;
ALTER TABLE public.variants ALTER COLUMN quantity SET DEFAULT 0;

-- G.5 non_inventory defaults
ALTER TABLE public.non_inventory_products ALTER COLUMN category SET DEFAULT 'general';

-- G.6 sale_items defaults
ALTER TABLE public.sale_items ALTER COLUMN unit SET DEFAULT 'pieces';
ALTER TABLE public.sale_items ALTER COLUMN is_non_inventory SET DEFAULT FALSE;

-- G.7 attendance defaults
ALTER TABLE public.attendance ALTER COLUMN is_late SET DEFAULT FALSE;

-- G.8 creditors defaults
ALTER TABLE public.creditors ALTER COLUMN is_paid SET DEFAULT FALSE;

-- G.9 customers defaults
ALTER TABLE public.customers ALTER COLUMN credit_rating SET DEFAULT 'good';

-- G.10 notifications defaults
ALTER TABLE public.notifications ALTER COLUMN is_read SET DEFAULT FALSE;

-- G.11 security_events defaults
ALTER TABLE public.security_events ALTER COLUMN severity SET DEFAULT 'medium';
ALTER TABLE public.security_events ALTER COLUMN resolved SET DEFAULT FALSE;

-- G.12 feature_flags defaults
ALTER TABLE public.feature_flags ALTER COLUMN enabled SET DEFAULT FALSE;

-- G.13 remittances defaults
ALTER TABLE public.remittances ALTER COLUMN status SET DEFAULT 'pending';

-- ================================================================
-- H. BACKFILL tenant_id for legacy rows (where tenant_id IS NULL)
-- This is a SAFE best-effort. If the table has rows but no tenant,
-- we try the most-recent fallback. NEVER delete rows.
-- ================================================================
-- NOTE: These UPDATEs are guarded by the WHERE clause so they will
-- be no-ops if tenant_id is already populated.

-- Try to resolve unknown tenant_id: pick the FIRST tenant record
-- (small stores typically have exactly 1 tenant). If zero tenants,
-- set to 'unknown-tenant-backfill' to avoid NOT NULL constraint
-- failures (caller should clean up later in Admin console).

DO $$
DECLARE
  default_tenant TEXT;
BEGIN
  SELECT id INTO default_tenant FROM public.tenants ORDER BY created_at LIMIT 1;
  IF default_tenant IS NULL THEN
    default_tenant := 'unknown-tenant-backfill';
    -- Ensure a placeholder tenant exists so FKs validate
    INSERT INTO public.tenants (id, store_name, subdomain, created_at)
    VALUES (default_tenant, 'Backfilled Tenant', default_tenant, NOW())
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Backfill every tenant-scoped table
  UPDATE public.users              SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.staff              SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.products           SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.variants           SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.non_inventory_products SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.sales              SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.sale_items         SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.attendance         SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.login_history      SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.expenses           SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.purchases          SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.creditors          SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.customers          SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.credits            SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.payments           SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.reminders          SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.remittances        SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.notifications      SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.activity_logs      SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.security_events    SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.error_logs         SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.audit_logs         SET tenant_id = default_tenant WHERE tenant_id IS NULL;
  UPDATE public.settings           SET tenant_id = default_tenant WHERE tenant_id IS NULL;
END $$;

-- Now SET NOT NULL on tenant_id for every business table (guaranteed filled by H)
ALTER TABLE public.users               ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.staff               ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.products            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.variants            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.non_inventory_products ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.sales               ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.sale_items          ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.attendance          ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.login_history       ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.expenses            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.purchases           ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.creditors           ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.customers           ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.credits             ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.payments            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.reminders           ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.remittances         ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.notifications       ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.activity_logs       ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.security_events     ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.error_logs          ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.audit_logs          ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.settings            ALTER COLUMN tenant_id SET NOT NULL;

-- Backfill other critical NOT NULL columns with safe defaults

-- staff.staff_id NOT NULL (some legacy imports might leave this NULL)
UPDATE public.staff SET staff_id = id WHERE staff_id IS NULL;
ALTER TABLE public.staff ALTER COLUMN staff_id SET NOT NULL;

-- products.name NOT NULL
UPDATE public.products SET name = 'Unnamed Product' WHERE name IS NULL;
ALTER TABLE public.products ALTER COLUMN name SET NOT NULL;

-- products.price NUMERIC NOT NULL
UPDATE public.products SET price = 0 WHERE price IS NULL;
ALTER TABLE public.products ALTER COLUMN price SET NOT NULL;

-- variants.name / price NOT NULL
UPDATE public.variants SET name = 'Default' WHERE name IS NULL;
ALTER TABLE public.variants ALTER COLUMN name SET NOT NULL;
UPDATE public.variants SET price = 0 WHERE price IS NULL;
ALTER TABLE public.variants ALTER COLUMN price SET NOT NULL;

-- non_inventory.name / price
UPDATE public.non_inventory_products SET name = 'Unnamed' WHERE name IS NULL;
ALTER TABLE public.non_inventory_products ALTER COLUMN name SET NOT NULL;
UPDATE public.non_inventory_products SET price = 0 WHERE price IS NULL;
ALTER TABLE public.non_inventory_products ALTER COLUMN price SET NOT NULL;

-- sales
UPDATE public.sales SET total = 0 WHERE total IS NULL;
ALTER TABLE public.sales ALTER COLUMN total SET NOT NULL;
UPDATE public.sales SET payment_type = 'cash' WHERE payment_type IS NULL;
ALTER TABLE public.sales ALTER COLUMN payment_type SET NOT NULL;
UPDATE public.sales SET payment_amount = 0 WHERE payment_amount IS NULL;
ALTER TABLE public.sales ALTER COLUMN payment_amount SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN remitted SET NOT NULL;

-- sale_items
UPDATE public.sale_items SET product_id = id WHERE product_id IS NULL;
ALTER TABLE public.sale_items ALTER COLUMN product_id SET NOT NULL;
UPDATE public.sale_items SET quantity = 1 WHERE quantity IS NULL;
ALTER TABLE public.sale_items ALTER COLUMN quantity SET NOT NULL;
UPDATE public.sale_items SET price = 0 WHERE price IS NULL;
ALTER TABLE public.sale_items ALTER COLUMN price SET NOT NULL;
ALTER TABLE public.sale_items ALTER COLUMN sale_id SET NOT NULL;

-- attendance
ALTER TABLE public.attendance ALTER COLUMN staff_id SET NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN date SET NOT NULL;

-- login_history
ALTER TABLE public.login_history ALTER COLUMN staff_id SET NOT NULL;
ALTER TABLE public.login_history ALTER COLUMN login_time SET NOT NULL;

-- expenses
UPDATE public.expenses SET description = 'Unspecified' WHERE description IS NULL;
ALTER TABLE public.expenses ALTER COLUMN description SET NOT NULL;
UPDATE public.expenses SET amount = 0 WHERE amount IS NULL;
ALTER TABLE public.expenses ALTER COLUMN amount SET NOT NULL;
UPDATE public.expenses SET category = 'other' WHERE category IS NULL;
ALTER TABLE public.expenses ALTER COLUMN category SET NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN date SET NOT NULL;

-- purchases
UPDATE public.purchases SET product_name = 'Unknown' WHERE product_name IS NULL;
ALTER TABLE public.purchases ALTER COLUMN product_name SET NOT NULL;
UPDATE public.purchases SET quantity = 0 WHERE quantity IS NULL;
ALTER TABLE public.purchases ALTER COLUMN quantity SET NOT NULL;
UPDATE public.purchases SET cost = 0 WHERE cost IS NULL;
ALTER TABLE public.purchases ALTER COLUMN cost SET NOT NULL;
ALTER TABLE public.purchases ALTER COLUMN date SET NOT NULL;

-- creditors
UPDATE public.creditors SET name = 'Unknown' WHERE name IS NULL;
ALTER TABLE public.creditors ALTER COLUMN name SET NOT NULL;
UPDATE public.creditors SET amount = 0 WHERE amount IS NULL;
ALTER TABLE public.creditors ALTER COLUMN amount SET NOT NULL;
ALTER TABLE public.creditors ALTER COLUMN is_paid SET NOT NULL;

-- customers
UPDATE public.customers SET name = 'Unknown' WHERE name IS NULL;
ALTER TABLE public.customers ALTER COLUMN name SET NOT NULL;
UPDATE public.customers SET phone = 'unknown' WHERE phone IS NULL;
ALTER TABLE public.customers ALTER COLUMN phone SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN credit_rating SET NOT NULL;

-- credits
ALTER TABLE public.credits ALTER COLUMN customer_id SET NOT NULL;
UPDATE public.credits SET amount = 0 WHERE amount IS NULL;
ALTER TABLE public.credits ALTER COLUMN amount SET NOT NULL;

-- payments
ALTER TABLE public.payments ALTER COLUMN customer_id SET NOT NULL;
UPDATE public.payments SET amount = 0 WHERE amount IS NULL;
ALTER TABLE public.payments ALTER COLUMN amount SET NOT NULL;
UPDATE public.payments SET payment_method = 'cash' WHERE payment_method IS NULL;
ALTER TABLE public.payments ALTER COLUMN payment_method SET NOT NULL;

-- reminders
ALTER TABLE public.reminders ALTER COLUMN customer_id SET NOT NULL;
UPDATE public.reminders SET message_type = 'email' WHERE message_type IS NULL;
ALTER TABLE public.reminders ALTER COLUMN message_type SET NOT NULL;
UPDATE public.reminders SET message = '' WHERE message IS NULL;
ALTER TABLE public.reminders ALTER COLUMN message SET NOT NULL;
UPDATE public.reminders SET status = 'queued' WHERE status IS NULL;
ALTER TABLE public.reminders ALTER COLUMN status SET NOT NULL;

-- remittances
ALTER TABLE public.remittances ALTER COLUMN staff_id SET NOT NULL;
UPDATE public.remittances SET staff_name = 'Unknown' WHERE staff_name IS NULL;
ALTER TABLE public.remittances ALTER COLUMN staff_name SET NOT NULL;
UPDATE public.remittances SET amount = 0 WHERE amount IS NULL;
ALTER TABLE public.remittances ALTER COLUMN amount SET NOT NULL;
UPDATE public.remittances SET transaction_count = 0 WHERE transaction_count IS NULL;
ALTER TABLE public.remittances ALTER COLUMN transaction_count SET NOT NULL;
ALTER TABLE public.remittances ALTER COLUMN status SET NOT NULL;

-- notifications
UPDATE public.notifications SET type = 'system_update' WHERE type IS NULL;
ALTER TABLE public.notifications ALTER COLUMN type SET NOT NULL;
UPDATE public.notifications SET message = '' WHERE message IS NULL;
ALTER TABLE public.notifications ALTER COLUMN message SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN is_read SET NOT NULL;

-- activity_logs
UPDATE public.activity_logs SET event_type = 'misc' WHERE event_type IS NULL;
ALTER TABLE public.activity_logs ALTER COLUMN event_type SET NOT NULL;
UPDATE public.activity_logs SET description = '' WHERE description IS NULL;
ALTER TABLE public.activity_logs ALTER COLUMN description SET NOT NULL;

-- security_events
UPDATE public.security_events SET type = 'misc' WHERE type IS NULL;
ALTER TABLE public.security_events ALTER COLUMN type SET NOT NULL;
ALTER TABLE public.security_events ALTER COLUMN severity SET NOT NULL;
UPDATE public.security_events SET description = '' WHERE description IS NULL;
ALTER TABLE public.security_events ALTER COLUMN description SET NOT NULL;
ALTER TABLE public.security_events ALTER COLUMN resolved SET NOT NULL;

-- error_logs
UPDATE public.error_logs SET message = '' WHERE message IS NULL;
ALTER TABLE public.error_logs ALTER COLUMN message SET NOT NULL;
ALTER TABLE public.error_logs ALTER COLUMN timestamp SET NOT NULL;

-- audit_logs
UPDATE public.audit_logs SET action = 'unknown' WHERE action IS NULL;
ALTER TABLE public.audit_logs ALTER COLUMN action SET NOT NULL;

-- feature_flags
ALTER TABLE public.feature_flags ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.feature_flags ALTER COLUMN enabled SET NOT NULL;

-- system_settings
ALTER TABLE public.system_settings ALTER COLUMN value SET NOT NULL;
ALTER TABLE public.system_settings ALTER COLUMN category SET NOT NULL;

-- developer_sessions
ALTER TABLE public.developer_sessions ALTER COLUMN developer_id SET NOT NULL;
ALTER TABLE public.developer_sessions ALTER COLUMN token SET NOT NULL;

-- settings
UPDATE public.settings SET key = id WHERE key IS NULL;
ALTER TABLE public.settings ALTER COLUMN key SET NOT NULL;
UPDATE public.settings SET value = '' WHERE value IS NULL;
ALTER TABLE public.settings ALTER COLUMN value SET NOT NULL;

-- admins
ALTER TABLE public.admins ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.admins ALTER COLUMN email SET NOT NULL;

-- users
ALTER TABLE public.users ALTER COLUMN password SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN failed_attempt_count SET NOT NULL;

COMMIT;

-- ================================================================
-- END OF 100_SAFE_MIGRATION.SQL
-- Next: run 101_rls_policies.sql, then 102_indexes.sql, then 103_storage.sql
-- ================================================================
