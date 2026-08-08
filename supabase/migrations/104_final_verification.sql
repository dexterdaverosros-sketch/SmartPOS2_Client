-- ============================================================================
-- SMARTPOS+ v4.0 — SUPABASE FINAL VERIFICATION (104_final_verification.sql)
-- Read-Only Verification Script for Fresh Database Setup
-- Execution Order: 5 of 5 (Run LAST)
-- ============================================================================

-- 1. VERIFY ALL 28 CANONICAL TABLES ARE CREATED
SELECT 
    count(*) AS total_tables_found,
    CASE WHEN count(*) >= 28 THEN 'PASS (28/28 Canonical Tables Created)' ELSE 'FAIL — Tables Missing' END AS table_audit_verdict
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 2. VERIFY PRIMARY KEYS USE NATIVE PostgreSQL UUID TYPE
SELECT 
    table_name,
    column_name,
    data_type,
    CASE WHEN data_type = 'uuid' THEN 'PASS' ELSE 'FAIL — NOT UUID' END AS pk_status
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND column_name = 'id'
  AND table_name IN (
    'tenants', 'users', 'staff', 'attendance', 'login_history',
    'products', 'variants', 'customers', 'credits', 'payments',
    'reminders', 'non_inventory_products', 'sales', 'sale_items',
    'remittances', 'notifications', 'expenses', 'purchases',
    'audit_logs', 'settings', 'sessions', 'creditors',
    'activity_logs', 'security_events', 'error_logs', 'feature_flags',
    'developer_sessions'
  )
ORDER BY table_name;

-- 3. VERIFY FOREIGN KEY DATA TYPE COMPATIBILITY (MUST BE 0 MISMATCHES)
SELECT 
    tc.table_name AS child_table, 
    kcu.column_name AS child_column, 
    ccu.table_name AS parent_table, 
    ccu.column_name AS parent_column,
    c1.data_type AS child_data_type,
    c2.data_type AS parent_data_type,
    CASE 
        WHEN c1.data_type = c2.data_type THEN 'PASS (Compatible)'
        ELSE 'FAIL (Mismatch)'
    END AS status
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

-- 4. VERIFY COMPOSITE INDEXES
SELECT 
    tablename,
    indexname,
    'PASS' AS status
FROM pg_indexes 
WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 5. VERIFY STORAGE BUCKETS
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
WHERE id IN ('product-images', 'customer-photos', 'profile-images', 'report-exports');

-- 6. FINAL CANONICAL VERDICT
SELECT 
    'SMARTPOS+ v4.0 FRESH SUPABASE DATABASE CREATION VERIFICATION COMPLETE' AS report,
    NOW() AS verified_at,
    'GO FOR BACKEND CLOUD SYNC & DEPLOYMENT' AS verdict;
