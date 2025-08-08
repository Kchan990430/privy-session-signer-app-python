import { NextApiRequest, NextApiResponse } from 'next';
import { Address } from 'viem';
import AcpClient, { 
  PrivySessionSigner, 
  AcpContractClient, 
  baseSepoliaAcpConfig
} from '@virtuals-protocol/acp-node';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;
const SESSION_SIGNER_SECRET = process.env.SESSION_SIGNER_SECRET!;

interface CreateJobRequest {
  providerAddress: Address;
  evaluatorAddress?: Address;
  serviceRequirement: string;
  amount: string;
  expirationHours?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      providerAddress, 
      evaluatorAddress,
      serviceRequirement, 
      amount, 
      expirationHours = 24
    } = req.body as CreateJobRequest;

    if (!providerAddress || !serviceRequirement || amount === undefined || amount === null) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'Provider address, service requirement, and amount are required' 
      });
    }

    // Debug environment variables
    const PRIVY_AUTH_KEY_ID = process.env.PRIVY_AUTH_KEY_ID;
    console.log('Environment check:', {
      PRIVY_AUTH_KEY_ID,
      hasSessionSignerSecret: !!SESSION_SIGNER_SECRET,
      sessionSignerSecretStart: SESSION_SIGNER_SECRET?.substring(0, 50) + '...'
    });

    // Create session signer with funded wallet and authorization key ID
    const sessionSigner = new PrivySessionSigner({
      walletId: 'h8ck8l1z0mmfn8qq8619wcv0',
      walletAddress: '0xE5Ede10D0010a028D72cF065DAfd8e2e8F2Ee55f' as Address,
      privyAppId: PRIVY_APP_ID,
      privyAppSecret: PRIVY_APP_SECRET,
      sessionSignerPrivateKey: SESSION_SIGNER_SECRET,
      chainId: 84532 // Base Sepolia
    });

    // Create ACP contract client with proper initialization
    const contractClient = new AcpContractClient(
      sessionSigner,
      baseSepoliaAcpConfig,
      process.env.NEXT_PUBLIC_ACP_RPC_URL
    );
    await contractClient.init();

    // Create ACP client with proper initialization
    const acpClient = new AcpClient({
      acpContractClient: contractClient
    });
    await acpClient.init();

    console.log('💼 Creating job with ACP SDK:', {
      providerAddress,
      evaluatorAddress: evaluatorAddress || 'Self-evaluated',
      serviceRequirement,
      amount,
      expirationHours
    });

    // Create job using ACP SDK
    const jobId = await acpClient.initiateJob(
      providerAddress,
      serviceRequirement,
      parseFloat(amount),
      evaluatorAddress // Can be undefined for self-evaluation
    );

    console.log('✅ Job created successfully:', {
      jobId,
      provider: providerAddress,
      amount
    });

    return res.status(200).json({
      success: true,
      jobId: jobId.toString(),
      txHash: null // ACP SDK doesn't return tx hash directly for job creation
    });

  } catch (error: any) {
    console.error('❌ Create job error:', error);
    return res.status(500).json({
      error: 'Failed to create job',
      message: error.message,
      details: error.stack
    });
  }
}