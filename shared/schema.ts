import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").unique(),
  email: text("email").unique(),
  mobile: text("mobile").unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'admin' or 'staff'
  staffId: text("staff_id"),
  businessName: text("business_name"),
  ownerName: text("owner_name"),
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
  name: text("name").notNull(),
  staffId: text("staff_id").notNull().unique(),
  passkey: text("passkey").notNull(),
  createdBy: text("created_by"),
  createdAt: integer("created_at", { mode: 'timestamp' }).default(new Date()),
});

// Expenses table
export const expenses = sqliteTable("expenses", {
    id: text("id").primaryKey(),
    description: text("description").notNull(),
    amount: real("amount").notNull(),
    category: text("category").notNull(),
    date: integer("date", { mode: 'timestamp' }).notNull(),
});

// Purchases table
export const purchases = sqliteTable("purchases", {
    id: text("id").primaryKey(),
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
    name: text("name").notNull(),
    amount: real("amount").notNull(),
    description: text("description"),
    dueDate: integer("dueDate", { mode: 'timestamp' }),
    reminderDate: integer("reminderDate", { mode: 'timestamp' }),
    isPaid: integer("is_paid", { mode: 'boolean' }).default(false),
});

// Remittances table for staff remitting daily sales to admin
export const remittances = sqliteTable("remittances", {
  id: text("id").primaryKey(),
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
  message: text("message").notNull(),
  stack: text("stack"),
  route: text("route"),
  browser: text("browser"),
  os: text("os"),
  userId: text("user_id"),
  storeId: text("store_id"),
  timestamp: integer("timestamp", { mode: 'timestamp' }).default(new Date()),
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

// Insert schemas
export const insertActivityLogSchema = createInsertSchema(activityLogs);
export const insertSecurityEventSchema = createInsertSchema(securityEvents);
export const insertErrorLogSchema = createInsertSchema(errorLogs);
export const insertFeatureFlagSchema = createInsertSchema(featureFlags);
export const insertSystemSettingSchema = createInsertSchema(systemSettings);
export const insertDeveloperSessionSchema = createInsertSchema(developerSessions);

// Types
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type DeveloperSession = typeof developerSessions.$inferSelect;
export type InsertDeveloperSession = z.infer<typeof insertDeveloperSessionSchema>;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  mobile: true,
  password: true,
  role: true,
  staffId: true,
  businessName: true,
  ownerName: true,
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
  name: true,
  staffId: true,
  passkey: true,
  createdBy: true,
});

export const insertExpenseSchema = createInsertSchema(expenses);
export const insertPurchaseSchema = createInsertSchema(purchases);
export const insertCreditorSchema = createInsertSchema(creditors);
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

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type InsertVariant = z.infer<typeof insertVariantSchema>;
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleItem = typeof saleItems.$inferSelect;
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchases.$inferSelect;
export type InsertCreditor = z.infer<typeof insertCreditorSchema>;
export type Creditor = typeof creditors.$inferSelect;
export type Remittance = typeof remittances.$inferSelect;
export type InsertRemittance = z.infer<typeof insertRemittanceSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NonInventoryProduct = typeof nonInventoryProducts.$inferSelect;
export type InsertNonInventoryProduct = z.infer<typeof insertNonInventoryProductSchema>;


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
