import { NextApiRequest, NextApiResponse } from 'next';
import { WalletAuthStore } from '@virtuals-protocol/acp-node';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { authConfigs } = req.body;

    if (!authConfigs || !Array.isArray(authConfigs)) {
      return res.status(400).json({ error: 'authConfigs array required' });
    }

    let restoredCount = 0;
    
    // Restore each auth configuration to the in-memory store
    for (const config of authConfigs) {
      if (config.walletId && config.privateKey && config.keyQuorumId) {
        // Restore to in-memory store
        WalletAuthStore.save(config.walletId, {
          walletId: config.walletId,
          walletAddress: config.walletAddress,
          keyQuorumId: config.keyQuorumId,
          authKeyId: config.authKeyId || '',
          privateKey: config.privateKey,
          privateKeyBase64: config.privateKeyBase64,
          publicKey: config.publicKey,
          createdAt: config.createdAt ? new Date(config.createdAt) : new Date(),
          userId: config.userId
        });
        restoredCount++;
        
        console.log(`Restored auth config for wallet ${config.walletId}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Restored ${restoredCount} auth configurations`,
      restoredCount
    });

  } catch (error: any) {
    console.error('Error restoring auth keys:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to restore auth keys'
    });
  }
}