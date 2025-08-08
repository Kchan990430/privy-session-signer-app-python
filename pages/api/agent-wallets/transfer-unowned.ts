import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Transfer funds from an unowned wallet without requiring user approval
 * This works because unowned wallets are controlled by app credentials
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
    const { walletId, toAddress, amountWei } = req.body;

    if (!walletId || !toAddress || !amountWei) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Send transaction from unowned wallet (no user approval needed)
    const response = await fetch(`https://api.privy.io/v1/wallets/${walletId}/rpc`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'privy-app-id': PRIVY_APP_ID,
      },
      body: JSON.stringify({
        method: 'eth_sendTransaction',
        caip2: 'eip155:84532', // Base Sepolia
        params: {
          transaction: {
            to: toAddress,
            value: `0x${BigInt(amountWei).toString(16)}`,
            data: '0x', // Empty data for simple transfer
          }
        }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to transfer from unowned wallet:', error);
      return res.status(response.status).json({ 
        error: 'Failed to transfer',
        details: error 
      });
    }

    const result = await response.json();
    const txHash = result.hash || result.data?.hash || result.data?.txHash;

    console.log('Transfer from unowned wallet successful:', txHash);

    return res.status(200).json({
      success: true,
      txHash,
      message: 'Transfer completed without user approval',
    });
  } catch (error: any) {
    console.error('Error transferring from unowned wallet:', error);
    return res.status(500).json({ 
      error: 'Failed to transfer',
      message: error.message 
    });
  }
}