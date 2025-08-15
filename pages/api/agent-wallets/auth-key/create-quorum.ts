import { NextApiRequest, NextApiResponse } from 'next';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('\n=== CREATE QUORUM REQUEST ===');
  console.log('Method:', req.method);
  console.log('Body:', req.body);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, walletAddress, publicKey } = req.body;

    if (!walletId || !walletAddress || !publicKey) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Creating key quorum for wallet:', walletAddress);
    console.log('Provided wallet ID:', walletId);

    // Always try to get the actual Privy wallet ID
    let actualWalletId = walletId;
    
    // Import Privy SDK to get wallet details
    const { PrivyClient } = await import('@privy-io/server-auth');
    const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
    
    try {
      console.log('Fetching actual Privy wallet ID for address:', walletAddress);
      console.log('Provided wallet ID:', walletId);
      
      // Always fetch by address to ensure we get the correct wallet ID
      const walletsResponse = await privy.walletApi.getWallets({
        addresses: [walletAddress]
      });
      
      if (walletsResponse.data && walletsResponse.data.length > 0) {
        actualWalletId = walletsResponse.data[0].id;
        console.log('✅ Found actual Privy wallet ID:', actualWalletId);
        console.log('Wallet details:', {
          id: walletsResponse.data[0].id,
          address: walletsResponse.data[0].address,
          signers: walletsResponse.data[0].signers
        });
      } else {
        console.log('⚠️ Wallet not found in Privy wallet API');
        console.log('Attempting to use address as wallet ID:', walletAddress);
        // Sometimes the wallet ID is the address itself for new wallets
        actualWalletId = walletAddress;
      }
    } catch (e: any) {
      console.error('Error fetching Privy wallet ID:', e.message);
      console.log('Will attempt with address as wallet ID:', walletAddress);
      actualWalletId = walletAddress;
    }

    // Create key quorum with Privy REST API
    const basicAuth = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64');
    
    const response = await fetch('https://auth.privy.io/api/v1/key_quorums', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        'privy-app-id': PRIVY_APP_ID
      },
      body: JSON.stringify({
        public_keys: [publicKey]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to create key quorum:', error);
      throw new Error(`Failed to create key quorum: ${error}`);
    }

    const data = await response.json();
    const keyQuorumId = data.id;

    console.log('Key quorum created:', keyQuorumId);
    
    // Note: Session signer will be added from the frontend using Privy's React SDK
    // The backend cannot add signers as it requires user session context
    console.log('Key quorum ready. Session signer will be added from frontend.');

    // Return the key quorum ID - we do NOT store the private key
    return res.status(200).json({
      success: true,
      keyQuorumId,
      walletId: actualWalletId, // Return the actual Privy wallet ID used
      walletAddress,
      message: 'Key quorum created successfully. Session signer will be added from frontend.'
    });

  } catch (error: any) {
    console.error('Error creating key quorum:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create key quorum' 
    });
  }
}