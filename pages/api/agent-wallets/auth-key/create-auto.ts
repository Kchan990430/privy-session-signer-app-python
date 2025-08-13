import { NextApiRequest, NextApiResponse } from 'next';
import { PrivyAuthKeyManager, WalletAuthStore } from '@virtuals-protocol/acp-node';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

// Helper to get wallet ID from Privy
async function getWalletIdFromPrivy(walletAddress: string): Promise<string | null> {
  try {
    const basicAuth = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64');
    
    const response = await fetch(`https://auth.privy.io/api/v1/wallets?address=${walletAddress}`, {
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'privy-app-id': PRIVY_APP_ID
      }
    });
    
    if (!response.ok) {
      console.error('Failed to get wallet from Privy:', await response.text());
      return null;
    }
    
    const data = await response.json();
    if (data.wallets && data.wallets.length > 0) {
      return data.wallets[0].id;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching wallet ID:', error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { walletId, walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    // If walletId is not provided or is the same as address, try to get it from Privy
    if (!walletId || walletId === walletAddress) {
      console.log(`Fetching wallet ID for address ${walletAddress}...`);
      const privyWalletId = await getWalletIdFromPrivy(walletAddress);
      
      if (!privyWalletId) {
        console.log('Wallet not found in Privy yet, might be too new. Using address as ID.');
        // For very new wallets, Privy might not have indexed them yet
        // We'll use the address as the ID temporarily
        walletId = walletAddress;
      } else {
        walletId = privyWalletId;
        console.log(`Found wallet ID: ${walletId}`);
      }
    }

    // Check if auth key already exists (by wallet ID or address)
    let existingConfig = WalletAuthStore.get(walletId);
    if (!existingConfig) {
      existingConfig = WalletAuthStore.getByAddress(walletAddress);
    }
    
    if (existingConfig) {
      return res.status(200).json({
        exists: true,
        message: 'Auth key already exists',
        authKeyId: existingConfig.authKeyId,
        keyQuorumId: existingConfig.keyQuorumId,
        createdAt: existingConfig.createdAt
      });
    }

    // Initialize auth key manager
    const authKeyManager = new PrivyAuthKeyManager(PRIVY_APP_ID, PRIVY_APP_SECRET);

    // For new wallets, we might need to wait a bit for Privy to process them
    // Let's try to create the auth key with retries
    let attempts = 0;
    const maxAttempts = 3;
    let authConfig = null;
    let lastError = null;

    while (attempts < maxAttempts && !authConfig) {
      attempts++;
      
      try {
        // If we still don't have a real wallet ID after first attempt, try fetching again
        if (attempts > 1 && walletId === walletAddress) {
          const newWalletId = await getWalletIdFromPrivy(walletAddress);
          if (newWalletId) {
            walletId = newWalletId;
            console.log(`Retry ${attempts}: Found wallet ID ${walletId}`);
          }
        }

        console.log(`Attempt ${attempts}: Creating auth key for wallet ${walletAddress} (ID: ${walletId})...`);
        authConfig = await authKeyManager.setupWalletWithAuth(walletId, walletAddress);
        
        // Store configuration
        WalletAuthStore.save(walletId, authConfig);
        
        console.log(`✅ Auth key created successfully on attempt ${attempts}`);
        
      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempts} failed:`, error.message);
        
        if (attempts < maxAttempts) {
          // Wait a bit before retrying (Privy might need time to index new wallet)
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (!authConfig) {
      throw lastError || new Error('Failed to create auth key after multiple attempts');
    }

    return res.status(200).json({
      success: true,
      message: 'Authorization key created and session signer added',
      authKeyId: authConfig.authKeyId,
      keyQuorumId: authConfig.keyQuorumId,
      walletAddress: authConfig.walletAddress,
      walletId: walletId,
      createdAt: authConfig.createdAt,
      attempts: attempts
    });

  } catch (error: any) {
    console.error('Error creating auth key:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create authorization key',
      details: error.toString()
    });
  }
}