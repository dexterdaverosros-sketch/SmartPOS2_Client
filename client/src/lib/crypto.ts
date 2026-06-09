/**
 * Simple client-side encryption for stored credentials.
 * In a real production environment, this would use a more robust solution
 * like a Hardware Security Module (HSM) or a managed Secret Manager.
 */

const MASTER_KEY = 'smartpos-dev-console-key'; // In production, this would be derived from user input

export const cryptoUtils = {
  encrypt: (text: string): string => {
    // This is a simple Base64 + simple obfuscation for demonstration.
    // In real production, use SubtleCrypto AES-GCM.
    const encoded = new TextEncoder().encode(text);
    const key = new TextEncoder().encode(MASTER_KEY);
    const encrypted = encoded.map((byte, i) => byte ^ key[i % key.length]);
    return btoa(String.fromCharCode(...encrypted));
  },

  decrypt: (encodedText: string): string => {
    try {
      const encrypted = atob(encodedText).split('').map(c => c.charCodeAt(0));
      const key = new TextEncoder().encode(MASTER_KEY);
      const decrypted = encrypted.map((byte, i) => byte ^ key[i % key.length]);
      return new TextDecoder().decode(new Uint8Array(decrypted));
    } catch (e) {
      return '';
    }
  }
};
