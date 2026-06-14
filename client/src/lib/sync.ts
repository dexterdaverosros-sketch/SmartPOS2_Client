import { db } from './db';
import type { Product, Variant } from '@shared/schema';
import api from './api';

interface SyncResponse {
  products: Product[];
  variants?: Variant[];
  timestamp: string;
}

interface StaffSyncResponse {
  staff: Array<{
    id: string;
    name: string;
    staffId: string;
    createdBy: string;
    createdAt: Date | null;
  }>;
  timestamp: string;
}

export class DatabaseSyncService {
  private baseUrl: string;
  private lastSyncTimestamp: string | null = null;
  private isSyncing: boolean = false;

  constructor(baseUrl: string = '') {
    // Default to current origin if no baseUrl provided
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    
    // Try to load last sync timestamp from localStorage
    if (typeof window !== 'undefined') {
      this.lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp');
    }
  }

  /**
   * Set the base URL for the sync service
   * This should be the URL of the router when connected to it
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Get the current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if the service is currently syncing
   */
  isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Get the last sync timestamp
   */
  getLastSyncTimestamp(): string | null {
    return this.lastSyncTimestamp;
  }

  /**
   * Push all local data to Supabase (Sales, items, expenses, etc.)
   */
  async pushToCloud(onProgress?: (progress: number, message: string) => void): Promise<void> {
    if (this.isSyncing) throw new Error('Sync already in progress');
    this.isSyncing = true;
    
    try {
      // 1. Fetch local sales
      onProgress?.(10, 'Fetching local sales...');
      const sales = await db.sales.toArray();
      const saleItems = await db.saleItems.toArray();
      
      // 2. Sync Sales to Supabase
      if (sales.length > 0) {
        onProgress?.(30, `Syncing ${sales.length} sales to Cloud...`);
        // We'll push in chunks if needed, but for now let's use the API
        // The API already has logic to push to Supabase if useCloud() is true
        // But we want a direct push for "Manual Sync"
        await api.post('/api/cloud/sync-sales', { sales, items: saleItems });
      }

      // 3. Sync Expenses
      onProgress?.(60, 'Syncing expenses...');
      const expenses = await db.expenses.toArray();
      if (expenses.length > 0) {
        await api.post('/api/cloud/sync-expenses', { expenses });
      }

      // 4. Sync Products (ensure latest versions are in cloud)
      onProgress?.(80, 'Syncing products catalog...');
      const products = await db.products.toArray();
      if (products.length > 0) {
        await api.post('/api/cloud/products', products);
      }

      onProgress?.(100, 'Cloud synchronization complete.');
    } catch (error) {
      console.error('Cloud push failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync the local database with the server
   */
  async syncDatabase(): Promise<boolean> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return false;
    }

    if (!this.baseUrl) {
      console.error('Base URL not set for sync service');
      throw new Error('Base URL not configured for sync service');
    }

    this.isSyncing = true;

    try {
      // Sync products and staff accounts
      await Promise.all([
        this.syncProducts(),
        this.syncStaff()
      ]);

      console.log('Full sync completed successfully.');
      return true;
    } catch (error) {
      console.error('Error during full sync:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync products from the server
   */
  private async syncProducts(): Promise<void> {
    try {
      const data: SyncResponse = await api.post('/api/sync', {
        lastSyncTimestamp: this.lastSyncTimestamp,
      });
      
      if (!data || typeof data !== 'object' || !Array.isArray(data.products)) {
        throw new Error('Invalid products data received from server');
      }
      
      // Update local database with received data
      await this.updateLocalDatabase(data.products);
      
      // Update variants if available
      if (data.variants && Array.isArray(data.variants)) {
        await this.updateLocalVariantsDatabase(data.variants);
      }
      
      // Update last sync timestamp
      this.lastSyncTimestamp = data.timestamp;
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastSyncTimestamp', data.timestamp);
      }

      console.log(`Products sync: Updated ${data.products.length} products.`);
    } catch (error) {
      console.error('Products sync error:', error);
      throw error;
    }
  }

  /**
   * Sync staff accounts from the server
   */
  private async syncStaff(): Promise<void> {
    try {
      const data: StaffSyncResponse = await api.post('/api/sync-staff', {
        lastSyncTimestamp: localStorage.getItem('lastStaffSyncTimestamp'),
      });
      
      if (!data || typeof data !== 'object' || !Array.isArray(data.staff)) {
        console.warn('Invalid staff data received from server');
        return;
      }
      
      // Update local database with staff data
      await this.updateLocalStaffDatabase(data.staff);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastStaffSyncTimestamp', data.timestamp);
      }

      console.log(`Staff sync: Updated ${data.staff.length} staff accounts.`);
    } catch (error) {
      console.warn(`Staff sync failed:`, error);
    }
  }

  /**
   * Update local staff database with received data
   */
  private async updateLocalStaffDatabase(staffData: Array<{
    id: string;
    name: string;
    staffId: string;
    createdBy: string;
    createdAt: Date | null;
  }>): Promise<void> {
    if (!staffData || staffData.length === 0) {
      return;
    }

    await db.transaction('rw', db.staff, async () => {
      for (const staffMember of staffData) {
        const existingStaff = await db.staff.get(staffMember.id);
        
        if (!existingStaff) {
          // Add new staff member (without passkey for security)
          // Passkeys are stored locally when admin creates them
          await db.staff.add({
            ...staffMember,
            passkey: '', // Will be set locally by admin
          });
        }
      }
    });
  }

  /**
   * Fetch a product by barcode from the server
   */
  async getProductByBarcode(barcode: string): Promise<Product | null> {
    if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
      throw new Error('Invalid barcode provided');
    }

    try {
      // First try to get from local database
      const localProduct = await db.products.where('barcode').equals(barcode.trim()).first();
      if (localProduct) {
        return localProduct;
      }

      // If not found locally, try to get from server
      const product = await api.get(`/api/products/${encodeURIComponent(barcode.trim())}`);
      return product;
    } catch (error) {
      console.error('Error fetching product by barcode:', error);
      return null;
    }
  }

  /**
   * Check if the server is reachable
   */
  async checkServerConnection(): Promise<boolean> {
    try {
      await api.get('/api/health');
      return true;
    } catch (error) {
      console.error('Error checking server connection:', error);
      return false;
    }
  }

  /**
   * Update the local database with received data
   */
  private async updateLocalDatabase(products: Product[]): Promise<void> {
    if (!products || products.length === 0) {
      return;
    }

    // Use transaction for better performance and atomicity
    await db.transaction('rw', db.products, async () => {
      for (const product of products) {
        // Check if product exists
        const existingProduct = await db.products.get(product.id);
        
        if (existingProduct) {
          // If product exists, update it only if the server version is newer
          const existingDate = new Date(existingProduct.updatedAt || existingProduct.createdAt || new Date());
          const newDate = new Date(product.updatedAt || product.createdAt || new Date());
          
          if (newDate > existingDate) {
            await db.products.put(product);
          }
        } else {
          // If product doesn't exist, add it
          await db.products.add(product);
        }
      }
    });
  }

  /**
   * Update the local database with received variants
   */
  private async updateLocalVariantsDatabase(variants: Variant[]): Promise<void> {
    if (!variants || variants.length === 0) {
      return;
    }

    await db.transaction('rw', db.variants, async () => {
      for (const variant of variants) {
        // Check if variant exists
        const existingVariant = await db.variants.get(variant.id);
        
        if (existingVariant) {
          // If variant exists, update it only if the server version is newer
          const existingDate = new Date((existingVariant as any).updatedAt || (existingVariant as any).createdAt || new Date());
          const newDate = new Date((variant as any).updatedAt || (variant as any).createdAt || new Date());
          
          if (newDate > existingDate) {
            await db.variants.put(variant);
          }
        } else {
          // If variant doesn't exist, add it
          await db.variants.add(variant);
        }
      }
    });
  }
}

// Create a singleton instance
export const databaseSyncService = new DatabaseSyncService();