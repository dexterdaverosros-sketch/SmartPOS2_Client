const getBaseUrl = () => {
  if (import.meta.env.PROD && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    // In production (not local), use the NEW Render backend URL
    return 'https://smartpos2-bsiscaps.onrender.com';
  } else {
    // In development or local production, use the current origin
    return window.location.origin;
  }
};

const getHeaders = () => {
  const token = localStorage.getItem('smartpos_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('API: Adding Authorization header with token:', token);
  } else {
    console.log('API: No token found in localStorage, Authorization header not added.');
  }
  return headers;
};

const api = {
  async get<T = any>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${getBaseUrl()}${endpoint}`, {
        headers: getHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API GET Error (${response.status}): ${errorText || response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error(`API GET failed for ${endpoint}:`, error);
      throw error;
    }
  },

  async post<T = any>(endpoint: string, body: any): Promise<T> {
    try {
      const response = await fetch(`${getBaseUrl()}${endpoint}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || `API POST Error (${response.status})`);
        } catch (e) {
          throw new Error(`API POST Error (${response.status}): ${errorText || response.statusText}`);
        }
      }
      return response.json();
    } catch (error) {
      console.error(`API POST failed for ${endpoint}:`, error);
      throw error;
    }
  },

  async patch<T = any>(endpoint: string, body: any): Promise<T> {
    try {
      const response = await fetch(`${getBaseUrl()}${endpoint}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API PATCH Error (${response.status}): ${errorText || response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error(`API PATCH failed for ${endpoint}:`, error);
      throw error;
    }
  },

  async put<T = any>(endpoint: string, body: any): Promise<T> {
    try {
      const response = await fetch(`${getBaseUrl()}${endpoint}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API PUT Error (${response.status}): ${errorText || response.statusText}`);
      }
      return response.json();
    } catch (error) {
      console.error(`API PUT failed for ${endpoint}:`, error);
      throw error;
    }
  },

  async delete(endpoint: string) {
    try {
      const response = await fetch(`${getBaseUrl()}${endpoint}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API DELETE Error (${response.status}): ${errorText || response.statusText}`);
      }
      return true;
    } catch (error) {
      console.error(`API DELETE failed for ${endpoint}:`, error);
      throw error;
    }
  }
};

export default api;
