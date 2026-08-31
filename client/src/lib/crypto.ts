/**
 * Secure Storage Utility for SmartPOS
 * Provides client-side data masking and encryption for stored local keys
 */

const SECRET_SALT = 'SmartPOS_v4_Secure_Salt_2026';

function xorCipher(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

export const SecureStorage = {
  setItem(key: string, value: string): void {
    try {
      const cipher = xorCipher(value, SECRET_SALT);
      const encoded = btoa(encodeURIComponent(cipher));
      localStorage.setItem(`_sp_enc_${key}`, encoded);
      // Clean legacy unencrypted key
      localStorage.removeItem(key);
    } catch {
      localStorage.setItem(key, value);
    }
  },

  getItem(key: string): string | null {
    try {
      const encVal = localStorage.getItem(`_sp_enc_${key}`);
      if (encVal) {
        const cipher = decodeURIComponent(atob(encVal));
        return xorCipher(cipher, SECRET_SALT);
      }
      // Fallback to legacy unencrypted key
      return localStorage.getItem(key);
    } catch {
      return localStorage.getItem(key);
    }
  },

  removeItem(key: string): void {
    localStorage.removeItem(`_sp_enc_${key}`);
    localStorage.removeItem(key);
  }
};

export const cryptoUtils = {
  encrypt: (data: any): string => {
    try {
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      const cipher = xorCipher(str, SECRET_SALT);
      return btoa(encodeURIComponent(cipher));
    } catch {
      return '';
    }
  },
  decrypt: (token: string): any => {
    try {
      const cipher = decodeURIComponent(atob(token));
      const str = xorCipher(cipher, SECRET_SALT);
      try {
        return JSON.parse(str);
      } catch {
        return str;
      }
    } catch {
      return null;
    }
  }
};
