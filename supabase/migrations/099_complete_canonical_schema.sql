-- ================================================================
-- SmartPOS+ v2.0 — COMPLETE SUPABASE POSTGRESQL SCHEMA
-- PHASE SUPABASE-1 : FINAL CANONICAL SCHEMA
-- ================================================================
-- SOURCE OF TRUTH PRECEDENCE (applied to derive this script):
--   1. pushAllToCloud() / pullAllFromCloud() upsert payloads
--   2. /api/cloud/* route bodies & client sync service
--   3. shared/schema.ts (Drizzle + Zod)
--   4. server/migrations/001_initial_schema.sql + 003_composite_constraints.sql
--   5. supabase/migrations/001_init_all_tables.sql (fixed to drop
--      deprecated staff.profile_image & staff.username per 002/003)
--   6. server/database.ts initSchema() legacy migrations
-- ================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. CLEAN SLATE (DROP IF NEEDED)
--    Only uncomment in a throwaway environment. Production should
--    use the incremental migration runner instead of DROP.
-- ================================================================
-- DROP TABLE IF EXISTS public.developer_sessions CASCADE;
-- DROP TABLE IF EXISTS public.system_settings CASCADE;
-- DROP TABLE IF EXISTS public.feature_flags CASCADE;
-- DROP TABLE IF EXISTS public.audit_logs CASCADE;
-- DROP TABLE IF EXISTS public.error_logs CASCADE;
-- DROP TABLE IF EXISTS public.security_events CASCADE;
-- DROP TABLE IF EXISTS public.activity_logs CASCADE;
-- DROP TABLE IF EXISTS public.notifications CASCADE;
-- DROP TABLE IF EXISTS public.remittances CASCADE;
-- DROP TABLE IF EXISTS public.payments CASCADE;
-- DROP TABLE IF EXISTS public.credits CASCADE;
-- DROP TABLE IF EXISTS public.reminders CASCADE;
-- DROP TABLE IF EXISTS public.customers CASCADE;
-- DROP TABLE IF EXISTS public.creditors CASCADE;
-- DROP TABLE IF EXISTS public.purchases CASCADE;
-- DROP TABLE IF EXISTS public.expenses CASCADE;
-- DROP TABLE IF EXISTS public.login_history CASCADE;
-- DROP TABLE IF EXISTS public.attendance CASCADE;
-- DROP TABLE IF EXISTS public.sale_items CASCADE;
-- DROP TABLE IF EXISTS public.sales CASCADE;
-- DROP TABLE IF EXISTS public.non_inventory_products CASCADE;
-- DROP TABLE IF EXISTS public.settings CASCADE;
-- DROP TABLE IF EXISTS public.variants CASCADE;
-- DROP TABLE IF EXISTS public.products CASCADE;
-- DROP TABLE IF EXISTS public.staff CASCADE;
-- DROP TABLE IF EXISTS public.users CASCADE;
-- DROP TABLE IF EXISTS public.tenants CASCADE;
-- DROP TABLE IF EXISTS public.admins CASCADE;

-- ================================================================
-- 2. TENANTS (top of the FK dependency graph)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id                  TEXT PRIMARY KEY,
  store_name          TEXT NOT NULL,
  subdomain           TEXT NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 3. USERS  (admin / owner accounts linked to a tenant)
--    NOTE: users.username is KEPT (per project memory). Staff
--    equivalent column is DROPPED per 003.
-- ================================================================
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
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Composite uniqueness per 003 & 001_initial_schema.sql
  CONSTRAINT users_tenant_username_unique UNIQUE (tenant_id, username),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_mobile_unique UNIQUE (mobile)
);

-- ================================================================
-- 4. STAFF   (operators / cashiers. profile_image & username REMOVED)
-- ================================================================
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
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Enums
  CONSTRAINT staff_role_check CHECK (role IN ('cashier','manager','admin')),
  CONSTRAINT staff_employment_status_check CHECK (employment_status IN ('active','inactive','on_leave')),
  CONSTRAINT staff_gender_check CHECK (gender IS NULL OR gender IN ('male','female','other')),
  CONSTRAINT staff_assigned_shift_check CHECK (assigned_shift IS NULL OR assigned_shift IN ('morning','afternoon','evening')),
  -- Composite uniqueness per 003
  CONSTRAINT staff_tenant_staffid_unique UNIQUE (tenant_id, staff_id)
);

-- ================================================================
-- 5. PRODUCTS  (inventory items)
-- ================================================================
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
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Composite barcode uniqueness per 001_initial_schema.sql
  CONSTRAINT products_tenant_barcode_unique UNIQUE (tenant_id, barcode)
);

-- ================================================================
-- 6. VARIANTS  (child of products)
-- ================================================================
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

-- ================================================================
-- 7. NON-INVENTORY PRODUCTS  (services, fees, etc)
-- ================================================================
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
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT non_inventory_products_tenant_barcode_unique UNIQUE (tenant_id, barcode)
);

-- ================================================================
-- 8. SALES  (transaction headers)
-- ================================================================
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

-- ================================================================
-- 9. SALE_ITEMS  (line items under each sale)
-- ================================================================
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

-- ================================================================
-- 10. ATTENDANCE  (staff clock-in / clock-out)
-- ================================================================
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

-- ================================================================
-- 11. LOGIN_HISTORY  (per-staff audit of authentication events)
-- ================================================================
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

-- ================================================================
-- 12. EXPENSES  (client-side Dexie + /api/cloud/sync-expenses sync)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  amount              NUMERIC NOT NULL,
  category            TEXT NOT NULL,
  date                TIMESTAMPTZ NOT NULL
);

-- ================================================================
-- 13. PURCHASES  (stock replenishment — exists in Dexie client)
-- ================================================================
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

-- ================================================================
-- 14. CREDITORS  (suppliers / amounts the store OWES)
-- ================================================================
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

-- ================================================================
-- 15. CUSTOMERS  (people the store sells to on credit)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  phone               TEXT NOT NULL,
  address             TEXT,
  credit_rating       TEXT NOT NULL DEFAULT 'good',
  photo_url           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customers_credit_rating_check CHECK (credit_rating IN ('good','bad'))
);

-- ================================================================
-- 16. CREDITS  (individual charges / debts on a customer account)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.credits (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id         TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount              NUMERIC NOT NULL,
  due_date            TIMESTAMPTZ,
  remarks             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT credits_amount_positive CHECK (amount > 0)
);

-- ================================================================
-- 17. PAYMENTS  (customer payments toward their credit balance)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id         TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount              NUMERIC NOT NULL,
  payment_method      TEXT NOT NULL,
  remarks             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_amount_positive CHECK (amount > 0),
  CONSTRAINT payments_payment_method_check CHECK (payment_method IN ('cash','gcash','bank','others'))
);

-- ================================================================
-- 18. REMINDERS  (outbound customer credit reminders / SMS/email)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.reminders (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id         TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  message_type        TEXT NOT NULL,
  message             TEXT NOT NULL,
  status              TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reminders_message_type_check CHECK (message_type IN ('sms','email','push')),
  CONSTRAINT reminders_status_check CHECK (status IN ('queued','sent','failed','delivered'))
);

-- ================================================================
-- 19. REMITTANCES  (staff → admin daily cash remittances)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.remittances (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id            TEXT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  staff_name          TEXT NOT NULL,
  amount              NUMERIC NOT NULL,
  transaction_count   INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ,
  CONSTRAINT remittances_status_check CHECK (status IN ('pending','confirmed','rejected'))
);

-- ================================================================
-- 20. NOTIFICATIONS  (per-tenant inbox for alerts)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id             TEXT,
  type                TEXT NOT NULL,
  message             TEXT NOT NULL,
  data                TEXT,
  is_read             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_type_check CHECK (type IN ('remittance','system_update','inventory_alert','security','storage'))
);

-- ================================================================
-- 21. ACTIVITY_LOGS  (developer-dashboard activity feed)
-- ================================================================
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

-- ================================================================
-- 22. SECURITY_EVENTS  (developer defense hub events)
-- ================================================================
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
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT security_events_severity_check CHECK (severity IN ('low','medium','high'))
);

-- ================================================================
-- 23. ERROR_LOGS  (system error telemetry)
-- ================================================================
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

-- ================================================================
-- 24. AUDIT_LOGS  (staff-change admin audit trail)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  admin_id            TEXT,
  admin_name          TEXT,
  action              TEXT NOT NULL,
  staff_id            TEXT,
  staff_name          TEXT,
  changed_fields      JSONB,
  ip_address          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 25. FEATURE_FLAGS  (developer-controlled global feature toggles)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,
  enabled             BOOLEAN NOT NULL DEFAULT FALSE,
  description         TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 26. SYSTEM_SETTINGS  (developer-console global settings, PK=key)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  key                 TEXT PRIMARY KEY,
  value               TEXT NOT NULL,
  category            TEXT NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 27. DEVELOPER_SESSIONS  (developer RBAC session tokens)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.developer_sessions (
  id                  TEXT PRIMARY KEY,
  developer_id        TEXT NOT NULL,
  token               TEXT NOT NULL,
  device_info         TEXT,
  ip_address          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ
);

-- ================================================================
-- 28. SETTINGS  (per-tenant K/V store — NOT composite PK in Postgres
--     because pushAllToCloud upserts on (tenant_id, key) with a
--     synthetic UUID primary key.)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id                  TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id           TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key                 TEXT NOT NULL,
  value               TEXT NOT NULL,
  CONSTRAINT settings_tenant_key_unique UNIQUE (tenant_id, key)
);

-- ================================================================
-- 29. ADMINS  (legacy /api/cloud/admins sync target used by client
--     cloud sync. Kept as a mirror of users with name/email/passhash
--     because routes.ts POST /api/cloud/admins explicitly writes here.)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.admins (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL DEFAULT '',
  email               TEXT NOT NULL DEFAULT '',
  passhash            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 3. COMPOSITE UNIQUE CONSTRAINTS already declared inline above.
-- ================================================================
-- (see: users_tenant_username_unique, staff_tenant_staffid_unique,
--       products_tenant_barcode_unique, non_inventory_products_* ,
--       settings_tenant_key_unique)

-- ================================================================
-- 4. COMPOSITE INDEXES (tenant_id FIRST per 003_composite_constraints.sql
--    plus the single-column tenant_id index sweep from 001_init plus
--    a few additional high-frequency query paths.)
-- ================================================================

-- 003 migration composites
CREATE INDEX IF NOT EXISTS idx_products_tenant_barcode      ON public.products(tenant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created         ON public.sales(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_tenant       ON public.sale_items(tenant_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name        ON public.customers(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_credits_tenant_customer      ON public.credits(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_customer     ON public.payments(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_reminders_tenant_customer    ON public.reminders(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_staff_tenant_staff_id        ON public.staff(tenant_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_username        ON public.users(tenant_id, username);
CREATE INDEX IF NOT EXISTS idx_remittances_tenant_status    ON public.remittances(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user    ON public.notifications(tenant_id, user_id);

-- Legacy database.ts inline CREATE INDEXes (high-frequency paths)
CREATE INDEX IF NOT EXISTS idx_products_barcode             ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_updated_at          ON public.products(updated_at);
CREATE INDEX IF NOT EXISTS idx_staff_created_at             ON public.staff(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_rating             ON public.customers(credit_rating);
CREATE INDEX IF NOT EXISTS idx_credits_created_at           ON public.credits(created_at);
CREATE INDEX IF NOT EXISTS idx_credits_due_date             ON public.credits(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_created_at          ON public.payments(created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id           ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_id          ON public.attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date        ON public.attendance(tenant_id, staff_id, date);
CREATE INDEX IF NOT EXISTS idx_login_history_staff_id       ON public.login_history(staff_id);
CREATE INDEX IF NOT EXISTS idx_login_history_staff_time     ON public.login_history(tenant_id, staff_id, login_time);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date         ON public.expenses(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_purchases_tenant_date        ON public.purchases(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_creditors_tenant_paid        ON public.creditors(tenant_id, is_paid);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created    ON public.audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_created ON public.activity_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_tenant_resolved ON public.security_events(tenant_id, resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant_timestamp  ON public.error_logs(tenant_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_variants_product_id          ON public.variants(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read        ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_developer_sessions_token     ON public.developer_sessions(token);
CREATE INDEX IF NOT EXISTS idx_developer_sessions_expires   ON public.developer_sessions(expires_at);

-- ================================================================
-- 5. RLS (Row Level Security) — strict tenant isolation on every
--    business table.  Supabase enforces RLS by default when ON.
--    Policies mirror the X-Tenant-ID middleware on the server.
-- ================================================================
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'users','staff','products','variants','non_inventory_products',
    'sales','sale_items','attendance','login_history','expenses',
    'purchases','creditors','customers','credits','payments',
    'reminders','remittances','notifications','activity_logs',
    'security_events','error_logs','audit_logs','settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('
      DROP POLICY IF EXISTS %I_tenant_isolation ON public.%I;
      CREATE POLICY %I_tenant_isolation ON public.%I
        FOR ALL
        USING (auth.jwt() ->> ''tenant_id'' = tenant_id::TEXT)
        WITH CHECK (auth.jwt() ->> ''tenant_id'' = tenant_id::TEXT);
    ', t, t, t, t);
  END LOOP;
END $$;

-- Feature flags, system settings, tenants, developer_sessions, admins
-- are SUPERUSER / developer-only: no RLS tenant-scoping, but keep RLS ON
-- to block anon access and rely on service_role for server writes.
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins          ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- END OF CANONICAL SUPABASE SCHEMA
-- ================================================================
