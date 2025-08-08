import { NextApiRequest, NextApiResponse } from 'next';
import { Address } from 'viem';
import AcpClient, { 
  PrivySessionSigner, 
  AcpContractClient, 
  baseSepoliaAcpConfig
} from '@virtuals-protocol/acp-node';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;
const SESSION_SIGNER_SECRET = process.env.SESSION_SIGNER_SECRET!;

interface BrowseJobsRequest {
  walletId: string;
  walletAddress: Address;
  status?: string;
  limit?: number;
}

interface BrowseJobsResponse {
  success: boolean;
  data?: {
    jobs: any[];
    count: number;
  };
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BrowseJobsResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    const { 
      walletId, 
      walletAddress, 
      status,
      limit = 20
    } = req.body as BrowseJobsRequest;

    if (!walletId || !walletAddress) {
      return res.status(400).json({ 
        success: false,
        error: 'walletId and walletAddress are required' 
      });
    }

    // Create session signer
    const sessionSigner = new PrivySessionSigner({
      walletId,
      walletAddress,
      privyAppId: PRIVY_APP_ID,
      privyAppSecret: PRIVY_APP_SECRET,
      sessionSignerSecret: SESSION_SIGNER_SECRET,
      chainId: 84532 // Base Sepolia
    });

    // Create ACP contract client
    const contractClient = new AcpContractClient(
      sessionSigner,
      baseSepoliaAcpConfig,
      process.env.NEXT_PUBLIC_ACP_RPC_URL
    );
    await contractClient.init();

    // Create ACP client
    const acpClient = new AcpClient({
      acpContractClient: contractClient
    });
    await acpClient.init();

    // Get jobs for this agent
    let jobs: any[] = [];
    
    // Get different types of jobs based on status
    if (!status || status === 'active') {
      try {
        const activeJobs = await acpClient.getActiveJobs(1, Math.floor(limit / 3));
        jobs = jobs.concat(Array.isArray(activeJobs) ? activeJobs : []);
      } catch (err: any) {
        // Only log warning if it's not a "Not Found" error
        if (!err.message?.includes('Not Found')) {
          console.warn('Failed to get active jobs:', err);
        }
      }
    }
    
    if (!status || status === 'completed') {
      try {
        const completedJobs = await acpClient.getCompletedJobs(1, Math.floor(limit / 3));
        jobs = jobs.concat(Array.isArray(completedJobs) ? completedJobs : []);
      } catch (err: any) {
        // Only log warning if it's not a "Not Found" error
        if (!err.message?.includes('Not Found')) {
          console.warn('Failed to get completed jobs:', err);
        }
      }
    }
    
    if (!status || status === 'cancelled') {
      try {
        const cancelledJobs = await acpClient.getCancelledJobs(1, Math.floor(limit / 3));
        jobs = jobs.concat(Array.isArray(cancelledJobs) ? cancelledJobs : []);
      } catch (err: any) {
        // Only log warning if it's not a "Not Found" error
        if (!err.message?.includes('Not Found')) {
          console.warn('Failed to get cancelled jobs:', err);
        }
      }
    }

    console.log('✅ Browse jobs successful:', {
      agentWallet: walletAddress,
      status,
      foundJobs: jobs.length
    });

    return res.status(200).json({
      success: true,
      data: {
        jobs,
        count: jobs.length
      }
    });

  } catch (error: any) {
    console.error('❌ Browse jobs error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}