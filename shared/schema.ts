import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Tenants table - single source of truth for all stores
export const tenants = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  storeName: text("store_name").notNull(),
  subdomain: text("subdomain").unique().notNull(),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
});

// Users table for authentication
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  username: text("username").unique(),
  email: text("email").unique(),
  mobile: text("mobile").unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'owner', 'admin', 'manager', 'staff', 'cashier'
  staffId: text("staff_id"),
  businessName: text("business_name"),
  ownerName: text("owner_name"),
  location: text("location"), // City/Region
  profileImage: text("profile_image"), // Base64 encoded profile image
  securityQuestion1: text("security_question_1"),
  securityAnswer1: text("security_answer_1"),
  securityQuestion2: text("security_question_2"),
  securityAnswer2: text("security_answer_2"),
  securityQuestion3: text("security_question_3"),
  securityAnswer3: text("security_answer_3"),
  failedAttemptCount: integer("failed_attempt_count").default(0),
  lockoutUntil: integer("lockout_until", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
});



// Products table for inventory
export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull().unique(),
  barcode: text("barcode").unique(),
  price: real("price").notNull(),
  cost: real("cost").default(0),
  quantity: integer("quantity").notNull().default(0),
  category: text("category").default("general"),
  description: text("description"),
  image: text("image"), // Base64 encoded image or URL
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(new Date()),
});

// Variants table for product variants
export const variants = sqliteTable("variants", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  productId: text("product_id").notNull(),
  name: text("name").notNull(),
  barcode: text("barcode"),
  price: real("price").notNull(),
  cost: real("cost").notNull(),
  quantity: integer("quantity").notNull().default(0),
  image: text("image"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(new Date()),
});

// Sales table for transactions
export const sales = sqliteTable("sales", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  total: real("total").notNull(),
  paymentType: text("payment_type").notNull(), // 'cash' or 'ewallet'
  paymentAmount: real("payment_amount").notNull(),
  staffId: text("staff_id"),
  remitted: integer("remitted", { mode: 'boolean' }).default(false),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
});

// Sale items table
export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  saleId: text("sale_id").notNull(),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  price: real("price").notNull(),
  unit: text("unit").default("pieces"),
  productName: text("product_name"),
  isNonInventory: integer("is_non_inventory", { mode: 'boolean' }).default(false),
});

// Staff table for management
export const staff = sqliteTable("staff", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  userId: text("user_id"),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  name: text("name").notNull(), // Full name (computed)
  staffId: text("staff_id").notNull().unique(),
  passkey: text("passkey").notNull(),
  role: text("role").default("cashier"), // cashier, manager, admin
  branch: text("branch"),
  department: text("department"),
  employmentStatus: text("employment_status").default("active"), // active, inactive, on_leave
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  birthdate: integer("birthdate", { mode: 'timestamp' }),
  gender: text("gender"), // male, female, other
  dateHired: integer("date_hired", { mode: 'timestamp' }),
  assignedShift: text("assigned_shift"), // morning, afternoon, evening
  lastLogin: integer("last_login", { mode: 'timestamp' }),
  passwordLastChanged: integer("password_last_changed", { mode: 'timestamp' }),
  permissions: text("permissions", { mode: 'json' }), // JSON array of permissions
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(new Date()),
});

// Attendance table
export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  staffId: text("staff_id").notNull(),
  date: integer("date", { mode: 'timestamp' }).notNull(),
  clockIn: integer("clock_in", { mode: 'timestamp' }),
  clockOut: integer("clock_out", { mode: 'timestamp' }),
  hoursWorked: real("hours_worked"),
  isLate: integer("is_late", { mode: 'boolean' }).default(false),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(new Date()),
});

// Login History table
export const loginHistory = sqliteTable("login_history", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  staffId: text("staff_id").notNull(),
  deviceInfo: text("device_info"),
  ipAddress: text("ip_address"),
  loginTime: integer("login_time", { mode: 'timestamp' }).notNull(),
  logoutTime: integer("logout_time", { mode: 'timestamp' }),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
});

// Expenses table
export const expenses = sqliteTable("expenses", {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    description: text("description").notNull(),
    amount: real("amount").notNull(),
    category: text("category").notNull(),
    date: integer("date", { mode: 'timestamp' }).notNull(),
});

// Purchases table
export const purchases = sqliteTable("purchases", {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    productName: text("productName").notNull(),
    quantity: integer("quantity").notNull(),
    cost: real("cost").notNull(),
    supplier: text("supplier"),
    date: integer("date", { mode: 'timestamp' }).notNull(),
    description: text("description"),
    details: text("details"),
    expirationDate: integer("expiration_date", { mode: 'timestamp' }),
});

// Non-inventory products table
export const nonInventoryProducts = sqliteTable("non_inventory_products", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull().unique(),
  price: real("price").notNull(),
  category: text("category").default("general"),
  description: text("description"),
  image: text("image"), // Base64 encoded image or URL
  barcode: text("barcode").unique(),
  barcodeData: text("barcode_data"), // SVG or Base64 barcode image
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(new Date()),
});

// Creditors table
export const creditors = sqliteTable("creditors", {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    name: text("name").notNull(),
    amount: real("amount").notNull(),
    description: text("description"),
    dueDate: integer("dueDate", { mode: 'timestamp' }),
    reminderDate: integer("reminderDate", { mode: 'timestamp' }),
    isPaid: integer("is_paid", { mode: 'boolean' }).default(false),
});

// Customers table
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  address: text("address"),
  creditRating: text("credit_rating").notNull(), // 'good' or 'bad'
  photoUrl: text("photo_url"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).notNull(),
});

// Credits table (Loans/Debts per customer)
export const credits = sqliteTable("credits", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  customerId: text("customer_id").notNull(),
  amount: real("amount").notNull(),
  dueDate: integer("due_date", { mode: 'timestamp' }),
  remarks: text("remarks"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

// Payments table (Customer payments towards credit)
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  customerId: text("customer_id").notNull(),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").notNull(),
  remarks: text("remarks"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull(),
});

// Remittances table for staff remitting daily sales to admin
export const remittances = sqliteTable("remittances", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  staffId: text("staff_id").notNull(),
  staffName: text("staff_name").notNull(),
  amount: real("amount").notNull(),
  transactionCount: integer("transaction_count").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'confirmed', 'rejected'
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
  confirmedAt: integer("confirmed_at", { mode: 'timestamp' }),
});

// Notifications table for system alerts
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  userId: text("user_id"), // recipient, null for all admins
  type: text("type").notNull(), // 'remittance', 'system_update', 'inventory_alert', 'security', 'storage'
  message: text("message").notNull(),
  data: text("data"), // JSON string for extra payload
  isRead: integer("is_read", { mode: 'boolean' }).default(false),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
});

// Activity logs for developer monitoring
export const activityLogs = sqliteTable("activity_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  eventType: text("event_type").notNull(), // 'login', 'logout', 'product_create', etc.
  userId: text("user_id"),
  storeId: text("store_id"),
  description: text("description").notNull(),
  metadata: text("metadata"), // JSON string
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
});

// Security events for defense hub
export const securityEvents = sqliteTable("security_events", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  type: text("type").notNull(), // 'failed_login', 'multiple_devices', 'suspicious_access'
  severity: text("severity").notNull(), // 'low', 'medium', 'high'
  description: text("description").notNull(),
  ipAddress: text("ip_address"),
  location: text("location"),
  userId: text("user_id"),
  metadata: text("metadata"),
  resolved: integer("resolved", { mode: 'boolean' }).default(false),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
});

// Error logs for system monitoring
export const errorLogs = sqliteTable("error_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  message: text("message").notNull(),
  stack: text("stack"),
  route: text("route"),
  browser: text("browser"),
  os: text("os"),
  userId: text("user_id"),
  storeId: text("store_id"),
  timestamp: integer("timestamp", { mode: "timestamp" }).default(new Date()),
});

// Audit logs for staff changes
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  adminId: text("admin_id"), // ID of admin who made the change
  adminName: text("admin_name"),
  action: text("action").notNull(), // e.g., "Updated Staff"
  staffId: text("staff_id"), // ID of staff affected
  staffName: text("staff_name"),
  changedFields: text("changed_fields", { mode: "json" }), // JSON array of changed fields
  ipAddress: text("ip_address"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(new Date()),
});

// Feature flags for remote configuration
export const featureFlags = sqliteTable("feature_flags", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  enabled: integer("enabled", { mode: 'boolean' }).default(false),
  description: text("description"),
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(new Date()),
});

// System settings for developer console
export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON string
  category: text("category").notNull(), // 'general', 'appearance', 'maintenance', etc.
  updatedAt: integer("updated_at", { mode: 'timestamp' }).default(new Date()),
});

// Developer sessions for RBAC and audit
export const developerSessions = sqliteTable("developer_sessions", {
  id: text("id").primaryKey(),
  developerId: text("developer_id").notNull(),
  token: text("token").notNull(),
  deviceInfo: text("device_info"),
  ipAddress: text("ip_address"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
  expiresAt: integer("expires_at", { mode: 'timestamp' }),
});

// Staff Constants
export const staffRoles = ['cashier', 'manager', 'admin'] as const;
export const employmentStatuses = ['active', 'inactive', 'on_leave'] as const;
export const assignedShifts = ['morning', 'afternoon', 'evening'] as const;
export const staffGenders = ['male', 'female', 'other'] as const;
export const staffPermissions = ['sales.create', 'sales.view', 'products.manage', 'customers.manage', 'staff.view', 'reports.view'] as const;

// Insert schemas
export const insertTenantSchema = createInsertSchema(tenants);
export const insertAttendanceSchema = createInsertSchema(attendance);
export const insertLoginHistorySchema = createInsertSchema(loginHistory);
export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const insertActivityLogSchema = createInsertSchema(activityLogs);
export const insertSecurityEventSchema = createInsertSchema(securityEvents);
export const insertErrorLogSchema = createInsertSchema(errorLogs);
export const insertFeatureFlagSchema = createInsertSchema(featureFlags);
export const insertSystemSettingSchema = createInsertSchema(systemSettings);
export const insertDeveloperSessionSchema = createInsertSchema(developerSessions);

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  mobile: true,
  password: true,
  role: true,
  staffId: true,
  businessName: true,
  ownerName: true,
  location: true,
  securityQuestion1: true,
  securityAnswer1: true,
  securityQuestion2: true,
  securityAnswer2: true,
  securityQuestion3: true,
  securityAnswer3: true,
  failedAttemptCount: true,
  lockoutUntil: true,
});

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  barcode: true,
  price: true,
  quantity: true,
  category: true,
  description: true,
  image: true,
});

export const insertSaleSchema = createInsertSchema(sales).pick({
  total: true,
  paymentType: true,
  paymentAmount: true,
  staffId: true,
});

export const insertSaleItemSchema = createInsertSchema(saleItems);

export const insertStaffSchema = createInsertSchema(staff).pick({
  firstName: true,
  middleName: true,
  lastName: true,
  name: true,
  staffId: true,
  passkey: true,
  role: true,
  branch: true,
  department: true,
  employmentStatus: true,
  email: true,
  phone: true,
  address: true,
  birthdate: true,
  gender: true,
  dateHired: true,
  assignedShift: true,
  permissions: true,
  createdBy: true,
});

export const staffCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  middleName: z.string().trim().max(100).optional().nullable(),
  lastName: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(250),
  staffId: z.string().trim().min(1).max(50),
  passkey: z.string().min(4).max(200),
  role: z.enum(staffRoles).default('cashier'),
  branch: z.string().trim().max(150).optional().nullable(),
  department: z.string().trim().max(150).optional().nullable(),
  employmentStatus: z.enum(employmentStatuses).default('active'),
  email: z.string().trim().email().max(254).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  birthdate: z.coerce.date().optional().nullable(),
  gender: z.enum(staffGenders).optional().nullable(),
  dateHired: z.coerce.date().optional().nullable(),
  assignedShift: z.enum(assignedShifts).optional().nullable(),
  permissions: z.array(z.enum(staffPermissions)).default([]),
});

export const staffUpdateSchema = z.preprocess(
  (raw: any) => {
    if (!raw || typeof raw !== 'object') return raw;
    const cleaned: Record<string, any> = { ...raw };
    const emptyAsNull = ['phone', 'address', 'branch', 'department', 'firstName', 'middleName', 'lastName'];
    const emptyAsUndefined = ['email', 'role', 'employmentStatus', 'gender', 'assignedShift', 'birthdate', 'dateHired'];
    for (const k of Object.keys(cleaned)) {
      const v = cleaned[k];
      if (typeof v === 'string' && v.trim() === '') {
        if (emptyAsNull.includes(k)) cleaned[k] = null;
        else if (emptyAsUndefined.includes(k)) cleaned[k] = undefined;
        else cleaned[k] = undefined;
      }
    }
    return cleaned;
  },
  staffCreateSchema.partial().omit({ staffId: true, passkey: true, name: true })
);

export const staffStatusSchema = z.object({ status: z.enum(employmentStatuses) });
export const staffPermissionsSchema = z.object({ permissions: z.array(z.enum(staffPermissions)).max(staffPermissions.length) });

export const insertExpenseSchema = createInsertSchema(expenses);
export const insertPurchaseSchema = createInsertSchema(purchases);
export const insertCreditorSchema = createInsertSchema(creditors);
export const insertCustomerSchema = createInsertSchema(customers);

export const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  address: z.string().optional(),
  credit_rating: z.enum(['good','bad']),
  photo_url: z.string().url().optional(),
});

export const insertCreditSchema = createInsertSchema(credits);

export const creditSchema = z.object({
  amount: z.number().positive(),
  due_date: z.string().datetime().optional(),
  remarks: z.string().optional(),
  date: z.string().datetime().optional(),
});

export const insertPaymentSchema = createInsertSchema(payments);

export const paymentSchema = z.object({
  amount: z.number().positive(),
  payment_method: z.enum(['cash','gcash','bank','others']),
  remarks: z.string().optional(),
  date: z.string().datetime().optional(),
});

export const insertRemittanceSchema = createInsertSchema(remittances);
export const insertNotificationSchema = createInsertSchema(notifications);

export const insertNonInventoryProductSchema = createInsertSchema(nonInventoryProducts).pick({
  name: true,
  price: true,
  category: true,
  description: true,
  image: true,
  barcode: true,
  barcodeData: true,
});

export const insertVariantSchema = createInsertSchema(variants).pick({
  productId: true,
  name: true,
  barcode: true,
  price: true,
  cost: true,
  image: true,
});

// Update schemas
export const updateTenantSchema = insertTenantSchema.partial();
export const updateUserSchema = insertUserSchema.partial();
export const updateProductSchema = insertProductSchema.partial();
export const updateVariantSchema = insertVariantSchema.partial();
export const updateSaleSchema = insertSaleSchema.partial();
export const updateSaleItemSchema = insertSaleItemSchema.partial();
export const updateStaffSchema = staffUpdateSchema;
export const updateAttendanceSchema = insertAttendanceSchema.partial();
export const updateLoginHistorySchema = insertLoginHistorySchema.partial();
export const updateExpenseSchema = insertExpenseSchema.partial();
export const updatePurchaseSchema = insertPurchaseSchema.partial();
export const updateCreditorSchema = insertCreditorSchema.partial();
export const updateCustomerSchema = customerSchema.partial();
export const updateCreditSchema = creditSchema.partial();
export const updatePaymentSchema = paymentSchema.partial();
export const updateRemittanceSchema = insertRemittanceSchema.partial();
export const updateNotificationSchema = insertNotificationSchema.partial();
export const updateActivityLogSchema = insertActivityLogSchema.partial();
export const updateSecurityEventSchema = insertSecurityEventSchema.partial();
export const updateErrorLogSchema = insertErrorLogSchema.partial();
export const updateAuditLogSchema = insertAuditLogSchema.partial();
export const updateFeatureFlagSchema = insertFeatureFlagSchema.partial();
export const updateSystemSettingSchema = insertSystemSettingSchema.partial();
export const updateDeveloperSessionSchema = insertDeveloperSessionSchema.partial();
export const updateNonInventoryProductSchema = insertNonInventoryProductSchema.partial();

// Types
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type UpdateTenant = z.infer<typeof updateTenantSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;

export type Variant = typeof variants.$inferSelect;
export type InsertVariant = z.infer<typeof insertVariantSchema>;
export type UpdateVariant = z.infer<typeof updateVariantSchema>;

export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type UpdateSale = z.infer<typeof updateSaleSchema>;

export type SaleItem = typeof saleItems.$inferSelect;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type UpdateSaleItem = z.infer<typeof updateSaleItemSchema>;

export type Staff = typeof staff.$inferSelect;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type UpdateStaff = z.infer<typeof updateStaffSchema>;

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type UpdateAttendance = z.infer<typeof updateAttendanceSchema>;

export type LoginHistory = typeof loginHistory.$inferSelect;
export type InsertLoginHistory = z.infer<typeof insertLoginHistorySchema>;
export type UpdateLoginHistory = z.infer<typeof updateLoginHistorySchema>;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type UpdateExpense = z.infer<typeof updateExpenseSchema>;

export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type UpdatePurchase = z.infer<typeof updatePurchaseSchema>;

export type Creditor = typeof creditors.$inferSelect;
export type InsertCreditor = z.infer<typeof insertCreditorSchema>;
export type UpdateCreditor = z.infer<typeof updateCreditorSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type UpdateCustomer = z.infer<typeof updateCustomerSchema>;

export type Credit = typeof credits.$inferSelect;
export type InsertCredit = z.infer<typeof insertCreditSchema>;
export type UpdateCredit = z.infer<typeof updateCreditSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type UpdatePayment = z.infer<typeof updatePaymentSchema>;

export type Remittance = typeof remittances.$inferSelect;
export type InsertRemittance = z.infer<typeof insertRemittanceSchema>;
export type UpdateRemittance = z.infer<typeof updateRemittanceSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type UpdateNotification = z.infer<typeof updateNotificationSchema>;

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type UpdateActivityLog = z.infer<typeof updateActivityLogSchema>;

export type SecurityEvent = typeof securityEvents.$inferSelect;
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;
export type UpdateSecurityEvent = z.infer<typeof updateSecurityEventSchema>;

export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type UpdateErrorLog = z.infer<typeof updateErrorLogSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type UpdateAuditLog = z.infer<typeof updateAuditLogSchema>;

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type UpdateFeatureFlag = z.infer<typeof updateFeatureFlagSchema>;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type UpdateSystemSetting = z.infer<typeof updateSystemSettingSchema>;

export type DeveloperSession = typeof developerSessions.$inferSelect;
export type InsertDeveloperSession = z.infer<typeof insertDeveloperSessionSchema>;
export type UpdateDeveloperSession = z.infer<typeof updateDeveloperSessionSchema>;

export type NonInventoryProduct = typeof nonInventoryProducts.$inferSelect;
export type InsertNonInventoryProduct = z.infer<typeof insertNonInventoryProductSchema>;
export type UpdateNonInventoryProduct = z.infer<typeof updateNonInventoryProductSchema>;

// Cart item type for sales
export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unit: 'pieces' | 'dozen' | 'carton';
  subtotal: number;
  isNonInventory?: boolean;
};

