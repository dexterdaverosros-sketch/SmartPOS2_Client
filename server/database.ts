import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs"; // Import bcryptjs
import { getSupabase } from "./supabase";
import { 
  Staff, 
  Sale, 
  SaleItem,
  User
} from '@shared/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite only if needed (not on Render in some cases, but for now we keep it)
let db: any;
export const initSQLite = () => {
  if (db) return db;
  const dataDir = path.resolve(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'smartpos.db');
  db = new Database(dbPath);
  return db;
};

    // Helper to determine if we should use Cloud (Supabase)
export const useCloud = () => {
  const url = process.env.SUPABASE_URL || "https://yvtdagbiuxmvlesaikts.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_9Wwym8pGkJCa_C1xnDtVBQ_F-QFylwk";
  return !!url && !!key && url !== "" && key !== "";
};

// Database service
export const dbService = {
  // Initialize tables if they do not exist
  initSchema: async () => {
    const sqlite = initSQLite();
    // Check for staff table schema mismatch (INTEGER id vs TEXT id)
    try {
      const staffInfo = sqlite.prepare('PRAGMA table_info(staff)').all() as any[];
      const idCol = staffInfo.find(c => c.name === 'id');
      if (idCol && idCol.type === 'INTEGER') {
        console.log('Migrating staff table from INTEGER id to TEXT id...');
        db.transaction(() => {
          // Disable foreign keys temporarily to avoid issues during migration
          db.exec('PRAGMA foreign_keys = OFF');
          
          db.exec(`ALTER TABLE staff RENAME TO staff_old`);
          
          db.exec(`
            CREATE TABLE staff (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              staffId TEXT UNIQUE NOT NULL,
              passkey TEXT,
              createdBy TEXT,
              createdAt TEXT
            )
          `);
          
          // Try to copy data
          // We cast id to TEXT. If schema matches otherwise, this should work.
          // Note: staff_old might have staff_id vs staffId. 
          // If staff_old has staffId, use it. If not, try staff_id.
          const cols = staffInfo.map(c => c.name);
          const hasStaffId = cols.includes('staffId');
          const hasSnakeStaffId = cols.includes('staff_id');
          
          const sourceStaffId = hasStaffId ? 'staffId' : (hasSnakeStaffId ? 'staff_id' : "''");
          const sourcePasskey = cols.includes('passkey') ? 'passkey' : "''";
          
          db.exec(`
            INSERT INTO staff (id, name, staffId, passkey, createdBy, createdAt)
            SELECT CAST(id AS TEXT), name, ${sourceStaffId}, ${sourcePasskey}, createdBy, createdAt 
            FROM staff_old
          `);
          
          db.exec(`DROP TABLE staff_old`);
          
          // Re-enable foreign keys
          db.exec('PRAGMA foreign_keys = ON');
        })();
        console.log('Staff table migration completed.');
      }
    } catch (e) {
      console.error('Migration failed (non-critical if table doesnt exist):', e);
    }

    // Ensure sessions table has no foreign keys
    try {
      const sessionForeignKeys = sqlite.prepare('PRAGMA foreign_key_list(sessions)').all();
      if (sessionForeignKeys.length > 0) {
        console.log('Recreating sessions table without foreign keys...');
        db.transaction(() => {
          db.exec('PRAGMA foreign_keys = OFF');
          db.exec('DROP TABLE IF EXISTS sessions');
          db.exec(`
            CREATE TABLE sessions (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              tenant_id TEXT,
              token TEXT UNIQUE NOT NULL,
              device_info TEXT,
              ip_address TEXT,
              created_at TEXT NOT NULL,
              last_active_at TEXT NOT NULL
            )
          `);
          db.exec('PRAGMA foreign_keys = ON');
        })();
        console.log('Sessions table recreated successfully.');
      }
    } catch (e) {
      console.error('Sessions table migration failed (non-critical if table is new):', e);
    }

    // Create base and ledger tables if they don't exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        store_name TEXT NOT NULL,
        subdomain TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        cost REAL DEFAULT 0,
        barcode TEXT UNIQUE NOT NULL,
        category TEXT,
        image TEXT,
        quantity INTEGER DEFAULT 0,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS variants (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
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
        staffId TEXT UNIQUE NOT NULL,
        passkey TEXT,
        createdBy TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        businessName TEXT,
        ownerName TEXT,
        mobile TEXT,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tenant_id TEXT,
        token TEXT UNIQUE NOT NULL,
        device_info TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
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
        tenant_id TEXT,
        customer_id TEXT NOT NULL,
        amount REAL NOT NULL CHECK (amount > 0),
        due_date TEXT,
        remarks TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        customer_id TEXT NOT NULL,
        amount REAL NOT NULL CHECK (amount > 0),
        payment_method TEXT NOT NULL,
        remarks TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        customer_id TEXT NOT NULL,
        message_type TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS non_inventory_products (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT,
        description TEXT,
        image TEXT,
        barcode TEXT UNIQUE NOT NULL,
        barcode_data TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS remittances (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
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
        tenant_id TEXT,
        user_id TEXT,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        is_read INTEGER DEFAULT 0,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        total REAL NOT NULL,
        paymentType TEXT NOT NULL,
        paymentAmount REAL NOT NULL,
        staffId TEXT,
        remitted INTEGER DEFAULT 0,
        createdAt TEXT
      );

      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        saleId TEXT NOT NULL,
        productId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        unit TEXT DEFAULT 'pieces',
        productName TEXT,
        isNonInventory INTEGER DEFAULT 0,
        FOREIGN KEY(saleId) REFERENCES sales(id) ON DELETE CASCADE
      );
    `);

    // Perform lightweight migrations for missing columns
    const getColumns = (table: string) =>
      db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];

    // List of all tables that should have tenant_id
    const tablesWithTenant = [
      'products', 'variants', 'staff', 'users', 'sessions',
      'customers', 'credits', 'payments', 'reminders',
      'non_inventory_products', 'remittances', 'notifications',
      'sales', 'sale_items'
    ];

    const productCols = getColumns('products').map(c => c.name);
    const staffCols = getColumns('staff').map(c => c.name);
    const customerCols = getColumns('customers').map(c => c.name);
    const salesCols = getColumns('sales').map(c => c.name);

    const migrate = db.transaction(() => {
      // Add tenant_id to all relevant tables if missing
      for (const table of tablesWithTenant) {
        const cols = getColumns(table).map(c => c.name);
        if (!cols.includes('tenant_id')) {
          try {
            db.exec(`ALTER TABLE ${table} ADD COLUMN tenant_id TEXT`);
            console.log(`Added tenant_id column to ${table} table`);
          } catch (e) {
            console.error(`Failed to add tenant_id to ${table}:`, e);
          }
        }
      }
      // Add missing columns to sales
      if (!salesCols.includes('remitted')) {
        try {
          db.exec(`ALTER TABLE sales ADD COLUMN remitted INTEGER DEFAULT 0`);
        } catch (e) {
          console.error('Migration: sales.remitted failed (might already exist)', e);
        }
      }

      // Add missing columns to products
      if (!productCols.includes('updatedAt')) {
        db.exec(`ALTER TABLE products ADD COLUMN updatedAt TEXT`);
      }
      if (!productCols.includes('createdAt')) {
        db.exec(`ALTER TABLE products ADD COLUMN createdAt TEXT`);
      }
      if (!productCols.includes('cost')) {
        db.exec(`ALTER TABLE products ADD COLUMN cost REAL DEFAULT 0`);
      }

      // Ensure indexes exist (only after columns are present)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_products_updatedAt ON products(updatedAt)`);

      // Add missing columns to staff
      if (!staffCols.includes('staffId')) {
        db.exec(`ALTER TABLE staff ADD COLUMN staffId TEXT`);
      }
      if (!staffCols.includes('passkey')) {
        db.exec(`ALTER TABLE staff ADD COLUMN passkey TEXT`);
      }
      if (!staffCols.includes('createdBy')) {
        db.exec(`ALTER TABLE staff ADD COLUMN createdBy TEXT`);
      }
      if (!staffCols.includes('createdAt')) {
        db.exec(`ALTER TABLE staff ADD COLUMN createdAt TEXT`);
      }

      // Staff indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_staff_staffId ON staff(staffId)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_staff_createdAt ON staff(createdAt)`);

      // Sessions indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);

      // Customers migrations and indexes
      if (!customerCols.includes('updated_at')) {
        db.exec(`ALTER TABLE customers ADD COLUMN updated_at TEXT`);
      }
      db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_customers_rating ON customers(credit_rating)`);

      // Credits indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_credits_customer ON credits(customer_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_credits_created_at ON credits(created_at)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_credits_due_date ON credits(due_date)`);

      // Payments indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at)`);

      // Reminders indexes
      db.exec(`CREATE INDEX IF NOT EXISTS idx_reminders_customer ON reminders(customer_id)`);
    });

    migrate();

    // Sync from Cloud (Supabase) if available to restore from backup
    if (useCloud()) {
      console.log('Checking for Cloud Backup in Supabase...');
      const supabase = getSupabase();
      if (supabase) {
        try {
          // Restore Products
          const { data: cloudProducts } = await supabase.from('products').select('*');
          if (cloudProducts && cloudProducts.length > 0) {
            dbService.saveProducts(cloudProducts);
            console.log(`Restored ${cloudProducts.length} products from Cloud.`);
          }
          
          // Restore Staff
          const { data: cloudStaff } = await supabase.from('staff').select('*');
          if (cloudStaff && cloudStaff.length > 0) {
            dbService.saveStaff(cloudStaff);
            console.log(`Restored ${cloudStaff.length} staff from Cloud.`);
          }

          // Restore Admins/Users
          const { data: cloudUsers } = await supabase.from('users').select('*');
          if (cloudUsers && cloudUsers.length > 0) {
            for (const user of cloudUsers) {
              dbService.saveAdmin(user);
            }
            console.log(`Restored ${cloudUsers.length} admin accounts from Cloud.`);
          }
        } catch (e) {
          console.warn('Could not restore from Cloud backup (check table existence):', e);
        }
      }
    }
  },
  // Tenant methods
  getTenantBySubdomain: (subdomain: string) => {
    return db.prepare('SELECT * FROM tenants WHERE subdomain = ?').get(subdomain);
  },
  getTenantById: (id: string) => {
    return db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
  },
  createTenant: (input: { id: string; store_name: string; subdomain: string }) => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tenants (id, store_name, subdomain, created_at)
      VALUES (?, ?, ?, ?)
    `).run(input.id, input.store_name, input.subdomain, now);
    return db.prepare('SELECT * FROM tenants WHERE id = ?').get(input.id);
  },
  listTenants: () => {
    return db.prepare('SELECT * FROM tenants ORDER BY created_at DESC').all();
  },
  // Ledger: Customers
  createCustomer: (input: { id: string; name: string; phone: string; address?: string | null; credit_rating: 'good'|'bad'; photo_url?: string | null; }) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(`INSERT INTO customers (id, name, phone, address, credit_rating, photo_url, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`);
    stmt.run(input.id, input.name, input.phone, input.address ?? null, input.credit_rating, input.photo_url ?? null, now, now);
    return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(input.id);
  },
  updateCustomer: (id: string, updates: Partial<{ name: string; phone: string; address: string | null; credit_rating: 'good'|'bad'; photo_url: string | null; }>) => {
    const current = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id) as any;
    if (!current) return undefined;
    const next = {
      name: updates.name ?? current.name,
      phone: updates.phone ?? current.phone,
      address: updates.address ?? current.address,
      credit_rating: updates.credit_rating ?? current.credit_rating,
      photo_url: updates.photo_url ?? current.photo_url,
      updated_at: new Date().toISOString(),
    };
    db.prepare(`UPDATE customers SET name = ?, phone = ?, address = ?, credit_rating = ?, photo_url = ?, updated_at = ? WHERE id = ?`).run(
      next.name, next.phone, next.address, next.credit_rating, next.photo_url, next.updated_at, id
    );
    return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  },
  deleteCustomer: (id: string) => {
    const info = db.prepare(`DELETE FROM customers WHERE id = ?`).run(id);
    return info.changes ?? 0;
  },
  getCustomer: (id: string) => {
    return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  },
  listCustomers: () => {
    return db.prepare(`SELECT * FROM customers ORDER BY name ASC`).all();
  },
  updateCustomerPhoto: (id: string, photoUrl: string) => {
    db.prepare(`UPDATE customers SET photo_url = ?, updated_at = ? WHERE id = ?`).run(photoUrl, new Date().toISOString(), id);
    return db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
  },

  // Ledger: Credits
  addCredit: (input: { id: string; customer_id: string; amount: number; remarks?: string | null; created_at?: string }) => {
    const created = input.created_at ?? new Date().toISOString();
    db.prepare(`INSERT INTO credits (id, customer_id, amount, due_date, remarks, created_at) VALUES (?,?,?,?,?,?)`).run(
      input.id, input.customer_id, input.amount, null, input.remarks ?? null, created
    );
    return db.prepare(`SELECT * FROM credits WHERE id = ?`).get(input.id);
  },
  updateCredit: (id: string, updates: Partial<{ amount: number; due_date: string | null; remarks: string | null }>) => {
    const current = db.prepare(`SELECT * FROM credits WHERE id = ?`).get(id) as any;
    if (!current) return undefined;
    const next = {
      amount: updates.amount ?? current.amount,
      due_date: updates.due_date ?? current.due_date ?? null,
      remarks: updates.remarks ?? current.remarks,
    };
    db.prepare(`UPDATE credits SET amount = ?, due_date = ?, remarks = ? WHERE id = ?`).run(next.amount, next.due_date, next.remarks, id);
    return db.prepare(`SELECT * FROM credits WHERE id = ?`).get(id);
  },
  deleteCredit: (id: string) => {
    const info = db.prepare(`DELETE FROM credits WHERE id = ?`).run(id);
    return info.changes ?? 0;
  },
  listCredits: (customerId: string) => {
    return db.prepare(`SELECT * FROM credits WHERE customer_id = ? ORDER BY datetime(created_at) DESC`).all(customerId);
  },
  sumCredits: (customerId: string) => {
    const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM credits WHERE customer_id = ?`).get(customerId) as any;
    return row?.total ?? 0;
  },

  // Ledger: Payments
  addPayment: (input: { id: string; customer_id: string; amount: number; payment_method: string; remarks?: string | null; created_at?: string }) => {
    const created = input.created_at ?? new Date().toISOString();
    db.prepare(`INSERT INTO payments (id, customer_id, amount, payment_method, remarks, created_at) VALUES (?,?,?,?,?,?)`).run(
      input.id, input.customer_id, input.amount, input.payment_method, input.remarks ?? null, created
    );
    return db.prepare(`SELECT * FROM payments WHERE id = ?`).get(input.id);
  },
  updatePayment: (id: string, updates: Partial<{ amount: number; payment_method: string; remarks: string | null }>) => {
    const current = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(id) as any;
    if (!current) return undefined;
    const next = {
      amount: updates.amount ?? current.amount,
      payment_method: updates.payment_method ?? current.payment_method,
      remarks: updates.remarks ?? current.remarks,
    };
    db.prepare(`UPDATE payments SET amount = ?, payment_method = ?, remarks = ? WHERE id = ?`).run(next.amount, next.payment_method, next.remarks, id);
    return db.prepare(`SELECT * FROM payments WHERE id = ?`).get(id);
  },
  deletePayment: (id: string) => {
    const info = db.prepare(`DELETE FROM payments WHERE id = ?`).run(id);
    return info.changes ?? 0;
  },
  listPayments: (customerId: string) => {
    return db.prepare(`SELECT * FROM payments WHERE customer_id = ? ORDER BY datetime(created_at) DESC`).all(customerId);
  },
  sumPayments: (customerId: string) => {
    const row = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE customer_id = ?`).get(customerId) as any;
    return row?.total ?? 0;
  },

  // Balance
  getBalance: (customerId: string) => {
    const total_credit = (db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM credits WHERE customer_id = ?`).get(customerId) as any)?.total ?? 0;
    const total_payment = (db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE customer_id = ?`).get(customerId) as any)?.total ?? 0;
    return { total_credit, total_payment, balance: total_credit - total_payment };
  },
  customersCount: () => {
    const row = db.prepare(`SELECT COUNT(*) AS cnt FROM customers`).get() as any;
    return row?.cnt ?? 0;
  },
  totalCredits: () => {
    const row = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM credits`).get() as any;
    return row?.total ?? 0;
  },
  totalPayments: () => {
    const row = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM payments`).get() as any;
    return row?.total ?? 0;
  },

  // Reminders
  addReminder: (input: { id: string; customer_id: string; message_type: string; message: string; status: string; created_at?: string }) => {
    const created = input.created_at ?? new Date().toISOString();
    db.prepare(`INSERT INTO reminders (id, customer_id, message_type, message, status, created_at) VALUES (?,?,?,?,?,?)`).run(
      input.id, input.customer_id, input.message_type, input.message, input.status, created
    );
    return db.prepare(`SELECT * FROM reminders WHERE id = ?`).get(input.id);
  },
  listReminders: (customerId: string) => {
    return db.prepare(`SELECT * FROM reminders WHERE customer_id = ? ORDER BY datetime(created_at) DESC`).all(customerId);
  },
  // Settings
  getSettings: () => {
    const rows = db.prepare(`SELECT key, value FROM settings`).all() as any[];
    const obj: Record<string, any> = {};
    for (const r of rows) {
      try {
        obj[r.key] = JSON.parse(r.value);
      } catch {
        obj[r.key] = r.value;
      }
    }
    return obj;
  },
  upsertSettings: (settings: Record<string, any>) => {
    const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
    const tx = db.transaction(() => {
      for (const [k, v] of Object.entries(settings)) {
        const val = typeof v === 'string' ? v : JSON.stringify(v);
        stmt.run(k, val);
      }
    });
    tx();
    return dbService.getSettings();
  },
  // Admin/User methods
  getAdmins: () => {
    return db.prepare('SELECT * FROM users WHERE role = ?').all('admin');
  },
  saveAdmin: (user: any) => {
    const effectiveTenantId = user.tenantId || user.tenant_id;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO users (id, username, password, role, businessName, ownerName, mobile, createdAt, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(user.id, user.username, user.password, user.role, user.businessName, user.ownerName, user.mobile, user.createdAt, effectiveTenantId);
    
    // Sync to Cloud (Supabase) if available
    if (useCloud()) {
      const supabase = getSupabase();
      if (supabase) {
        const cloudUser = {
          id: user.id,
          username: user.username,
          password: user.password,
          role: user.role,
          business_name: user.businessName || user.business_name,
          owner_name: user.ownerName || user.owner_name,
          mobile: user.mobile,
          profile_image: user.profileImage || user.profile_image,
          tenant_id: effectiveTenantId,
          created_at: user.createdAt || new Date().toISOString()
        };
        supabase.from('users').upsert(cloudUser).then(({ error }) => {
          if (error) console.error('Cloud admin sync error:', error);
          else console.log('Cloud admin sync: 1 admin updated.');
        });
      }
    }
    return user;
  },

  saveSecurityQuestions: async (userId: string, questions: string[], answers: string[]) => {
    const hashedAnswers = await Promise.all(answers.map(answer => bcrypt.hash(answer, 10)));
    const stmt = db.prepare(`
      UPDATE users SET
        securityQuestion1 = ?, securityAnswer1 = ?,
        securityQuestion2 = ?, securityAnswer2 = ?,
        securityQuestion3 = ?, securityAnswer3 = ?
      WHERE id = ?
    `);
    stmt.run(
      questions[0], hashedAnswers[0],
      questions[1], hashedAnswers[1],
      questions[2], hashedAnswers[2],
      userId
    );

    // Sync to Cloud (Supabase) if available
    if (useCloud()) {
      const supabase = getSupabase();
      if (supabase) {
        supabase.from('users').update({
          security_question_1: questions[0],
          security_answer_1: hashedAnswers[0],
          security_question_2: questions[1],
          security_answer_2: hashedAnswers[1],
          security_question_3: questions[2],
          security_answer_3: hashedAnswers[2],
        }).eq('id', userId).then(({ error }) => {
          if (error) console.error('Cloud security questions sync error:', error);
          else console.log('Cloud security questions sync: 1 user updated.');
        });
      }
    }
  },

  getUserByUsername: (username: string) => {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  updateAdmin: (id: string, updates: Partial<User>) => {
    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!current) return undefined;

    const next = {
      ...current,
      ...updates
    };

    const stmt = db.prepare(`
      UPDATE users SET
        username = ?, password = ?, role = ?, businessName = ?, 
        ownerName = ?, mobile = ?, createdAt = ?, profileImage = ?
      WHERE id = ?
    `);
    
    stmt.run(
      next.username, next.password, next.role, next.businessName, 
      next.ownerName, next.mobile, next.createdAt, next.profileImage || null, id
    );

    // Sync to Cloud (Supabase) if available
    if (useCloud()) {
      const supabase = getSupabase();
      if (supabase) {
        supabase.from('users').upsert(next).then(({ error }) => {
          if (error) console.error('Cloud admin update sync error:', error);
          else console.log('Cloud admin update sync: 1 admin updated.');
        });
      }
    }
    return next;
  },

  getUserSecurityQuestions: (username: string) => {
    return db.prepare(`
      SELECT securityQuestion1, securityQuestion2, securityQuestion3,
             securityAnswer1, securityAnswer2, securityAnswer3
      FROM users WHERE username = ?
    `).get(username);
  },

  updateUserPassword: async (username: string, newPasswordHash: string) => {
    const stmt = db.prepare(`UPDATE users SET password = ? WHERE username = ?`);
    stmt.run(newPasswordHash, username);

    // Sync to Cloud (Supabase) if available
    if (useCloud()) {
      const supabase = getSupabase();
      if (supabase) {
        supabase.from('users').update({ password: newPasswordHash }).eq('username', username).then(({ error }) => {
          if (error) console.error('Cloud password update sync error:', error);
          else console.log('Cloud password update sync: 1 user updated.');
        });
      }
    }
  },

  recordFailedLoginAttempt: (username: string) => {
    const user = db.prepare('SELECT failedAttemptCount FROM users WHERE username = ?').get(username);
    if (user) {
      const newCount = (user.failedAttemptCount || 0) + 1;
      db.prepare('UPDATE users SET failedAttemptCount = ? WHERE username = ?').run(newCount, username);
      return newCount;
    }
    return 0;
  },

  lockUserAccount: (username: string, lockoutMinutes: number) => {
    const lockoutUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
    db.prepare('UPDATE users SET lockoutUntil = ? WHERE username = ?').run(lockoutUntil.toISOString(), username);
  },

  resetLoginAttempts: (username: string) => {
    db.prepare('UPDATE users SET failedAttemptCount = 0, lockoutUntil = NULL WHERE username = ?').run(username);
  },

  addSale: (sale: Sale, saleItems: SaleItem[]) => {
    const result = db.transaction(() => {
      // Insert sale
      db.prepare(`
        INSERT INTO sales (id, total, paymentType, paymentAmount, staffId, remitted, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(sale.id, sale.total, sale.paymentType, sale.paymentAmount, sale.staffId, sale.remitted ? 1 : 0, sale.createdAt instanceof Date ? sale.createdAt.toISOString() : String(sale.createdAt));

      // Insert sale items and update product/variant quantities
      for (const item of saleItems) {
        // Ensure we have an id and saleId
        const itemId = item.id || randomUUID();
        const itemSaleId = item.saleId || sale.id;
        
        db.prepare(`
          INSERT INTO sale_items (id, saleId, productId, quantity, price, unit, productName, isNonInventory)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(itemId, itemSaleId, item.productId, item.quantity, item.price, item.unit, item.productName, item.isNonInventory ? 1 : 0);

        if (!item.isNonInventory) {
          // Deduct from product or variant
          const product = db.prepare('SELECT id, quantity FROM products WHERE id = ?').get(item.productId) as { id: string, quantity: number } | undefined;
          if (product) {
            const newQuantity = product.quantity - item.quantity;
            db.prepare('UPDATE products SET quantity = ?, updatedAt = ? WHERE id = ?').run(newQuantity, new Date().toISOString(), product.id);
          } else {
            const variant = db.prepare('SELECT id, quantity FROM variants WHERE id = ?').get(item.productId) as { id: string, quantity: number } | undefined;
            if (variant) {
              const newQuantity = variant.quantity - item.quantity;
              db.prepare('UPDATE variants SET quantity = ?, updated_at = ? WHERE id = ?').run(newQuantity, new Date().toISOString(), variant.id);
            } else {
              console.warn(`Product or variant with ID ${item.productId} not found for inventory deduction during sale ${sale.id}.`);
            }
          }
        }
      }
    })();

    // Sync to Supabase Cloud if enabled - ULTRA DEFENSIVE VERSION
    if (useCloud()) {
      const supabase = getSupabase();
      if (supabase) {
        (async () => {
          try {
            console.log('[SYNC] Starting sale sync to Supabase for sale:', sale.id);
            // Start with ABSOLUTELY MINIMAL data only (required columns)
            let saleData = {
              id: sale.id,
              total: sale.total,
              created_at: sale.createdAt instanceof Date ? sale.createdAt.toISOString() : String(sale.createdAt)
            };
            // Try to add optional columns one by one, only if they exist
            const optionalSaleFields = [
              { key: 'payment_type', value: sale.paymentType },
              { key: 'staff_id', value: sale.staffId },
              { key: 'remitted', value: !!sale.remitted },
              { key: 'payment_amount', value: sale.paymentAmount }
            ];
            for (const field of optionalSaleFields) {
              try {
                const testData = { ...saleData, [field.key]: field.value };
                const { error: testError } = await supabase.from('sales').upsert(testData, { onConflict: 'id' }).select().limit(0);
                if (!testError) {
                  saleData[field.key] = field.value;
                  console.log(`[SYNC] Added sale column: ${field.key}`);
                }
              } catch (e) {
                console.log(`[SYNC] Sale column ${field.key} not found, skipping...`);
              }
            }
            // Now perform actual sync
            const { error: saleError } = await supabase.from('sales').upsert(saleData, { onConflict: 'id' });
            if (saleError) {
              console.warn('[SYNC] Sale sync failed, trying with ONLY id/total/created_at:', saleError);
              const minimalOnly = { id: sale.id, total: sale.total, created_at: sale.createdAt instanceof Date ? sale.createdAt.toISOString() : String(sale.createdAt) };
              const { error: minimalSaleError } = await supabase.from('sales').upsert(minimalOnly, { onConflict: 'id' });
              if (minimalSaleError) {
                console.error('[SYNC] Even minimal sale sync failed! Skipping sale sync...', minimalSaleError);
                return;
              }
            }

            console.log('[SYNC] Sale synced, now syncing sale items...');
            
            // Sync Sale Items (also ultra defensive)
            for (const item of saleItems) {
              try {
                let itemData = {
                  id: item.id || randomUUID(),
                  sale_id: item.saleId || sale.id
                };
                const optionalItemFields = [
                  { key: 'product_id', value: item.productId },
                  { key: 'quantity', value: item.quantity },
                  { key: 'price', value: item.price },
                  { key: 'unit', value: item.unit },
                  { key: 'product_name', value: item.productName },
                  { key: 'is_non_inventory', value: !!item.isNonInventory }
                ];
                for (const field of optionalItemFields) {
                  try {
                    const testData = { ...itemData, [field.key]: field.value };
                    const { error: testError } = await supabase.from('sale_items').upsert(testData, { onConflict: 'id' }).select().limit(0);
                    if (!testError) {
                      itemData[field.key] = field.value;
                    }
                  } catch (e) {
                    console.log(`[SYNC] Sale item column ${field.key} not found, skipping...`);
                  }
                }
                const { error: itemError } = await supabase.from('sale_items').upsert(itemData, { onConflict: 'id' });
                if (itemError) {
                  console.warn(`[SYNC] Failed to sync sale item ${item.id}`, itemError);
                }
              } catch (itemErr) {
                console.error(`[SYNC] Failed to sync sale item ${item.id}`, itemErr);
              }
            }

            console.log(`[SYNC] Sale ${sale.id} sync complete!`);
          } catch (err) {
            console.error('[SYNC] Failed to sync sale to Supabase:', err);
          }
        })();
      }
    }
    return result;
  },

  // Non-inventory product methods
  getNonInventoryProducts: (tenantId: string) => {
    return db.prepare('SELECT * FROM non_inventory_products WHERE tenant_id = ?').all(tenantId);
  },

  getNonInventoryProductByBarcode: (barcode: string, tenantId: string) => {
    return db.prepare('SELECT * FROM non_inventory_products WHERE barcode = ? AND tenant_id = ?').get(barcode, tenantId);
  },

  saveNonInventoryProducts: (products: any[], tenantId: string) => {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO non_inventory_products 
      (id, tenant_id, name, price, category, description, image, barcode, barcode_data, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((products: any[]) => {
      for (const product of products) {
        try {
          insert.run(
            product.id,
            tenantId,
            product.name,
            product.price,
            product.category || 'general',
            product.description || null,
            product.image || null,
            product.barcode,
            product.barcodeData || product.barcode_data || null,
            product.createdAt || new Date().toISOString(),
            product.updatedAt || new Date().toISOString()
          );
        } catch (e) {
          console.error('Failed to upsert non-inventory product', product?.barcode, e);
        }
      }
    });
    
    insertMany(products);

    // // Mirror to Cloud (Supabase) if available
    // if (useCloud()) {
    //   const supabase = getSupabase();
    //   if (supabase) {
    //     const cloudProducts = products.map(p => ({
    //       id: String(p.id),
    //       tenant_id: tenantId,
    //       name: String(p.name || ''),
    //       price: Number(p.price || 0),
    //       category: p.category || 'general',
    //       description: p.description || null,
    //       image: p.image || null,
    //       barcode: String(p.barcode || ''),
    //       barcode_data: p.barcodeData || p.barcode_data || null,
    //       created_at: p.createdAt || new Date().toISOString(),
    //       updated_at: p.updatedAt || new Date().toISOString()
    //     }));
    //     supabase.from('non_inventory_products').upsert(cloudProducts, { onConflict: 'id' }).then(({ error }) => {
    //       if (error) console.error('Cloud non-inventory product sync error:', error);
    //       else console.log(`Cloud non-inventory product sync: ${cloudProducts.length} items updated.`);
    //     });
    //   }
    // }

    return products;
  },

  deleteNonInventoryProduct: (id: string, tenantId: string) => {
    return db.prepare('DELETE FROM non_inventory_products WHERE id = ? AND tenant_id = ?').run(id, tenantId);
  },

  // Clear all table data (products, staff)
  clearAllData: () => {
    const delProducts = db.prepare('DELETE FROM products').run();
    const delStaff = db.prepare('DELETE FROM staff').run();
    return {
      productsDeleted: delProducts.changes ?? 0,
      staffDeleted: delStaff.changes ?? 0,
    };
  },
  // Product methods
  getProducts: (tenantId: string) => {
    return db.prepare('SELECT * FROM products WHERE tenant_id = ?').all(tenantId);
  },

  getProductByBarcode: (barcode: string, tenantId: string) => {
    return db.prepare('SELECT * FROM products WHERE barcode = ? AND tenant_id = ?').get(barcode, tenantId);
  },

  getProductById: (id: string, tenantId: string) => {
    return db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').get(id, tenantId);
  },

  updateStock: (id: string, quantity: number, tenantId: string) => {
    return db.prepare('UPDATE products SET quantity = ?, updatedAt = ? WHERE id = ? AND tenant_id = ?').run(quantity, new Date().toISOString(), id, tenantId);
  },

  saveProducts: (products: any[], tenantId: string) => {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO products 
      (id, tenant_id, name, price, cost, barcode, category, image, quantity, createdAt, updatedAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((products: any[]) => {
      for (const product of products) {
        try {
          const id = String(product.id);
          const name = String(product.name ?? '');
          const price = Number(product.price ?? 0);
          const cost = Number(product.cost ?? 0);
          const barcode = String(product.barcode ?? '').trim();
          const category = product.category != null ? String(product.category) : null;
          const image = product.image != null ? String(product.image) : null;
          const quantity = Number(product.quantity ?? 0);
          const createdAt = String(product.createdAt ?? new Date().toISOString());
          const updatedAt = String(product.updatedAt ?? new Date().toISOString());

          insert.run(
            id,
            tenantId,
            name,
            price,
            cost,
            barcode,
            category,
            image,
            quantity,
            createdAt,
            updatedAt
          );
        } catch (e) {
          console.error('Failed to upsert product', product?.barcode, e);
        }
      }
    });
    
    insertMany(products);
    
    // Mirror to Cloud (Supabase) if available - ULTRA DEFENSIVE VERSION
    if (useCloud()) {
      const supabase = getSupabase();
      if (supabase) {
        (async () => {
          try {
            console.log('[SYNC] Starting product sync to Supabase for tenant:', tenantId);
            // Process each product individually for maximum safety
            for (const p of products) {
              try {
                // Start with ABSOLUTELY MINIMAL product data
                let productData = {
                  id: String(p.id),
                  tenant_id: tenantId,
                  name: String(p.name || ''),
                  price: Number(p.price || 0),
                  created_at: p.createdAt ?? new Date().toISOString(),
                  updated_at: p.updatedAt ?? new Date().toISOString()
                };
                // Try adding optional fields one by one
                const optionalProductFields = [
                  { key: 'cost', value: Number(p.cost || 0) },
                  { key: 'category', value: p.category ?? null },
                  { key: 'image', value: p.image ?? null },
                  { key: 'quantity', value: Number(p.quantity || 0) },
                  { key: 'barcode', value: String(p.barcode || '') }
                ];
                for (const field of optionalProductFields) {
                  try {
                    const testData = { ...productData, [field.key]: field.value };
                    const { error: testError } = await supabase.from('products').upsert(testData, { onConflict: 'id' }).select().limit(0);
                    if (!testError) {
                      productData[field.key] = field.value;
                    }
                  } catch (e) {
                    console.log(`[SYNC] Product column ${field.key} not found, skipping...`);
                  }
                }
                // Now sync this product
                const { error: prodError } = await supabase.from('products').upsert(productData, { onConflict: 'id' });
                if (prodError) {
                  console.warn(`[SYNC] Failed to sync product ${p.id}, trying with only minimal data...`, prodError);
                  const minimalOnly = {
                    id: String(p.id),
                    tenant_id: tenantId,
                    name: String(p.name || ''),
                    price: Number(p.price || 0),
                    created_at: p.createdAt ?? new Date().toISOString(),
                    updated_at: p.updatedAt ?? new Date().toISOString()
                  };
                  await supabase.from('products').upsert(minimalOnly, { onConflict: 'id' });
                }
              } catch (singleProdErr) {
                console.error(`[SYNC] Failed to sync product ${p.id}`, singleProdErr);
              }
            }
            console.log(`[SYNC] Product sync complete: ${products.length} products processed.`);
          } catch (err) {
            console.error('[SYNC] Cloud product sync error:', err);
          }
        })();
      }
    }
    
    return products;
  },

  getProductsSince: (timestamp: Date, tenantId: string) => {
    return db.prepare('SELECT * FROM products WHERE datetime(updatedAt) > datetime(?) AND tenant_id = ?').all(timestamp.toISOString(), tenantId);
  },

  getVariantsSince: (timestamp: Date, tenantId: string) => {
    const rows = db.prepare('SELECT * FROM variants WHERE datetime(updated_at) > datetime(?) AND tenant_id = ?').all(timestamp.toISOString(), tenantId) as any[];
    return rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      name: r.name,
      barcode: r.barcode,
      price: r.price,
      cost: r.cost,
      image: r.image,
      quantity: r.quantity,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  // Variant methods
  getVariants: (productId: string, tenantId: string) => {
    // Map snake_case columns to camelCase properties to match shared/schema
    const rows = db.prepare('SELECT * FROM variants WHERE product_id = ? AND tenant_id = ?').all(productId, tenantId) as any[];
    return rows.map(r => ({
      id: r.id,
      productId: r.product_id,
      name: r.name,
      barcode: r.barcode,
      price: r.price,
      cost: r.cost,
      image: r.image,
      quantity: r.quantity,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  getVariantById: (id: string, tenantId: string) => {
    const r = db.prepare('SELECT * FROM variants WHERE id = ? AND tenant_id = ?').get(id, tenantId) as any;
    if (!r) return undefined;
    return {
      id: r.id,
      productId: r.product_id,
      name: r.name,
      barcode: r.barcode,
      price: r.price,
      cost: r.cost,
      image: r.image,
      quantity: r.quantity,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  getAllSalesWithStaff: async () => {
    let sales = db.prepare(`
      SELECT
        s.id AS saleId,
        s.total,
        s.paymentType,
        s.paymentAmount,
        s.staffId,
        s.remitted,
        s.createdAt,
        st.name AS staffName
      FROM sales s
      LEFT JOIN staff st ON s.staffId = st.staffId
      ORDER BY s.createdAt DESC
    `).all() as any[];

    // If local sales is empty and cloud is available, try fetching from Supabase
    if (sales.length === 0 && useCloud()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data: cloudSales, error: saleError } = await supabase
            .from('sales')
            .select(`
              id,
              total,
              payment_type,
              payment_amount,
              staff_id,
              remitted,
              created_at
            `)
            .order('created_at', { ascending: false });

          if (!saleError && cloudSales) {
            // Also fetch staff names for these sales
            const { data: cloudStaff } = await supabase.from('staff').select('staff_id, name');
            const staffMap = new Map((cloudStaff || []).map(s => [s.staff_id, s.name]));

            sales = cloudSales.map(s => ({
              saleId: s.id,
              total: s.total,
              paymentType: s.payment_type,
              paymentAmount: s.payment_amount,
              staffId: s.staff_id,
              remitted: !!s.remitted,
              createdAt: s.created_at,
              staffName: staffMap.get(s.staff_id) || 'Staff'
            }));
          }
        } catch (err) {
          console.error('Failed to fetch sales from Supabase:', err);
        }
      }
    }

    const salesWithItems = await Promise.all(sales.map(async (sale) => {
      let items = db.prepare('SELECT * FROM sale_items WHERE saleId = ?').all(sale.saleId);
      
      // If local items is empty and cloud is available, try fetching from Supabase
      if (items.length === 0 && useCloud()) {
        const supabase = getSupabase();
        if (supabase) {
          try {
            const { data: cloudItems } = await supabase
              .from('sale_items')
              .select('*')
              .eq('sale_id', sale.saleId);
            
            if (cloudItems) {
              items = cloudItems.map(it => ({
                id: it.id,
                saleId: it.sale_id,
                productId: it.product_id,
                quantity: it.quantity,
                price: it.price,
                unit: it.unit,
                productName: it.product_name,
                isNonInventory: !!it.is_non_inventory
              }));
            }
          } catch (err) {
            console.error(`Failed to fetch items for sale ${sale.saleId} from Supabase:`, err);
          }
        }
      }

      return {
        id: sale.saleId,
        total: sale.total,
        paymentType: sale.paymentType,
        paymentAmount: sale.paymentAmount,
        staffId: sale.staffId,
        remitted: !!sale.remitted,
        createdAt: sale.createdAt,
        staffName: sale.staffName || 'Staff',
        items: items.map((it: any) => ({
          id: it.id,
          saleId: it.saleId || it.sale_id,
          productId: it.productId || it.product_id,
          quantity: it.quantity,
          price: it.price,
          unit: it.unit,
          productName: it.productName || it.product_name,
          isNonInventory: !!(it.isNonInventory || it.is_non_inventory)
        }))
      };
    }));
    return salesWithItems;
  },

  getAllVariants: () => {
     return db.prepare('SELECT * FROM variants').all();
  },

  saveVariants: (variants: any[], tenantId: string) => {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO variants 
      (id, tenant_id, product_id, name, barcode, price, cost, image, quantity, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((variants: any[]) => {
      for (const v of variants) {
        try {
          insert.run(
            v.id,
            tenantId,
            v.productId || v.product_id,
            v.name,
            v.barcode || null,
            v.price,
            v.cost,
            v.image || null,
            v.quantity || 0,
            v.createdAt || v.created_at || new Date().toISOString(),
            v.updatedAt || v.updated_at || new Date().toISOString()
          );
        } catch (e: any) {
          if (e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
            console.warn(`Skipping variant ${v?.id} due to missing product_id: ${v.productId || v.product_id}`);
          } else {
            console.error('Failed to upsert variant', v?.id, e);
          }
        }
      }
    });
    
    insertMany(variants);
    return variants;
  },

  // Staff methods
  getStaff: (tenantId: string) => {
    return db.prepare('SELECT * FROM staff WHERE tenant_id = ?').all(tenantId);
  },

  saveStaff: async (staff: any[], tenantId: string) => {
    // Debug schema
    console.log('Staff table schema:', db.prepare('PRAGMA table_info(staff)').all());

    const insert = db.prepare(`
      INSERT OR REPLACE INTO staff 
      (id, tenant_id, user_id, name, staffId, passkey, createdBy, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction(async (staffMembers: any[]) => {
      for (const member of staffMembers) {
        const effectiveTenantId = tenantId || member.tenantId || member.tenant_id;
        // Hash passkey if not already hashed
        let passkey = member.passkey;
        if (passkey && !passkey.startsWith('$2')) {
          passkey = await bcrypt.hash(passkey, 10);
        }
        insert.run(
          member.id,
          effectiveTenantId,
          member.userId || member.user_id || null,
          member.name,
          member.staffId || member.staff_id,
          passkey,
          member.createdBy || member.created_by,
          member.createdAt || member.created_at || new Date().toISOString()
        );
      }
    });
    
    await insertMany(staff);

    // Mirror to Cloud (Supabase) if available
    if (useCloud()) {
      const supabase = getSupabase();
      if (supabase) {
        // Map to snake_case for Supabase, skip columns that might not exist
        const cloudStaff = staff.map(m => {
          const effectiveTenantId = tenantId || m.tenantId || m.tenant_id;
          const staffData: any = {
            id: String(m.id),
            tenant_id: effectiveTenantId,
            user_id: m.userId || m.user_id || null,
            name: String(m.name || ''),
            staff_id: String(m.staffId || m.staff_id || ''),
            passhash: m.passkey && m.passkey.startsWith('$2') ? m.passkey : null, // Use passhash instead of passkey to match server login
            created_by: m.createdBy || m.created_by || null
          };
          // Only add created_at if it exists or we need it
          if (m.createdAt || m.created_at) {
            staffData.created_at = m.createdAt || m.created_at || new Date().toISOString();
          }
          return staffData;
        });
        
        supabase.from('staff').upsert(cloudStaff, { onConflict: 'id' }).then(({ error }) => {
          if (error) console.error('Cloud staff sync error:', error);
          else console.log(`Cloud staff sync: ${cloudStaff.length} staff updated.`);
        });
      }
    }

    return staff;
  },

  getStaffSince: (timestamp: Date, tenantId: string) => {
    return db.prepare('SELECT * FROM staff WHERE datetime(createdAt) > datetime(?) AND tenant_id = ?').all(timestamp.toISOString(), tenantId);
  },

  // Auth & Session methods
  getStaffByStaffId: (staffId: string, tenantId: string) => {
    return db.prepare('SELECT * FROM staff WHERE staffId = ? AND tenant_id = ?').get(staffId, tenantId);
  },

  verifyStaffCredentials: (staffId: string, passkey: string, tenantId: string) => {
    return db.prepare('SELECT * FROM staff WHERE staffId = ? AND tenant_id = ?').get(staffId, tenantId);
  },

  createSession: (session: { id: string; user_id: string; token: string; tenant_id?: string; device_info: string; ip_address: string; created_at: string; last_active_at: string }) => {
    db.prepare(`
      INSERT INTO sessions (id, user_id, tenant_id, token, device_info, ip_address, created_at, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id, session.user_id, session.tenant_id || null, session.token, session.device_info, session.ip_address, session.created_at, session.last_active_at
    );
    return session;
  },

  getSessionByToken: (token: string) => {
    console.log('DB Service: Looking up session for token:', token);
    const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    if (session) {
      console.log('DB Service: Session found for token:', token);
    } else {
      console.warn('DB Service: No session found for token:', token);
    }
    return session;
  },

  getUserSessions: (userId: string) => {
    return db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY last_active_at DESC').all(userId);
  },

  revokeSession: (token: string) => {
    return db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },

  revokeUserSessions: (userId: string) => {
    return db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  },

  updateSessionActivity: (token: string) => {
    const now = new Date().toISOString();
    return db.prepare('UPDATE sessions SET last_active_at = ? WHERE token = ?').run(now, token);
  },
  
  // Admin clear all sessions
  clearAllSessions: () => {
    return db.prepare('DELETE FROM sessions').run();
  },

  cleanupExpiredSessions: (maxAgeHours: number = 24) => {
    // SQLite datetime is in UTC ISO string.
    // We delete sessions where last_active_at < (now - maxAgeHours)
    // SQLite modifiers: '-24 hours'
    return db.prepare(`
      DELETE FROM sessions 
      WHERE datetime(last_active_at) < datetime('now', '-' || ? || ' hours')
    `).run(maxAgeHours);
  },

  // Remittance methods
  createRemittance: (remittance: any) => {
    const stmt = db.prepare(`
      INSERT INTO remittances (id, staff_id, staff_name, amount, transaction_count, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      remittance.id,
      remittance.staffId,
      remittance.staffName,
      remittance.amount,
      remittance.transactionCount,
      'pending',
      new Date().toISOString()
    );
    return remittance;
  },

  getRemittanceById: (id: string) => {
    return db.prepare('SELECT * FROM remittances WHERE id = ?').get(id);
  },

  getRemittedSalesForStaff: (staffId: string) => {
    return db.prepare('SELECT id FROM sales WHERE (staffId = ? OR staffId = ?) AND remitted = 1').all(staffId, staffId);
  },

  confirmRemittance: (id: string) => {
    const now = new Date().toISOString();
    
    return db.transaction(() => {
      // Update remittance status
      db.prepare(`
        UPDATE remittances 
        SET status = 'confirmed', confirmed_at = ?
        WHERE id = ?
      `).run(now, id);
      
      const remittance = db.prepare('SELECT * FROM remittances WHERE id = ?').get(id) as any;
      if (!remittance) return null;

      // Mark all unremitted sales for this staff as remitted
      db.prepare(`
        UPDATE sales 
        SET remitted = 1 
        WHERE (staffId = ? OR staffId = ?) AND remitted = 0
      `).run(remittance.staff_id, remittance.staff_id); 

      // NEW: Sync Inventory with Cloud (Supabase) if configured
      // if (useCloud()) {
      //   const supabase = getSupabase();
      //   if (supabase) {
      //     // Get all products to sync current local state to cloud
      //     const products = db.prepare('SELECT * FROM products').all();
      //     if (products && products.length > 0) {
      //       supabase.from('products').upsert(products).then(({ error }) => {
      //         if (error) console.error('Cloud inventory sync error on remit:', error);
      //         else console.log(`Cloud inventory sync on remit: ${products.length} products synced.`);
      //       });
      //     }
      //   }
      // }

      return remittance;
    })();
  },

  listPendingRemittances: () => {
    return db.prepare("SELECT * FROM remittances WHERE status = 'pending' ORDER BY created_at DESC").all();
  },

  cancelRemittance: (id: string) => {
    return db.transaction(() => {
      // Update remittance status
      db.prepare(`
        UPDATE remittances 
        SET status = 'cancelled'
        WHERE id = ?
      `).run(id);
      
      const remittance = db.prepare('SELECT * FROM remittances WHERE id = ?').get(id) as any;
      if (!remittance) return null;

      return remittance;
    })();
  },

  listConfirmedRemittances: () => {
    return db.prepare("SELECT * FROM remittances WHERE status = 'confirmed' ORDER BY created_at DESC").all();
  },

  // Notification methods
  createNotification: (notification: any) => {
    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, type, message, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const id = randomUUID();
    stmt.run(
      id,
      notification.userId || null,
      notification.type,
      notification.message,
      notification.data ? JSON.stringify(notification.data) : null,
      new Date().toISOString()
    );
    return { id, ...notification };
  },

  listNotifications: (userId: string | null) => {
    if (userId) {
      return db.prepare('SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 50').all(userId);
    }
    return db.prepare('SELECT * FROM notifications WHERE user_id IS NULL ORDER BY created_at DESC LIMIT 50').all();
  },

  markNotificationRead: (id: string) => {
    return db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  },

  getUnreadNotificationCount: (userId: string | null) => {
    if (userId) {
      const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0').get(userId) as any;
      return row?.count || 0;
    }
    const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id IS NULL AND is_read = 0').get() as any;
    return row?.count || 0;
  },

  markAllNotificationsRead: (userId: string | null) => {
    if (userId) {
      return db.prepare('UPDATE notifications SET is_read = 1 WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0').run(userId);
    }
    return db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id IS NULL AND is_read = 0').run();
  },

  deleteNotification: (id: string) => {
    return db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
  },

  deleteNotifications: (ids: string[]) => {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`DELETE FROM notifications WHERE id IN (${placeholders})`);
    return stmt.run(...ids);
  },

  // ==============================================
  // Cloud Sync: Push All Data to Supabase
  // ==============================================
  pushAllToCloud: async (tenantId: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');

    console.log('=== Starting full sync to Supabase ===');

    // 1. Sync Products (with missing column handling)
    const products = db.prepare('SELECT * FROM products WHERE tenant_id = ?').all(tenantId) as any[];
    if (products.length > 0) {
      for (const p of products) {
        let productData = {
          id: String(p.id),
          tenant_id: tenantId,
          name: String(p.name || ''),
          price: Number(p.price || 0),
          created_at: p.createdAt ?? new Date().toISOString(),
          updated_at: p.updatedAt ?? new Date().toISOString()
        };
        // Try adding optional fields one by one
        const optionalProductFields = [
          { key: 'cost', value: Number(p.cost || 0) },
          { key: 'category', value: p.category ?? null },
          { key: 'image', value: p.image ?? null },
          { key: 'quantity', value: Number(p.quantity || 0) },
          { key: 'barcode', value: String(p.barcode || '') }
        ];
        for (const field of optionalProductFields) {
          try {
            const testData = { ...productData, [field.key]: field.value };
            const { error: testError } = await supabase.from('products').upsert(testData, { onConflict: 'id' }).select().limit(0);
            if (!testError) {
              productData[field.key] = field.value;
            }
          } catch (e) {
            console.log(`[SYNC] Product column ${field.key} not found, skipping...`);
          }
        }
        // Now sync this product
        const { error: prodError } = await supabase.from('products').upsert(productData, { onConflict: 'id' });
        if (prodError) {
          console.warn(`[SYNC] Failed to sync product ${p.id}, trying with only minimal data...`, prodError);
          const minimalOnly = {
            id: String(p.id),
            tenant_id: tenantId,
            name: String(p.name || ''),
            price: Number(p.price || 0),
            created_at: p.createdAt ?? new Date().toISOString(),
            updated_at: p.updatedAt ?? new Date().toISOString()
          };
          await supabase.from('products').upsert(minimalOnly, { onConflict: 'id' });
        }
      }
      console.log(`Synced ${products.length} products`);
    }

    // 2. Sync Variants
    const variants = db.prepare('SELECT * FROM variants WHERE tenant_id = ?').all(tenantId) as any[];
    if (variants.length > 0) {
      const cloudVariants = variants.map(v => ({
        id: v.id,
        tenant_id: tenantId,
        product_id: v.product_id,
        name: v.name,
        barcode: v.barcode || null,
        price: v.price,
        cost: v.cost,
        image: v.image || null,
        quantity: v.quantity || 0,
        created_at: v.created_at || new Date().toISOString(),
        updated_at: v.updated_at || new Date().toISOString()
      }));
      const { error: varError } = await supabase.from('variants').upsert(cloudVariants, { onConflict: 'id' });
      if (varError) throw varError;
      console.log(`Synced ${variants.length} variants`);
    }

    // 3. Sync Staff
    const staff = db.prepare('SELECT * FROM staff WHERE tenant_id = ?').all(tenantId) as any[];
    if (staff.length > 0) {
      const cloudStaff = staff.map(s => ({
        id: s.id,
        tenant_id: tenantId,
        user_id: s.userId || null,
        name: s.name,
        staff_id: s.staffId,
        passkey: s.passkey || null,
        created_by: s.createdBy || null,
        created_at: s.createdAt || new Date().toISOString()
      }));
      const { error: staffError } = await supabase.from('staff').upsert(cloudStaff, { onConflict: 'id' });
      if (staffError) throw staffError;
      console.log(`Synced ${staff.length} staff`);
    }

    // 4. Sync Users (Admins)
    const users = db.prepare('SELECT * FROM users WHERE tenant_id = ?').all(tenantId) as any[];
    if (users.length > 0) {
      const cloudUsers = users.map(u => ({
        id: u.id,
        tenant_id: tenantId,
        username: u.username,
        password: u.password,
        role: u.role,
        business_name: u.businessName || null,
        owner_name: u.ownerName || null,
        mobile: u.mobile || null,
        profile_image: u.profileImage || null,
        security_question_1: u.securityQuestion1 || null,
        security_answer_1: u.securityAnswer1 || null,
        security_question_2: u.securityQuestion2 || null,
        security_answer_2: u.securityAnswer2 || null,
        security_question_3: u.securityQuestion3 || null,
        security_answer_3: u.securityAnswer3 || null,
        created_at: u.createdAt || new Date().toISOString()
      }));
      const { error: userError } = await supabase.from('users').upsert(cloudUsers, { onConflict: 'id' });
      if (userError) throw userError;
      console.log(`Synced ${users.length} users`);
    }

    // 5. Sync Customers
    const customers = db.prepare('SELECT * FROM customers WHERE tenant_id = ?').all(tenantId) as any[];
    if (customers.length > 0) {
      const cloudCustomers = customers.map(c => ({
        id: c.id,
        tenant_id: tenantId,
        name: c.name,
        phone: c.phone,
        address: c.address || null,
        credit_rating: c.credit_rating,
        photo_url: c.photo_url || null,
        created_at: c.created_at || new Date().toISOString(),
        updated_at: c.updated_at || new Date().toISOString()
      }));
      const { error: custError } = await supabase.from('customers').upsert(cloudCustomers, { onConflict: 'id' });
      if (custError) throw custError;
      console.log(`Synced ${customers.length} customers`);
    }

    // 6. Sync Credits (Ledger)
    const credits = db.prepare('SELECT * FROM credits WHERE tenant_id = ?').all(tenantId) as any[];
    if (credits.length > 0) {
      const cloudCredits = credits.map(c => ({
        id: c.id,
        tenant_id: tenantId,
        customer_id: c.customer_id,
        amount: c.amount,
        due_date: c.due_date || null,
        remarks: c.remarks || null,
        created_at: c.created_at || new Date().toISOString()
      }));
      const { error: creditError } = await supabase.from('credits').upsert(cloudCredits, { onConflict: 'id' });
      if (creditError) throw creditError;
      console.log(`Synced ${credits.length} credits`);
    }

    // 7. Sync Payments (Ledger)
    const payments = db.prepare('SELECT * FROM payments WHERE tenant_id = ?').all(tenantId) as any[];
    if (payments.length > 0) {
      const cloudPayments = payments.map(p => ({
        id: p.id,
        tenant_id: tenantId,
        customer_id: p.customer_id,
        amount: p.amount,
        payment_method: p.payment_method,
        remarks: p.remarks || null,
        created_at: p.created_at || new Date().toISOString()
      }));
      const { error: payError } = await supabase.from('payments').upsert(cloudPayments, { onConflict: 'id' });
      if (payError) throw payError;
      console.log(`Synced ${payments.length} payments`);
    }

    // 8. Sync Reminders
    const reminders = db.prepare('SELECT * FROM reminders WHERE tenant_id = ?').all(tenantId) as any[];
    if (reminders.length > 0) {
      const cloudReminders = reminders.map(r => ({
        id: r.id,
        tenant_id: tenantId,
        customer_id: r.customer_id,
        message_type: r.message_type,
        message: r.message,
        status: r.status,
        created_at: r.created_at || new Date().toISOString()
      }));
      const { error: remError } = await supabase.from('reminders').upsert(cloudReminders, { onConflict: 'id' });
      if (remError) throw remError;
      console.log(`Synced ${reminders.length} reminders`);
    }

    // 9. Sync Non-inventory Products
    const nonInvProducts = db.prepare('SELECT * FROM non_inventory_products WHERE tenant_id = ?').all(tenantId) as any[];
    if (nonInvProducts.length > 0) {
      const cloudNonInv = nonInvProducts.map(p => ({
        id: p.id,
        tenant_id: tenantId,
        name: p.name,
        price: p.price,
        category: p.category || null,
        description: p.description || null,
        image: p.image || null,
        barcode: p.barcode,
        barcode_data: p.barcode_data || null,
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || new Date().toISOString()
      }));
      const { error: nonInvError } = await supabase.from('non_inventory_products').upsert(cloudNonInv, { onConflict: 'id' });
      if (nonInvError) throw nonInvError;
      console.log(`Synced ${nonInvProducts.length} non-inventory products`);
    }

    // 10. Sync Sales
    const sales = db.prepare('SELECT * FROM sales WHERE tenant_id = ?').all(tenantId) as any[];
    if (sales.length > 0) {
      const cloudSales = sales.map(s => ({
        id: s.id,
        tenant_id: tenantId,
        total: s.total,
        payment_type: s.paymentType,
        payment_amount: s.paymentAmount,
        staff_id: s.staffId || null,
        remitted: !!s.remitted,
        created_at: s.createdAt || new Date().toISOString()
      }));
      const { error: saleError } = await supabase.from('sales').upsert(cloudSales, { onConflict: 'id' });
      if (saleError) throw saleError;
      console.log(`Synced ${sales.length} sales`);
    }

    // 11. Sync Sale Items
    const saleItems = db.prepare('SELECT * FROM sale_items WHERE tenant_id = ?').all(tenantId) as any[];
    if (saleItems.length > 0) {
      const cloudSaleItems = saleItems.map(i => ({
        id: i.id,
        tenant_id: tenantId,
        sale_id: i.saleId,
        product_id: i.productId,
        quantity: i.quantity,
        price: i.price,
        unit: i.unit || 'pieces',
        product_name: i.productName || null,
        is_non_inventory: !!i.isNonInventory
      }));
      const { error: itemError } = await supabase.from('sale_items').upsert(cloudSaleItems, { onConflict: 'id' });
      if (itemError) throw itemError;
      console.log(`Synced ${saleItems.length} sale items`);
    }

    // 12. Sync Remittances
    const remittances = db.prepare('SELECT * FROM remittances WHERE tenant_id = ?').all(tenantId) as any[];
    if (remittances.length > 0) {
      const cloudRemittances = remittances.map(r => ({
        id: r.id,
        tenant_id: tenantId,
        staff_id: r.staff_id,
        staff_name: r.staff_name,
        amount: r.amount,
        transaction_count: r.transaction_count,
        status: r.status,
        created_at: r.created_at || new Date().toISOString(),
        confirmed_at: r.confirmed_at || null
      }));
      const { error: remitError } = await supabase.from('remittances').upsert(cloudRemittances, { onConflict: 'id' });
      if (remitError) throw remitError;
      console.log(`Synced ${remittances.length} remittances`);
    }

    // 13. Sync Notifications
    const notifications = db.prepare('SELECT * FROM notifications WHERE tenant_id = ?').all(tenantId) as any[];
    if (notifications.length > 0) {
      const cloudNotifications = notifications.map(n => ({
        id: n.id,
        tenant_id: tenantId,
        user_id: n.user_id || null,
        type: n.type,
        message: n.message,
        data: n.data || null,
        is_read: !!n.is_read,
        created_at: n.created_at || new Date().toISOString()
      }));
      const { error: notifError } = await supabase.from('notifications').upsert(cloudNotifications, { onConflict: 'id' });
      if (notifError) throw notifError;
      console.log(`Synced ${notifications.length} notifications`);
    }

    // 14. Sync Settings
    const settings = db.prepare('SELECT * FROM settings').all() as any[];
    if (settings.length > 0) {
      const cloudSettings = settings.map(s => ({
        id: randomUUID(),
        tenant_id: tenantId,
        key: s.key,
        value: s.value,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      const { error: setError } = await supabase.from('settings').upsert(cloudSettings, { onConflict: 'tenant_id,key' });
      if (setError) throw setError;
      console.log(`Synced ${settings.length} settings`);
    }

    console.log('=== Full sync to Supabase complete ===');
    return { success: true, message: 'All data pushed to Supabase' };
  },

  // ==============================================
  // Cloud Sync: Pull All Data from Supabase
  // ==============================================
  pullAllFromCloud: async (tenantId: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');

    console.log('=== Starting full sync from Supabase ===');

    // 1. Pull Products
    const { data: cloudProducts, error: prodError } = await supabase.from('products').select('*').eq('tenant_id', tenantId);
    if (prodError) throw prodError;
    if (cloudProducts && cloudProducts.length > 0) {
      dbService.saveProducts(cloudProducts.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        cost: p.cost,
        barcode: p.barcode,
        category: p.category,
        image: p.image,
        quantity: p.quantity,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      })), tenantId);
      console.log(`Pulled ${cloudProducts.length} products`);
    }

    // 2. Pull Variants
    const { data: cloudVariants, error: varError } = await supabase.from('variants').select('*').eq('tenant_id', tenantId);
    if (varError) throw varError;
    if (cloudVariants && cloudVariants.length > 0) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO variants 
        (id, tenant_id, product_id, name, barcode, price, cost, image, quantity, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction((variants: any[]) => {
        for (const v of variants) {
          insert.run(v.id, tenantId, v.product_id, v.name, v.barcode, v.price, v.cost, v.image, v.quantity, v.created_at, v.updated_at);
        }
      })(cloudVariants);
      console.log(`Pulled ${cloudVariants.length} variants`);
    }

    // 3. Pull Staff
    const { data: cloudStaff, error: staffError } = await supabase.from('staff').select('*').eq('tenant_id', tenantId);
    if (staffError) throw staffError;
    if (cloudStaff && cloudStaff.length > 0) {
      dbService.saveStaff(cloudStaff.map(s => ({
        id: s.id,
        tenantId: s.tenant_id,
        userId: s.user_id,
        name: s.name,
        staffId: s.staff_id,
        passkey: s.passkey,
        createdBy: s.created_by,
        createdAt: s.created_at
      })), tenantId);
      console.log(`Pulled ${cloudStaff.length} staff`);
    }

    // 4. Pull Users (Admins)
    const { data: cloudUsers, error: userError } = await supabase.from('users').select('*').eq('tenant_id', tenantId);
    if (userError) throw userError;
    if (cloudUsers && cloudUsers.length > 0) {
      for (const u of cloudUsers) {
        dbService.saveAdmin({
          id: u.id,
          tenantId: u.tenant_id,
          username: u.username,
          password: u.password,
          role: u.role,
          businessName: u.business_name,
          ownerName: u.owner_name,
          mobile: u.mobile,
          profileImage: u.profile_image,
          securityQuestion1: u.security_question_1,
          securityAnswer1: u.security_answer_1,
          securityQuestion2: u.security_question_2,
          securityAnswer2: u.security_answer_2,
          securityQuestion3: u.security_question_3,
          securityAnswer3: u.security_answer_3,
          createdAt: u.created_at
        });
      }
      console.log(`Pulled ${cloudUsers.length} users`);
    }

    // 5. Pull Customers
    const { data: cloudCustomers, error: custError } = await supabase.from('customers').select('*').eq('tenant_id', tenantId);
    if (custError) throw custError;
    if (cloudCustomers && cloudCustomers.length > 0) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO customers 
        (id, tenant_id, name, phone, address, credit_rating, photo_url, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction((customers: any[]) => {
        for (const c of customers) {
          insert.run(c.id, tenantId, c.name, c.phone, c.address, c.credit_rating, c.photo_url, c.created_at, c.updated_at);
        }
      })(cloudCustomers);
      console.log(`Pulled ${cloudCustomers.length} customers`);
    }

    // 6. Pull Credits
    const { data: cloudCredits, error: creditError } = await supabase.from('credits').select('*').eq('tenant_id', tenantId);
    if (creditError) throw creditError;
    if (cloudCredits && cloudCredits.length > 0) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO credits 
        (id, tenant_id, customer_id, amount, due_date, remarks, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction((credits: any[]) => {
        for (const c of credits) {
          insert.run(c.id, tenantId, c.customer_id, c.amount, c.due_date, c.remarks, c.created_at);
        }
      })(cloudCredits);
      console.log(`Pulled ${cloudCredits.length} credits`);
    }

    // 7. Pull Payments
    const { data: cloudPayments, error: payError } = await supabase.from('payments').select('*').eq('tenant_id', tenantId);
    if (payError) throw payError;
    if (cloudPayments && cloudPayments.length > 0) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO payments 
        (id, tenant_id, customer_id, amount, payment_method, remarks, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction((payments: any[]) => {
        for (const p of payments) {
          insert.run(p.id, tenantId, p.customer_id, p.amount, p.payment_method, p.remarks, p.created_at);
        }
      })(cloudPayments);
      console.log(`Pulled ${cloudPayments.length} payments`);
    }

    // 8. Pull Reminders
    const { data: cloudReminders, error: remError } = await supabase.from('reminders').select('*').eq('tenant_id', tenantId);
    if (remError) throw remError;
    if (cloudReminders && cloudReminders.length > 0) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO reminders 
        (id, tenant_id, customer_id, message_type, message, status, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction((reminders: any[]) => {
        for (const r of reminders) {
          insert.run(r.id, tenantId, r.customer_id, r.message_type, r.message, r.status, r.created_at);
        }
      })(cloudReminders);
      console.log(`Pulled ${cloudReminders.length} reminders`);
    }

    // 9. Pull Non-inventory Products
    const { data: cloudNonInv, error: nonInvError } = await supabase.from('non_inventory_products').select('*').eq('tenant_id', tenantId);
    if (nonInvError) throw nonInvError;
    if (cloudNonInv && cloudNonInv.length > 0) {
      dbService.saveNonInventoryProducts(cloudNonInv.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        description: p.description,
        image: p.image,
        barcode: p.barcode,
        barcodeData: p.barcode_data,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      })), tenantId);
      console.log(`Pulled ${cloudNonInv.length} non-inventory products`);
    }

    // 10. Pull Sales
    const { data: cloudSales, error: saleError } = await supabase.from('sales').select('*').eq('tenant_id', tenantId);
    if (saleError) throw saleError;
    if (cloudSales && cloudSales.length > 0) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO sales 
        (id, tenant_id, total, paymentType, paymentAmount, staffId, remitted, createdAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction((sales: any[]) => {
        for (const s of sales) {
          insert.run(s.id, tenantId, s.total, s.payment_type, s.payment_amount, s.staff_id, s.remitted ? 1 : 0, s.created_at);
        }
      })(cloudSales);
      console.log(`Pulled ${cloudSales.length} sales`);
    }

    // 11. Pull Sale Items
    const { data: cloudSaleItems, error: itemError } = await supabase.from('sale_items').select('*').eq('tenant_id', tenantId);
    if (itemError) throw itemError;
    if (cloudSaleItems && cloudSaleItems.length > 0) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO sale_items 
        (id, tenant_id, saleId, productId, quantity, price, unit, productName, isNonInventory) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction((items: any[]) => {
        for (const i of items) {
          insert.run(i.id, tenantId, i.sale_id, i.product_id, i.quantity, i.price, i.unit, i.product_name, i.is_non_inventory ? 1 : 0);
        }
      })(cloudSaleItems);
      console.log(`Pulled ${cloudSaleItems.length} sale items`);
    }

    // 12. Pull Remittances
    const { data: cloudRemittances, error: remitError } = await supabase.from('remittances').select('*').eq('tenant_id', tenantId);
    if (remitError) throw remitError;
    if (cloudRemittances && cloudRemittances.length > 0) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO remittances 
        (id, tenant_id, staff_id, staff_name, amount, transaction_count, status, created_at, confirmed_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction((remittances: any[]) => {
        for (const r of remittances) {
          insert.run(r.id, tenantId, r.staff_id, r.staff_name, r.amount, r.transaction_count, r.status, r.created_at, r.confirmed_at);
        }
      })(cloudRemittances);
      console.log(`Pulled ${cloudRemittances.length} remittances`);
    }

    // 13. Pull Notifications
    const { data: cloudNotifications, error: notifError } = await supabase.from('notifications').select('*').eq('tenant_id', tenantId);
    if (notifError) throw notifError;
    if (cloudNotifications && cloudNotifications.length > 0) {
      const insert = db.prepare(`
        INSERT OR REPLACE INTO notifications 
        (id, tenant_id, user_id, type, message, data, is_read, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction((notifs: any[]) => {
        for (const n of notifs) {
          insert.run(n.id, tenantId, n.user_id, n.type, n.message, n.data, n.is_read ? 1 : 0, n.created_at);
        }
      })(cloudNotifications);
      console.log(`Pulled ${cloudNotifications.length} notifications`);
    }

    // 14. Pull Settings
    const { data: cloudSettings, error: setError } = await supabase.from('settings').select('*').eq('tenant_id', tenantId);
    if (setError) throw setError;
    if (cloudSettings && cloudSettings.length > 0) {
      const settingsObj: Record<string, any> = {};
      for (const s of cloudSettings) {
        try {
          settingsObj[s.key] = JSON.parse(s.value);
        } catch {
          settingsObj[s.key] = s.value;
        }
      }
      dbService.upsertSettings(settingsObj);
      console.log(`Pulled ${cloudSettings.length} settings`);
    }

    console.log('=== Full sync from Supabase complete ===');
    return { success: true, message: 'All data pulled from Supabase' };
  }
};

export default dbService;
