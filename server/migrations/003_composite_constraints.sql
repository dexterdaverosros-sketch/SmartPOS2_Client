-- Create tenant-scoped and high-frequency performance indexes
CREATE INDEX IF NOT EXISTS idx_products_tenant_barcode ON products(tenant_id, barcode);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created ON sales(tenant_id, createdAt);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_tenant ON sale_items(tenant_id, saleId);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name ON customers(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_credits_tenant_customer ON credits(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_customer ON payments(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_reminders_tenant_customer ON reminders(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_staff_tenant_id ON staff(tenant_id, staffId);
CREATE INDEX IF NOT EXISTS idx_users_tenant_username ON users(tenant_id, username);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_remittances_tenant_status ON remittances(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user ON notifications(tenant_id, user_id);
