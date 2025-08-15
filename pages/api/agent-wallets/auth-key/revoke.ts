import { NextApiRequest, NextApiResponse } from 'next';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Dynamic import to avoid webpack bundling issues
    const { PrivyAuthKeyManager, WalletAuthStore } = await import('@virtuals-protocol/acp-node');
    
    const { walletId } = req.body;

    if (!walletId) {
      return res.status(400).json({ error: 'walletId required' });
    }

    // Get existing configuration
    const config = WalletAuthStore.get(walletId);
    if (!config) {
      return res.status(404).json({ error: 'No auth configuration found' });
    }

    // Initialize auth key manager
    const authKeyManager = new PrivyAuthKeyManager(PRIVY_APP_ID, PRIVY_APP_SECRET);

    // Revoke the session signer
    console.log(`Revoking auth for wallet ${config.walletAddress}...`);
    await authKeyManager.revokeSessionSigner(
      walletId,
      config.keyQuorumId,
      config.privateKey
    );

    // Remove from store
    WalletAuthStore.delete(walletId);

    return res.status(200).json({
      success: true,
      message: 'Authorization revoked successfully',
      walletAddress: config.walletAddress,
      revokedKeyQuorumId: config.keyQuorumId,
      revokedAt: new Date()
    });

  } catch (error: any) {
    console.error('Error revoking auth:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to revoke authorization'
    });
  }
}