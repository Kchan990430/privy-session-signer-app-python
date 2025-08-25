/**
 * Authorization Signature Generation for Privy
 * 
 * Implements ECDSA P-256 signature generation compatible with Privy's
 * authorization signature format for client-signed transactions.
 */

import * as crypto from 'crypto';

export interface AuthorizationPayload {
  version: number;
  method: string;
  caip2: string;
  params: {
    transaction: {
      to: string;
      data: string;
      value: string;
    };
  };
}

/**
 * Generate authorization signature for Privy transaction relay
 * 
 * @param privateKeyPEM - Private key in PEM format
 * @param transaction - Transaction data (to, data, value)
 * @param chainId - Chain ID for the transaction
 * @returns Base64 encoded authorization signature
 */
export function generateAuthorizationSignature(
  privateKeyPEM: string,
  transaction: any,
  chainId: number
): string {
  // Create the payload in Privy's expected format
  const payload: AuthorizationPayload = {
    version: 1,
    method: 'eth_sendTransaction',
    caip2: `eip155:${chainId}`,
    params: {
      transaction: transaction
    }
  };

  // Sort object keys recursively (required by Privy)
  const sortedPayload = sortObject(payload);
  const payloadString = JSON.stringify(sortedPayload);

  // Sign the payload using Node.js crypto
  const sign = crypto.createSign('SHA256');
  sign.update(payloadString);
  sign.end();

  // Handle PEM format (replace escaped newlines)
  const pemKey = privateKeyPEM.replace(/\\n/g, '\n');
  const signature = sign.sign(pemKey, 'base64');

  return signature;
}

/**
 * Generate authorization signature from base64 encoded private key
 * 
 * @param privateKeyBase64 - Private key in base64 DER format (with optional 'wallet-auth:' prefix)
 * @param transaction - Transaction data
 * @param chainId - Chain ID
 * @returns Base64 encoded authorization signature
 */
export function generateAuthorizationSignatureFromBase64(
  privateKeyBase64: string,
  transaction: any,
  chainId: number
): string {
  // Remove the 'wallet-auth:' prefix if present
  const cleanKey = privateKeyBase64.replace('wallet-auth:', '');
  
  // Decode base64 to get DER format key
  const derKey = Buffer.from(cleanKey, 'base64');
  
  // Convert DER to PEM format
  const pemKey = derToPem(derKey);
  
  return generateAuthorizationSignature(pemKey, transaction, chainId);
}

/**
 * Convert DER format key to PEM format
 */
function derToPem(derKey: Buffer): string {
  const base64 = derKey.toString('base64');
  const lines = [];
  
  // Add PEM header
  lines.push('-----BEGIN EC PRIVATE KEY-----');
  
  // Split base64 into 64-character lines
  for (let i = 0; i < base64.length; i += 64) {
    lines.push(base64.slice(i, i + 64));
  }
  
  // Add PEM footer
  lines.push('-----END EC PRIVATE KEY-----');
  
  return lines.join('\n');
}

/**
 * Sort object keys recursively (required by Privy for signature validation)
 */
function sortObject(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  
  const sorted: any = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = sortObject(obj[key]);
  });
  return sorted;
}

/**
 * Generate a new ECDSA P-256 key pair for session signing
 * 
 * @returns Object containing privateKey (PEM), publicKey (PEM), and privateKeyBase64
 */
export async function generateWalletAuthKey(): Promise<{
  privateKey: string;
  publicKey: string;
  privateKeyBase64: string;
}> {
  return new Promise((resolve, reject) => {
    crypto.generateKeyPair('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'sec1',
        format: 'pem'
      }
    }, (err, publicKey, privateKey) => {
      if (err) {
        reject(err);
        return;
      }

      // Convert private key to base64 DER format for storage
      const privateKeyObj = crypto.createPrivateKey(privateKey);
      const privateKeyDer = privateKeyObj.export({
        format: 'der',
        type: 'sec1'
      });
      const privateKeyBase64 = `wallet-auth:${privateKeyDer.toString('base64')}`;

      resolve({
        privateKey,
        publicKey,
        privateKeyBase64
      });
    });
  });
}

/**
 * Validate an authorization signature (for debugging)
 * 
 * @param signature - Base64 encoded signature
 * @param publicKeyPEM - Public key in PEM format
 * @param transaction - Transaction data that was signed
 * @param chainId - Chain ID
 * @returns true if signature is valid
 */
export function validateAuthorizationSignature(
  signature: string,
  publicKeyPEM: string,
  transaction: any,
  chainId: number
): boolean {
  try {
    // Create the same payload that was signed
    const payload: AuthorizationPayload = {
      version: 1,
      method: 'eth_sendTransaction',
      caip2: `eip155:${chainId}`,
      params: {
        transaction: transaction
      }
    };

    const sortedPayload = sortObject(payload);
    const payloadString = JSON.stringify(sortedPayload);

    // Verify the signature
    const verify = crypto.createVerify('SHA256');
    verify.update(payloadString);
    verify.end();

    const pemKey = publicKeyPEM.replace(/\\n/g, '\n');
    return verify.verify(pemKey, signature, 'base64');
  } catch (error) {
    console.error('Signature validation failed:', error);
    return false;
  }
}