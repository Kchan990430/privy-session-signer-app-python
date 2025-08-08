import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Creates an unowned wallet that can be controlled by the backend without user approval
 * These wallets are controlled entirely by app credentials
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    return res.status(500).json({ error: 'Privy credentials not configured' });
  }

  try {
    const { name, description } = req.body;

    // Create an unowned wallet (no owner specified)
    const response = await fetch('https://api.privy.io/v1/wallets', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'privy-app-id': PRIVY_APP_ID,
      },
      body: JSON.stringify({
        chain_type: 'ethereum',
        // No owner specified - this creates an unowned wallet
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to create unowned wallet:', error);
      return res.status(response.status).json({ 
        error: 'Failed to create wallet',
        details: error 
      });
    }

    const wallet = await response.json();
    
    // Store wallet info (in production, use a database)
    const walletInfo = {
      id: wallet.id,
      address: wallet.address,
      name: name || `Unowned Agent ${Date.now()}`,
      description: description || 'Backend-controlled autonomous agent wallet',
      type: 'unowned',
      createdAt: new Date().toISOString(),
      // This wallet can be controlled without user approval
      requiresApproval: false,
    };

    console.log('Created unowned wallet:', walletInfo);

    return res.status(200).json(walletInfo);
  } catch (error: any) {
    console.error('Error creating unowned wallet:', error);
    return res.status(500).json({ 
      error: 'Failed to create wallet',
      message: error.message 
    });
  }
}