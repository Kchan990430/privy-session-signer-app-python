import { NextApiRequest, NextApiResponse } from 'next';

const acpNode = require('@virtuals-protocol/acp-node');
const { 
  PrivySessionSigner,
  AcpContractClient,
  baseSepoliaAcpConfig,
} = acpNode;

import { gasSponsorshipConfig } from '../../../lib/gasSponsorshipConfig';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, walletAddress, privateKeyBase64 } = req.body;

    if (!walletId || !walletAddress || !privateKeyBase64) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Initialize the session signer
    const sessionSigner = new PrivySessionSigner({
      walletId: walletId,
      walletAddress: walletAddress,
      privyAppId: PRIVY_APP_ID,
      privyAppSecret: PRIVY_APP_SECRET,
      sessionSignerPrivateKey: privateKeyBase64,
      chainId: 84532 // Base Sepolia
    });

    // Initialize ACP Contract Client with gas sponsorship config
    const configWithSponsorship = {
      ...baseSepoliaAcpConfig,
      ...gasSponsorshipConfig
    };
    
    const acpContractClient = new AcpContractClient(
      sessionSigner,
      configWithSponsorship,
      process.env.NEXT_PUBLIC_ACP_RPC_URL
    );
    await acpContractClient.init();

    // Get smart account details
    const smartAccountAddress = acpContractClient.smartAccountAddress;
    const smartAccountBalance = await acpContractClient.getSmartAccountBalance();

    const result = {
      gasSponsorship: {
        enabled: !!smartAccountAddress,
        smartAccountAddress,
        smartAccountBalance: smartAccountBalance ? `${Number(smartAccountBalance) / 1e18} ETH` : 'N/A',
        paymasterConfigured: !!gasSponsorshipConfig.paymasterUrl,
        bundlerConfigured: !!gasSponsorshipConfig.bundlerUrl,
      },
      walletDetails: {
        ownerWallet: walletAddress,
        walletId: walletId,
      },
      instructions: !smartAccountAddress ? 
        'Smart account not created. Check configuration.' :
        `Register smart account ${smartAccountAddress} at https://acp-staging.virtuals.io/ to enable gas sponsorship`,
      status: smartAccountAddress ? 'ready' : 'not_configured'
    };

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Verification error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to verify gas sponsorship',
      details: error.toString()
    });
  }
}