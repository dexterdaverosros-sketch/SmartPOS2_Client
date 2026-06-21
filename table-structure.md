# SmartPOS+ Database Schema Reference

## Tables

### 1. tenants
Stores information about each tenant (business/store).

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique tenant ID | PRIMARY KEY |
| store_name | TEXT | Store/business name | NOT NULL |
| subdomain | TEXT | Unique subdomain for the tenant | NOT NULL, UNIQUE |
| created_at | INTEGER/DATE | Timestamp when tenant was created | DEFAULT: current time |

---

### 2. users
Stores user accounts (admins and staff).

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique user ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant this user belongs to | NOT NULL |
| username | TEXT | Unique username | UNIQUE |
| email | TEXT | User email | UNIQUE |
| mobile | TEXT | User mobile number | UNIQUE |
| password | TEXT | Hashed password | NOT NULL |
| role | TEXT | User role | NOT NULL (owner, admin, manager, staff, cashier) |
| staff_id | TEXT | Reference to staff table (if applicable) | |
| business_name | TEXT | Business name (for admin users) | |
| owner_name | TEXT | Owner name (for admin users) | |
| location | TEXT | Business location | |
| profile_image | TEXT | Base64 encoded profile image | |
| security_question_1 | TEXT | Security question 1 | |
| security_answer_1 | TEXT | Hashed security answer 1 | |
| security_question_2 | TEXT | Security question 2 | |
| security_answer_2 | TEXT | Hashed security answer 2 | |
| security_question_3 | TEXT | Security question 3 | |
| security_answer_3 | TEXT | Hashed security answer 3 | |
| failed_attempt_count | INTEGER | Number of failed login attempts | DEFAULT: 0 |
| lockout_until | INTEGER/DATE | Timestamp when lockout ends | |
| created_at | INTEGER/DATE | Timestamp when user was created | DEFAULT: current time |

---

### 3. staff
Stores staff member information.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique staff ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant this staff belongs to | NOT NULL |
| user_id | TEXT | Reference to users table | |
| name | TEXT | Staff member's full name | NOT NULL |
| staff_id | TEXT | Unique staff identifier | NOT NULL, UNIQUE |
| passkey | TEXT | Hashed passkey for staff login | |
| created_by | TEXT | ID of user who created this staff | |
| created_at | INTEGER/DATE | Timestamp when staff was created | DEFAULT: current time |

---

### 4. products
Stores product inventory.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique product ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant this product belongs to | NOT NULL |
| name | TEXT | Product name | NOT NULL, UNIQUE |
| barcode | TEXT | Product barcode | UNIQUE |
| price | REAL | Product selling price | NOT NULL |
| cost | REAL | Product cost price | DEFAULT: 0 |
| quantity | INTEGER | Available stock quantity | NOT NULL, DEFAULT: 0 |
| category | TEXT | Product category | DEFAULT: 'general' |
| description | TEXT | Product description | |
| image | TEXT | Product image (Base64 or URL) | |
| created_at | INTEGER/DATE | Timestamp when product was created | DEFAULT: current time |
| updated_at | INTEGER/DATE | Timestamp when product was last updated | DEFAULT: current time |

---

### 5. variants
Stores product variants.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique variant ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant this variant belongs to | NOT NULL |
| product_id | TEXT | Reference to products table | NOT NULL |
| name | TEXT | Variant name | NOT NULL |
| barcode | TEXT | Variant barcode | |
| price | REAL | Variant selling price | NOT NULL |
| cost | REAL | Variant cost price | NOT NULL |
| quantity | INTEGER | Available stock quantity | NOT NULL, DEFAULT: 0 |
| image | TEXT | Variant image | |
| created_at | INTEGER/DATE | Timestamp when variant was created | DEFAULT: current time |
| updated_at | INTEGER/DATE | Timestamp when variant was last updated | DEFAULT: current time |

---

### 6. sales
Stores transaction records.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique sale ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant this sale belongs to | NOT NULL |
| total | REAL | Total sale amount | NOT NULL |
| payment_type | TEXT | Payment method | NOT NULL |
| payment_amount | REAL | Amount paid | NOT NULL |
| staff_id | TEXT | ID of staff who processed the sale | |
| remitted | INTEGER/BOOLEAN | Whether sale has been remitted | DEFAULT: 0 (false) |
| created_at | INTEGER/DATE | Timestamp when sale was processed | DEFAULT: current time |

---

### 7. sale_items
Stores individual items in each sale.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique sale item ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant this item belongs to | NOT NULL |
| sale_id | TEXT | Reference to sales table | NOT NULL |
| product_id | TEXT | Reference to products or variants table | NOT NULL |
| quantity | INTEGER | Quantity sold | NOT NULL |
| price | REAL | Price per unit | NOT NULL |
| unit | TEXT | Unit of measurement | DEFAULT: 'pieces' |
| product_name | TEXT | Name of the product at time of sale | |
| is_non_inventory | INTEGER/BOOLEAN | Whether item is non-inventory | DEFAULT: 0 (false) |

---

### 8. non_inventory_products
Stores products that aren't tracked in inventory.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant | NOT NULL |
| name | TEXT | Product name | NOT NULL, UNIQUE |
| price | REAL | Product price | NOT NULL |
| category | TEXT | Product category | DEFAULT: 'general' |
| description | TEXT | Product description | |
| image | TEXT | Product image | |
| barcode | TEXT | Product barcode | UNIQUE |
| barcode_data | TEXT | SVG or Base64 barcode image | |
| created_at | INTEGER/DATE | Timestamp when created | DEFAULT: current time |
| updated_at | INTEGER/DATE | Timestamp when last updated | DEFAULT: current time |

---

### 9. customers
Stores customer information.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique customer ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant | NOT NULL |
| name | TEXT | Customer name | NOT NULL |
| phone | TEXT | Customer phone number | NOT NULL |
| address | TEXT | Customer address | |
| credit_rating | TEXT | Credit rating (good/bad) | NOT NULL |
| photo_url | TEXT | Customer photo | |
| created_at | INTEGER/DATE | Timestamp when created | NOT NULL |
| updated_at | INTEGER/DATE | Timestamp when last updated | NOT NULL |

---

### 10. credits
Stores customer credit/loan records.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique credit ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant | NOT NULL |
| customer_id | TEXT | Reference to customers table | NOT NULL |
| amount | REAL | Credit/loan amount | NOT NULL |
| due_date | INTEGER/DATE | Payment due date | |
| remarks | TEXT | Additional notes | |
| created_at | INTEGER/DATE | Timestamp when created | NOT NULL |

---

### 11. payments
Stores customer payments.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique payment ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant | NOT NULL |
| customer_id | TEXT | Reference to customers table | NOT NULL |
| amount | REAL | Payment amount | NOT NULL |
| payment_method | TEXT | Payment method | NOT NULL |
| remarks | TEXT | Additional notes | |
| created_at | INTEGER/DATE | Timestamp when created | NOT NULL |

---

### 12. creditors
Stores creditor information.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique creditor ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant | NOT NULL |
| name | TEXT | Creditor name | NOT NULL |
| amount | REAL | Amount owed | NOT NULL |
| description | TEXT | Description/transaction details | |
| due_date | INTEGER/DATE | Payment due date | |
| reminder_date | INTEGER/DATE | Reminder date | |
| is_paid | INTEGER/BOOLEAN | Whether paid | DEFAULT: 0 (false) |

---

### 13. expenses
Stores expense records.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique expense ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant | NOT NULL |
| description | TEXT | Expense description | NOT NULL |
| amount | REAL | Expense amount | NOT NULL |
| category | TEXT | Expense category | NOT NULL |
| date | INTEGER/DATE | Expense date | NOT NULL |

---

### 14. purchases
Stores purchase records.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique purchase ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant | NOT NULL |
| product_name | TEXT | Product name | NOT NULL |
| quantity | INTEGER | Quantity purchased | NOT NULL |
| cost | REAL | Cost price | NOT NULL |
| supplier | TEXT | Supplier name | |
| date | INTEGER/DATE | Purchase date | NOT NULL |
| description | TEXT | Description | |
| details | TEXT | Additional details | |
| expiration_date | INTEGER/DATE | Product expiration date | |

---

### 15. remittances
Stores staff remittance records.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique remittance ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant | NOT NULL |
| staff_id | TEXT | Reference to staff table | NOT NULL |
| staff_name | TEXT | Staff name | NOT NULL |
| amount | REAL | Remittance amount | NOT NULL |
| transaction_count | INTEGER | Number of transactions | NOT NULL |
| status | TEXT | Status (pending, confirmed, rejected) | NOT NULL, DEFAULT: 'pending' |
| created_at | INTEGER/DATE | Timestamp when created | DEFAULT: current time |
| confirmed_at | INTEGER/DATE | Timestamp when confirmed | |

---

### 16. notifications
Stores system notifications.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique notification ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant | NOT NULL |
| user_id | TEXT | Recipient user ID (null for all admins) | |
| type | TEXT | Notification type | NOT NULL |
| message | TEXT | Notification message | NOT NULL |
| data | TEXT | Additional data (JSON string) | |
| is_read | INTEGER/BOOLEAN | Whether read | DEFAULT: 0 (false) |
| created_at | INTEGER/DATE | Timestamp when created | DEFAULT: current time |

---

### 17. activity_logs
Stores activity logs for monitoring.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique log ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant | NOT NULL |
| event_type | TEXT | Event type | NOT NULL |
| user_id | TEXT | User ID | |
| store_id | TEXT | Store ID | |
| description | TEXT | Event description | NOT NULL |
| metadata | TEXT | Additional metadata (JSON string) | |
| created_at | INTEGER/DATE | Timestamp when created | DEFAULT: current time |

---

### 18. security_events
Stores security-related events.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique event ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant | NOT NULL |
| type | TEXT | Event type | NOT NULL |
| severity | TEXT | Severity (low, medium, high) | NOT NULL |
| description | TEXT | Event description | NOT NULL |
| ip_address | TEXT | IP address | |
| location | TEXT | Location | |
| user_id | TEXT | User ID | |
| metadata | TEXT | Additional metadata | |
| resolved | INTEGER/BOOLEAN | Whether resolved | DEFAULT: 0 (false) |
| created_at | INTEGER/DATE | Timestamp when created | DEFAULT: current time |

---

### 19. error_logs
Stores error logs for debugging.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique error log ID | PRIMARY KEY |
| tenant_id | TEXT | ID of the tenant | NOT NULL |
| message | TEXT | Error message | NOT NULL |
| stack | TEXT | Stack trace | |
| route | TEXT | Route where error occurred | |
| browser | TEXT | Browser info | |
| os | TEXT | OS info | |
| user_id | TEXT | User ID | |
| store_id | TEXT | Store ID | |
| timestamp | INTEGER/DATE | Timestamp of error | DEFAULT: current time |

---

### 20. feature_flags
Stores feature flags for remote configuration.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique flag ID | PRIMARY KEY |
| name | TEXT | Feature name | NOT NULL, UNIQUE |
| enabled | INTEGER/BOOLEAN | Whether feature is enabled | DEFAULT: 0 (false) |
| description | TEXT | Feature description | |
| updated_at | INTEGER/DATE | Timestamp when last updated | DEFAULT: current time |

---

### 21. system_settings
Stores system-wide settings.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| key | TEXT | Setting key | PRIMARY KEY |
| value | TEXT | Setting value (JSON string) | NOT NULL |
| category | TEXT | Setting category | NOT NULL |
| updated_at | INTEGER/DATE | Timestamp when last updated | DEFAULT: current time |

---

### 22. developer_sessions
Stores developer session info.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique session ID | PRIMARY KEY |
| developer_id | TEXT | Developer ID | NOT NULL |
| token | TEXT | Session token | NOT NULL |
| device_info | TEXT | Device info | |
| ip_address | TEXT | IP address | |
| created_at | INTEGER/DATE | Timestamp when created | DEFAULT: current time |
| expires_at | INTEGER/DATE | Session expiration time | |

---

### 23. sessions
Stores user session info.

| Column | Type | Description | Constraints |
|--------|------|-------------|-------------|
| id | TEXT | Unique session ID | PRIMARY KEY |
| user_id | TEXT | User ID | NOT NULL |
| tenant_id | TEXT | Tenant ID | |
| token | TEXT | Session token | NOT NULL, UNIQUE |
| device_info | TEXT | Device info | |
| ip_address | TEXT | IP address | |
| created_at | TEXT/DATE | Timestamp when created | NOT NULL |
| last_active_at | TEXT/DATE | Timestamp of last activity | NOT NULL |
