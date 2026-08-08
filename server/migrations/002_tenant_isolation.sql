-- Backfill NULL or empty tenant_id entries for existing tables
UPDATE customers SET tenant_id = 'default-tenant-id' WHERE tenant_id IS NULL OR tenant_id = '';
UPDATE sales SET tenant_id = 'default-tenant-id' WHERE tenant_id IS NULL OR tenant_id = '';
UPDATE sale_items SET tenant_id = 'default-tenant-id' WHERE tenant_id IS NULL OR tenant_id = '';
UPDATE products SET tenant_id = 'default-tenant-id' WHERE tenant_id IS NULL OR tenant_id = '';
UPDATE variants SET tenant_id = 'default-tenant-id' WHERE tenant_id IS NULL OR tenant_id = '';
UPDATE staff SET tenant_id = 'default-tenant-id' WHERE tenant_id IS NULL OR tenant_id = '';
UPDATE users SET tenant_id = 'default-tenant-id' WHERE tenant_id IS NULL OR tenant_id = '';
UPDATE settings SET tenant_id = 'default-tenant-id' WHERE tenant_id IS NULL OR tenant_id = '';
UPDATE remittances SET tenant_id = 'default-tenant-id' WHERE tenant_id IS NULL OR tenant_id = '';
UPDATE notifications SET tenant_id = 'default-tenant-id' WHERE tenant_id IS NULL OR tenant_id = '';
UPDATE non_inventory_products SET tenant_id = 'default-tenant-id' WHERE tenant_id IS NULL OR tenant_id = '';
