-- Initial Schema Migration
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  store_name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  cost REAL DEFAULT 0,
  barcode TEXT NOT NULL,
  category TEXT,
  image TEXT,
  quantity INTEGER DEFAULT 0,
  createdAt TEXT,
  updatedAt TEXT,
  UNIQUE(barcode, tenant_id)
);

CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  barcode TEXT,
  price REAL NOT NULL,
  cost REAL NOT NULL,
  image TEXT,
  quantity INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  staffId TEXT NOT NULL,
  passkey TEXT,
  role TEXT DEFAULT 'cashier',
  branch TEXT,
  department TEXT,
  employmentStatus TEXT DEFAULT 'active',
  email TEXT,
  phone TEXT,
  address TEXT,
  dateHired TEXT,
  assignedShift TEXT,
  lastLogin TEXT,
  passwordLastChanged TEXT,
  permissions TEXT,
  createdBy TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  UNIQUE(staffId, tenant_id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL,
  businessName TEXT,
  ownerName TEXT,
  mobile TEXT,
  createdAt TEXT,
  UNIQUE(username, tenant_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  credit_rating TEXT NOT NULL CHECK (credit_rating IN ('good','bad')),
  photo_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  due_date TEXT,
  remarks TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL,
  remarks TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (key, tenant_id)
);

CREATE TABLE IF NOT EXISTS non_inventory_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  category TEXT,
  description TEXT,
  image TEXT,
  barcode TEXT NOT NULL,
  barcode_data TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(barcode, tenant_id)
);

CREATE TABLE IF NOT EXISTS remittances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  amount REAL NOT NULL,
  transaction_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT,
  confirmed_at TEXT,
  FOREIGN KEY(staff_id) REFERENCES staff(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  total REAL NOT NULL,
  paymentType TEXT NOT NULL,
  paymentAmount REAL NOT NULL,
  staffId TEXT,
  remitted INTEGER DEFAULT 0,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saleId TEXT NOT NULL,
  productId TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  unit TEXT DEFAULT 'pieces',
  productName TEXT,
  isNonInventory INTEGER DEFAULT 0,
  FOREIGN KEY(saleId) REFERENCES sales(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  admin_id TEXT,
  admin_name TEXT,
  action TEXT NOT NULL,
  staff_id TEXT,
  staff_name TEXT,
  changed_fields TEXT,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  date TEXT NOT NULL,
  clock_in TEXT,
  clock_out TEXT,
  hours_worked REAL,
  is_late INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS login_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  login_time TEXT NOT NULL,
  logout_time TEXT,
  created_at TEXT
);
