import { NextApiRequest, NextApiResponse } from 'next';
import { Address } from 'viem';

const acpNode = require('@virtuals-protocol/acp-node');
const AcpClient = acpNode.default || acpNode.AcpClient || acpNode;
const { 
  PrivySessionSigner,
  AcpContractClient,
  baseSepoliaAcpConfig,
  WalletAuthStore 
} = acpNode;

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let { walletId, walletAddress, privateKeyBase64, agents } = req.body;

    if (!walletId || !walletAddress || !agents || agents.length === 0) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    if (!privateKeyBase64) {
      return res.status(400).json({ 
        error: 'Private key (base64 format) required for job creation' 
      });
    }

    console.log(`🚀 Creating concurrent jobs for ${agents.length} agents`);

    // If walletId looks like "agent-0x..." it's not a real Privy wallet ID
    // We need to look up the actual wallet ID
    if (walletId && walletId.startsWith('agent-')) {
      console.log('Detected custom wallet ID format, looking up actual Privy wallet ID...');
      const addressFromId = walletId.replace('agent-', '');
      
      try {
        // Try to find the actual wallet ID
        const { PrivyClient } = await import('@privy-io/server-auth');
        const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
        const walletsResponse = await privy.walletApi.getWallets();
        
        const wallet = walletsResponse.data?.find(
          w => w.address.toLowerCase() === addressFromId.toLowerCase()
        );
        
        if (wallet) {
          console.log(`Found Privy wallet ID: ${wallet.id} for address: ${addressFromId}`);
          walletId = wallet.id;
          walletAddress = wallet.address;
        }
      } catch (lookupError: any) {
        console.error('Failed to lookup wallet ID:', lookupError);
      }
    }

    // Initialize the session signer with the provided private key
    const sessionSigner = new PrivySessionSigner({
      walletId: walletId,
      walletAddress: walletAddress as Address,
      privyAppId: PRIVY_APP_ID,
      privyAppSecret: PRIVY_APP_SECRET,
      sessionSignerPrivateKey: privateKeyBase64,
      chainId: 84532 // Base Sepolia
    });

    // Initialize ACP Contract Client
    const acpContractClient = new AcpContractClient(
      sessionSigner,
      baseSepoliaAcpConfig,
      process.env.NEXT_PUBLIC_ACP_RPC_URL
    );
    await acpContractClient.init();

    // Initialize ACP Client
    const acpClient = new AcpClient({
      acpContractClient,
      onNewTask: (job) => console.log('New task:', job.id),
      onEvaluate: (job) => console.log('Evaluate job:', job.id)
    });
    await acpClient.init();

    // Create jobs concurrently for all agents
    const jobPromises = agents.map(async (agent: any) => {
      try {
        console.log(`Creating job for agent: ${agent.walletAddress}`);
        
        // Use the same agent as both provider and evaluator for testing
        const job = await acpClient.initiateJob(
          agent.walletAddress as Address, // Provider
          "testing create concurrent jobs", // Hardcoded service requirement
          0, // Amount set to 0
          agent.walletAddress as Address  // Evaluator (same as provider for testing)
        );

        console.log(`✅ Job created for agent ${agent.name}: Job ID ${job.id}`);
        
        return {
          success: true,
          agent: agent.name,
          agentAddress: agent.walletAddress,
          jobId: job.id,
          txHash: job.txHash
        };
      } catch (error: any) {
        console.error(`❌ Failed to create job for agent ${agent.name}:`, error);
        return {
          success: false,
          agent: agent.name,
          agentAddress: agent.walletAddress,
          error: error.message || 'Unknown error'
        };
      }
    });

    // Wait for all jobs to complete
    const results = await Promise.allSettled(jobPromises);
    
    // Process results
    const jobResults = results.map(result => 
      result.status === 'fulfilled' ? result.value : {
        success: false,
        error: result.reason?.message || 'Job creation failed'
      }
    );

    const successCount = jobResults.filter(r => r.success).length;
    const failureCount = jobResults.filter(r => !r.success).length;

    console.log(`📊 Job creation complete: ${successCount} succeeded, ${failureCount} failed`);

    return res.status(200).json({
      success: true,
      message: `Created ${successCount} jobs successfully`,
      totalAgents: agents.length,
      successCount,
      failureCount,
      results: jobResults,
      usedAuthKey: true
    });

  } catch (error: any) {
    console.error('Concurrent job creation error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create concurrent jobs',
      details: error.toString()
    });
  }
}