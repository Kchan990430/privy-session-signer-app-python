import { NextApiRequest, NextApiResponse } from 'next';
import { 
  WalletAuthStore, 
  PrivySessionSigner,
  AcpContractClient,
  baseSepoliaAcpConfig,
  MemoType,
  AcpJobPhases
} from '@virtuals-protocol/acp-node';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, walletAddress, testType = 'simple' } = req.body;

    if (!walletId || !walletAddress) {
      return res.status(400).json({ error: 'walletId and walletAddress required' });
    }

    // Get auth configuration
    const authConfig = WalletAuthStore.get(walletId);
    if (!authConfig) {
      return res.status(404).json({ error: 'No auth configuration found. Create auth key first.' });
    }

    // Create session signer with the per-wallet auth key
    const sessionSigner = new PrivySessionSigner({
      walletId,
      walletAddress,
      privyAppId: PRIVY_APP_ID,
      privyAppSecret: PRIVY_APP_SECRET,
      sessionSignerPrivateKey: authConfig.privateKeyBase64,
      keyQuorumId: authConfig.keyQuorumId,
      chainId: 84532 // Base Sepolia
    });

    let result: any = {};

    if (testType === 'simple') {
      // Test simple transaction
      console.log('Testing simple transaction...');
      const txHash = await sessionSigner.sendTransaction({
        to: '0x0000000000000000000000000000000000000000',
        value: BigInt(0),
        data: '0x'
      });

      result = {
        success: true,
        type: 'simple_transaction',
        transactionHash: txHash,
        message: 'Transaction sent successfully using per-wallet auth key'
      };

    } else if (testType === 'memo') {
      // Test creating a memo with ACP
      console.log('Testing ACP memo creation...');
      const contractClient = new AcpContractClient(
        sessionSigner,
        baseSepoliaAcpConfig
      );

      const memoHash = await contractClient.createMemo(
        1, // jobId (test value)
        `Test memo from wallet ${walletAddress.slice(0, 8)}`,
        MemoType.MESSAGE,
        false,
        AcpJobPhases.TRANSACTION
      );

      result = {
        success: true,
        type: 'acp_memo',
        transactionHash: memoHash,
        message: 'Memo created successfully using per-wallet auth key'
      };

    } else if (testType === 'job') {
      // Test creating a job
      console.log('Testing ACP job creation...');
      const contractClient = new AcpContractClient(
        sessionSigner,
        baseSepoliaAcpConfig
      );

      const jobResult = await contractClient.createJob(
        walletAddress, // provider
        walletAddress, // evaluator (same for test)
        new Date(Date.now() + 24 * 60 * 60 * 1000) // expires in 24 hours
      );

      result = {
        success: true,
        type: 'acp_job',
        transactionHash: jobResult.txHash,
        jobId: jobResult.jobId,
        message: `Job #${jobResult.jobId} created successfully using per-wallet auth key`
      };
    }

    return res.status(200).json({
      ...result,
      authKeyId: authConfig.authKeyId,
      keyQuorumId: authConfig.keyQuorumId,
      walletAddress
    });

  } catch (error: any) {
    console.error('Test transaction failed:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to send test transaction',
      details: error.toString()
    });
  }
}