// Privy Authorization Signature - Node.js style implementation for browser
// This is the ACTIVE implementation used by CreateJobPanelSDKPython component
// 
// CRITICAL: This implementation includes DER format conversion to match Python's cryptography library.
// Web Crypto API returns IEEE P1363 format, but Privy expects DER format.

import canonicalize from 'canonicalize';

// Convert IEEE P1363 signature to DER format (matching Python's cryptography library)
function ieee1363ToDer(signature: Uint8Array): Uint8Array {
  // IEEE P1363 format is r||s (64 bytes for P-256: 32 bytes each)
  let r = signature.slice(0, 32);
  let s = signature.slice(32, 64);
  
  // Remove leading zeros
  while (r.length > 1 && r[0] === 0x00 && !(r[1] & 0x80)) {
    r = r.slice(1);
  }
  while (s.length > 1 && s[0] === 0x00 && !(s[1] & 0x80)) {
    s = s.slice(1);
  }
  
  // Add padding if high bit is set (to prevent negative interpretation)
  if (r[0] & 0x80) {
    const padded = new Uint8Array(r.length + 1);
    padded[0] = 0x00;
    padded.set(r, 1);
    r = padded;
  }
  if (s[0] & 0x80) {
    const padded = new Uint8Array(s.length + 1);
    padded[0] = 0x00;
    padded.set(s, 1);
    s = padded;
  }
  
  // Build DER structure: SEQUENCE { INTEGER r, INTEGER s }
  const result = new Uint8Array(6 + r.length + s.length);
  let offset = 0;
  
  // SEQUENCE tag
  result[offset++] = 0x30;
  result[offset++] = 4 + r.length + s.length;
  
  // INTEGER r
  result[offset++] = 0x02;
  result[offset++] = r.length;
  result.set(r, offset);
  offset += r.length;
  
  // INTEGER s  
  result[offset++] = 0x02;
  result[offset++] = s.length;
  result.set(s, offset);
  
  return result;
}

export async function generatePrivyAuthSignatureNodeStyle(
  authorizationKey: string,
  walletId: string,
  rpcPayload: any
): Promise<string> {
  try {
    // Remove wallet-auth: prefix if present
    const privateKeyAsString = authorizationKey.replace('wallet-auth:', '');
    
    // Create the exact payload structure from Privy docs
    const payload = {
      version: 1,
      method: 'POST',
      url: `https://api.privy.io/v1/wallets/${walletId}/rpc`,
      body: {
        method: "eth_sendTransaction",
        caip2: rpcPayload.caip2 || "eip155:84532",
        chain_type: "ethereum",
        sponsor: true,
        params: {
          transaction: rpcPayload.params?.transaction || rpcPayload
        }
      },
      headers: {
        'privy-app-id': 'cmebhuv1100ygld0c94coox0d'
      }
    };
    
    // JSON-canonicalize the payload exactly as shown in docs
    const serializedPayload = canonicalize(payload) as string;
    
    // For browser, we need to use Web Crypto API instead of Node's crypto
    // Convert base64 private key to crypto key
    const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyAsString}\n-----END PRIVATE KEY-----`;
    
    // Decode PEM to ArrayBuffer
    const pemContents = privateKeyPem
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');
    
    const binaryDer = atob(pemContents);
    const binaryDerBuffer = new ArrayBuffer(binaryDer.length);
    const bufferView = new Uint8Array(binaryDerBuffer);
    for (let i = 0; i < binaryDer.length; i++) {
      bufferView[i] = binaryDer.charCodeAt(i);
    }
    
    // Import the key
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryDerBuffer,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      false,
      ['sign']
    );
    
    // Sign the serialized payload
    const signatureArrayBuffer = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256'
      },
      privateKey,
      new TextEncoder().encode(serializedPayload)
    );
    
    // Convert IEEE P1363 to DER format (matching Python backend)
    // Web Crypto API returns IEEE P1363 format (r||s), 64 bytes for P-256
    const ieee1363Signature = new Uint8Array(signatureArrayBuffer);
    const derSignature = ieee1363ToDer(ieee1363Signature);
    
    // Convert DER signature to base64 (matching Python backend exactly)
    const signature = btoa(String.fromCharCode(...derSignature));
    
    console.log('📝 Payload signed:', serializedPayload.substring(0, 100) + '...');
    console.log('✍️ Signature format: DER (matching Python backend)');
    console.log('✍️ IEEE P1363 length:', ieee1363Signature.length, 'bytes');
    console.log('✍️ DER length:', derSignature.length, 'bytes');
    console.log('✍️ DER signature (Node.js style):', signature.substring(0, 20) + '...');
    
    return signature;
  } catch (error) {
    console.error('Failed to generate signature:', error);
    throw error;
  }
}