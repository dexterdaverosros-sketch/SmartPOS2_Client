import { apiRequest } from "./api";

const getDevHeaders = () => ({
  'x-developer-auth': 'true'
});

export const developerApi = {
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
  }
};
