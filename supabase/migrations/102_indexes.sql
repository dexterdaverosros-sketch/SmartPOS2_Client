-- ============================================================================
-- SMARTPOS+ v4.0 — SUPABASE PERFORMANCE INDEXES (102_indexes.sql)
-- Execution Order: 3 of 5 (Run AFTER 101_rls_policies.sql)
-- ============================================================================

BEGIN;

-- Tenant-scoped query performance composite indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id, username);
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff(tenant_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON attendance(tenant_id, staff_id, date);
CREATE INDEX IF NOT EXISTS idx_login_history_tenant ON login_history(tenant_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_variants_tenant ON variants(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_credits_tenant ON credits(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_reminders_tenant ON reminders(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_non_inventory_tenant ON non_inventory_products(tenant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created ON sales(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sale_items_tenant ON sale_items(tenant_id, sale_id);
CREATE INDEX IF NOT EXISTS idx_remittances_tenant ON remittances(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_purchases_tenant ON purchases(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_settings_tenant ON settings(tenant_id, key);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_creditors_tenant ON creditors(tenant_id, is_paid);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant ON activity_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_tenant ON security_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant ON error_logs(tenant_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_developer_sessions_token ON developer_sessions(token);

COMMIT;
