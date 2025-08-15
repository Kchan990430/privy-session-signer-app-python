import crypto from 'crypto';

/**
 * Generate authorization signature for Privy API requests
 * Based on https://docs.privy.io/api-reference/authorization-signatures
 */
export async function generateAuthorizationSignature(
  method: string,
  path: string,
  body: any,
  privateKeyPem: string
): Promise<string> {
  // Create the payload to sign
  const payload = {
    method: method.toUpperCase(),
    path,
    body: body ? sortObjectKeys(body) : undefined
  };
  
  // Convert to canonical JSON (sorted keys, no whitespace)
  const canonicalPayload = JSON.stringify(payload, null, 0);
  
  // Sign with P-256 private key
  const sign = crypto.createSign('SHA256');
  sign.update(canonicalPayload);
  sign.end();
  
  const signature = sign.sign(privateKeyPem, 'base64');
  
  return signature;
}

/**
 * Recursively sort object keys for canonical JSON
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  
  if (typeof obj === 'object') {
    const sorted: any = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = sortObjectKeys(obj[key]);
    });
    return sorted;
  }
  
  return obj;
}

/**
 * Generate authorization headers for Privy API
 */
export async function getAuthorizationHeaders(
  method: string,
  path: string,
  body: any,
  privateKeyPem: string,
  appId: string,
  appSecret: string
): Promise<Record<string, string>> {
  const signature = await generateAuthorizationSignature(method, path, body, privateKeyPem);
  
  return {
    'Authorization': `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
    'privy-app-id': appId,
    'privy-authorization-signature': signature,
    'Content-Type': 'application/json'
  };
}