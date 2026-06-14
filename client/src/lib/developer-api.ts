import { apiRequest } from "./queryClient";

const getDevHeaders = () => ({
  'x-developer-auth': 'true'
});

export const developerApi = {
  broadcastMessage: async (message: string) => {
    const res = await apiRequest('POST', '/api/developer/broadcast', { message });
    return res.json();
  },
  getDashboardStats: async () => {
    const res = await fetch('/api/developer/dashboard-stats', { headers: getDevHeaders() });
    if (!res.ok) throw new Error("Failed to fetch dashboard stats");
    return res.json();
  },

  getClients: async (params: any = {}) => {
    const searchParams = new URLSearchParams(params);
    const res = await fetch(`/api/developer/clients?${searchParams}`, { headers: getDevHeaders() });
    if (!res.ok) throw new Error("Failed to fetch clients");
    return res.json();
  },

  getActivityFeed: async (params: any = {}) => {
    const searchParams = new URLSearchParams(params);
    const res = await fetch(`/api/developer/activity-feed?${searchParams}`, { headers: getDevHeaders() });
    if (!res.ok) throw new Error("Failed to fetch activity feed");
    return res.json();
  },

  getFeatureFlags: async () => {
    const res = await fetch('/api/developer/feature-flags', { headers: getDevHeaders() });
    if (!res.ok) throw new Error("Failed to fetch feature flags");
    return res.json();
  },

  toggleFeatureFlag: async (id: string, enabled: boolean) => {
    const res = await fetch(`/api/developer/feature-flags/${id}/toggle`, {
      method: 'POST',
      headers: { ...getDevHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    if (!res.ok) throw new Error("Failed to toggle feature flag");
    return res.json();
  },

  askAi: async (query: string) => {
    const res = await fetch('/api/developer/ai-assistant/query', {
      method: 'POST',
      headers: { ...getDevHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    if (!res.ok) throw new Error("Failed to query AI Assistant");
    return res.json();
  },

  broadcast: async (message: string, channels: string[]) => {
    const res = await fetch('/api/developer/broadcast', {
      method: 'POST',
      headers: { ...getDevHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, channels })
    });
    if (!res.ok) throw new Error("Failed to send broadcast");
    return res.json();
  },

  globalLogout: async () => {
    const res = await fetch('/api/developer/global-logout', {
      method: 'POST',
      headers: getDevHeaders()
    });
    if (!res.ok) throw new Error("Failed to perform global logout");
    return res.json();
  },

  clearLogs: async () => {
    const res = await fetch('/api/developer/logs/clear', {
      method: 'POST',
      headers: getDevHeaders()
    });
    if (!res.ok) throw new Error("Failed to clear logs");
    return res.json();
  },

  triggerBackup: async () => {
    const res = await fetch('/api/developer/backup/trigger', {
      method: 'POST',
      headers: getDevHeaders()
    });
    if (!res.ok) throw new Error("Failed to trigger backup");
    return res.json();
  },

  toggleMaintenance: async (enabled: boolean) => {
    const res = await fetch('/api/developer/maintenance/toggle', {
      method: 'POST',
      headers: { ...getDevHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    if (!res.ok) throw new Error("Failed to toggle maintenance mode");
    return res.json();
  },

  getSettings: async () => {
    const res = await fetch('/api/developer/settings', { headers: getDevHeaders() });
    if (!res.ok) throw new Error("Failed to fetch settings");
    return res.json();
  },

  updateSetting: async (key: string, value: any, category: string = 'general') => {
    const res = await fetch('/api/developer/settings', {
      method: 'POST',
      headers: { ...getDevHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, category })
    });
    if (!res.ok) throw new Error("Failed to update setting");
    return res.json();
  },

  testIntegration: async (integration: string, credentials: any) => {
    const res = await fetch(`/api/developer/integrations/${integration}/test`, {
      method: 'POST',
      headers: { ...getDevHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    return res.json();
  }
};
