import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import type { Staff, Sale, SaleItem, User } from "@shared/schema"; // Import Sale and SaleItem types
import dbService from "./database";
import { scanWifiNetworks, getWifiStatus } from "./network";
import { randomUUID } from "crypto";
import { z } from "zod";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { getSupabase } from "./supabase";
import { DeveloperService } from "./developer-service";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database schema for products and staff
  dbService.initSchema();
  

  // Enable CORS for all routes
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      // Allow all netlify subdomains, localhost, and onrender.com/railway.app
      if (origin.includes('netlify.app') || origin.includes('localhost') || origin.includes('onrender.com') || origin.includes('railway.app')) {
        return callback(null, true);
      }
      return callback(null, true); // For now, allow everything for testing
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-ID"]
  }));
  app.use(express.json());

  // Health check for Render
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Quick test endpoint to check what's in Supabase (for debugging) - NO TENANT CHECK!
  app.get("/api/test/supabase-users", async (req, res) => {
    try {
      console.log("=== TEST ENDPOINT HIT ===");
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: "No Supabase connection" });
      
      const { data: tenants } = await supabase.from("tenants").select("*");
      const { data: users } = await supabase.from("users").select("id, username, tenant_id, role");
      
      console.log("=== TEST: Supabase Data ===");
      console.log("Tenants:", tenants);
      console.log("Users:", users);
      
      res.json({ tenants, users });
    } catch (error) {
      console.error("Test endpoint error:", error);
      res.status(500).json({ error: "Test endpoint failed", details: error });
    }
  });

  // Tenant registration (no auth required, no tenant check needed)
  app.post("/api/tenants/register", async (req: Request, res: Response) => {
    try {
      console.log("=== REGISTERING TENANT ===");
      const { storeName, subdomain, username, password } = req.body;
      console.log("Data:", { storeName, subdomain, username });
      
      const supabase = getSupabase();
      if (!supabase) {
        return res.status(500).json({ error: "Cloud not configured" });
      }
      
      // 1. Create tenant
      const tenantId = randomUUID();
      console.log("Creating tenant with ID:", tenantId);
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({ id: tenantId, store_name: storeName, subdomain: subdomain.toLowerCase() })
        .select()
        .single();
      
      if (tenantError) {
        console.error("TENANT ERROR:", tenantError);
        return res.status(400).json({ error: tenantError.message });
      }
      console.log("TENANT CREATED:", tenant);
      
      // 2. Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log("Password hashed, starts with:", hashedPassword.substring(0, 20));
      
      // 3. Create admin user - ONLY the minimal data we KNOW is in your users table!
      // Your users table only has: id, tenant_id, username, password, role
      const userId = randomUUID();
      const minimalUserData: any = {
        id: userId,
        tenant_id: tenant.id,
        username,
        password: hashedPassword,
        role: "admin"
      };
      
      console.log("Creating user with data:", minimalUserData);
      
      const { data: user, error: userError } = await supabase
        .from("users")
        .insert(minimalUserData)
        .select()
        .single();
      
      if (userError) {
        console.error("USER ERROR:", userError);
        return res.status(400).json({ 
          error: "Failed to create user.",
          details: userError 
        });
      }
      
      console.log("USER CREATED:", user);
      
      res.status(201).json({ success: true, tenant, user });
    } catch (error) {
      console.error("TENANT REGISTRATION ERROR:", error);
      res.status(500).json({ error: "Tenant registration failed", details: error });
    }
  });

  // Tenant Context Middleware (APPLIES TO ALL SUBSEQUENT ROUTES!)
  const tenantContext = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get tenant identifier from X-Tenant-ID header
      const subdomain = req.headers['x-tenant-id'] as string;
      
      if (!subdomain) {
        return res.status(400).json({ error: 'X-Tenant-ID header is required' });
      }
      
      // Validate tenant via Supabase
      const supabase = getSupabase();
      if (!supabase) {
        console.warn('Supabase not configured, skipping tenant validation');
        // For development, if Supabase not available, just attach dummy tenant
        (req as any).tenantId = 'default-tenant-id';
        (req as any).subdomain = subdomain;
        return next();
      }

      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('subdomain', subdomain)
        .single();

      if (error || !tenant) {
        console.error('Tenant not found for subdomain: ' + subdomain, error);
        return res.status(404).json({ error: 'Store not found' });
      }

      // Attach tenant to request object
      (req as any).tenant = tenant;
      (req as any).tenantId = tenant.id;
      (req as any).subdomain = subdomain;
      
      console.log('Tenant identified: ' + tenant.store_name + ' (' + subdomain + ')');
      next();
    } catch (error) {
      console.error('Tenant context error:', error);
      res.status(500).json({ error: 'Failed to identify store' });
    }
  };

  const allowLocalNetwork: (req: Request, res: Response, next: NextFunction) => void = (req, res, next) => {
    // Prefer X-Forwarded-For when present (proxies), otherwise use socket remote address
    const xff = (req.headers['x-forwarded-for'] as string) || '';
    const ip = xff ? xff.split(',')[0].trim() : (req.ip || req.socket.remoteAddress || '');
    
    // Allow localhost
    if (ip === '::1' || ip === '127.0.0.1' || ip.includes('127.0.0.1')) {
      return next();
    }
    
    // Allow private networks
    // 192.168.x.x
    if (ip.includes('192.168.')) {
      return next();
    }
    // 10.x.x.x
    if (/^(\:\:ffff\:)?10\./.test(ip)) {
      return next();
    }
    // 172.16.x.x - 172.31.x.x
    if (/^(\:\:ffff\:)?172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) {
      return next();
    }

    // In development mode or production deployment allow all (convenience)
    if (app.get('env') === 'development' || process.env.NODE_ENV === 'production') {
      return next();
    }
    
    // For local network mode, we enforce restriction
    console.warn(`Blocked access from non-local IP: ${ip}`);
    res.status(403).json({ error: 'Access restricted to local network devices only' });
  };

  // Schedule session cleanup (every 60 minutes)
  setInterval(() => {
    try {
      const result = dbService.cleanupExpiredSessions(24); // 24 hours inactivity
      if (result.changes > 0) {
        console.log('Cleaned up ' + result.changes + ' expired sessions');
      }
    } catch (e) {
      console.error('Session cleanup failed:', e);
    }
  }, 60 * 60 * 1000);

  // Helper function to get tenant from X-Tenant-ID
  const getTenantFromHeader = async (req: Request) => {
    const subdomain = req.headers['x-tenant-id'] as string;
    if (!subdomain) return null;
    
    const supabase = getSupabase();
    if (!supabase) return { id: 'default-tenant-id', subdomain };
    
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('subdomain', subdomain.toLowerCase())
      .single();
    
    return tenant;
  };

  // Admin Status
  app.get('/api/auth/status', async (req: Request, res: Response) => {
    try {
      const tenant = await getTenantFromHeader(req);
      const admin = dbService.getAdmin();
      const adminExists = !!admin;
      console.log('/api/auth/status hit, tenant:', tenant);
      console.log('/api/auth/status, admin exists:', adminExists);
      
      if (!adminExists) {
        return res.json({ adminExists: false, tenant: tenant || null });
      }
      
      const { password, ...adminWithoutPassword } = admin;
      
      res.json({ adminExists: true, admin: adminWithoutPassword, tenant: tenant || null });
    } catch (error) {
      console.error('Error in /api/auth/status:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  // Settings API
  app.get('/api/settings', (req, res) => {
    try {
      const settings = dbService.getSettings();
      // Wrap in receipt key to match client expectation
      const response = {
        receipt: settings.receipt || {}
      };
      res.json(response);
    } catch (error) {
      console.error('Error in GET /api/settings:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  });

  app.put('/api/settings', (req, res) => {
    try {
      const { receipt } = req.body;
      // Save receipt settings
      const result = dbService.upsertSettings({ receipt });
      res.json(result);
    } catch (error) {
      console.error('Error in PUT /api/settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // Test print endpoint (simple placeholder)
  app.post('/api/print/test-receipt', (req, res) => {
    try {
      console.log('Test receipt print requested');
      res.json({ success: true, message: 'Test receipt queued for printing' });
    } catch (error) {
      console.error('Error in test print:', error);
      res.status(500).json({ error: 'Failed to print test receipt' });
    }
  });

  // Auth API
  app.post('/api/auth/admin-login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      console.log('=== LOGIN ATTEMPT ===');
      console.log('Username:', username);
      
      // Get tenant from header
      const tenant = await getTenantFromHeader(req);
      console.log('Tenant:', tenant);
      
      // First check Supabase first (prefer cloud over local)
      let admin = null;
      const supabase = getSupabase();
      if (supabase) {
        console.log('=== CHECKING SUPABASE ===');
        console.log('Looking for user:', username);
        
        // Try all possible ways to find the user
        let attempts = [];
        if (tenant) {
          attempts.push(
            // 1. Exact match with tenant_id
            async () => {
              console.log('Attempt 1: with tenant_id');
              return await supabase.from('users').select('*').eq('username', username).eq('tenant_id', tenant.id).single();
            },
            // 2. Case-insensitive username with tenant_id
            async () => {
              console.log('Attempt 2: with tenant_id, case-insensitive');
              const { data: users } = await supabase.from('users').select('*').eq('tenant_id', tenant.id);
              const user = users?.find(u => u.username.toLowerCase() === username.toLowerCase());
              return { data: user, error: user ? null : new Error('Not found') };
            }
          );
        }
        // Also add attempts without tenant_id
        attempts.push(
          // 3. Without tenant_id
          async () => {
            console.log('Attempt 3: without tenant_id');
            return await supabase.from('users').select('*').eq('username', username).single();
          },
          // 4. Case-insensitive without tenant_id
          async () => {
            console.log('Attempt 4: without tenant_id, case-insensitive');
            const { data: users } = await supabase.from('users').select('*');
            const user = users?.find(u => u.username.toLowerCase() === username.toLowerCase());
            return { data: user, error: user ? null : new Error('Not found') };
          }
        );
        
        // Try each attempt until one works
        let data: any = null;
        for (let i = 0; i < attempts.length; i++) {
          const result = await attempts[i]();
          if (!result.error && result.data) {
            data = result.data;
            console.log('SUCCESS with attempt ' + (i+1) + '!');
            break;
          }
          console.log('Attempt ' + (i+1) + ' failed:', result.error?.message || 'No data');
        }
        
        if (data) {
          console.log('User data from Supabase:');
          console.log('  - id:', data.id);
          console.log('  - username:', data.username);
          console.log('  - role:', data.role);
          console.log('  - tenant_id:', data.tenant_id);
          console.log('  - password starts with:', (data.password || '').substring(0, 20));
          
          admin = data as any;
          console.log('Successfully found user in Supabase');
        } else {
          console.log('All attempts failed to find user in Supabase');
        }
      }
      
      // If not in Supabase, try local
      if (!admin) {
        console.log('User not found in Supabase, checking local DB');
        admin = dbService.getUserByUsername(username) as User | undefined;
        if (admin) {
          console.log('Found user in local DB:', admin.username);
        }
      }
      
      if (!admin) {
        console.log('ERROR: User not found anywhere');
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      console.log('=== CHECKING ROLE ===');
      // Check if role is admin (handle different role column names)
      const isAdmin = admin.role === 'admin' || admin.is_admin === true || admin.type === 'admin';
      console.log('Role check:', isAdmin ? 'PASS' : 'FAIL');
      console.log('  - admin.role:', admin.role);
      console.log('  - admin.is_admin:', admin.is_admin);
      console.log('  - admin.type:', admin.type);
      
      if (!isAdmin) {
        console.log('ERROR: User is not an admin');
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      console.log('=== CHECKING PASSWORD ===');
      console.log('Password entered:', password);
      console.log('Stored hash:', (admin.password || '').substring(0, 30) + '...');
      
      const isValid = await bcrypt.compare(password, admin.password);
      console.log('Password valid:', isValid);
      
      if (!isValid) {
        console.log('ERROR: Password invalid');
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      console.log('=== CREATING SESSION ===');
      // Create session
      const token = randomUUID();
      const session = {
        id: randomUUID(),
        user_id: admin.id,
        token,
        tenant_id: tenant?.id || admin.tenant_id || 'default',
        device_info: req.headers['user-agent'] || 'Unknown Device',
        ip_address: req.ip || req.socket.remoteAddress || 'Unknown',
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString()
      };

      dbService.createSession(session);
      console.log('Session created successfully');

      // Auto-pull all data from cloud on login for multi-device sync
      if (useCloud()) {
        try {
          const tenantId = session.tenant_id;
          console.log('=== AUTO-PULLING DATA FROM CLOUD ===');
          await dbService.pullAllFromCloud(tenantId);
          console.log('=== AUTO-PULL COMPLETED ===');
        } catch (pullError) {
          console.warn('=== AUTO-PULL FAILED (continuing login anyway) ===', pullError);
        }
      }

      // Return admin info and token
      const { password: _, ...adminInfo } = admin;
      console.log('=== LOGIN SUCCESSFUL ===');
      res.json({ user: adminInfo, token });
    } catch (error) {
      console.error('=== LOGIN ERROR ===');
      console.error(error);
      res.status(500).json({ error: 'Login failed', details: error });
    }
  });

  // Apply tenantContext middleware to all protected API endpoints
  app.use('/api', (req, res, next) => {
    // Skip tenantContext for public endpoints
    const publicEndpoints = [
      '/health',
      '/test/supabase-users',
      '/tenants/register',
      '/auth/status',
      '/auth/login',
      '/auth/admin-login',
      '/auth/session',
      '/server-info',
      '/wifi/status',
      '/wifi/connect'
    ];
    
    if (publicEndpoints.some(p => req.path.startsWith(p))) {
      return next();
    }
    
    // Otherwise require tenant context
    tenantContext(req, res, next);
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { staffId, passkey, deviceInfo } = req.body;
      
      // Get tenant from header
      const tenant = await getTenantFromHeader(req);

      // Verify credentials with tenant check
      let staff = null;
      const supabase = getSupabase();
      
      if (supabase && tenant) {
        // Check Supabase first with tenant ID validation
        const { data, error } = await supabase
          .from('staff')
          .select('*')
          .eq('staff_id', staffId)
          .eq('tenant_id', tenant.id)
          .single();
          
        if (!error && data) {
          staff = {
            id: data.id,
            name: data.name,
            staffId: data.staff_id,
            passkey: data.passhash,
            createdBy: data.created_by,
            createdAt: data.created_at,
            tenantId: data.tenant_id
          };
          // Save to local DB for future offline use
          dbService.saveStaff([staff]);
        }
      } 
      
      // If not in Supabase, try local
      if (!staff) {
        staff = dbService.getStaffByStaffId(staffId) as any;
      }

      if (!staff) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password using bcrypt
      const isValid = await bcrypt.compare(passkey, staff.passkey);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Create session
      const token = randomUUID();
      const session = {
        id: randomUUID(),
        user_id: staff.id,
        token,
        tenant_id: tenant?.id || 'default', // Store tenant ID in session
        device_info: deviceInfo || 'Unknown Device',
        ip_address: req.ip || req.socket.remoteAddress || 'Unknown',
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString()
      };

      dbService.createSession(session);

      // Return token and user info
      res.status(200).json({
        token,
        user: {
          id: staff.id,
          name: staff.name,
          staffId: staff.staffId,
          role: 'staff'
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/cloud/login', async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: 'Cloud not configured' });
      const { staffId, passkey, deviceInfo } = req.body;
      const { data, error } = await supabase.from('staff').select('*').eq('staff_id', staffId).single();
      if (error || !data) return res.status(401).json({ error: 'Invalid credentials' });
      const ok = await bcrypt.compare(passkey, String(data.passhash || ''));
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = randomUUID();
      const session = {
        id: randomUUID(),
        user_id: String(data.id),
        token,
        device_info: deviceInfo || 'Unknown Device',
        ip_address: req.ip || req.socket.remoteAddress || 'Unknown',
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString()
      };
      dbService.createSession(session);
      res.status(200).json({
        token,
        user: {
          id: String(data.id),
          name: String(data.name),
          staffId: String(data.staff_id),
          role: 'staff'
        }
      });
    } catch (e) {
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        dbService.revokeSession(token);
      }
      res.status(200).json({ message: 'Logged out' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  const authenticateUser = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    console.log('Server Auth: Received Authorization header:', authHeader);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('Server Auth: No valid Authorization header provided.');
      return res.status(401).json({ error: 'Authentication required: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Server Auth: Extracted token:', token);
    const session = dbService.getSessionByToken(token) as any;

    if (!session) {
      console.warn('Server Auth: Invalid session for token:', token);
      return res.status(401).json({ error: 'Authentication required: Invalid session' });
    }

    // Update activity
    dbService.updateSessionActivity(token);
    console.log('Server Auth: Session valid, user ID:', session.user_id);

    // Attach user ID to request for downstream use
    (req as any).userId = session.user_id;
    next();
  };

  app.post('/api/auth/set-security-questions', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const { questions, answers } = req.body;

      if (!userId || !Array.isArray(questions) || questions.length !== 3 || !Array.isArray(answers) || answers.length !== 3) {
        return res.status(400).json({ error: 'Invalid input: userId, 3 questions, and 3 answers are required.' });
      }

      // Hash answers before saving (already handled in dbService.saveSecurityQuestions)
      await dbService.saveSecurityQuestions(userId, questions, answers);
      res.status(200).json({ message: 'Security questions set successfully.' });
    } catch (error) {
      console.error('Error setting security questions:', error);
      res.status(500).json({ error: 'Failed to set security questions.' });
    }
  });

  app.post('/api/auth/verify-security-answers', async (req: Request, res: Response) => {
    try {
      const { username, answers } = req.body;

      if (!username || !Array.isArray(answers) || answers.length !== 3) {
        return res.status(400).json({ error: 'Invalid input: username and 3 answers are required.' });
      }

      const user = dbService.getUserByUsername(username) as User | undefined; // Get full user data
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Check for lockout
      if (user.lockoutUntil && new Date(user.lockoutUntil) > new Date()) {
        const remainingTime = Math.ceil((new Date(user.lockoutUntil).getTime() - new Date().getTime()) / (1000 * 60));
        return res.status(429).json({ error: `Account locked. Try again in ${remainingTime} minutes.` });
      }

      const securityQuestions = dbService.getUserSecurityQuestions(username);

      if (!securityQuestions || !securityQuestions.securityQuestion1) { // Check if questions are set
        return res.status(404).json({ error: 'Security questions not set for this user.' });
      }

      const storedHashedAnswers = [
        securityQuestions.securityAnswer1,
        securityQuestions.securityAnswer2,
        securityQuestions.securityAnswer3,
      ];

      let allAnswersMatch = true;
      for (let i = 0; i < 3; i++) {
        if (!await bcrypt.compare(answers[i], storedHashedAnswers[i])) {
          allAnswersMatch = false;
          break;
        }
      }

      if (allAnswersMatch) {
        dbService.resetLoginAttempts(username); // Reset attempts on success
        res.status(200).json({ success: true, message: 'Security answers verified.' });
      } else {
        const failedAttempts = dbService.recordFailedLoginAttempt(username);
        if (failedAttempts >= 3) { // Lockout after 3 failed attempts
          dbService.lockUserAccount(username, 3); // Lock for 3 minutes
          return res.status(401).json({ success: false, error: 'Incorrect security answers. Account locked for 3 minutes.' });
        }
        res.status(401).json({ success: false, error: 'Incorrect security answers.' });
      }
    } catch (error) {
      console.error('Error verifying security answers:', error);
      res.status(500).json({ error: 'Failed to verify security answers.' });
    }
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { username, newPassword } = req.body;

      if (!username || !newPassword) {
        return res.status(400).json({ error: 'Username and new password are required.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await dbService.updateUserPassword(username, hashedPassword);

      res.status(200).json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  });

  app.post('/api/auth/update-admin', authenticateUser, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;
      const updates = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const updatedUser = dbService.updateAdmin(userId, updates);
      if (!updatedUser) {
        return res.status(404).json({ error: 'Admin not found' });
      }

      res.status(200).json({ success: true, user: updatedUser });
    } catch (error) {
      console.error('Error updating admin:', error);
      res.status(500).json({ error: 'Failed to update admin profile.' });
    }
  });

  app.get('/api/auth/session', (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];
      const session = dbService.getSessionByToken(token) as any;

      if (!session) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      // Update activity
      dbService.updateSessionActivity(token);

      // Get user info
      const allStaff = dbService.getStaff() as any[];
      const user = allStaff.find(s => s.id === session.user_id);

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      res.status(200).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          staffId: user.staffId,
          role: 'staff'
        }
      });
    } catch (error) {
      console.error('Session check error:', error);
      res.status(500).json({ error: 'Session check failed' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
  });

  // Products API - Sync products with connected devices
  app.get('/api/products', (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const products = dbService.getProducts(tenantId);
      res.status(200).json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  app.post('/api/sales', async (req: Request, res: Response) => {
    try {
      const { sale, items } = req.body; // Expecting sale and items separately
      
      if (!sale || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Invalid sale data provided.' });
      }

      // Ensure staffId is present, if not, default to 'unknown' or handle as appropriate
      if (!sale.staffId) {
        sale.staffId = 'unknown'; // Or fetch from session if admin is making the sale
      }

      // Use the new atomic addSale method
      dbService.addSale(sale, items);
      
      // Emit specific inventory updates and a new sale event
      for (const item of items) {
        if (!item.isNonInventory) {
          io.emit('inventory-update', { productId: item.productId, quantityChange: -item.quantity });
        }
      }
      io.emit('sale-added', { sale, items }); // Emit the full sale for admin dashboard

      res.status(201).json({ success: true, message: 'Sale processed successfully.' });
    } catch (error: any) {
      console.error('Error processing server sale:', error);
      res.status(500).json({ error: error.message || 'Failed to process sale on server' });
    }
  });

  app.get('/api/sales-history', async (req: Request, res: Response) => {
    try {
      const salesHistory = await dbService.getAllSalesWithStaff();
      res.status(200).json(salesHistory);
    } catch (error) {
      console.error('Error fetching sales history:', error);
      res.status(500).json({ error: 'Failed to fetch sales history' });
    }
  });

  app.get('/api/cloud/products', async (_req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: 'Cloud not configured' });
      const { data, error } = await supabase.from('products').select('*');
      if (error) return res.status(500).json({ error: 'Failed to fetch products' });
      const mapped = (data || []).map((p: any) => ({
        id: String(p.id),
        name: p.name,
        price: Number(p.price || 0),
        cost: Number(p.cost || 0),
        barcode: String(p.barcode || ''),
        category: p.category || null,
        image: p.image || null,
        quantity: Number(p.quantity || 0),
        createdAt: p.created_at || null,
        updatedAt: p.updated_at || null
      }));
      res.status(200).json(mapped);
    } catch {
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  app.get('/api/cloud/transactions', async (_req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: 'Cloud not configured' });
      
      const { data, error } = await supabase
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

      if (error) throw error;

      // Also fetch staff names for these sales
      const { data: cloudStaff } = await supabase.from('staff').select('staff_id, name');
      const staffMap = new Map((cloudStaff || []).map(s => [s.staff_id, s.name]));

      const mapped = (data || []).map(s => ({
        id: s.id,
        total: s.total,
        paymentType: s.payment_type,
        paymentAmount: s.payment_amount,
        staffId: s.staff_id,
        remitted: !!s.remitted,
        createdAt: s.created_at,
        staffName: staffMap.get(s.staff_id) || 'Staff'
      }));

      res.status(200).json(mapped);
    } catch (error) {
      console.error('Cloud transactions fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch cloud transactions' });
    }
  });

  app.post('/api/cloud/sync-sales', async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: 'Cloud not configured' });
      
      const { sales, items } = req.body;
      if (!Array.isArray(sales) || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Invalid data format' });
      }

      // Upsert sales
      const mappedSales = sales.map(s => ({
        id: s.id,
        total: s.total,
        payment_type: s.paymentType,
        payment_amount: s.paymentAmount,
        staff_id: s.staffId,
        remitted: !!s.remitted,
        created_at: s.createdAt
      }));

      const { error: salesError } = await supabase.from('sales').upsert(mappedSales, { onConflict: 'id' });
      if (salesError) throw salesError;

      // Upsert items
      const mappedItems = items.map(it => ({
        id: it.id,
        sale_id: it.saleId,
        product_id: it.productId,
        quantity: it.quantity,
        price: it.price,
        unit: it.unit,
        product_name: it.productName,
        is_non_inventory: !!it.isNonInventory
      }));

      const { error: itemsError } = await supabase.from('sale_items').upsert(mappedItems, { onConflict: 'id' });
      if (itemsError) throw itemsError;

      res.status(200).json({ success: true, syncedSales: sales.length, syncedItems: items.length });
    } catch (error) {
      console.error('Cloud sales sync error:', error);
      res.status(500).json({ error: 'Failed to sync sales to cloud' });
    }
  });

  app.post('/api/cloud/sync-expenses', async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: 'Cloud not configured' });
      
      const { expenses } = req.body;
      if (!Array.isArray(expenses)) return res.status(400).json({ error: 'Invalid data format' });

      const mappedExpenses = expenses.map(e => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        category: e.category,
        date: e.date
      }));

      const { error } = await supabase.from('expenses').upsert(mappedExpenses, { onConflict: 'id' });
      if (error) throw error;

      res.status(200).json({ success: true, syncedExpenses: expenses.length });
    } catch (error) {
      console.error('Cloud expenses sync error:', error);
      res.status(500).json({ error: 'Failed to sync expenses to cloud' });
    }
  });

  app.get('/api/products/:barcode', (req: Request, res: Response) => {
    try {
      const { barcode } = req.params;
      const tenantId = (req as any).tenantId;
      const product = dbService.getProductByBarcode(barcode, tenantId) as any;
      
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      res.status(200).json(product);
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({ error: 'Failed to fetch product' });
    }
  });
  
  // Non-inventory products API
  app.get('/api/non-inventory-products', (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const products = dbService.getNonInventoryProducts(tenantId);
      res.status(200).json(products);
    } catch (error) {
      console.error('Error fetching non-inventory products:', error);
      res.status(500).json({ error: 'Failed to fetch non-inventory products' });
    }
  });

  app.post('/api/non-inventory-products', (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const products = Array.isArray(req.body) ? req.body : [req.body];
      dbService.saveNonInventoryProducts(products, tenantId);
      res.status(200).json({ message: 'Non-inventory products saved successfully' });
    } catch (error) {
      console.error('Error saving non-inventory products:', error);
      res.status(500).json({ error: 'Failed to save non-inventory products' });
    }
  });

  app.delete('/api/non-inventory-products/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tenantId = (req as any).tenantId;
      dbService.deleteNonInventoryProduct(id, tenantId);
      res.status(200).json({ message: 'Non-inventory product deleted' });
    } catch (error) {
      console.error('Error deleting non-inventory product:', error);
      res.status(500).json({ error: 'Failed to delete non-inventory product' });
    }
  });

  // Specific endpoint for barcode scanning from customer page
  app.get('/api/products/barcode/:barcode', (req: Request, res: Response) => {
    try {
      const { barcode } = req.params;
      const tenantId = (req as any).tenantId;
      let product = dbService.getProductByBarcode(barcode, tenantId) as any;
      
      if (!product) {
        // Try to find in non-inventory products
        const niProduct = dbService.getNonInventoryProductByBarcode(barcode, tenantId) as any;
        if (niProduct) {
          product = {
            ...niProduct,
            quantity: 999999, // Infinite stock for non-inventory
            isNonInventory: true
          };
        }
      }
      
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      // Add inStock property based on quantity
      const productWithStock = {
        ...product,
        inStock: (product.quantity > 0)
      };
      
      res.status(200).json(productWithStock);
    } catch (error) {
      console.error('Error fetching product by barcode:', error);
      res.status(500).json({ error: 'Failed to fetch product' });
    }
  });


  // Variant endpoints
  app.get('/api/products/:id/variants', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tenantId = (req as any).tenantId;
      const variants = dbService.getVariants(id, tenantId);
      res.status(200).json(variants);
    } catch (error) {
      console.error('Error fetching variants:', error);
      res.status(500).json({ error: 'Failed to fetch variants' });
    }
  });

  app.post('/api/cloud/products', async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: 'Cloud not configured' });
      const products = Array.isArray(req.body) ? req.body : [];
      const rows = products.map((p: any) => ({
        id: String(p.id),
        name: String(p.name || ''),
        price: Number(p.price || 0),
        cost: Number(p.cost || 0),
        barcode: String(p.barcode || ''),
        category: p.category ?? null,
        image: p.image ?? null,
        quantity: Number(p.quantity || 0),
        created_at: p.createdAt ?? new Date().toISOString(),
        updated_at: p.updatedAt ?? new Date().toISOString()
      }));
      const { error } = await supabase.from('products').upsert(rows, { onConflict: 'id' });
      if (error) return res.status(500).json({ error: 'Failed to sync products' });
      res.status(200).json({ synced: rows.length });
    } catch {
      res.status(500).json({ error: 'Failed to sync products' });
    }
  });

  app.post('/api/variants', (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const variants = req.body;
      if (!Array.isArray(variants)) {
        return res.status(400).json({ error: 'Invalid variants data: expected an array' });
      }

      // Filter out variants that don't have a corresponding product
      const validVariants = variants.filter((v: any) => {
        if (!v.productId && !v.product_id) {
          console.warn(`Variant ${v.id} skipped: missing productId`);
          return false;
        }
        const productId = v.productId || v.product_id;
        const productExists = dbService.getProductById(productId, tenantId);
        if (!productExists) {
          console.warn(`Variant ${v.id} skipped: product with ID ${productId} does not exist`);
          return false;
        }
        return true;
      });

      if (validVariants.length > 0) {
        dbService.saveVariants(validVariants, tenantId);
        res.status(200).json({ message: `Successfully updated ${validVariants.length} variants` });
      } else {
        res.status(200).json({ message: 'No valid variants to update' });
      }
    } catch (error) {
      console.error('Error updating variants:', error);
      res.status(500).json({ error: 'Failed to update variants' });
    }
  });

  // Sync endpoint - allows clients to sync their database with the server
  app.post('/api/sync', (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const { lastSyncTimestamp } = req.body;
      const timestamp = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0);
      
      // Get all products updated since the last sync
      const products = dbService.getProductsSince(timestamp, tenantId);
      const variants = dbService.getVariantsSince(timestamp, tenantId);
      
      res.status(200).json({
        products,
        variants,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error during sync:', error);
      res.status(500).json({ error: 'Sync failed' });
    }
  });

  // Staff API - Share staff accounts with connected devices
  app.get('/api/staff', (req: Request, res: Response) => {
    try {
      const staff = dbService.getStaff();
      res.status(200).json(staff);
    } catch (error) {
      console.error('Error fetching staff:', error);
      res.status(500).json({ error: 'Failed to fetch staff' });
    }
  });

  app.get('/api/cloud/staff', async (_req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: 'Cloud not configured' });
      const { data, error } = await supabase.from('staff').select('*');
      if (error) return res.status(500).json({ error: 'Failed to fetch staff' });
      const mapped = (data || []).map((s: any) => ({
        id: String(s.id),
        name: s.name,
        staffId: s.staff_id,
        passkey: '',
        createdBy: s.created_by || null,
        createdAt: s.created_at || null
      }));
      res.status(200).json(mapped);
    } catch {
      res.status(500).json({ error: 'Failed to fetch staff' });
    }
  });

  app.get('/api/cloud/admins', async (_req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: 'Cloud not configured' });
      const { data, error } = await supabase.from('admins').select('*');
      if (error) return res.status(500).json({ error: 'Failed to fetch admins' });
      const mapped = (data || []).map((a: any) => ({
        id: String(a.id),
        name: a.name,
        email: a.email
      }));
      res.status(200).json(mapped);
    } catch {
      res.status(500).json({ error: 'Failed to fetch admins' });
    }
  });


  // Sync staff endpoint - allows clients to sync staff accounts
  app.post('/api/sync-staff', (req: Request, res: Response) => {
    try {
      const { lastSyncTimestamp } = req.body;
      const timestamp = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0);
      
      // Get all staff updated since the last sync
      const staff = (dbService.getStaffSince(timestamp) as any[])
        .map((member: any) => ({
          id: member.id,
          name: member.name,
          staffId: member.staffId,
          createdBy: member.createdBy,
          createdAt: member.createdAt
        }));
      
      res.status(200).json({
        staff,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error during staff sync:', error);
      res.status(500).json({ error: 'Staff sync failed' });
    }
  });

  // WiFi scanning endpoint - returns nearby WiFi networks (Windows only)
  app.get('/api/wifi/scan', async (_req: Request, res: Response) => {
    try {
      const networks = await scanWifiNetworks();
      res.status(200).json(networks);
    } catch (error: any) {
      console.error('Error scanning WiFi networks:', error);
      res.status(501).json({ error: 'Wi‑Fi scan not supported on this platform', details: error?.message });
    }
  });

  // Admin endpoint: clear server database tables (products, staff)
  app.post('/api/admin/clear', (req: Request, res: Response) => {
    try {
      const { confirm } = req.body || {};
      if (confirm !== 'CLEAR_ALL') {
        return res.status(400).json({ error: 'Confirmation required', expected: 'CLEAR_ALL' });
      }
      const result = dbService.clearAllData();
      res.status(200).json({ message: 'Server database cleared', ...result });
    } catch (error) {
      console.error('Error clearing server database:', error);
      res.status(500).json({ error: 'Failed to clear server database' });
    }
  });

  // Connect to WiFi network (not supported from Node server)
  app.post('/api/wifi/connect', async (req: Request, res: Response) => {
    const { ssid } = req.body;
    if (!ssid) {
      return res.status(400).json({ error: 'SSID is required' });
    }
    // Purposefully do not simulate: inform clients to use OS settings.
    return res.status(501).json({
      error: 'Wi‑Fi connect is not implemented server‑side. Use device Wi‑Fi settings.'
    });
  });

  // Get current WiFi connection status (Windows: netsh, others: OS interfaces)
  app.get('/api/wifi/status', async (_req: Request, res: Response) => {
    try {
      const status = await getWifiStatus();
      res.status(200).json(status);
    } catch (error: any) {
      console.error('Error getting WiFi status:', error);
      res.status(500).json({ error: 'Failed to get Wi‑Fi status', details: error?.message });
    }
  });

  // Provide server info (origin) so clients on LAN can discover the real server URL
  app.get('/api/server-info', (req: Request, res: Response) => {
    try {
      // Prioritize X-Forwarded headers for proxies
      const xProto = req.headers['x-forwarded-proto'] as string;
      const xHost = req.headers['x-forwarded-host'] as string;

      const protocol = xProto || req.protocol || 'http';
      const host = xHost || req.get('host') || `localhost:5000`;

      // If we're on Render, we can use the RENDER_EXTERNAL_URL
      // Otherwise, we build the origin from the request headers
      let origin = process.env.RENDER_EXTERNAL_URL || `${protocol}://${host}`;
      
      // If the origin is purely a hostname, prepend the protocol
      if (origin && !origin.startsWith('http')) {
        origin = `https://${origin}`;
      }
      
      // Ensure the origin is the absolute Render URL if it exists
      if (process.env.RENDER_EXTERNAL_URL && !origin.includes('onrender.com')) {
        origin = process.env.RENDER_EXTERNAL_URL;
      }
      
      res.status(200).json({ origin });
    } catch (error) {
      console.error('Error getting server info:', error);
      res.status(500).json({ error: 'Failed to get server info' });
    }
  });

  const httpServer = createServer(app);

  // Ledger: validation schemas
  const customerSchema = z.object({
    name: z.string().min(1),
    phone: z.string().min(5),
    address: z.string().optional(),
    credit_rating: z.enum(['good','bad']),
    photo_url: z.string().url().optional(),
  });

  // List all products (server database)
  app.get('/api/products', (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const products = dbService.getProducts(tenantId);
      res.status(200).json(products);
    } catch (error) {
      console.error('Error listing products:', error);
      res.status(500).json({ error: 'Failed to list products' });
    }
  });

  const creditSchema = z.object({
    amount: z.number().positive(),
    due_date: z.string().datetime().optional(),
    remarks: z.string().optional(),
    date: z.string().datetime().optional(),
  });

  const paymentSchema = z.object({
    amount: z.number().positive(),
    payment_method: z.enum(['cash','gcash','bank','others']),
    remarks: z.string().optional(),
    date: z.string().datetime().optional(),
  });

  // Ensure photo directory exists
  const photoDir = path.resolve(import.meta.dirname, 'data', 'photos');
  if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });
  app.use('/photos', express.static(photoDir));

  // Customers
  app.post('/api/customers', (req, res) => {
    try {
      const parsed = customerSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid customer data', details: parsed.error.flatten() });
      const id = randomUUID();
      const created = dbService.createCustomer({ id, name: parsed.data.name, phone: parsed.data.phone, address: parsed.data.address ?? null, credit_rating: parsed.data.credit_rating, photo_url: parsed.data.photo_url ?? null });
      res.status(201).json(created);
    } catch (e) {
      res.status(500).json({ error: 'Failed to create customer' });
    }
  });

  app.get('/api/customers', (req, res) => {
    try {
      const customers = dbService.listCustomers() as any[];
      const enriched = customers.map((c) => {
        const bal = dbService.getBalance(c.id);
        return { ...c, ...bal };
      });
      const sortBy = (req.query.sort_by as string) || 'name';
      const sort = (req.query.sort as string) || '';
      const filter = (req.query.filter as string) || '';
      const search = (req.query.search as string) || '';
      const dueBefore = (req.query.due_before as string) || '';
      const dueAfter = (req.query.due_after as string) || '';
      let out = enriched;
      if (search) {
        const kw = search.toLowerCase();
        out = out.filter((c) => String(c.name).toLowerCase().includes(kw) || String(c.phone || '').toLowerCase().includes(kw));
      }
      if (filter === 'paid') out = out.filter((c) => (c.balance ?? 0) <= 0);
      if (filter === 'unpaid') out = out.filter((c) => (c.balance ?? 0) > 0);
      if (dueBefore || dueAfter) {
        const beforeTime = dueBefore ? Date.parse(dueBefore) : undefined;
        const afterTime = dueAfter ? Date.parse(dueAfter) : undefined;
        out = out.filter((c) => {
          const rows = dbService.listCredits(c.id) as any[];
          const hasDue = rows.some((cr) => {
            if (!cr.due_date) return false;
            const t = Date.parse(cr.due_date);
            if (Number.isNaN(t)) return false;
            if (beforeTime && t >= beforeTime) return false;
            if (afterTime && t <= afterTime) return false;
            return true;
          });
        return hasDue;
        });
      }
      if (sort) {
        if (sort === 'name_asc') out = out.sort((a,b) => String(a.name).localeCompare(String(b.name)));
        else if (sort === 'name_desc') out = out.sort((a,b) => String(b.name).localeCompare(String(a.name)));
      } else {
        if (sortBy === 'balance') out = out.sort((a,b) => (b.balance ?? 0) - (a.balance ?? 0));
        else if (sortBy === 'credit') out = out.sort((a,b) => (b.total_credit ?? 0) - (a.total_credit ?? 0));
        else out = out.sort((a,b) => String(a.name).localeCompare(String(b.name)));
      }
      res.status(200).json(out);
    } catch (e) {
      res.status(500).json({ error: 'Failed to list customers' });
    }
  });

  app.get('/api/customers/:id', (req, res) => {
    const c = dbService.getCustomer(req.params.id) as any;
    if (!c) return res.status(404).json({ error: 'Customer not found' });
    const bal = dbService.getBalance(req.params.id);
    res.status(200).json({ ...c, ...bal });
  });

  app.put('/api/customers/:id', (req, res) => {
    try {
      const parsed = customerSchema.partial().safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid customer data', details: parsed.error.flatten() });
      if (parsed.data.credit_rating && !['good','bad'].includes(parsed.data.credit_rating)) return res.status(400).json({ error: 'Invalid credit rating' });
      const updated = dbService.updateCustomer(req.params.id, parsed.data);
      if (!updated) return res.status(404).json({ error: 'Customer not found' });
      res.status(200).json(updated);
    } catch (e) {
      res.status(500).json({ error: 'Failed to update customer' });
    }
  });

  app.delete('/api/customers/:id', (req, res) => {
    const changes = dbService.deleteCustomer(req.params.id);
    if (!changes) return res.status(404).json({ error: 'Customer not found' });
    res.status(204).send();
  });

  // Photo upload via base64 JSON: { "photo_data": "data:image/png;base64,..." }
  app.post('/api/customers/:id/upload-photo', (req, res) => {
    try {
      const { photo_data } = req.body || {};
      if (!photo_data || typeof photo_data !== 'string') return res.status(400).json({ error: 'photo_data base64 string required' });
      const match = photo_data.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) return res.status(400).json({ error: 'Invalid data URL format' });
      const mime = match[1];
      const b64 = match[2];
      const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') ? 'jpg' : 'img';
      const file = path.join(photoDir, `${req.params.id}.${ext}`);
      fs.writeFileSync(file, Buffer.from(b64, 'base64'));
      const rel = `/photos/${req.params.id}.${ext}`;
      const updated = dbService.updateCustomerPhoto(req.params.id, rel) as any;
      if (!updated) return res.status(404).json({ error: 'Customer not found' });
      res.status(200).json(updated);
    } catch (e) {
      res.status(500).json({ error: 'Failed to upload photo' });
    }
  });

  // Credits
  app.post('/api/customers/:id/credits', (req, res) => {
    const parsed = creditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid credit data', details: parsed.error.flatten() });
    const id = randomUUID();
    const created_at = parsed.data.date ?? new Date().toISOString();
    const created = dbService.addCredit({ id, customer_id: req.params.id, amount: parsed.data.amount, remarks: parsed.data.remarks ?? null, created_at });
    if (parsed.data.due_date) dbService.updateCredit(id, { due_date: parsed.data.due_date });
    res.status(201).json(created);
  });

  app.get('/api/customers/:id/credits', (req, res) => {
    const rows = dbService.listCredits(req.params.id);
    res.status(200).json(rows);
  });

  app.put('/api/credits/:credit_id', (req, res) => {
    const parsed = creditSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid credit update', details: parsed.error.flatten() });
    const updated = dbService.updateCredit(req.params.credit_id, { amount: parsed.data.amount, due_date: parsed.data.due_date ?? null, remarks: parsed.data.remarks ?? null });
    if (!updated) return res.status(404).json({ error: 'Credit not found' });
    res.status(200).json(updated);
  });

  app.delete('/api/credits/:credit_id', (req, res) => {
    const changes = dbService.deleteCredit(req.params.credit_id);
    if (!changes) return res.status(404).json({ error: 'Credit not found' });
    res.status(204).send();
  });

  // Payments
  app.post('/api/customers/:id/payments', (req, res) => {
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payment data', details: parsed.error.flatten() });
    const id = randomUUID();
    const created_at = parsed.data.date ?? new Date().toISOString();
    const created = dbService.addPayment({ id, customer_id: req.params.id, amount: parsed.data.amount, payment_method: parsed.data.payment_method, remarks: parsed.data.remarks ?? null, created_at });
    res.status(201).json(created);
  });

  app.get('/api/customers/:id/payments', (req, res) => {
    const rows = dbService.listPayments(req.params.id);
    res.status(200).json(rows);
  });

  app.put('/api/payments/:payment_id', (req, res) => {
    const parsed = paymentSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payment update', details: parsed.error.flatten() });
    const updated = dbService.updatePayment(req.params.payment_id, { amount: parsed.data.amount, payment_method: parsed.data.payment_method, remarks: parsed.data.remarks ?? null });
    if (!updated) return res.status(404).json({ error: 'Payment not found' });
    res.status(200).json(updated);
  });

  app.delete('/api/payments/:payment_id', (req, res) => {
    const changes = dbService.deletePayment(req.params.payment_id);
    if (!changes) return res.status(404).json({ error: 'Payment not found' });
    res.status(204).send();
  });

  // Balance
  app.get('/api/customers/:id/balance', (req, res) => {
    const bal = dbService.getBalance(req.params.id);
    res.status(200).json(bal);
  });

  // Send reminder
  app.post('/api/customers/:id/send-reminder', (req, res) => {
    const { message_type } = req.body || {};
    const types = ['sms','email','push'];
    const mt = String(message_type || '').toLowerCase();
    if (!types.includes(mt)) return res.status(400).json({ error: 'Invalid message type', supported: types });
    const cust = dbService.getCustomer(req.params.id) as any;
    if (!cust) return res.status(404).json({ error: 'Customer not found' });
    const bal = dbService.getBalance(req.params.id);
    const msg = `Hello ${cust.name}, your current balance is ${bal.balance}. Please settle before due.`;
    const status = 'queued';
    const log = dbService.addReminder({ id: randomUUID(), customer_id: req.params.id, message_type: mt, message: msg, status });
    res.status(200).json({ delivery_status: status, reminder: log });
  });

  // Settings
  app.get('/api/settings', (req, res) => {
    const settings = dbService.getSettings();
    res.status(200).json(settings);
  });
  app.put('/api/settings', (req, res) => {
    const updated = dbService.upsertSettings(req.body || {});
    res.status(200).json(updated);
  });

  app.post('/api/print/test-receipt', (req, res) => {
    try {
      const settings = dbService.getSettings() as any;
      const receipt = settings.receipt || {};
      const paperWidth = receipt.paperWidth || '58mm';
      const sep = paperWidth === '80mm' ? '------------------------------------------------' : '--------------------------------';
      const printerName = receipt.printerDeviceName || 'Default System Printer';
      
      const now = new Date();
      const lines: string[] = [];
      const storeName = String(receipt.storeName || 'SmartPOS+ Store').toUpperCase();
      lines.push(storeName);
      const address = String(receipt.storeAddress || '').trim();
      if (address) lines.push(address);
      const phone = String(receipt.storePhone || '').trim();
      if (phone) lines.push(`Tel: ${phone}`);
      lines.push(sep);
      lines.push('TEST RECEIPT');
      lines.push(now.toLocaleString());
      lines.push(sep);
      lines.push('Sample Item A    x1   ₱100.00');
      lines.push('Sample Item B    x2   ₱ 50.00');
      lines.push(sep);
      lines.push('TOTAL                 ₱200.00');
      lines.push('CASH                  ₱500.00');
      lines.push('CHANGE                ₱300.00');
      lines.push(sep);
      const headerNote = String(receipt.headerNote || '').trim();
      if (headerNote) lines.unshift(headerNote);
      const footerNote = String(receipt.footerNote || '').trim();
      if (footerNote) lines.push(footerNote);
      const content = lines.join('\n');
      console.log(`\n===== PRINTER: ${printerName} (${paperWidth}) =====`);
      console.log('\n===== TEST RECEIPT START =====\n' + content + '\n===== TEST RECEIPT END =====\n');
      res.status(200).json({ printed: true, printer: printerName });
    } catch (error) {
      console.error('Test receipt print failed:', error);
      res.status(500).json({ error: 'Failed to print test receipt' });
    }
  });

  app.post('/api/print/sale', (req, res) => {
    try {
      const settings = dbService.getSettings() as any;
      const receipt = settings.receipt || {};
      const paperWidth = receipt.paperWidth || '58mm';
      const sep = paperWidth === '80mm' ? '------------------------------------------------' : '--------------------------------';
      const printerName = receipt.printerDeviceName || 'Default System Printer';

      const body = req.body || {};
      const items = Array.isArray(body.items) ? body.items : [];
      const total = Number(body.total || 0);
      const paymentAmount = Number(body.paymentAmount || 0);
      const change = Number(body.change || 0);
      const paymentType = String(body.paymentType || 'cash').toUpperCase();
      const staffName = body.staffName ? String(body.staffName) : '';
      const createdAt = body.createdAt ? new Date(body.createdAt) : new Date();
      const lines: string[] = [];
      const storeName = String(receipt.storeName || 'SmartPOS+ Store').toUpperCase();
      lines.push(storeName);
      const address = String(receipt.storeAddress || '').trim();
      if (address) lines.push(address);
      const phone = String(receipt.storePhone || '').trim();
      if (phone) lines.push(`Tel: ${phone}`);
      if (receipt.showDateTime !== false) {
        lines.push(createdAt.toLocaleString());
      }
      if (receipt.showStaffName && staffName) {
        lines.push(`Staff: ${staffName}`);
      }
      const headerNote = String(receipt.headerNote || '').trim();
      if (headerNote) lines.push(headerNote);
      lines.push(sep);
      for (const raw of items) {
        const name = String(raw.name || '');
        const quantity = Number(raw.quantity || 0);
        const unit = String(raw.unit || '');
        const price = Number(raw.price || 0);
        const subtotal = Number(raw.subtotal || 0);
        lines.push(name);
        lines.push(
          `${quantity} ${unit} x ₱${price.toFixed(2)}   ₱${subtotal.toFixed(2)}`
        );
      }
      lines.push(sep);
      lines.push(`TOTAL                 ₱${total.toFixed(2)}`);
      lines.push(`${paymentType.padEnd(9)}        ₱${paymentAmount.toFixed(2)}`);
      lines.push(`CHANGE                ₱${change.toFixed(2)}`);
      lines.push(sep);
      const footerNote = String(receipt.footerNote || '').trim();
      if (footerNote) lines.push(footerNote);
      const content = lines.join('\n');
      console.log(`\n===== PRINTER: ${printerName} (${paperWidth}) =====`);
      console.log('\n===== SALE RECEIPT START =====\n' + content + '\n===== SALE RECEIPT END =====\n');
      res.status(200).json({ printed: true, printer: printerName });
    } catch (error) {
      console.error('Sale receipt print failed:', error);
      res.status(500).json({ error: 'Failed to print sale receipt' });
    }
  });

  // Customer ledger composite
  app.get('/api/customers/:id/ledger', (req, res) => {
    const customer = dbService.getCustomer(req.params.id) as any;
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const credits = dbService.listCredits(req.params.id);
    const payments = dbService.listPayments(req.params.id);
    const bal = dbService.getBalance(req.params.id);
    res.status(200).json({ customer, credits, payments, ...bal });
  });

  // Dashboard cards
  app.get('/api/customers/count', (req, res) => {
    res.status(200).json({ count: dbService.customersCount() });
  });
  app.get('/api/payments/total', (req, res) => {
    res.status(200).json({ total_payment: dbService.totalPayments() });
  });
  app.get('/api/credits/total', (req, res) => {
    res.status(200).json({ total_credit: dbService.totalCredits() });
  });
  app.get('/api/ledger/summary', (req, res) => {
    const total_credit = dbService.totalCredits();
    const total_payment = dbService.totalPayments();
    res.status(200).json({ total_credit, total_payment, balance: total_credit - total_payment });
  });

  // Wallet APIs
  app.get('/api/wallet/:provider/oauth/start', (req, res) => {
    const { provider } = req.params;
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:5000';
    const callbackUrl = `${protocol}://${host}/wallet-callback?provider=${provider}&status=success`;
    
    // In a real app, this would redirect to GCash/Maya's actual OAuth URL
    // For now, we redirect to a mock simulation page
    res.send(`
      <html>
        <head>
          <title>Link ${provider.toUpperCase()}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50 flex items-center justify-center min-h-screen p-4">
          <div class="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md border border-gray-100">
            <div class="text-center mb-8">
              <div class="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span class="text-3xl font-bold text-blue-600">${provider[0].toUpperCase()}</span>
              </div>
              <h1 class="text-2xl font-bold text-gray-900">Link your ${provider.toUpperCase()} account</h1>
              <p class="text-gray-500 mt-2">SmartPOS+ wants to link with your e-wallet</p>
            </div>
            <div class="space-y-4">
              <div class="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p class="text-sm font-medium text-gray-700">Mobile Number</p>
                <p class="text-lg font-semibold text-gray-900">09xx xxx xxxx</p>
              </div>
              <button onclick="window.location.href='${callbackUrl}'" class="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
                Authorize & Link
              </button>
              <button onclick="window.close()" class="w-full bg-white text-gray-500 py-3 rounded-xl font-medium border border-gray-200 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
            <p class="text-[10px] text-gray-400 text-center mt-8">Secure connection powered by SmartPOS+ Gateway</p>
          </div>
        </body>
      </html>
    `);
  });

  app.get('/api/wallet/:provider/status', (req, res) => {
    const { provider } = req.params;
    const settings = dbService.getSettings() as any;
    const wallets = settings.wallets || {};
    res.json({ connected: !!wallets[provider] });
  });

  app.post('/api/wallet/:provider/connect', (req, res) => {
    const { provider } = req.params;
    const settings = dbService.getSettings() as any;
    const wallets = settings.wallets || {};
    wallets[provider] = true;
    dbService.upsertSettings({ ...settings, wallets });
    res.json({ success: true });
  });

  // Socket.IO Setup
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: true, // Allow all origins for testing
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["polling", "websocket"],
    allowEIO3: true, // Support for older clients
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Track connected users
  const connectedUsers = new Map<string, { socketIds: Set<string>, lastActive: Date, view?: string }>();

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join-user", (userId) => {
      socket.join(`user:${userId}`);

      const user = connectedUsers.get(userId) || { socketIds: new Set<string>(), lastActive: new Date() };
      user.socketIds.add(socket.id);
      user.lastActive = new Date();
      connectedUsers.set(userId, user);

      // Broadcast online status
      io.emit("user-status", { userId, status: "online", lastActive: new Date().toISOString() });

      // Also emit staffStatusUpdate for staff management
      io.emit("staffStatusUpdate", { staffId: userId, isOnline: true, lastActive: new Date() });
    });

    socket.on("leave-user", (userId) => {
      socket.leave(`user:${userId}`);
      const user = connectedUsers.get(userId);
      if (user) {
        user.socketIds.delete(socket.id);
        if (user.socketIds.size === 0) {
          connectedUsers.delete(userId);
          io.emit("user-status", { userId, status: "offline", lastActive: new Date().toISOString() });
          io.emit("staffStatusUpdate", { staffId: userId, isOnline: false, lastActive: new Date() });
        }
      }
    });

    // Staff Management events
    socket.on("adminOnline", ({ adminId }) => {
      const user = connectedUsers.get(adminId) || { socketIds: new Set<string>(), lastActive: new Date() };
      user.socketIds.add(socket.id);
      user.lastActive = new Date();
      connectedUsers.set(adminId, user);
      io.emit("staffStatusUpdate", { staffId: adminId, isOnline: true, lastActive: new Date() });
    });

    socket.on("adminOffline", ({ adminId }) => {
      const user = connectedUsers.get(adminId);
      if (user) {
        user.socketIds.delete(socket.id);
        if (user.socketIds.size === 0) {
          connectedUsers.delete(adminId);
          io.emit("staffStatusUpdate", { staffId: adminId, isOnline: false, lastActive: new Date() });
        }
      }
    });

    socket.on("heartbeat", ({ adminId }) => {
      const user = connectedUsers.get(adminId);
      if (user) {
        user.lastActive = new Date();
      }
    });

    socket.on("getStaffStatus", (staffIds: string[]) => {
      const statuses = staffIds.map(id => ({
        staffId: id,
        isOnline: connectedUsers.has(id),
        lastActive: connectedUsers.get(id)?.lastActive
      }));
      socket.emit("staffStatusBulk", statuses);
    });

    socket.on("setStaffView", ({ view }) => {
      // Could find user by searching socket ID in all sets
    });

    // Inventory events
    socket.on("product-viewed", ({ barcode }) => {
      console.log(`Product viewed: ${barcode}`);
    });

    socket.on("disconnect", () => {
      // Find user by socket ID and remove
      for (const [userId, user] of connectedUsers.entries()) {
        if (user.socketIds.has(socket.id)) {
          user.socketIds.delete(socket.id);
          if (user.socketIds.size === 0) {
            connectedUsers.delete(userId);
            io.emit("user-status", { userId, status: "offline", lastActive: new Date().toISOString() });
            io.emit("staffStatusUpdate", { staffId: userId, isOnline: false, lastActive: new Date() });
          }
          break;
        }
      }
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Middleware to attach io to req (optional, or just use global io)
  // But we need to emit from API routes.
  // Let's modify the routes to use this io instance.
  // We can attach it to app, or just use it here if we inline the route handlers or move them.
  // Since registerRoutes returns httpServer, we can't easily export io.
  // But we can wrap the route handlers here.

  // Re-define routes that need to emit events
  
  // Products update
  app.post('/api/products', (req: Request, res: Response) => {
    try {
      const tenantId = (req as any).tenantId;
      const products = req.body;
      if (Array.isArray(products)) {
        dbService.saveProducts(products, tenantId);
        io.emit('inventory-update'); // Emit update
        res.status(200).json({ message: 'Products updated successfully' });
      } else {
        res.status(400).json({ error: 'Invalid products data' });
      }
    } catch (error) {
      console.error('Error updating products:', error);
      res.status(500).json({ error: 'Failed to update products' });
    }
  });

  // Staff update
  app.post('/api/staff', async (req: Request, res: Response) => {
    try {
      const staff = req.body;
      if (Array.isArray(staff)) {
        dbService.saveStaff(staff);
        res.status(200).json({ message: 'Staff updated successfully' });
      } else {
        res.status(400).json({ error: 'Invalid staff data' });
      }
    } catch (error) {
      console.error('Error updating staff:', error);
      res.status(500).json({ error: 'Failed to update staff' });
    }
  });

  app.post('/api/cloud/staff', async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: 'Cloud not configured' });
      const staff = Array.isArray(req.body) ? req.body : [];
      const rows = await Promise.all(staff.map(async (m: any) => {
        const passhash = m.passkey && m.passkey.startsWith('$2') ? m.passkey : await bcrypt.hash(String(m.passkey || ''), 10);
        return {
          id: String(m.id),
          name: String(m.name || ''),
          staff_id: String(m.staffId || ''),
          passhash,
          created_by: m.createdBy ?? null,
          created_at: m.createdAt ?? new Date().toISOString()
        };
      }));
      const { error } = await supabase.from('staff').upsert(rows, { onConflict: 'id' });
      if (error) return res.status(500).json({ error: 'Failed to sync staff' });
      res.status(200).json({ synced: rows.length });
    } catch {
      res.status(500).json({ error: 'Failed to sync staff' });
    }
  });

  app.post('/api/cloud/admins', async (req: Request, res: Response) => {
    try {
      const supabase = getSupabase();
      if (!supabase) return res.status(500).json({ error: 'Cloud not configured' });
      const admins = Array.isArray(req.body) ? req.body : [req.body];
      const rows = await Promise.all(admins.map(async (a: any) => {
        const passhash = a.password && a.password.startsWith('$2') ? a.password : await bcrypt.hash(String(a.password || ''), 10);
        return {
          id: String(a.id),
          name: String(a.name || ''),
          email: String(a.email || ''),
          passhash,
          created_at: a.createdAt ?? new Date().toISOString()
        };
      }));
      const { error } = await supabase.from('admins').upsert(rows, { onConflict: 'id' });
      if (error) return res.status(500).json({ error: 'Failed to sync admins' });
      res.status(200).json({ synced: rows.length });
    } catch {
      res.status(500).json({ error: 'Failed to sync admins' });
    }
  });

  // Remittance & Notifications Routes
  app.post('/api/remit', authenticateUser, async (req: Request, res: Response) => {
    try {
      const { staffId, staffName, amount, transactionCount } = req.body;
      const id = randomUUID();
      const remittance = dbService.createRemittance({
        id,
        staffId,
        staffName,
        amount,
        transactionCount
      });

      // Create notification for admin
      const notification = dbService.createNotification({
        type: 'remittance',
        message: `${staffName} remitted ₱${amount.toLocaleString()} for ${transactionCount} transactions.`,
        data: { remittanceId: id, staffName, amount, transactionCount }
      });

      // Notify all admins via socket
      io.emit('notification-received', notification);
      io.emit('remittance-sent', remittance);

      res.status(201).json({ success: true, remittance });
    } catch (error) {
      console.error('Remittance error:', error);
      res.status(500).json({ error: 'Failed to process remittance' });
    }
  });

  app.post('/api/remit/confirm/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const remittance = dbService.confirmRemittance(id) as any;
      if (!remittance) return res.status(404).json({ error: 'Remittance not found' });

      // Create notification about confirmation (optional)
      const notification = dbService.createNotification({
        type: 'system_update',
        message: `Remittance of ₱${remittance.amount} from ${remittance.staff_name} has been confirmed.`,
        data: { remittanceId: id }
      });

      io.emit('notification-received', notification);
      io.emit('remittance-confirmed', remittance);

      res.json({ success: true, remittance });
    } catch (error) {
      console.error('Confirmation error:', error);
      res.status(500).json({ error: 'Failed to confirm remittance' });
    }
  });

  app.get('/api/remittances/pending', async (req: Request, res: Response) => {
    try {
      const pending = dbService.listPendingRemittances();
      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch pending remittances' });
    }
  });

  app.get('/api/sales/remitted/:staffId', async (req: Request, res: Response) => {
    try {
      const { staffId } = req.params;
      const remittedSales = dbService.getRemittedSalesForStaff(staffId);
      res.json(remittedSales);
    } catch (error) {
      console.error('Error fetching remitted sales:', error);
      res.status(500).json({ error: 'Failed to fetch remitted sales' });
    }
  });

  app.get('/api/notifications', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || null;
      const notifications = dbService.listNotifications(userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  app.get('/api/notifications/unread-count', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || null;
      const count = dbService.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  app.patch('/api/notifications/:id/read', async (req: Request, res: Response) => {
    try {
      dbService.markNotificationRead(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // ==========================================
  // DEVELOPER MODE ROUTES
  // ==========================================

  const authenticateDev = (req: Request, res: Response, next: NextFunction) => {
    // Check for developer flag in session or custom header
    // In production, this should check a secure token or Supabase session
    const isDev = req.headers['x-developer-auth'] === 'true';
    if (!isDev) return res.status(403).json({ error: 'Unauthorized developer access' });
    next();
  };

  app.get('/api/developer/dashboard-stats', authenticateDev, async (req, res) => {
    try {
      const stats = await DeveloperService.getDashboardStats();
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/developer/clients', authenticateDev, async (req, res) => {
    try {
      const clients = await DeveloperService.listClients(req.query);
      res.json(clients);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/developer/activity-feed', authenticateDev, async (req, res) => {
    try {
      const feed = await DeveloperService.getActivityFeed(req.query);
      res.json(feed);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/developer/feature-flags', authenticateDev, async (req, res) => {
    try {
      const flags = await DeveloperService.getFeatureFlags();
      res.json(flags);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/developer/feature-flags/:id/toggle', authenticateDev, async (req, res) => {
    try {
      const { enabled } = req.body;
      await DeveloperService.updateFeatureFlag(req.params.id, enabled);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/developer/ai-assistant/query', authenticateDev, async (req, res) => {
    try {
      const { query } = req.body;
      let response = "I'm analyzing the ecosystem data...";
      if (query.toLowerCase().includes('storage')) {
        response = "ABC Store currently consumes 1.8GB, which is 34% of total ecosystem storage. Growth trend suggests they might reach 5GB in 2.4 months.";
      } else if (query.toLowerCase().includes('inactive')) {
        response = "There are 5 stores that have been inactive for more than 30 days. Would you like me to generate a summary of these accounts?";
      }
      res.json({ response });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/developer/settings', authenticateDev, async (req, res) => {
    try {
      const settings = await DeveloperService.getSystemSettings();
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/developer/settings', authenticateDev, async (req, res) => {
    try {
      const { key, value, category } = req.body;
      await DeveloperService.updateSystemSetting(key, value, category);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/developer/integrations/:integration/test', authenticateDev, async (req, res) => {
    try {
      const { integration } = req.params;
      const credentials = req.body;
      const result = await DeveloperService.testIntegration(integration, credentials);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/developer/global-logout', authenticateDev, async (req, res) => {
    try {
      await DeveloperService.globalLogout();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/developer/logs/clear', authenticateDev, async (req, res) => {
    try {
      await DeveloperService.clearLogs();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/developer/backup/trigger', authenticateDev, async (req, res) => {
    try {
      const result = await DeveloperService.triggerBackup();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/developer/maintenance/toggle', authenticateDev, async (req, res) => {
    try {
      const { enabled } = req.body;
      await DeveloperService.toggleMaintenance(enabled);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Sync endpoints for Push to Cloud and Pull from Cloud
  app.post('/api/sync/push-all', async (req, res) => {
    try {
      const tenantId = (req as any).tenantId;
      const result = await dbService.pushAllToCloud(tenantId);
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Push to cloud failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/sync/pull-all', async (req, res) => {
    try {
      const tenantId = (req as any).tenantId;
      const result = await dbService.pullAllFromCloud(tenantId);
      res.status(200).json(result);
    } catch (error: any) {
      console.error('Pull from cloud failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return httpServer;
}
