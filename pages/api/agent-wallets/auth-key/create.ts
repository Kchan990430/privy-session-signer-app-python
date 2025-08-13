import { NextApiRequest, NextApiResponse } from 'next';
import { PrivyAuthKeyManager, WalletAuthStore } from '@virtuals-protocol/acp-node';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, walletAddress } = req.body;

    if (!walletId || !walletAddress) {
      return res.status(400).json({ error: 'walletId and walletAddress required' });
    }

    // Check if auth key already exists
    const existingConfig = WalletAuthStore.get(walletId);
    if (existingConfig) {
      return res.status(200).json({
        message: 'Auth key already exists',
        authKeyId: existingConfig.authKeyId,
        keyQuorumId: existingConfig.keyQuorumId,
        createdAt: existingConfig.createdAt
      });
    }

    // Initialize auth key manager
    const authKeyManager = new PrivyAuthKeyManager(PRIVY_APP_ID, PRIVY_APP_SECRET);

    // Create auth key and add session signer
    console.log(`Creating auth key for wallet ${walletAddress}...`);
    const authConfig = await authKeyManager.setupWalletWithAuth(walletId, walletAddress);

    // Store configuration
    WalletAuthStore.save(walletId, authConfig);

    return res.status(200).json({
      success: true,
      message: 'Authorization key created and session signer added',
      authKeyId: authConfig.authKeyId,
      keyQuorumId: authConfig.keyQuorumId,
      walletAddress: authConfig.walletAddress,
      createdAt: authConfig.createdAt
    });

  } catch (error: any) {
    console.error('Error creating auth key:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create authorization key'
    });
  }
}