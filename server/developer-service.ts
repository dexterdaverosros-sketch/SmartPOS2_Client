import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { 
  ActivityLog, 
  SecurityEvent, 
  ErrorLog, 
  FeatureFlag, 
  SystemSetting,
  DeveloperSession,
  User,
  Sale
} from "@shared/schema";
import { randomUUID } from "crypto";

export class DeveloperService {
  private static get supabase(): SupabaseClient | null {
    return getSupabase();
  }

  // --- Dashboard Stats ---
  static async getDashboardStats() {
    const supabase = this.supabase;
    if (!supabase) throw new Error("Supabase not configured");

    const [
      { count: totalStores },
      { count: totalUsers },
      { data: salesData },
      { data: storageData },
      { data: activityData }
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('staff').select('*', { count: 'exact', head: true }),
      supabase.from('sales').select('total, created_at'),
      supabase.rpc('get_total_storage_usage'), // Custom RPC
      supabase.from('activity_logs').select('event_type, created_at')
    ]);

    // Calculate online/offline based on last activity < 5 mins
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: onlineStores } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .gt('last_activity_at', fiveMinsAgo);

    return {
      totalStores: totalStores || 0,
      onlineStores: onlineStores || 0,
      offlineStores: (totalStores || 0) - (onlineStores || 0),
      totalUsers: totalUsers || 0,
      totalStorage: storageData || 0,
      dailyLogins: activityData?.filter(a => a.event_type === 'login' && new Date(a.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length || 0,
      errorCount: activityData?.filter(a => a.event_type === 'error').length || 0,
      systemHealth: 'Healthy'
    };
  }

  // --- Client Management ---
  static async listClients(params: { search?: string; filter?: string; sort?: string }) {
    const supabase = this.supabase;
    if (!supabase) throw new Error("Supabase not configured");

    let query = supabase.from('users').select('*').eq('role', 'admin');

    if (params.search) {
      query = query.or(`business_name.ilike.%${params.search}%,owner_name.ilike.%${params.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data.map(u => ({
      id: u.id,
      storeName: u.business_name,
      ownerName: u.owner_name,
      email: u.email,
      status: new Date(u.last_activity_at) > new Date(Date.now() - 5 * 60 * 1000) ? 'online' : 'offline',
      storageUsed: '0 MB', // Would need aggregation
      createdDate: u.created_at,
      subscription: u.subscription_plan || 'Free'
    }));
  }

  // --- Activity Logs ---
  static async logActivity(log: Partial<ActivityLog>) {
    const supabase = this.supabase;
    if (!supabase) return;

    await supabase.from('activity_logs').insert({
      id: randomUUID(),
      event_type: log.eventType,
      user_id: log.userId,
      store_id: log.storeId,
      description: log.description,
      metadata: JSON.stringify(log.metadata || {}),
      created_at: new Date().toISOString()
    });
  }

  static async getActivityFeed(params: { limit?: number; type?: string }) {
    const supabase = this.supabase;
    if (!supabase) throw new Error("Supabase not configured");

    let query = supabase.from('activity_logs').select('*').order('created_at', { ascending: false });
    if (params.type && params.type !== 'All') query = query.eq('event_type', params.type);
    if (params.limit) query = query.limit(params.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // --- Security ---
  static async getSecurityEvents() {
    const supabase = this.supabase;
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.from('security_events').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  static async logSecurityEvent(event: Partial<SecurityEvent>) {
    const supabase = this.supabase;
    if (!supabase) return;

    await supabase.from('security_events').insert({
      id: randomUUID(),
      type: event.type,
      severity: event.severity,
      description: event.description,
      ip_address: event.ipAddress,
      user_id: event.userId,
      created_at: new Date().toISOString()
    });
  }

  // --- Feature Flags ---
  static async getFeatureFlags() {
    const supabase = this.supabase;
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.from('feature_flags').select('*');
    if (error) throw error;
    return data;
  }

  static async updateFeatureFlag(id: string, enabled: boolean) {
    const supabase = this.supabase;
    if (!supabase) throw new Error("Supabase not configured");

    const { error } = await supabase.from('feature_flags').update({ enabled, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  // --- Error Monitoring ---
  static async logError(error: Partial<ErrorLog>) {
    const supabase = this.supabase;
    if (!supabase) return;

    await supabase.from('error_logs').insert({
      id: randomUUID(),
      message: error.message,
      stack: error.stack,
      route: error.route,
      browser: error.browser,
      os: error.os,
      user_id: error.userId,
      store_id: error.storeId,
      timestamp: new Date().toISOString()
    });
  }

  // --- System Settings ---
  static async getSystemSettings() {
    const supabase = this.supabase;
    if (!supabase) throw new Error("Supabase not configured");

    const { data, error } = await supabase.from('system_settings').select('*');
    if (error) throw error;
    return data;
  }

  static async updateSystemSetting(key: string, value: any) {
    const supabase = this.supabase;
    if (!supabase) throw new Error("Supabase not configured");

    const { error } = await supabase.from('system_settings').upsert({
      key,
      value: JSON.stringify(value),
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }
}
