import { NextApiRequest, NextApiResponse } from 'next';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, walletAddress, signerId } = req.body;

    if (!walletAddress || !signerId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Removing signer from wallet:', walletAddress);
    console.log('Signer ID to remove:', signerId);

    // Get actual Privy wallet ID if needed
    let actualWalletId = walletId;
    const basicAuth = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64');
    
    if (!actualWalletId || actualWalletId.startsWith('0x')) {
      // Fetch actual wallet ID from Privy
      try {
        const { PrivyClient } = await import('@privy-io/server-auth');
        const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
        
        const walletsResponse = await privy.walletApi.getWallets({
          addresses: [walletAddress]
        });
        
        if (walletsResponse.data && walletsResponse.data.length > 0) {
          actualWalletId = walletsResponse.data[0].id;
          console.log('Found actual Privy wallet ID:', actualWalletId);
        }
      } catch (e) {
        console.error('Could not fetch Privy wallet ID:', e);
        return res.status(500).json({ error: 'Failed to get wallet information' });
      }
    }

    // Remove the signer using Privy API
    const removeResponse = await fetch(`https://auth.privy.io/api/v1/wallets/${actualWalletId}/signers/${signerId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'privy-app-id': PRIVY_APP_ID
      }
    });

    if (!removeResponse.ok) {
      const error = await removeResponse.text();
      console.error('Failed to remove signer:', error);
      return res.status(500).json({ 
        error: 'Failed to remove signer', 
        details: error 
      });
    }

    console.log(`✅ Successfully removed signer ${signerId} from wallet ${actualWalletId}`);

    return res.status(200).json({
      success: true,
      message: 'Signer removed successfully',
      walletId: actualWalletId,
      removedSignerId: signerId
    });

  } catch (error: any) {
    console.error('Error removing signer:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to remove signer' 
    });
  }
}