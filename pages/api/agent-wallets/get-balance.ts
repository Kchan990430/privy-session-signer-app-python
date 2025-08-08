import { NextApiRequest, NextApiResponse } from 'next';
import { Address, createPublicClient, http, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';

interface GetBalanceRequest {
  walletAddress: Address;
  tokenAddress?: Address;
}

interface GetBalanceResponse {
  success: boolean;
  data?: {
    address: Address;
    balance: string; // Balance in wei
    balanceFormatted: string; // Balance in ETH
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GetBalanceResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    const { walletAddress, tokenAddress } = req.body as GetBalanceRequest;

    if (!walletAddress) {
      return res.status(400).json({ 
        success: false,
        error: 'walletAddress is required' 
      });
    }

    // Create public client for Base Sepolia
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.NEXT_PUBLIC_ACP_RPC_URL || 'https://sepolia.base.org'),
    });

    // Get balance using SDK's getBalance utility if available
    let balance: bigint;
    
    if (tokenAddress) {
      // For ERC20 tokens, we'd need to implement token balance checking
      // For now, return 0 as placeholder
      balance = BigInt(0);
    } else {
      // Get ETH balance
      balance = await publicClient.getBalance({ address: walletAddress });
    }

    return res.status(200).json({
      success: true,
      data: {
        address: walletAddress,
        balance: balance.toString(),
        balanceFormatted: formatEther(balance),
      },
    });

  } catch (error: any) {
    console.error('❌ Get balance error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}