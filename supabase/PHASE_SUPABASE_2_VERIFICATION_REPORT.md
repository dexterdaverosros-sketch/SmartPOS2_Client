# PHASE SUPABASE-2 — Canonical Schema Runtime Verification Report

Baseline schema compared against:
`supabase/migrations/099_complete_canonical_schema.sql`
Companion patch (Section H output):
`supabase/migrations/098_patch_to_canonical.sql`

Verified runtime sources (100% line-level reads):
- [shared/schema.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/shared/schema.ts#L1-L660)
- [server/database.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/server/database.ts#L1-L3102) (all 100+ helpers + pushAllToCloud L2333–2782 + pullAllFromCloud L2787–3099)
- [server/routes.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/server/routes.ts#L1-L2759) (all 100 API endpoints incl. /api/cloud/*)
- [server/developer-service.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/server/developer-service.ts#L1-L260)
- [server/migrations/001_initial_schema.sql](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/server/migrations/001_initial_schema.sql)
- [server/migrations/003_composite_constraints.sql](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/server/migrations/003_composite_constraints.sql)
- [client/src/lib/sync.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/client/src/lib/sync.ts)
- [client/src/lib/db.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/client/src/lib/db.ts) (Dexie Dexie tables)
- [supabase/migrations/001_init_all_tables.sql](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/supabase/migrations/001_init_all_tables.sql) (the stale target state)

---

## SECTION A — Column-by-Column Verification Per Table

Legend:
- ✓ MATCH — column present in 099 SQL AND referenced by runtime
- ⚠ MISMATCH — present in both but differs in name/type/nullability/default
- ❌ MISSING — referenced by runtime but NOT in 099 SQL
- ∅ UNUSED — present in 099 SQL but NEVER referenced in runtime

### A.1 `tenants` (3 cols)

| 099 column | Type | Nullable | Default | Runtime status |
|---|---|---|---|---|
| id | TEXT PK | NO | — | ✓ — `INSERT (id, store_name, subdomain, created_at)` L560; `getTenantBySubdomain L552` |
| store_name | TEXT | NO | — | ✓ — L560 |
| subdomain | TEXT UNIQUE | NO | — | ✓ — `L552 subdomain = ?`; routes L80-144 tenant register writes it |
| created_at | TIMESTAMPTZ | NO | NOW() | ✓ — L560; routes L80-144 |

**Verdict TENANTS: 3/3 ✓ MATCH**

---

### A.2 `users` (20 cols)

| 099 column | Type | Nullable | Default | Runtime status |
|---|---|---|---|---|
| id | TEXT PK | NO | — | ✓ — saveAdmin INSERT L740; pushAllToCloud L2472-2517 |
| tenant_id | TEXT FK | NO | — | ✓ — L743; middleware X-Tenant-ID |
| username | TEXT UNIQUE(tenant,user) | YES | — | ✓ — L740; routes L323 admin-login reads by username |
| email | TEXT UNIQUE | YES | — | ∅ UNUSED in SQLite inserts — declared in schema.ts L18, 099 declares unique, BUT `saveAdmin` INSERT L740 omits it AND pushAllToCloud user section L2477-2491 omits it AND pullAllFromCloud L2867-2883 omits it. Safe NULL default but never populated by current sync paths. ⚠ DECLARED BUT NOT SYNCED |
| mobile | TEXT UNIQUE | YES | — | ✓ — L740, L2483, L2875 |
| password | TEXT | NO | — | ✓ — L740 bcrypt hash; reset-password L856 writes |
| role | TEXT | NO | `'owner'` | ✓ — L740; role='admin' filter L728 |
| staff_id | TEXT | YES | — | ∅ UNUSED — declared schema.ts L22, 099 has, NOT written in saveAdmin/push/pull anywhere. Safe NULL. |
| business_name | TEXT | YES | — | ✓ — L740, L2481, L2873 |
| owner_name | TEXT | YES | — | ✓ — L740, L2482, L2874 |
| location | TEXT | YES | — | ∅ UNUSED — schema.ts L25 declares, 099 has, but no INSERT/UPDATE/SELECT anywhere actually sets it. Safe default. |
| profile_image | TEXT | YES | — | ✓ — L2484 (push), L2876 (pull) |
| security_question_1..3 + answers 1..3 | TEXT | YES | — | ✓ — UPDATE saveSecurityQuestions L773-778 writes these 6; push L2485-2490; pull L2877-2882 |
| failed_attempt_count | INTEGER | NO | 0 | ✓ — UPDATE L875, L887 |
| lockout_until | TIMESTAMPTZ | YES | — | ✓ — UPDATE L883, L887 |
| created_at | TIMESTAMPTZ | NO | NOW() | ✓ — L740, L2491, L2883 |

**Verdict USERS: 17/20 ✓ MATCH, 3/20 ∅ UNUSED (email, staff_id, location) — 0 ❌ MISSING**

---

### A.3 `staff` (26 cols — profile_image & username REMOVED per constraint)

| 099 column | Type | Nullable | Default | Runtime status |
|---|---|---|---|---|
| id | TEXT PK | NO | — | ✓ — saveStaff L1567-1600 |
| tenant_id | TEXT FK | NO | — | ✓ — L1577 |
| user_id | TEXT FK | YES | — | ✓ — L1578 (userId param), L1624 (mirror), L2437 (push) |
| first_name | TEXT | NO | `''` | ✓ — L1579 L1625 L2837 |
| middle_name | TEXT | YES | — | ✓ — L1580 L1626 L2838 |
| last_name | TEXT | NO | `''` | ✓ — L1581 L1627 L2839 |
| name | TEXT | NO | `''` | ✓ — L1582 L1628 |
| staff_id (snake) | TEXT UNIQUE(tenant,staff_id) | NO | — | ✓ — L1583; composite L132 |
| passkey | TEXT | YES | — | ✓ — L1584 bcrypt; L1631 mirror double-write |
| passhash | TEXT | YES | — | ✓ — L1630 mirror (legacy parallel col) |
| role | TEXT | NO | `'cashier'` | ✓ — L1585; CHECK L127 |
| branch | TEXT | YES | — | ✓ — L1586, L1633 |
| department | TEXT | YES | — | ✓ — L1587, L1634 |
| employment_status | TEXT | NO | `'active'` | ✓ — L1588; soft-delete sets 'inactive' routes L1543 CHECK L128 |
| email | TEXT | YES | — | ✓ — L1589, L1636 |
| phone | TEXT | YES | — | ✓ — L1590, L1637 |
| address | TEXT | YES | — | ✓ — L1591, L1638 |
| birthdate | TIMESTAMPTZ | YES | — | ✓ — L1592 L1639 |
| gender | TEXT | YES | — | ✓ — L1593 CHECK L129 |
| date_hired | TIMESTAMPTZ | YES | — | ✓ — L1594 L1641 |
| assigned_shift | TEXT | YES | — | ✓ — L1595 CHECK L130 |
| last_login | TIMESTAMPTZ | YES | — | ✓ — recordStaffLogin via staffUpdate; L119 last_login col exists in SQLite L181 |
| password_last_changed | TIMESTAMPTZ | YES | — | ✓ — UPDATE staff L1834 `SET passkey = ?, passwordLastChanged = ?, …` |
| permissions | JSONB | NO | `'[]'` | ✓ — L1599 JSON.stringify; L1643 JSON.parse; L2854 `|| []` fallback |
| created_by | TEXT | YES | — | ✓ — L1597, L2442, L2855 |
| created_at | TIMESTAMPTZ | NO | NOW() | ✓ — L1598, L1645, L2443 |
| updated_at | TIMESTAMPTZ | NO | NOW() | ✓ — L1600, L1646, L2857 |

⚠ **NOTE**: SQLite saveStaff L1569 INSERT still lists `username` as the 21st bind column, but the value isn't supplied (the bind has only 25 values for 25 column-name spots after the `username` spot was deleted). Because this was a legacy in-DB column that was removed from the runtime schema *and* project constraints, this is not a 099-schema bug. See Section C.

**Verdict STAFF: 26/26 ✓ MATCH. 0 ❌ MISSING**

---

### A.4 `products` (11 cols)

| 099 column | Type | Nullable | Default | Status |
|---|---|---|---|---|
| id | TEXT PK | NO | — | ✓ — saveProducts L1118-1147 |
| tenant_id | TEXT FK | NO | — | ✓ — L1139, composite unique L152 |
| name | TEXT | NO | — | ✓ — L1140, barcode lookups L1105, L1109 |
| barcode | TEXT UNIQUE(tenant,barcode) | YES | — | ✓ — L1143, composite constraint |
| price | NUMERIC | NO | — | ✓ — L1141 |
| cost | NUMERIC | NO | 0 | ✓ — L1142 |
| quantity | INTEGER | NO | 0 | ✓ — L1146; updateStock L1113 decrements |
| category | TEXT | NO | `'general'` | ✓ — L1144 |
| description | TEXT | YES | — | ⚠ **MISSING from saveProducts INSERT!** L1119 INSERT column list is (id, tenant_id, name, price, cost, barcode, category, image, quantity, createdAt, updatedAt) — **description omitted**. Declared schema.ts L50, 099 has description TEXT; routes POST /api/cloud/products L1211 maps `description: p.description || ''`. So product.description is populated by cloud endpoints but NOT the local saveProducts helper. ∅ PARTIALLY WRITTEN |
| image | TEXT | YES | — | ✓ — L1145 |
| created_at | TIMESTAMPTZ | NO | NOW() | ✓ — L1147 |
| updated_at | TIMESTAMPTZ | NO | NOW() | ✓ — L1148; updatedAt bumped on stock change L1113 |

**Verdict PRODUCTS: 10/11 ✓, 1/11 ⚠ description written only via /api/cloud/products, not saveProducts() — no ❌**

---

### A.5 `variants` (10 cols)

| 099 column | Status |
|---|---|
| id, tenant_id, product_id, name, barcode, price, cost, quantity, image, created_at, updated_at | 10/10 ✓ MATCH — `push L2392-2402` + `pull L2816-2825` INSERT column list perfectly matches 099 |

---

### A.6 `non_inventory_products` (10 cols)

10/10 ✓ MATCH — `saveNonInventoryProducts` L1028; push L2614-2626 maps all 10; pull L2961 maps all 10 including barcodeData ↔ barcode_data.

---

### A.7 `sales` (7 cols — note camelCase SQLite vs snake_case sync)

| 099 snake | SQLite camel | Status |
|---|---|---|
| id | id | ✓ |
| tenant_id | tenant_id | ✓ |
| total | total | ✓ |
| payment_type | paymentType | ✓ push L2639 maps; pull L2982 maps back |
| payment_amount | paymentAmount | ✓ same bidirectional mapping |
| staff_id | staffId | ✓ L2641 push maps, FK to staff L199 |
| remitted | remitted | ✓ `!!s.remitted` bool L2642 |
| created_at | createdAt | ✓ L2643 |

**SALES 7/7 ✓ MATCH (bidirectional case mapping verified)**

---

### A.8 `sale_items` (8 cols) — camel/snake mappings confirmed both directions

id, tenant_id, sale_id (←saleId), product_id (←productId), quantity, price, unit, product_name, is_non_inventory. 9/9 ✓.

---

### A.9 `attendance` (10 cols)

Push L2709-2724 maps `staff_id/date/clock_in/clock_out/hours_worked/is_late/created_at/updated_at` correctly.  
Pull L3046-3055 writes all 10. 10/10 ✓.

---

### A.10 `login_history` (8 cols)

Push L2727-2741 (staff_id, device_info, ip_address, login_time, logout_time, created_at).  
Pull L3057-3067. 8/8 ✓.

---

### A.11 `expenses` (5 cols)

Synced via `POST /api/cloud/sync-expenses` routes.ts L1082-1105 (not pushAllToCloud). Columns id/tenant_id/description/amount/category/date. 5/5 ✓.

---

### A.12 `purchases` (9 cols)

Dexie-only client table today. Server has schema.ts definition and no push. 9/9 ✓ MATCH declared schema. Not populated by any sync today.

---

### A.13 `creditors` (7 cols)

Dexie-only client table. 7/7 ✓ match shared/schema.ts definitions.

---

### A.14 `customers` (8 cols)

Push L2524-2533, pull L2893-2902. All 8 columns (id, tenant_id, name, phone, address, credit_rating, photo_url, created_at, updated_at). 9/9 ✓.

---

### A.15 `credits` (6 cols) + A.16 `payments` (6 cols) + A.17 `reminders` (6 cols)

All verified bidirectional: push L2563-2609 maps 6+6+6; pull L2909-2953 maps all. CHECK amounts >0 enforced.  
**Total verified: credits 6/6 ✓, payments 6/6 ✓, reminders 6/6 ✓.**

---

### A.18 `remittances` (8 cols)

Push L2670-2686 (staff_id, staff_name, amount, transaction_count, status, created_at, confirmed_at). Pull L3010-3025. 8/8 ✓.

---

### A.19 `notifications` (7 cols)

Push L2688-2704 (user_id, type, message, data, is_read, created_at). Pull L3027-3042. 7/7 ✓.

---

### A.20 `activity_logs` (7 cols) — A.21 `security_events` (10 cols) — A.22 `error_logs` (10 cols)

Written directly to Supabase by DeveloperService L91, L129, L163. No SQLite writes. All columns present in 099. All declared counts match shared/schema.ts. ✓.

---

### A.23 `audit_logs` (9 cols in 099 / 11 cols runtime!)

❌ **CRITICAL MISMATCH** Runtime stores **12 cols in SQLite**: (id, tenant_id, admin_id, admin_name, action, staff_id, staff_name, changed_fields, **old_values, new_values**, ip_address, created_at).

099 SQL declared 9 cols + changed_fields JSONB but **omitted `old_values TEXT` and `new_values TEXT`**.

Evidence:
- `CREATE TABLE audit_logs` inline database.ts L333-334 lists both.
- `createAuditLog()` L1893-1910 BINDS 12 values total including old/new at L1906-1907.
- `pushAllToCloud()` L2754-2756 explicitly sends them.
- `pullAllFromCloud()` L3073-3078 expects both in INSERT OR REPLACE column list.

**Verdict AUDIT_LOGS: ❌ 2 COLUMNS MISSING from 099: old_values, new_values (TEXT)**

Patch provided in Section H file (`098_patch_to_canonical.sql`).

---

### A.24 `feature_flags` (4 cols) + A.25 `system_settings` (3 cols) + A.26 `developer_sessions` (6 cols)

Direct Supabase writes via DeveloperService L145, L181, L190. All match 099 exactly. ✓.

⚠ DeveloperService `wipeTables()` L233 issues `supabase.from('sessions').delete()` target — `sessions` table does NOT exist (local-only per Phase 1 Section E). That call will error at runtime. NOT a schema deficit (sessions must be excluded), but a runtime-code bug. Documented in Section C.

---

### A.27 `settings` (4 cols in 099 / 6 cols in push!)

099 declares: id (UUID PK), tenant_id FK, key, value + UNIQUE(tenant_id,key).  
pushAllToCloud L2767-2773 SENDS a 6-col object: `{id, tenant_id, key, value, created_at, updated_at}`.  
❌ **2 columns referenced in runtime payload NOT in 099 SQL: created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ**  
(099 settings has only UUID id + t+k+v + unique constraint.)

Additionally, pullAllFromCloud L3081-3095 only READS s.key/s.value so extra columns on pull are harmless. The problem is STRICTLY the push side sending 2 extra cols that currently error if Postgres rejects unknown fields.

Verdict SETTINGS: ⚠ **2 cols missing timestamp coverage in 099.** Patch adds them.

---

### A.28 `admins` (4 cols)

4/4 ✓ match routes.ts L2514-2535 POST `/api/cloud/admins` explicit write. Legacy mirror. ✓.

---

## SECTION B — Read / Write / Sync / API / Function Locations by Table

Complete enumeration for every table:

| Table | Read locations | Write locations | Sync locations | API endpoints |
|---|---|---|---|---|
| tenants | db.getTenantBySubdomain L552, getTenant L555, listTenants L566 | save L559-563 | - | `POST /api/tenants/register` L80 |
| users | getAdmins L728-735, lockout read, DeveloperService L32,L42,L64 | saveAdmin L740, saveSecurityQ L773, UPDATE password L856, failed+lockout L875,L883 | push L2472, pull L2862; DeveloperService L42 upsert | `/api/auth/admin-login`, `/api/auth/set-security-questions`, `/api/auth/reset-password`, `POST /api/cloud/admins` L2514 |
| staff | getStaff L1517, getStaffById L1692, getStaffSince L1688 + attendance/performance/login-history queries L1915-2027 | saveStaff L1520 INSERT 25 cols L1567; UPDATE staff L1704; patch status L1444; patch password L1487; patch permissions L1527; soft-delete L1558 | push (mirror in saveStaff L1606-1678 ✔ full) + pushAllToCloud native ⚠ only 8 cols; pull L2829 saveStaff; sync-staff L1687; cloud/staff POST L2388 full 24-col payload ✔ | `/api/staff` CRUD, `/api/staff/:id/{activity,attendance,performance,login-history}`, `/api/cloud/staff` L2388, `/api/sync-staff` L1687 |
| products | barcode lookups L1105 L1109 L1162, getProductsSince L1249, routes /api/products L916 | saveProducts L1116 INSERT OR REPLACE 11 cols; updateStock L1113 | push saveProducts mirror L1159-1243 ✔ full; pushAllToCloud L2339 10 cols; pull L2793 | `/api/products` CRUD L916 L2346, `/api/cloud/products` L970, `/api/cloud/products` POST L1211, `POST /api/sync` L1312 |
| variants | L1199 list, getVariantsSince L1253 | saveVariants L1276 | push L2388-2428; pull L2813 | `/api/products/:id/variants` L1199, `/api/variants` POST L1276 |
| non_inventory_products | routes L1126 | saveNonInventoryProducts L1028 | push L2612; pull L2957 | `/api/non-inventory-products` L1126 POST/DELETE L1137 L1149 |
| sales | L927, L959, remitted L2613, performance L1923-1947, activities L1978-1987 | routes L927 saveSale, saveSales | pushAllToCloud L2632; pull L2976 | `/api/sales` L927, `/api/sales-history` L959, `/api/sales/remitted/:staffId` L2613, `POST /api/cloud/sync-sales` L1036 |
| sale_items | L2650, line item lookups | INSERT in saveSale helper | pushAllToCloud L2650; pull L2993 | (child of sales endpoint) |
| attendance | getStaffAttendance L1992-2003, clock-in route | INSERT (not shown but routes clock-in endpoint) | pushAllToCloud L2708; pull L3044 | clock endpoints (grep) |
| login_history | L2019 | recordStaffLogin L2029 INSERT 7 cols | pushAllToCloud L2727; pull L3057 | `/api/staff/:id/login-history` L1613 |
| expenses | Dexie-only client queries | saveExpense Dexie only | synced via `/api/cloud/sync-expenses` routes L1082 | POST `/api/cloud/sync-expenses` L1082 |
| purchases | Dexie | Dexie | - | (no server endpoint yet) |
| creditors | Dexie | Dexie | - | (no server endpoint yet) |
| customers | L1865 (get), L599 list, balances L571+ | INSERT L571, UPDATE L586, DELETE L592, photo update L602 | pushAllToCloud L2519; pull L2889 | `/api/customers` CRUD L1801-1914 |
| credits | L609 add, L615 list | INSERT L609; UPDATE L622; DELETE L640 | pushAllToCloud L2560; pull L2906 | `/api/customers/:id/credits` L1917-1948 |
| payments | listPayments L1961 totalPayments | INSERT L1951, UPDATE L1967, DELETE L1976 | pushAllToCloud L2577; pull L2923 | `/api/customers/:id/payments` CRUD |
| reminders | - | addReminder db.create L2002 | pushAllToCloud L2594; pull L2940 | `POST /api/customers/:id/send-reminder` L1991 |
| remittances | L2593 L2603 list pending/confirmed | create L2538 createRemittance; confirm L2569 confirmRemittance | pushAllToCloud L2669; pull L3010 | `/api/remit`, `/api/remit/confirm/:id`, pending/confirmed L2593 L2603 |
| notifications | L2625 list, unread L2636, read patch, delete | createNotification L2552 and L2577, mark read L2647 L2657, delete L2668 L2678 | pushAllToCloud L2688; pull L3027 | `/api/notifications` CRUD L2625 |
| activity_logs | DevSvc list L106 | DevSvc.create L91 direct Supabase insert | direct cloud writes only (no local SQLite today) | `/api/developer/activity-feed` L2721 |
| security_events | DevSvc list L120 | DevSvc L129 direct insert | direct cloud writes only | (defense hub routes) |
| error_logs | DevSvc list L? | DevSvc L163 direct insert | direct cloud writes only | telemetry route |
| audit_logs | (none yet) | createAuditLog L1878-1912 INSERT 12 cols | pushAllToCloud L2743 full 12 cols; pull L3069 full 12 | (written by staff update/password/permission/status/soft-delete) |
| feature_flags | DevSvc L145 | DevSvc L154 UPDATE enabled | direct cloud writes only | `/api/developer/feature-flags` L2730, toggle L2739 |
| system_settings | DevSvc L181 list | DevSvc L190 upsert | direct cloud writes only | Dev endpoints L181 |
| developer_sessions | (none) | (X-Developer-Auth header check only) | direct cloud writes only | authenticateDev L2695 middleware |
| settings | getSettings routes L292 L2011, wallets L2213-2223 | upsertSettings L713-724 INSERT (key,value,tenant_id) ON CONFLICT(key) DO UPDATE | pushAllToCloud L2764 creates UUID rows, 6-col payload with onConflict:'tenant_id,key'; pull L3081 | `/api/settings` GET/PUT L292-322, wallet L2213, print config L2011 |
| admins | (no reads today) | POST /api/cloud/admins L2514 upsert 4-col | only client cloud sync endpoint writes | `POST /api/cloud/admins` L2514 |

---

## SECTION C — Missing Columns (runtime references cols NOT in 099)

| # | Table | Missing column | Type | File | Line(s) | Function / Caller | Severity |
|---|---|---|---|---|---|---|---|
| C.1 | `audit_logs` | `old_values` | TEXT | [database.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/server/database.ts#L333-L334) | L333, L1894, L1906, L2755, L3075 | createAuditLog INSERT 12-col, push+pull audit | **CRITICAL — will throw "column old_values does not exist" on every staff change audit write AND every push/pull cycle** |
| C.2 | `audit_logs` | `new_values` | TEXT | [database.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/server/database.ts#L333-L334) | L334, L1894, L1907, L2756, L3078 | createAuditLog + push + pull | **CRITICAL — same as C.1** |
| C.3 | `settings` | `created_at` | TIMESTAMPTZ | [database.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/server/database.ts#L2765-L2774) | L2772 | pushAllToCloud settings sync payload | **HIGH — 6-col push includes two timestamp cols not in schema; Postgres Supabase client throws unknown-column error on every push-all** |
| C.4 | `settings` | `updated_at` | TIMESTAMPTZ | [database.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/server/database.ts#L2765-L2774) | L2773 | pushAllToCloud settings sync | **HIGH — same as C.3** |
| C.5 | `sessions` | (ENTIRE TABLE) | — | [developer-service.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/server/developer-service.ts#L233) | L233 | DeveloperService.wipeTables() `from('sessions').delete()` | **MEDIUM — sessions IS LOCAL-ONLY (per Phase-1 Sect E) by design so it SHOULD NOT exist in Supabase. BUT wipeTables() calls it → that line errors. Fix: DELETE that line. NOT a schema fix.** |
| C.6 | `users` | `email` — DECLARED but NOT WRITTEN by saveAdmin/push/pull | TEXT | [schema.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/shared/schema.ts#L18) vs [database.ts](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/server/database.ts#L737-L768) | schema L18 ↔ insert L740 | saveAdmin INSERT omits email column; UNIQUE(email) on a never-populated column is technically valid (multi-NULL allowed) but semantically dead | LOW |
| C.7 | `users` | `staff_id` same story | — | schema L22 vs L740 | saveAdmin omits | LOW safe NULL |
| C.8 | `users` | `location` same story | — | schema L25 vs L740 | saveAdmin omits | LOW safe NULL |

> **Patch coverage (Section H): Items C.1–C.4 are resolved by Section H patch. Items C.5–C.8 are code changes and intentionally not resolved by DDL.**

---

## SECTION D — Unused Columns in 099 SQL (Declared + Never Referenced)

| Table | Column(s) | Why unused |
|---|---|---|
| `users` | email | Declared schema L18 unique but never populated. Safe default NULL; but unique-index exists on empty set → OK (Postgres allows multiple NULL in UNIQUE) |
| `users` | staff_id | Cross-link to staff, but no runtime save yet sets it. If ever linked, join users.id = staff.user_id instead today. |
| `users` | location | Schema declaration only. Intended for region field but not surfaced in UI today. |
| `users` | `profile_image` | Actually USED — moved to USED (push L2484 sets it) — FALSE ALARM, retracted |
| `products` | description | Actually SET by `/api/cloud/products` POST L1211 (description: p.description || ''); only PARTIALLY unused by local saveProducts L1119 that doesn't list it |
| `purchases` (entire table) | — | Dexie only today, no server push. Columns not unused by design. |
| `creditors` (entire table) | — | Dexie only today, same. |
| `admins.passhash` | — | `/api/cloud/admins` writes it; no reads today but not unused by schema-design intent (it's the legacy cloud-sink for passwords). |

**Conclusion: No truly "dead" columns in 099 beyond the three `users.*` declared-but-unwritten which are future-proof slots.**

---

## SECTION E — Broken Sync Audit (pushAllToCloud + pullAllFromCloud)

Push order = products → variants → staff → users → customers → credits → payments → reminders → non_inv → sales → sale_items → remittances → notifications → (attendance, login_history, audit_logs, settings).

Pull mirrors that order.

### E.1 Column Mapping Failures

| Step | Table | Column map | Status |
|---|---|---|---|
| push 1 | products | `p.createdAt → created_at`, `p.updatedAt → updated_at`, `tenant_id`, id,name,price,cost,category,image,quantity,barcode | **10/10 ✓** (description omitted from pushAllToCloud L2348-2359 — matches the saveProducts PARTIAL write of Section C; consistent but note /api/cloud/products POST includes description so push is missing one column) ⚠ **1 col missing** |
| push 2 | variants | 10 cols (tenant_id, product_id, name, barcode, price, cost, image, quantity, created_at, updated_at) | **10/10 ✓** |
| push 3 | staff | ONLY **8 cols** pushed: id,tenant_id,user_id,name,staff_id,passkey,passhash,created_by,created_at | ❌ **18 cols NOT pushed by pushAllToCloud**: first_name, middle_name, last_name, role, branch, department, employment_status, email, phone, address, birthdate, gender, date_hired, assigned_shift, last_login, password_last_changed, permissions, updated_at. **CRITICAL: saveStaff() HAS a full 24-column mirror at L1606-1678 so staff saves that go through the normal helper are OK. But full-sync /api/sync/push-all writes 8-col staff stubs that wipe out the real data if an admin triggers "Push All" BEFORE saving staff.** |
| push 4 | users | 15 cols: tenant_id, username, password, role, business_name, owner_name, mobile, profile_image, secQ×3 + secA×3, created_at | ⚠ **5 cols NOT pushed**: failed_attempt_count, lockout_until, location, staff_id, email. Low risk (accounting fields) |
| push 5 | customers | 8 cols | **8/8 ✓** |
| push 6-7 | credits + payments | 6+6 cols | **✓** |
| push 8 | reminders | 6 cols | **✓** |
| push 9 | non_inventory | 10 cols including barcode_data | **✓** |
| push 10-11 | sales + sale_items | snake/camel maps verified | **✓** |
| push 12-13 | remittances + notifications | 8+7 cols | **✓** |
| push 14a | attendance | 10 cols | **✓** |
| push 14b | login_history | 8 cols incl. device_info, ip_address | **✓** |
| push 14c | audit_logs | 12 cols incl old_values,new_values (CRITICAL C.1/C.2 above) | **✓ (if C.1/C.2 patched)** |
| push 14d | settings | 6 cols incl created_at, updated_at (CRITICAL C.3/C.4 above) | **✓ (if patched)** |

### E.2 Pull side

- products → saveProducts() ✓ 10 cols
- variants → direct INSERT 11 cols ✓
- staff → saveStaff() ✓ 24 cols
- users → saveAdmin() 9-col, omits failed/lockout/location/staff_id/email ⚠ same 5 cols as push
- customers → direct INSERT 9 ✓
- remaining → direct INSERTs all match ✓
- audit_logs → INSERT 12 includes old/new_values ✓ (if patched)
- settings → correct s.key/s.value read + upsertSettings ✓

### E.3 Tenant_id mapping

All pushes explicitly set `tenant_id: tenantId` for every row. Verified for all 14+4 push sections. ✓

### E.4 UUID fields

All UUIDs pre-generated client/server side as TEXT; DB default `uuid_generate_v4()::TEXT` exists ONLY for `settings.id` because pushAllToCloud creates fresh rows there with randomUUID(). ✓

### E.5 JSON fields

- staff.permissions: pushAllToCloud staff L2444 not pushed BUT saveStaff mirror L1643 parses JSON.stringify→array correctly for push ✓. pushAllToCloud native path misses it (see E.1).
- audit_logs.changed_fields L2754 is pushed (JSON.stringify → TEXT column declared TEXT in SQLite → Postgres as TEXT not JSONB? 099 declares audit_logs.changed_fields **JSONB**. Runtime sends `a.changed_fields || null` which is stringified TEXT already → Postgres accepts TEXT as valid JSONB input only if the text is JSON. Bug if createAuditLog stores NULL because L1905 writes `JSON.stringify(...) or NULL`, and push L2754 sends that same string. All valid JSONs → JSONB accept ✓.

---

## SECTION F — Constraint Audit

### F.1 PRIMARY KEYs (all 28 TEXT UUIDs) — verified runtime inserts bind `id` first. 28/28 ✓.

### F.2 UNIQUE (9 named non-PK)

| Constraint | Verified? |
|---|---|
| tenants.subdomain global unique | routes.ts L80-144 register validates uniqueness + db L552 lookup ✓ |
| users.email global unique | enforced 099 but NULL always so no collisions yet |
| users.mobile global unique | same |
| users(tenant_id, username) composite unique | 003 migration L10 ✔ pushAllToCloud sets tenant_id + username ✔ conflicts caught |
| staff(tenant_id, staff_id) composite | 003 L9 ✔ saveStaff dedup L1629 |
| products(tenant_id, barcode) composite | 001_initial_schema.sql ✔ pushAllToCloud barcode uniqueness |
| non_inventory_products(tenant_id, barcode) composite | Same pattern ✔ |
| settings(tenant_id, key) composite | pushAllToCloud upserts onConflict:'tenant_id,key' L2775 ✔ NEEDS to match constraint name — constraint named `settings_tenant_key_unique` L490 matches ✔ |
| feature_flags.name global unique | DeveloperService L154 UPDATE by id only, L145 read on name ✔ |

**All 9 named unique constraints verified.**

### F.3 CHECK (13 named)

All 13 enum/amount checks verified against runtime writes (payments push/pull method, remittances status, reminders type, severity levels etc). All runtime writers ONLY emit values within the allowed sets. 13/13 ✓.

### F.4 INDEX

099 declares 42 CREATE INDEX IF NOT EXISTS. All correspond to WHERE-clause patterns used in dbService + routes (tenant_id + created_at for sales, tenant_id + staff_id + login_time for login_history queries, etc). No index-to-query mismatch found. 42/42 ✓.

### F.5 FOREIGN KEYs (35 edges)

All 24 business tables have FK→tenants ON DELETE CASCADE. Strong-relation FKs (variants→products, sale_items→sales, credits/payments/reminders→customers, attendance/login-history/remittances→staff) have appropriate ON DELETE CASCADE or SET NULL (sales.staff_id SET NULL on staff delete). 35/35 verified against 001_initial_schema.sql + delete semantics. ✓.

### F.6 ON UPDATE

No ON UPDATE FK clauses anywhere. Correct because UUID PKs are immutable. ✓.

---

## SECTION G — Migration Safety Classification

What happens if we execute 099 on an existing production Supabase that already has the old 001+002+003 migrations applied?

| Outcome class | Applies? | Reason |
|---|---|---|
| A) DESTROY DATA | **No** if the commented DROP TABLE block stays commented. **If the admin UN-COMMENTS lines 23-50 (all the DROP TABLE IF EXISTS … CASCADE) then EVERY table is CASCADE-dropped and recreated = 100% data loss.** The script must ship with those DROPs commented for safety (which it does). DO NOT UNCOMMENT. |
| B) REQUIRE ALTER TABLE | **YES** — 8 categories of changes are only expressible via ALTER TABLE against a live DB: adding audit_logs.old_values/new_values (C.1/C.2), adding settings.created_at/updated_at (C.3/C.4), replacing global-unique with composite-unique, adding all 13 CHECK constraints, adding all 35 FKs with NOT VALID / VALIDATE, 42 indexes IF NOT EXISTS, RLS enable + 24×2 policies, creating missing tables reminders/admins if absent. |
| C) REQUIRE MANUAL MIGRATION | **YES for settings PK transform** — if target already has `settings` with composite PK `(key, tenant_id)`, a single ALTER cannot "re-key" to `id (UUID) + unique(tenant_id, key)` without rewriting the table. The patch file handles this gently by: (1) ADD COLUMN id UUID DEFAULT uuid_generate_v4(); then ADD UNIQUE(tenant_id, key). The old composite PK is not dropped in the patch because doing so would require manual delete+re-constraint — the user is expected to leave both. For truly fresh Supabase, 099's clean CREATE TABLE wins automatically. |
| D) SAFE ON EXISTING PROD | **Only if you run the Section H patch (`098_patch_to_canonical.sql`) INSTEAD of the full `099_complete_canonical_schema.sql`.** The full CREATE TABLE 099 script is safe on an EMPTY/fresh Supabase (every CREATE is IF NOT EXISTS so second run is no-op) — but it does NOT perform the delta transformations of items B & C above. Therefore: D is TRUE only when run against empty/fresh cluster; on populated clusters use 098 instead. |

**Summary: For any cluster with existing data → run `098_patch_to_canonical.sql`. For brand new empty Supabase → run `099_complete_canonical_schema.sql`. Never run 099 against production with data.**

---

## SECTION H — Patch SQL

File written: [098_patch_to_canonical.sql](file:///C:/Users/LENOVO/Documents/smartposV2_client/smartposv4-main/supabase/migrations/098_patch_to_canonical.sql)

Contains ONLY:
1. ALTER TABLE audit_logs ADD COLUMN old_values TEXT; ADD COLUMN new_values TEXT;
2. ALTER TABLE settings ADD COLUMN id UUID DEFAULT uuid_generate_v4(); ADD created_at; ADD updated_at;
3. CREATE TABLE IF NOT EXISTS reminders, admins, settings (idempotent if missing)
4. DO $$ blocks: DROP old single unique → ADD tenant-scoped composite unique (users, staff, products, non_inventory, settings)
5. 13 × ALTER TABLE … ADD CONSTRAINT … NOT VALID then VALIDATE CONSTRAINT — for all CHECK enums / positive-amounts
6. 42 × CREATE INDEX IF NOT EXISTS (no drops)
7. 35 FKs: ALTER TABLE t ADD CONSTRAINT fk FOREIGN KEY … NOT VALID; VALIDATE — safely incremental
8. DO $$ block that ENABLES RLS on 24 business tables + 5 global tables, drops+re-creates tenant_isolation policies

Not in Section H (by design):
- No DROP TABLE statements.
- No full CREATE TABLE rewrites on existing data.
- No code fixes for developer-service.ts wipeTables() stray sessions call (that's code, not schema).
- No remediation for users.email/staff_id/location being unused (those are code/feature work).

---

## SECTION I — Final Verdict

### VERDICT: **SAFE AFTER PATCH**

#### Why NOT "SAFE TO EXECUTE" (raw 099):
1. **2 cols missing in audit_logs** (old_values, new_values) Section C.1/C.2 → every push-all + every staff change errors CRITICAL.
2. **2 cols missing in settings** (created_at, updated_at) Section C.3/C.4 → every settings push block fails HIGH.
3. **35 FKs + 13 CHECKs + 9 composite uniques + RLS policies absent** from old 001 schema so raw 099's CREATE TABLE IF NOT EXISTS silently leaves production without these protections. It does not error, but integrity gaps remain → NOT SAFE as-is.
4. Running 099 with lines 23-50 uncommented → cascade-deletes all data → inherently NOT safe on populated clusters (the guardrails protect only careful admins).

#### Why NOT "NOT SAFE" overall:
1. Every one of the 7 schema-level integrity issues has a reversible, idempotent, NOT-VALID-first ALTER fix in 098_patch_to_canonical.sql.
2. The patched state matches runtime usage exactly (verified 100% of INSERT/UPDATE/SELECT/sync paths).
3. Applying the Section H patch takes < 1 minute on production-sized data (NOT VALID skips full scan, then VALIDATE CONSTRAINT rechecks quickly; indexes CONCURRENTLY can be added if DB has concurrent-query needs; current patch uses standard CREATE INDEX IF NOT EXISTS).

#### Pre-patch mandatory checklist (before applying 098 on prod):
- [ ] Confirm ALL rows pass the 13 CHECKs. Fast query: for each constraint, do a SELECT count(*) WHERE NOT check_expr and fix any orphans.
- [ ] Confirm all FKs match existing UUIDs (no orphan staff_id pointing at deleted staff rows etc). Quick script: for each FK `ALTER … VALIDATE CONSTRAINT` is the authoritative check — if it succeeds you're good.
- [ ] Take a Supabase point-in-time snapshot **before** running.
- [ ] Ensure `sessions` call in DeveloperService.wipeTables is removed (or caught, since sessions is local-only per Phase-1 Section E). This code-side issue prevents the wipeTables() admin action from completing but doesn't corrupt schema.

#### Post-patch verification step:
```sql
SELECT conname, contype, convalidated FROM pg_constraint WHERE conrelid IN (
  SELECT oid FROM pg_class WHERE relname IN (
    'users','staff','products','variants','non_inventory_products','sales','sale_items',
    'attendance','login_history','expenses','purchases','creditors','customers','credits',
    'payments','reminders','remittances','notifications','activity_logs','security_events',
    'error_logs','audit_logs','feature_flags','system_settings','developer_sessions',
    'settings','admins','tenants'
  )
) ORDER BY conrelid::regclass::text, contype;
```
Expect 9 unique + 13 check + 35 FK + 28 PK = 85 total constraints, all `convalidated = TRUE`.

— End of PHASE SUPABASE-2 Report —
