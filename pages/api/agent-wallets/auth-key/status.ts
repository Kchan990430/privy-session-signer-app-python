import { NextApiRequest, NextApiResponse } from 'next';
import { WalletAuthStore } from '@virtuals-protocol/acp-node';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, walletAddress } = req.body;

    if (!walletId) {
      return res.status(400).json({ error: 'walletId required' });
    }

    // Check if auth key exists
    const authConfig = WalletAuthStore.get(walletId);
    
    if (!authConfig) {
      // Also check by address as fallback
      const configByAddress = WalletAuthStore.getByAddress(walletAddress);
      if (configByAddress) {
        return res.status(200).json({
          exists: true,
          authKeyId: configByAddress.authKeyId,
          keyQuorumId: configByAddress.keyQuorumId,
          walletAddress: configByAddress.walletAddress,
          createdAt: configByAddress.createdAt
        });
      }
      
      return res.status(200).json({
        exists: false,
        message: 'No authorization key found for this wallet'
      });
    }

    return res.status(200).json({
      exists: true,
      authKeyId: authConfig.authKeyId,
      keyQuorumId: authConfig.keyQuorumId,
      walletAddress: authConfig.walletAddress,
      createdAt: authConfig.createdAt
    });

  } catch (error: any) {
    console.error('Error checking auth key status:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to check auth key status'
    });
  }
}