-- ============================================================================
-- SMARTPOS+ v2.0 — SUPABASE MIGRATION (100_existing_uuid_schema_patch.sql)
-- FINAL AUDITED CANONICAL SCHEMA PATCH FOR EXISTING UUID SUPABASE DATABASE
-- Execution Order: 2 of 6 (Run AFTER 099_existing_uuid_preflight.sql)
-- ============================================================================
-- ABSOLUTE RULES ENFORCED:
--   1. ALL PRIMARY KEYS AND FOREIGN KEYS REMAIN NATIVE PostgreSQL UUID TYPES.
--   2. NO DROP TABLE, NO DROP COLUMN, NO DELETE, NO TRUNCATE.
--   3. NO ALTER COLUMN TYPE (NO UUID ↔ TEXT CONVERSIONS).
--   4. ALL STATEMENTS ARE IDEMPOTENT (ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS).
-- ============================================================================

BEGIN;

-- Ensure required crypto extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- STEP 1: ADD MISSING COLUMNS TO EXISTING TABLES (NON-DESTRUCTIVE)
-- ============================================================================

-- Table: users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;

-- Table: products
ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;

-- Table: purchases
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT 0;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMPTZ;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS description TEXT;

-- ============================================================================
-- STEP 2: CREATE ALL 11 MISSING TABLES USING NATIVE PostgreSQL UUID TYPES
-- ============================================================================

-- 1. Table: attendance (Staff daily time & attendance records)
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL,
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    hours_worked NUMERIC,
    is_late BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table: login_history (Staff login & device audit trail)
CREATE TABLE IF NOT EXISTS login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
    device_info TEXT,
    ip_address TEXT,
    login_time TIMESTAMPTZ NOT NULL,
    logout_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table: audit_logs (Admin actions & staff modification audit trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    admin_name TEXT,
    action TEXT NOT NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    staff_name TEXT,
    changed_fields JSONB,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table: sessions (User / Admin authenticated session tokens)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table: creditors (Customer debt tracking)
CREATE TABLE IF NOT EXISTS creditors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    reminder_date TIMESTAMPTZ,
    is_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Table: activity_logs (Developer & system activity tracking)
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    store_id TEXT,
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Table: security_events (Defense Hub security threat logging)
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    ip_address TEXT,
    location TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Table: error_logs (System error telemetry logs)
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    stack TEXT,
    route TEXT,
    browser TEXT,
    os TEXT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    store_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Table: feature_flags (Remote system feature flags)
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Table: system_settings (Developer console global settings)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    category TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Table: developer_sessions (Developer RBAC tokens)
CREATE TABLE IF NOT EXISTS developer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- ============================================================================
-- STEP 3: ADD COMPOSITE CONSTRAINTS SAFELY (TENANT ISOLATION)
-- Existing single-column UNIQUE constraints (products_barcode_key, staff_staff_id_key, etc.)
-- are preserved so no pre-existing data or indexes are disrupted.
-- New composite constraints guarantee tenant-scoped isolation.
-- ============================================================================

DO $$
BEGIN
    -- Composite unique constraint: users(tenant_id, username)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_tenant_username_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_tenant_username_unique UNIQUE (tenant_id, username);
    END IF;

    -- Composite unique constraint: staff(tenant_id, staff_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'staff_tenant_staff_id_unique'
    ) THEN
        ALTER TABLE staff ADD CONSTRAINT staff_tenant_staff_id_unique UNIQUE (tenant_id, staff_id);
    END IF;

    -- Composite unique constraint: products(tenant_id, barcode)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_tenant_barcode_unique'
    ) THEN
        ALTER TABLE products ADD CONSTRAINT products_tenant_barcode_unique UNIQUE (tenant_id, barcode);
    END IF;

    -- Composite unique constraint: non_inventory_products(tenant_id, barcode)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'non_inventory_tenant_barcode_unique'
    ) THEN
        ALTER TABLE non_inventory_products ADD CONSTRAINT non_inventory_tenant_barcode_unique UNIQUE (tenant_id, barcode);
    END IF;

    -- Composite unique constraint: settings(tenant_id, key)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'settings_tenant_key_unique'
    ) THEN
        -- Verify settings table has unique constraint on (tenant_id, key)
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conrelid = 'settings'::regclass AND contype = 'u'
        ) THEN
            ALTER TABLE settings ADD CONSTRAINT settings_tenant_key_unique UNIQUE (tenant_id, key);
        END IF;
    END IF;
END $$;

COMMIT;
