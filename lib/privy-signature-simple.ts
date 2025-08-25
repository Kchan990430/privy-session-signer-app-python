// Privy Authorization Signature Generation (Browser-compatible)
// Generates P-256 signatures exactly as shown in Privy documentation
// NOTE: This file is kept as a reference. The active implementation is in privy-signature-node-style.ts

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

export async function generatePrivyAuthSignature(
  authorizationKey: string,
  walletId: string,
  backendRpcPayload: any
): Promise<string> {
  try {
    console.log('🔐 Using Privy authorization key (P-256)');
    console.log('🔑 Input key format:', authorizationKey.startsWith('wallet-auth:') ? 'Has wallet-auth: prefix ✓' : 'Missing prefix ✗');
    
    // 1. Remove wallet-auth: prefix if present (as per Privy docs)
    const privateKeyString = authorizationKey.replace('wallet-auth:', '').trim();
    console.log('🔑 Authorization key (base64) length:', privateKeyString.length);
    console.log('🔑 Key preview:', privateKeyString.substring(0, 20) + '...');
    
    // 2. Construct the EXACT RPC body that backend sends to Privy
    // Must match the exact structure and field order in privy_relay.py
    const rpcBody = {
      method: "eth_sendTransaction",
      caip2: backendRpcPayload.caip2 || "eip155:84532", 
      chain_type: "ethereum",
      sponsor: true,
      params: {
        transaction: backendRpcPayload.params?.transaction || backendRpcPayload
      }
    };
    
    console.log('🔍 RPC body that will be sent to Privy:', JSON.stringify(rpcBody, null, 2));
    
    // 3. Create the HTTP request payload structure (as per Privy docs)
    const payload = {
      version: 1,
      method: 'POST',
      url: `https://api.privy.io/v1/wallets/${walletId}/rpc`,
      body: rpcBody, // Must match EXACTLY what backend sends
      headers: {
        'privy-app-id': 'cmebhuv1100ygld0c94coox0d' // Confirmed app ID
      }
    };
    
    console.log('📝 HTTP request payload to sign:', JSON.stringify(payload, null, 2));
    
    // 4. JSON-canonicalize the payload (as per Privy docs)
    const serializedPayload = canonicalize(payload) as string;
    const serializedPayloadBuffer = new TextEncoder().encode(serializedPayload);
    
    console.log('🔧 Canonicalized payload to sign:', serializedPayload);
    
    // 5. Convert private key from base64 to PEM format for Web Crypto
    const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyString}\n-----END PRIVATE KEY-----`;
    
    // 6. Import the private key using Web Crypto API (P-256)
    const privateKeyObject = await crypto.subtle.importKey(
      'pkcs8',
      pemToBuffer(privateKeyPem),
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      false,
      ['sign']
    );
    
    // 7. Sign the payload using P-256 + SHA-256 (as per Privy docs)
    const signatureArrayBuffer = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256'
      },
      privateKeyObject,
      serializedPayloadBuffer
    );
    
    // 8. Convert IEEE P1363 to DER format (matching Python backend)
    // Web Crypto API returns IEEE P1363 format (r||s), 64 bytes for P-256
    const ieee1363Signature = new Uint8Array(signatureArrayBuffer);
    const derSignature = ieee1363ToDer(ieee1363Signature);
    
    // 9. Convert DER signature to base64 (matching Python backend exactly)
    const signature = btoa(String.fromCharCode(...derSignature));
    
    console.log('✍️ Generated authorization signature:', signature.substring(0, 20) + '...');
    console.log('✍️ Signature format: DER (matching Python backend)');
    console.log('✍️ IEEE P1363 length:', ieee1363Signature.length, 'bytes');
    console.log('✍️ DER length:', derSignature.length, 'bytes');
    console.log('✍️ Base64 signature length:', signature.length, 'chars');
    
    return signature;
  } catch (error) {
    console.error('❌ Authorization signature generation failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate Privy authorization signature: ${errorMessage}`);
  }
}

// Helper function to convert PEM to ArrayBuffer
function pemToBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper function to convert ArrayBuffer to base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

// Note: This uses Privy authorization keys (P-256) in format: wallet-auth:base64-key
// Get your authorization key from Privy Dashboard → Settings → Authorization Keys