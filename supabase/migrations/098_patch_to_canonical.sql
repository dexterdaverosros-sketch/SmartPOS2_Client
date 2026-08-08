-- ================================================================
-- PHASE SUPABASE-2 : VERIFICATION PATCH SQL (SECTION H)
-- Apply ONLY to an existing Supabase that already has the old
-- 001_init_all_tables + 002_remove_staff_profile_image +
-- 003_remove_staff_username migrations applied.
--
-- These are the MINIMAL ALTER/CREATE/DROP statements needed to
-- transform that existing state into the 099 canonical schema.
-- ================================================================
-- NO DROP TABLE statements.
-- NO full CREATE TABLE rewrites.
-- ONLY delta-safe statements.
-- ================================================================

BEGIN;

-- ----------------------------------------------------------------
-- (1) ADD MISSING COLUMNS TO audit_logs
--     (pushAllToCloud, pullAllFromCloud, createAuditLog,
--      001_initial_schema.sql ALL reference old_values/new_values)
-- ----------------------------------------------------------------
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS old_values TEXT;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS new_values TEXT;

-- ----------------------------------------------------------------
-- (2) ADD TIMESTAMPS TO settings
--     (pushAllToCloud at 099 settings sync sends created_at,
--      updated_at.  Columns were absent from 099/001 schemas.)
-- ----------------------------------------------------------------
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ----------------------------------------------------------------
-- (3) TABLES MISSING FROM THE OLD 001 MIGRATION
--     If the target has no reminders/settings/admins tables yet,
--     CREATE TABLE IF NOT EXISTS is safe and idempotent.
--     (099 declares them;  developer-service wipeTables +
--      routes /api/cloud/admins + push step 8 reference them.)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminders (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id  TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  message      TEXT NOT NULL,
  status       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reminders_message_type_check CHECK (message_type IN ('sms','email','push')),
  CONSTRAINT reminders_status_check CHECK (status IN ('queued','sent','failed','delivered'))
);

CREATE TABLE IF NOT EXISTS public.admins (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  passhash   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (For settings, the table likely already exists with composite PK.
--  If it does, skip re-create.  We handle its delta via ALTERs above.)
-- Safety: if settings does not exist at all yet, create canonical form:
CREATE TABLE IF NOT EXISTS public.settings (
  id         TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  tenant_id  TEXT NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT settings_tenant_key_unique UNIQUE (tenant_id, key)
);

-- ----------------------------------------------------------------
-- (4) GLOBAL UNIQUE -> TENANT-SCOPED COMPOSITE UNIQUE
--     Replace stale single-column uniques with the 003 composite.
--     Done via ALTER CONSTRAINT + CREATE/DROP INDEX.
--     (USERS username, STAFF staff_id, PRODUCTS barcode,
--      NON_INVENTORY_PRODUCTS barcode, SETTINGS PK)
-- ----------------------------------------------------------------

-- users.username was global unique in 001.  Must be per-tenant composite.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_username_key;
  END IF;
END $$;
ALTER TABLE public.users
  ADD CONSTRAINT IF NOT EXISTS users_tenant_username_unique
  UNIQUE (tenant_id, username);

-- staff.staff_id was global unique in 001.  Must be per-tenant composite.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_staff_id_key'
  ) THEN
    ALTER TABLE public.staff DROP CONSTRAINT staff_staff_id_key;
  END IF;
END $$;
ALTER TABLE public.staff
  ADD CONSTRAINT IF NOT EXISTS staff_tenant_staffid_unique
  UNIQUE (tenant_id, staff_id);

-- products.name was global unique in 001 schema.ts.  Drop; replace with tenant+barcode composite.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_name_key'
  ) THEN
    ALTER TABLE public.products DROP CONSTRAINT products_name_key;
  END IF;
END $$;
ALTER TABLE public.products
  ADD CONSTRAINT IF NOT EXISTS products_tenant_barcode_unique
  UNIQUE (tenant_id, barcode);

-- non_inventory_products barcode unique single -> composite
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'non_inventory_products_barcode_key'
  ) THEN
    ALTER TABLE public.non_inventory_products DROP CONSTRAINT non_inventory_products_barcode_key;
  END IF;
END $$;
ALTER TABLE public.non_inventory_products
  ADD CONSTRAINT IF NOT EXISTS non_inventory_products_tenant_barcode_unique
  UNIQUE (tenant_id, barcode);

-- settings unique (tenant_id, key) — if settings exists with composite PK, this is redundant but
-- the constraint is still enforced because the PK already covers it.  We add it as a named
-- constraint so pushAllToCloud {onConflict:'tenant_id,key'} resolves deterministically.
ALTER TABLE public.settings
  ADD CONSTRAINT IF NOT EXISTS settings_tenant_key_unique
  UNIQUE (tenant_id, key);

-- ----------------------------------------------------------------
-- (5) ADD MISSING CHECK CONSTRAINTS (NOT VALID first to be fast on big tables,
--     then VALIDATE CONSTRAINT to ensure they actually pass)
-- ----------------------------------------------------------------

-- staff enums
ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_role_check,
  ADD CONSTRAINT staff_role_check
    CHECK (role IN ('cashier','manager','admin')) NOT VALID;
ALTER TABLE public.staff VALIDATE CONSTRAINT staff_role_check;

ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_employment_status_check,
  ADD CONSTRAINT staff_employment_status_check
    CHECK (employment_status IN ('active','inactive','on_leave')) NOT VALID;
ALTER TABLE public.staff VALIDATE CONSTRAINT staff_employment_status_check;

ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_gender_check,
  ADD CONSTRAINT staff_gender_check
    CHECK (gender IS NULL OR gender IN ('male','female','other')) NOT VALID;
ALTER TABLE public.staff VALIDATE CONSTRAINT staff_gender_check;

ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_assigned_shift_check,
  ADD CONSTRAINT staff_assigned_shift_check
    CHECK (assigned_shift IS NULL OR assigned_shift IN ('morning','afternoon','evening')) NOT VALID;
ALTER TABLE public.staff VALIDATE CONSTRAINT staff_assigned_shift_check;

-- customers
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_credit_rating_check,
  ADD CONSTRAINT customers_credit_rating_check
    CHECK (credit_rating IN ('good','bad')) NOT VALID;
ALTER TABLE public.customers VALIDATE CONSTRAINT customers_credit_rating_check;

-- credits + payments amounts
ALTER TABLE public.credits
  DROP CONSTRAINT IF EXISTS credits_amount_positive,
  ADD CONSTRAINT credits_amount_positive CHECK (amount > 0) NOT VALID;
ALTER TABLE public.credits VALIDATE CONSTRAINT credits_amount_positive;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_amount_positive,
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0) NOT VALID;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_amount_positive;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_payment_method_check,
  ADD CONSTRAINT payments_payment_method_check
    CHECK (payment_method IN ('cash','gcash','bank','others')) NOT VALID;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_payment_method_check;

-- reminders
ALTER TABLE public.reminders
  DROP CONSTRAINT IF EXISTS reminders_message_type_check,
  ADD CONSTRAINT reminders_message_type_check
    CHECK (message_type IN ('sms','email','push')) NOT VALID;
ALTER TABLE public.reminders VALIDATE CONSTRAINT reminders_message_type_check;

ALTER TABLE public.reminders
  DROP CONSTRAINT IF EXISTS reminders_status_check,
  ADD CONSTRAINT reminders_status_check
    CHECK (status IN ('queued','sent','failed','delivered')) NOT VALID;
ALTER TABLE public.reminders VALIDATE CONSTRAINT reminders_status_check;

-- remittances
ALTER TABLE public.remittances
  DROP CONSTRAINT IF EXISTS remittances_status_check,
  ADD CONSTRAINT remittances_status_check
    CHECK (status IN ('pending','confirmed','rejected')) NOT VALID;
ALTER TABLE public.remittances VALIDATE CONSTRAINT remittances_status_check;

-- notifications
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check,
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('remittance','system_update','inventory_alert','security','storage')) NOT VALID;
ALTER TABLE public.notifications VALIDATE CONSTRAINT notifications_type_check;

-- security_events
ALTER TABLE public.security_events
  DROP CONSTRAINT IF EXISTS security_events_severity_check,
  ADD CONSTRAINT security_events_severity_check
    CHECK (severity IN ('low','medium','high')) NOT VALID;
ALTER TABLE public.security_events VALIDATE CONSTRAINT security_events_severity_check;

-- ----------------------------------------------------------------
-- (6) COMPOSITE + SINGLE-COLUMN INDEXES NOT IN 001
--     (All CREATE INDEX IF NOT EXISTS — idempotent.)
-- ----------------------------------------------------------------

-- From 003_composite_constraints.sql
CREATE INDEX IF NOT EXISTS idx_products_tenant_barcode    ON public.products(tenant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created       ON public.sales(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_tenant     ON public.sale_items(tenant_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name      ON public.customers(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_credits_tenant_customer    ON public.credits(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_customer   ON public.payments(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_reminders_tenant_customer  ON public.reminders(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_staff_tenant_staff_id      ON public.staff(tenant_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_username      ON public.users(tenant_id, username);
CREATE INDEX IF NOT EXISTS idx_remittances_tenant_status  ON public.remittances(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user  ON public.notifications(tenant_id, user_id);

-- From database.ts legacy inline CREATE INDEX block (high freq paths)
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

-- ----------------------------------------------------------------
-- (7) MISSING FKs FROM 001 INIT (ON DELETE CASCADE / SET NULL)
--     001_init_all_tables had zero FKs declared.
--     These are the delta ADD CONSTRAINTs.
--     NOT VALID first, then VALIDATE so we don't take full table ACCESS EXCLUSIVE for long.
-- ----------------------------------------------------------------

-- users
ALTER TABLE public.users
  ADD CONSTRAINT IF NOT EXISTS users_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT users_tenant_id_fkey;

-- staff
ALTER TABLE public.staff
  ADD CONSTRAINT IF NOT EXISTS staff_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.staff VALIDATE CONSTRAINT staff_tenant_id_fkey;

ALTER TABLE public.staff
  ADD CONSTRAINT IF NOT EXISTS staff_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.staff VALIDATE CONSTRAINT staff_user_id_fkey;

-- products
ALTER TABLE public.products
  ADD CONSTRAINT IF NOT EXISTS products_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.products VALIDATE CONSTRAINT products_tenant_id_fkey;

-- variants
ALTER TABLE public.variants
  ADD CONSTRAINT IF NOT EXISTS variants_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.variants VALIDATE CONSTRAINT variants_tenant_id_fkey;

ALTER TABLE public.variants
  ADD CONSTRAINT IF NOT EXISTS variants_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.variants VALIDATE CONSTRAINT variants_product_id_fkey;

-- non_inventory_products
ALTER TABLE public.non_inventory_products
  ADD CONSTRAINT IF NOT EXISTS non_inventory_products_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.non_inventory_products VALIDATE CONSTRAINT non_inventory_products_tenant_id_fkey;

-- sales
ALTER TABLE public.sales
  ADD CONSTRAINT IF NOT EXISTS sales_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.sales VALIDATE CONSTRAINT sales_tenant_id_fkey;

ALTER TABLE public.sales
  ADD CONSTRAINT IF NOT EXISTS sales_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE public.sales VALIDATE CONSTRAINT sales_staff_id_fkey;

-- sale_items
ALTER TABLE public.sale_items
  ADD CONSTRAINT IF NOT EXISTS sale_items_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.sale_items VALIDATE CONSTRAINT sale_items_tenant_id_fkey;

ALTER TABLE public.sale_items
  ADD CONSTRAINT IF NOT EXISTS sale_items_sale_id_fkey
  FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.sale_items VALIDATE CONSTRAINT sale_items_sale_id_fkey;

-- attendance
ALTER TABLE public.attendance
  ADD CONSTRAINT IF NOT EXISTS attendance_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.attendance VALIDATE CONSTRAINT attendance_tenant_id_fkey;

ALTER TABLE public.attendance
  ADD CONSTRAINT IF NOT EXISTS attendance_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.attendance VALIDATE CONSTRAINT attendance_staff_id_fkey;

-- login_history
ALTER TABLE public.login_history
  ADD CONSTRAINT IF NOT EXISTS login_history_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.login_history VALIDATE CONSTRAINT login_history_tenant_id_fkey;

ALTER TABLE public.login_history
  ADD CONSTRAINT IF NOT EXISTS login_history_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.login_history VALIDATE CONSTRAINT login_history_staff_id_fkey;

-- expenses
ALTER TABLE public.expenses
  ADD CONSTRAINT IF NOT EXISTS expenses_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.expenses VALIDATE CONSTRAINT expenses_tenant_id_fkey;

-- purchases
ALTER TABLE public.purchases
  ADD CONSTRAINT IF NOT EXISTS purchases_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.purchases VALIDATE CONSTRAINT purchases_tenant_id_fkey;

-- creditors
ALTER TABLE public.creditors
  ADD CONSTRAINT IF NOT EXISTS creditors_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.creditors VALIDATE CONSTRAINT creditors_tenant_id_fkey;

-- customers
ALTER TABLE public.customers
  ADD CONSTRAINT IF NOT EXISTS customers_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.customers VALIDATE CONSTRAINT customers_tenant_id_fkey;

-- credits
ALTER TABLE public.credits
  ADD CONSTRAINT IF NOT EXISTS credits_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.credits VALIDATE CONSTRAINT credits_tenant_id_fkey;

ALTER TABLE public.credits
  ADD CONSTRAINT IF NOT EXISTS credits_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.credits VALIDATE CONSTRAINT credits_customer_id_fkey;

-- payments
ALTER TABLE public.payments
  ADD CONSTRAINT IF NOT EXISTS payments_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_tenant_id_fkey;

ALTER TABLE public.payments
  ADD CONSTRAINT IF NOT EXISTS payments_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.payments VALIDATE CONSTRAINT payments_customer_id_fkey;

-- reminders
ALTER TABLE public.reminders
  ADD CONSTRAINT IF NOT EXISTS reminders_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.reminders VALIDATE CONSTRAINT reminders_tenant_id_fkey;

ALTER TABLE public.reminders
  ADD CONSTRAINT IF NOT EXISTS reminders_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.reminders VALIDATE CONSTRAINT reminders_customer_id_fkey;

-- remittances
ALTER TABLE public.remittances
  ADD CONSTRAINT IF NOT EXISTS remittances_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.remittances VALIDATE CONSTRAINT remittances_tenant_id_fkey;

ALTER TABLE public.remittances
  ADD CONSTRAINT IF NOT EXISTS remittances_staff_id_fkey
  FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.remittances VALIDATE CONSTRAINT remittances_staff_id_fkey;

-- notifications
ALTER TABLE public.notifications
  ADD CONSTRAINT IF NOT EXISTS notifications_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.notifications VALIDATE CONSTRAINT notifications_tenant_id_fkey;

-- activity_logs
ALTER TABLE public.activity_logs
  ADD CONSTRAINT IF NOT EXISTS activity_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.activity_logs VALIDATE CONSTRAINT activity_logs_tenant_id_fkey;

-- security_events
ALTER TABLE public.security_events
  ADD CONSTRAINT IF NOT EXISTS security_events_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.security_events VALIDATE CONSTRAINT security_events_tenant_id_fkey;

-- error_logs
ALTER TABLE public.error_logs
  ADD CONSTRAINT IF NOT EXISTS error_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.error_logs VALIDATE CONSTRAINT error_logs_tenant_id_fkey;

-- audit_logs
ALTER TABLE public.audit_logs
  ADD CONSTRAINT IF NOT EXISTS audit_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.audit_logs VALIDATE CONSTRAINT audit_logs_tenant_id_fkey;

-- settings
ALTER TABLE public.settings
  ADD CONSTRAINT IF NOT EXISTS settings_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE public.settings VALIDATE CONSTRAINT settings_tenant_id_fkey;

-- ----------------------------------------------------------------
-- (8) RLS ENABLE + tenant isolation policies (missing on old DBs)
--     DO block idempotent: checks first, drops old policies.
-- ----------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  rls_tables TEXT[] := ARRAY[
    'users','staff','products','variants','non_inventory_products',
    'sales','sale_items','attendance','login_history','expenses',
    'purchases','creditors','customers','credits','payments',
    'reminders','remittances','notifications','activity_logs',
    'security_events','error_logs','audit_logs','settings'
  ];
BEGIN
  FOREACH t IN ARRAY rls_tables LOOP
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

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins          ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ================================================================
-- END OF SECTION H PATCH
-- ================================================================
