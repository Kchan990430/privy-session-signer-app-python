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

    // Get existing configuration
    const oldConfig = WalletAuthStore.get(walletId) || WalletAuthStore.getByAddress(walletAddress);
    if (!oldConfig) {
      // If no config exists, this wallet needs to create an auth key first
      return res.status(404).json({ 
        error: 'No existing auth configuration found. Please create an auth key first.',
        needsCreation: true
      });
    }

    // Initialize auth key manager
    const authKeyManager = new PrivyAuthKeyManager(PRIVY_APP_ID, PRIVY_APP_SECRET);

    // Rotate the auth key
    console.log(`Rotating auth key for wallet ${walletAddress}...`);
    const newConfig = await authKeyManager.rotateSessionSigner(
      walletId,
      walletAddress,
      oldConfig.keyQuorumId,
      oldConfig.privateKey
    );

    // Update stored configuration
    WalletAuthStore.save(walletId, newConfig);

    return res.status(200).json({
      success: true,
      message: 'Authorization key rotated successfully',
      oldKeyQuorumId: oldConfig.keyQuorumId,
      newAuthKeyId: newConfig.authKeyId,
      newKeyQuorumId: newConfig.keyQuorumId,
      rotatedAt: new Date()
    });

  } catch (error: any) {
    console.error('Error rotating auth key:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to rotate authorization key'
    });
  }
}