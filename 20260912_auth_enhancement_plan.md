# SmartPOS+ Authentication Enhancement — Implementation Plan

## Root Cause Summary

### Bug 1: Unbinding does NOT allow new account signup
- **Root cause**: `/api/tenants/unbind-device` only clears server SQLite (users/sessions/device_bound_tenant_id). It does NOT clear:
  - Client `localStorage` keys (`smartpos_user`, `smartpos_token`, `smartpos_tenant*`, `admin_*` remember-me)
  - Client Dexie IndexedDB (the `db.users` table still has the old admin!)
- **Result**: `AuthService.createAdmin()` in `client/src/lib/db.ts` calls `db.users.where('mobile').equals(...)` → finds old cached admin → throws "Mobile already registered" → blocks signup permanently.
- Also: `/api/auth/status` returns `adminExists` but `admin-signup.tsx` checks `data.configured` — so signup lock never works.

### Bug 2: Auth flow doesn't verify local admin against Supabase when online
- **Requirement**: ONLINE → check local DB for admin → verify same admin exists in Supabase → if both match → login.
- **Current**: `AuthService.loginAdmin` → always server-first via `/api/auth/admin-login`, server does SQLite-first then Supabase fallback. If admin only in local DB and online, it still logs in (no verification against cloud for the *local* admin's existence in cloud).
- **Required new flow**: ONLINE → query local Dexie `db.users` (admin role) → if found, call server `/api/auth/admin-login` with new query param `verifyAgainstCloud=true` → server MUST confirm admin exists in BOTH SQLite AND Supabase → fail if only local.
- **OFFLINE fallback**: If server unreachable → allow local-only login (existing behavior preserved).

### Bug 3: Asynchronization / race conditions
- Cloud sync operations lack client acknowledgment for critical path operations (login verification, unbinding, account creation).
- `pullAllFromCloud` runs non-blocking on admin login — returns to client before data ready, causing empty-dashboards after cloud login.

---

## Files to Modify

| # | File | Change Type | Scope |
|---|---|---|---|
| 1 | `server/routes.ts` | ENHANCE | (a) `/api/auth/admin-login` add cloud-verification mode. (b) `/api/tenants/unbind-device` return `clientPurgeKeys` list for client to clear localStorage+Dexie. (c) `/api/auth/status` return both `adminExists` and `configured`. |
| 2 | `server/database.ts` | ENHANCE | `clearBoundTenantId()` → also clear ALL tenant-scoped SQLite tables (products/staff/sales/…), return list of what was purged for diagnostic echo. Add `verifyAdminExistsInCloudAndLocal(username)` helper. |
| 3 | `client/src/lib/db.ts` | ENHANCE | `AuthService.loginAdmin`: use `useNetworkStatus`-style online check → ONLINE mode calls server with `?verifyAgainstCloud=true`, fail if mismatch. `AuthService.createAdmin`: before checking Dexie, **always** wipe Dexie users if no `smartpos_token` present (post-unbind state). Add static `purgeLocalState()` method. |
| 4 | `client/src/contexts/AuthContext.tsx` | ENHANCE | Add `unbindDevice()` method → calls `/api/tenants/unbind-device` → uses returned key list to purge localStorage → calls `db.resetDatabase()` or purges `db.users`, `db.staff`, etc. → clears React state. Also expose `isOnline` from a `navigator.onLine` check. |
| 5 | `client/src/pages/admin-signup.tsx` | FIX | (a) Check both `data.configured` **and** `data.adminExists`. (b) On mount → if NO token & NO stored user → call `purgeLocalState()` to guarantee stale Dexie data from unbind is removed. (c) Add "Unbind Device" button for locked state instead of just redirect. |
| 6 | `client/src/pages/register-tenant.tsx` | ENHANCE | `handleUnbindDevice` → after successful response → call `AuthService.purgeLocalState()` (or inline clear) → refresh status check → reset form. |
| 7 | `client/src/lib/sync.ts` | ENHANCE | `pullAllFromServerIntoDexie` → improve error surfacing, add retryable-flag header, surface stale-data state to caller. |
| 8 | `client/src/hooks/useNetworkStatus.ts` | (verify) | Ensure it's accurate; expose `isOnline` via hook for login. |

---

## Detailed Changes per File

### 1. `server/routes.ts`

#### A. `/api/auth/admin-login` — Add Cloud Verification Mode
- Accept query param or body flag `verifyAgainstCloud` (default `false` for backward compat).
- After finding admin in local SQLite → if flag is `true` AND `useCloud()` → query Supabase for admin by username/mobile.
  - If cloud lookup succeeds → verify `id` or `username` matches.
  - If cloud lookup FAILS (admin not in cloud) → return `401 { error: 'ADMIN_NOT_IN_CLOUD', message: 'Local admin account not found in Supabase Cloud. Please check your internet connection or contact the administrator.' }`.
- After successful login → `pullAllFromCloud` MUST resolve BEFORE returning to client (currently non-blocking for admin login) → change to blocking, but with a hard timeout (e.g., 15s) → if times out, return a `staleData: true` warning flag in response.

#### B. `/api/tenants/unbind-device` — Return Client Purge Instructions
- Response body should add:
  ```json
  {
    "success": true,
    "message": "Device successfully unbound",
    "clientPurge": {
      "localStorageKeys": ["smartpos_user","smartpos_token","smartpos_tenant_id","smartpos_tenant","smartpos_guest_mode","smartpos_guest_user_id","smartpos_guest_expiry","admin_username","admin_password","admin_remember_me","customer_checker_tenant_id","customer_checker_store_name","smartpos_guest_mode"],
      "purgeDexieTables": true
    }
  }
  ```
- Add password-verification gate: accept optional `{ adminUsername, adminPassword }` body → if device has admins, require one to verify before unbinding.

#### C. `/api/auth/status` — Add `configured` Flag
- Response: `{ adminExists, configured: adminExists, admin, tenant }` → aligns with what `admin-signup.tsx` checks.

---

### 2. `server/database.ts`

#### A. `clearBoundTenantId()` → Enhanced Full Purge
- Current: deletes `settings[device_bound_tenant_id]`, `users`, `sessions`.
- **Enhance**: Delete ALL business tables filtered by bound tenant (or ALL rows if tenant unknown):
  - `products`, `variants`, `staff`, `sales`, `sale_items`, `expenses`, `purchases`, `creditors`, `non_inventory_products`, `remittances`, `notifications`, `customers`, `credits`, `payments`, `reminders`, `bulk_inventory_transactions`, `bulk_inventory_items`, `pending_bulk_submissions`
- Return `{ purgedTables: string[] }` for diagnostics.

#### B. New Helper: `verifyAdminLocalAndCloud(username, localAdmin)` → `Promise<{ matched: boolean, cloudAdmin?: any }>`
- Uses Supabase to find admin by username/mobile/email/owner/business case-insensitive.
- Returns match result + optional cloud admin row for subsequent cache-sync path.

---

### 3. `client/src/lib/db.ts`

#### A. `AuthService.loginAdmin(username, password)` — Rewrite Flow
```
const isOnline = navigator.onLine || await quickHealthPing();

if (isOnline) {
  // NEW: ONLINE MODE - Verify BOTH local AND cloud
  const localAdmins = await db.users.where('role').equals('admin').toArray();
  try {
    // Send verifyAgainstCloud flag
    const response = await api.post('/api/auth/admin-login?verifyAgainstCloud=true', { username, password });
    if (response && response.user) {
      await db.users.put(response.user);  // sync cloud record to local
      return { user: response.user, token: response.token };
    }
  } catch (serverErr: any) {
    // If server returned ADMIN_NOT_IN_CLOUD, fail hard
    if (serverErr?.status === 401 && serverErr?.code === 'ADMIN_NOT_IN_CLOUD') {
      throw new Error('This local admin account is not registered in the cloud. Please reconnect or unbind device.');
    }
    // If network error → offline fallback
  }
}

// OFFLINE FALLBACK (server unreachable OR navigator.onLine = false)
const user = await findLocalAdminBy(username, mobile);
if (user && bcrypt ok) return { user };
return null;
```

#### B. `AuthService.createAdmin(...)` — Fix Post-Unbind Stale Check
```
static async createAdmin(...) {
  // If we are in a post-unbind state (no token in localStorage), clear Dexie users FIRST
  // to eliminate stale caches from previous unbinding
  if (!localStorage.getItem('smartpos_token')) {
    await AuthService.purgeLocalState({ skipApiCall: true });
  }
  // ... existing duplicate-check + create + sync
}
```

#### C. New Static Method: `AuthService.purgeLocalState(opts?)`
- Purges all localStorage smartpos_* keys (except maybe device mode/UI preferences)
- Clears `db.users`, `db.staff`, `db.products`, `db.variants`, `db.sales`, `db.saleItems`, `db.expenses`, `db.purchases`, `db.creditors`, `db.nonInventoryProducts`, `db.remittances`, `db.notifications`, `db.bulkInventoryTransactions`, `db.bulkInventoryItems`, `db.pendingBulkSubmissions`
- If opts.skipApiCall === false → also calls `/api/tenants/unbind-device`
- Returns success flag

---

### 4. `client/src/contexts/AuthContext.tsx`

#### A. Add `unbindDevice()` Method
- Exposed via context: `unbindDevice: (adminUsername?, adminPassword?) => Promise<{success:boolean}>`
- Calls `/api/tenants/unbind-device` with optional password body
- Uses response `clientPurge` keys → iterates `localStorage.removeItem(key)`
- If `purgeDexieTables === true` → call `db.resetDatabase()` or equivalent per-table clear
- Calls `setUser(null)`, `setToken(null)`, `setIsGuest(false)`
- Dispatches a global `CustomEvent('device-unbound')` for any subscribed UIs.

#### B. Session Restoration Effect — Add Offline Mode Graceful Handling
- If API call to `/api/auth/session` throws network error AND `localStorage.smartpos_user` is admin → keep local state but mark `isOnlineVerified: false` (optional extra state for UI to show "Offline Mode" banner).

---

### 5. `client/src/pages/admin-signup.tsx`

#### A. Status Check Fix
```ts
const data = await api.get('/api/auth/status');
if (data.configured || data.adminExists) {   // BOTH checks
  setIsLocked(true);
}
```

#### B. Mount-Time Purge Guarantee
```ts
useEffect(() => {
  (async () => {
    if (!localStorage.getItem('smartpos_token') && !localStorage.getItem('smartpos_user')) {
      // Fresh/unbound device → guarantee no stale Dexie leftover
      await AuthService.purgeLocalState({ skipApiCall: true });
    }
    checkStatus();
  })();
}, []);
```

#### C. Locked-State Add Unbind Button
- When `isLocked === true`, alongside "Go to Login" button add a "Unbind This Device" button → opens a password prompt → calls `useAuth().unbindDevice()` → on success → `setIsLocked(false)` + `toast('Device unbound, signup enabled')`.

---

### 6. `client/src/pages/register-tenant.tsx`

#### A. `handleUnbindDevice()` → Enhanced
- After successful response from server:
  - Call `AuthService.purgeLocalState({ skipApiCall: true })` OR use the `clientPurge` keys from response to purge.
  - Reset `formData` state to empty.
  - Clear `result` briefly → show a "Purge complete" success toast.
  - Hard-refresh `window.location.reload()` if needed to clear all in-memory state (conservative safety).

---

### 7. `client/src/lib/sync.ts`

#### A. `pullAllFromServerIntoDexie()` → Surface Stale Data State
- On `catch`, if server returned `staleData: true` in a response envelope, surface it.
- Add retry(1) logic before bubbling error.
- Ensure `localStorage.smartpos_tenant_id` is set **before** the pull (defensive ordering).

---

## Verification / Test Plan

| Scenario | Steps | Expected |
|---|---|---|
| **Unbind → Signup works (FIX #1)** | 1. Create Admin A → Logout. 2. Visit register-tenant → Unbind. 3. Visit admin-signup → create Admin B same mobile. | Signup succeeds, no "mobile already registered" error, Admin B logged in, A's data gone. |
| **Online login verifies cloud (FIX #2)** | 1. Create local Admin C in Dexie ONLY (no Supabase). 2. Online → login as C. | Login denied with "local admin not in cloud" error. |
| **Offline login allows local (FIX #2)** | 1. Ensure Admin D exists locally. 2. Disable network. 3. Login as D. | Login succeeds, offline banner shown. |
| **Online login — both exist → passes (FIX #2)** | 1. Admin in both SQLite + Supabase. 2. Online login. | Succeeds, Dexie hydrated with cloud data, no stale flag. |
| **Full unbind wipes all (FIX #1 deep)** | 1. Seed products/sales/staff locally. 2. Unbind device (with admin password). 3. Check Dexie tables, localStorage. | All `smartpos_*` keys gone, all Dexie tables empty, server SQLite cleaned. |
| **Signup lock now works (FIX status API)** | 1. Admin exists. 2. Visit `/admin-signup`. | "Registration Locked" page shown with unbind option. |
| **Async sync after login** | 1. Online login for admin with cloud data. 2. Check dashboard. | Dashboard shows data, no empty state; if cloud pull times out, toast warning shown. |

---

## Risk & Mitigation

| Risk | Mitigation |
|---|---|
| `clearBoundTenantId` wiping too much data (destructive) | Only purge when explicitly unbinding, log all purged tables to server logs, return diagnostic payload in unbind response (non-sensitive, no data leaked). |
| Breaking existing offline login | Offline fallback preserved; only online path adds cloud-verify gate. |
| `purgeLocalState` running on wrong mount | Guard: only run on admin-signup mount IF no token AND no smartpos_user in localStorage. |
| BCrypt cost on client (8) vs server (10) mismatch | Leave as is — login path already handles bcrypt compare correctly via `verifyPassword`. |

---

## Acceptance Criteria
1. After clicking unbind in either `register-tenant.tsx` or new admin-signup unbind button, user can successfully create a new admin account without "mobile/username already registered" errors.
2. Online admin login verifies admin exists in Supabase Cloud; otherwise denies with clear actionable message.
3. Offline admin login still works (local-only check), user sees "Offline Mode" indicator.
4. `/api/auth/status` returns `configured` that matches `adminExists` — signup lock screen works.
5. No data leakage: After unbind, previous tenant's products/sales/staff are inaccessible from client Dexie or server SQLite.
6. TypeScript compiles clean (`npm run build`) with no new `any` escapes in logic paths.
