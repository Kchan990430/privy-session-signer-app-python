import { NextApiRequest, NextApiResponse } from 'next';
import { PrivySessionSigner } from '@virtuals-protocol/acp-node';
import { Address } from 'viem';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;
const SESSION_SIGNER_SECRET = process.env.SESSION_SIGNER_SECRET!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletAddress, testMessage } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    // Test if backend can sign for this wallet
    // This is a simplified test - in production, you'd need the wallet ID
    const message = testMessage || `Backend authorization test for ${walletAddress}`;
    
    // Check if we have the necessary credentials
    if (!SESSION_SIGNER_SECRET) {
      return res.status(500).json({ 
        error: 'Backend not configured with session signer credentials' 
      });
    }

    // If we get here, backend is configured
    // In a real implementation, you would:
    // 1. Get the wallet ID from the address
    // 2. Create a PrivySessionSigner instance
    // 3. Try to sign a message or send a test transaction
    
    return res.status(200).json({
      success: true,
      message: 'Backend is configured with session signer credentials',
      details: {
        hasAppId: !!PRIVY_APP_ID,
        hasAppSecret: !!PRIVY_APP_SECRET,
        hasSessionSigner: !!SESSION_SIGNER_SECRET,
        walletAddress,
        testMessage: message
      }
    });

  } catch (error: any) {
    console.error('Test auth error:', error);
    return res.status(500).json({
      error: 'Test failed',
      message: error.message
    });
  }
}