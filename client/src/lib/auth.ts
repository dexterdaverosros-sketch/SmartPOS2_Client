import { AuthService } from './db';
import type { User } from '@shared/schema';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface StaffLoginCredentials {
  staffId: string;
  passkey: string;
}

export interface SignupData {
  businessName: string;
  ownerName: string;
  mobile: string;
  password: string;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Authentication utilities and helpers
 */
export class Auth {
  private static readonly STORAGE_KEY = 'smartpos_user';
  private static readonly SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Login admin user
   */
  static async loginAdmin(credentials: LoginCredentials): Promise<{ user: User, token?: string }> {
    try {
      const response = await AuthService.loginAdmin(credentials.username, credentials.password);
      
      if (!response || !response.user) {
        throw new AuthError('Invalid username or password');
      }

      this.setStoredUser(response.user);
      return response;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Login failed. Please try again.');
    }
  }

  /**
   * Login staff user
   */
  static async loginStaff(credentials: StaffLoginCredentials): Promise<User> {
    try {
      const user = await AuthService.loginStaff(credentials.staffId, credentials.passkey);
      
      if (!user) {
        throw new AuthError('Invalid staff ID or passkey');
      }

      this.setStoredUser(user);
      return user;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Staff login failed. Please try again.');
    }
  }

  /**
   * Create new admin account
   */
  static async signup(data: SignupData): Promise<{ user: User, token?: string }> {
    try {
      // Validate data
      if (!data.businessName.trim()) {
        throw new AuthError('Business name is required');
      }
      
      if (!data.ownerName.trim()) {
        throw new AuthError('Owner name is required');
      }
      
      if (!data.mobile.trim() || data.mobile.length < 10) {
        throw new AuthError('Valid mobile number is required');
      }
      
      if (!data.password || data.password.length < 6) {
        throw new AuthError('Password must be at least 6 characters');
      }

      const response = await AuthService.createAdmin(data);
      this.setStoredUser(response.user);
      return response;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Account creation failed. Please try again.');
    }
  }

  /**
   * Get current user from storage
   */
  static getCurrentUser(): User | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const userData = JSON.parse(stored);
      
      // Check if session is still valid
      if (userData.timestamp && Date.now() - userData.timestamp > this.SESSION_DURATION) {
        this.logout();
        return null;
      }

      return userData.user;
    } catch (error) {
      console.error('Error retrieving user from storage:', error);
      this.logout(); // Clear corrupted data
      return null;
    }
  }

  /**
   * Store user in localStorage with timestamp
   */
  private static setStoredUser(user: User): void {
    try {
      const userData = {
        user,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(userData));
    } catch (error) {
      console.error('Error storing user:', error);
    }
  }

  /**
   * Logout user and clear storage
   */
  static logout(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  /**
   * Check if current user is admin
   */
  static isAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'admin';
  }

  /**
   * Check if current user is staff
   */
  static isStaff(): boolean {
    const user = this.getCurrentUser();
    return user?.role === 'staff';
  }

  /**
   * Validate admin password (for staff operations that require admin approval)
   */
  static async validateAdminPassword(password: string): Promise<boolean> {
    try {
      // Get admin user (assuming there's only one admin or we can find the current admin)
      const currentUser = this.getCurrentUser();
      if (!currentUser) return false;

      // For admin validation, we can try to login with the stored username
      if (currentUser.role === 'admin' && currentUser.username) {
        const user = await AuthService.loginAdmin(currentUser.username, password);
        return !!user;
      }

      return false;
    } catch (error) {
      console.error('Error validating admin password:', error);
      return false;
    }
  }

  /**
   * Get user display name
   */
  static getUserDisplayName(user?: User): string {
    if (!user) {
      const currentUser = this.getCurrentUser();
      if (!currentUser) return 'User';
      user = currentUser;
    }

    return user.ownerName || user.username || 'User';
  }

  /**
   * Get business display name
   */
  static getBusinessDisplayName(user?: User): string {
    if (!user) {
      const currentUser = this.getCurrentUser();
      if (!currentUser) return 'Business';
      user = currentUser;
    }

    return user.businessName || 'Business';
  }

  /**
   * Check if session is about to expire
   */
  static isSessionExpiring(): boolean {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return false;

      const userData = JSON.parse(stored);
      const timeLeft = this.SESSION_DURATION - (Date.now() - userData.timestamp);
      
      // Session expires in less than 1 hour
      return timeLeft < 60 * 60 * 1000;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extend current session
   */
  static extendSession(): void {
    const currentUser = this.getCurrentUser();
    if (currentUser) {
      this.setStoredUser(currentUser);
    }
  }
}

export default Auth;
