import { NextApiRequest, NextApiResponse } from 'next';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    console.log('Getting signers for wallet:', walletAddress);

    // Import Privy SDK to get wallet details
    const { PrivyClient } = await import('@privy-io/server-auth');
    const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
    
    // Get wallet details including signers
    const walletsResponse = await privy.walletApi.getWallets({
      addresses: [walletAddress]
    });
    
    if (!walletsResponse.data || walletsResponse.data.length === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletsResponse.data[0];
    console.log('Wallet found:', wallet.id);
    console.log('Signers:', wallet.signers);

    // Format signers for display
    const signers = wallet.signers?.map((signer: any) => ({
      id: signer.id || signer.signerId || signer,
      type: signer.type || 'unknown',
      address: signer.address,
      name: signer.name
    })) || [];

    return res.status(200).json({
      success: true,
      walletId: wallet.id,
      walletAddress: wallet.address,
      signers
    });

  } catch (error: any) {
    console.error('Error getting signers:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get wallet signers' 
    });
  }
}