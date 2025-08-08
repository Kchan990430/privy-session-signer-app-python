import { NextApiRequest, NextApiResponse } from 'next';
import { Address } from 'viem';

interface RegisterWalletRequest {
  walletId: string;
  walletAddress: Address;
  sessionSignerId: string;
  chainType: string;
}

interface RegisterWalletResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// In-memory storage for demo purposes
// In production, use a database
const walletRegistry = new Map<string, RegisterWalletRequest>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RegisterWalletResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { walletId, walletAddress, sessionSignerId, chainType } = req.body as RegisterWalletRequest;

    if (!walletId || !walletAddress || !sessionSignerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    // Store wallet info
    walletRegistry.set(walletId, {
      walletId,
      walletAddress,
      sessionSignerId,
      chainType
    });

    console.log('✅ Wallet registered:', {
      walletId,
      walletAddress,
      sessionSignerId,
      chainType
    });

    // You can also store this in a database or send to your backend service
    // For now, we'll also save it to environment for backend use
    process.env[`WALLET_${walletId}`] = JSON.stringify({
      walletAddress,
      sessionSignerId
    });

    return res.status(200).json({
      success: true,
      message: `Wallet ${walletId} registered with session signer ${sessionSignerId}`
    });

  } catch (error) {
    console.error('Error registering wallet:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}

// Export the registry for use in other API routes
export { walletRegistry };