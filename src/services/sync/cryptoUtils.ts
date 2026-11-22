/**
 * Cryptographic utility for consistent SHA-256 hashing across browser and Node.js environments.
 */

export async function calculateSha256(data: string): Promise<string> {
  // If in browser or Web Crypto API is available
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback for Node.js test environment
  if (typeof window === 'undefined') {
    try {
      const cryptoMod = 'crypto';
      const crypto = await import(/* @vite-ignore */ cryptoMod);
      return crypto.createHash('sha256').update(data).digest('hex');
    } catch (err) {
      // ignore
    }
  }

  // Basic fallback hash if crypto is completely unavailable
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'fallback_' + Math.abs(hash).toString(16).padStart(16, '0');
}
