-- ============================================================================
-- SMARTPOS+ v2.0 — SUPABASE MIGRATION (099_existing_uuid_preflight.sql)
-- READ-ONLY PRE-FLIGHT DIAGNOSTIC FOR EXISTING UUID SUPABASE DATABASE
-- Execution Order: 1 of 6 (Run FIRST before schema patch)
-- ============================================================================

-- 1. Check all public tables and verify table count
SELECT 
    table_name,
    (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Detect missing backend tables (comparing against canonical 28 tables)
WITH canonical_tables AS (
    SELECT unnest(ARRAY[
        'tenants', 'users', 'staff', 'attendance', 'login_history',
        'products', 'variants', 'customers', 'credits', 'payments',
        'reminders', 'non_inventory_products', 'sales', 'sale_items',
        'remittances', 'notifications', 'expenses', 'purchases',
        'audit_logs', 'settings', 'sessions', 'creditors',
        'activity_logs', 'security_events', 'error_logs', 'feature_flags',
        'system_settings', 'developer_sessions'
    ]) AS table_name
)
SELECT 
    c.table_name AS canonical_table,
    CASE WHEN t.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING — Will be created in Step 100' END AS status
FROM canonical_tables c
LEFT JOIN information_schema.tables t ON c.table_name = t.table_name AND t.table_schema = 'public'
ORDER BY c.table_name;

-- 3. Diagnostic for Foreign Key Data Type Mismatches (UUID vs TEXT)
SELECT 
    tc.table_name AS child_table, 
    kcu.column_name AS child_column, 
    c1.data_type AS child_data_type,
    ccu.table_name AS parent_table, 
    ccu.column_name AS parent_column,
    c2.data_type AS parent_data_type,
    CASE 
        WHEN c1.data_type = c2.data_type THEN 'COMPATIBLE'
        ELSE 'MISMATCH ERROR (e.g. TEXT vs UUID)'
    END AS compatibility_status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
JOIN information_schema.columns AS c1
    ON c1.table_name = tc.table_name AND c1.column_name = kcu.column_name AND c1.table_schema = 'public'
JOIN information_schema.columns AS c2
    ON c2.table_name = ccu.table_name AND c2.column_name = ccu.column_name AND c2.table_schema = 'public'
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- 4. Check for missing columns in existing tables
SELECT 
    v.table_name,
    v.column_name,
    v.expected_type,
    CASE WHEN c.column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING — Will be added' END AS status
FROM (VALUES
    ('users', 'email', 'text'),
    ('users', 'staff_id', 'text'),
    ('users', 'location', 'text'),
    ('products', 'description', 'text'),
    ('purchases', 'quantity', 'integer'),
    ('purchases', 'cost', 'numeric'),
    ('purchases', 'details', 'text'),
    ('purchases', 'expiration_date', 'timestamp with time zone'),
    ('purchases', 'description', 'text')
) AS v(table_name, column_name, expected_type)
LEFT JOIN information_schema.columns c 
    ON c.table_schema = 'public' 
   AND c.table_name = v.table_name 
   AND c.column_name = v.column_name;

-- 5. Diagnostic for Staff username global uniqueness check (Rule 7)
SELECT 
    username, 
    COUNT(DISTINCT tenant_id) AS tenant_count,
    COUNT(*) AS total_occurrences,
    CASE WHEN COUNT(DISTINCT tenant_id) > 1 THEN 'CROSS-TENANT DUPLICATE FOUND — MUST CLEAN DATA BEFORE REMOVING GLOBAL UNIQUE CONSTRAINT' ELSE 'SAFE FOR TENANT-SCOPED UNIQUE' END AS audit_result
FROM public.staff
WHERE username IS NOT NULL AND username != ''
GROUP BY username
HAVING COUNT(DISTINCT tenant_id) > 1;

-- 6. Check existing unique constraints for settings and composite keys
SELECT 
    conrelid::regclass AS table_name,
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public' AND c.contype IN ('u', 'p')
ORDER BY table_name, constraint_name;

-- 7. Check RLS status across all public tables
SELECT 
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
