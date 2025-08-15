/**
 * Frontend P-256 key generation utilities
 * Generates keys compatible with Privy's authorization system
 */

export interface GeneratedAuthKey {
  privateKey: string;  // PEM format
  publicKey: string;   // PEM format
  privateKeyBase64: string;  // wallet-auth:BASE64 format for Privy
}

/**
 * Generate a P-256 (prime256v1/secp256r1) key pair in the browser
 */
export async function generateAuthKeyPair(): Promise<GeneratedAuthKey> {
  // Generate P-256 key pair using Web Crypto API
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256', // This is secp256r1/prime256v1
    },
    true, // extractable
    ['sign', 'verify']
  );

  // Export private key as PKCS8
  const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const privateKeyPem = arrayBufferToPem(privateKeyBuffer, 'PRIVATE KEY');
  
  // Export public key as SPKI
  const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyPem = arrayBufferToPem(publicKeyBuffer, 'PUBLIC KEY');

  // Convert private key to SEC1 format for Privy (they expect EC PRIVATE KEY format)
  // For browser compatibility, we'll use the PKCS8 format and convert server-side if needed
  // Create base64 format for Privy
  const privateKeyBase64 = `wallet-auth:${btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)))}`;

  return {
    privateKey: privateKeyPem,
    publicKey: publicKeyPem,
    privateKeyBase64
  };
}

/**
 * Convert ArrayBuffer to PEM format
 */
function arrayBufferToPem(buffer: ArrayBuffer, label: string): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

/**
 * Store private key temporarily in session storage (for the current session only)
 * This is more secure than localStorage as it's cleared when the tab closes
 */
export function storePrivateKeyTemporarily(walletId: string, privateKey: string, privateKeyBase64: string, keyQuorumId?: string): void {
  if (typeof window === 'undefined') return;
  
  const sessionKey = `temp_auth_key_${walletId}`;
  const data = {
    privateKey,
    privateKeyBase64,
    keyQuorumId,
    timestamp: Date.now(),
    expiresAt: Date.now() + (15 * 60 * 1000) // 15 minutes
  };
  
  sessionStorage.setItem(sessionKey, JSON.stringify(data));
}

/**
 * Retrieve temporarily stored private key
 */
export function getTemporaryPrivateKey(walletId: string): { privateKey: string; privateKeyBase64: string; keyQuorumId?: string } | null {
  if (typeof window === 'undefined') return null;
  
  const sessionKey = `temp_auth_key_${walletId}`;
  const stored = sessionStorage.getItem(sessionKey);
  
  if (!stored) return null;
  
  try {
    const data = JSON.parse(stored);
    
    // Check if expired
    if (data.expiresAt && Date.now() > data.expiresAt) {
      sessionStorage.removeItem(sessionKey);
      return null;
    }
    
    return {
      privateKey: data.privateKey,
      privateKeyBase64: data.privateKeyBase64,
      keyQuorumId: data.keyQuorumId
    };
  } catch {
    return null;
  }
}

/**
 * Clear temporary private key
 */
export function clearTemporaryPrivateKey(walletId: string): void {
  if (typeof window === 'undefined') return;
  const sessionKey = `temp_auth_key_${walletId}`;
  sessionStorage.removeItem(sessionKey);
}

/**
 * Clear all temporary private keys
 */
export function clearAllTemporaryKeys(): void {
  if (typeof window === 'undefined') return;
  
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('temp_auth_key_')) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => sessionStorage.removeItem(key));
}