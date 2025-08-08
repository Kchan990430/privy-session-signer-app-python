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

interface BrowseAgentsRequest {
  keyword?: string;
  options?: {
    top_k?: number;
    graduationStatus?: string;
    onlineStatus?: string;
  };
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
      keyword = '',
      options = {}
    } = req.body as BrowseAgentsRequest;

    const { top_k = 10, graduationStatus, onlineStatus } = options;

    // Create session signer with hardcoded wallet (as in previous working version)
    const sessionSigner = new PrivySessionSigner({
      walletId: 'hvmmb28vjgumo0jldw5s14ep',
      walletAddress: '0x2E7f3A7244b4BCad88C1eD99646676df5A8E76f4' as Address,
      privyAppId: PRIVY_APP_ID,
      privyAppSecret: PRIVY_APP_SECRET,
      sessionSignerSecret: SESSION_SIGNER_SECRET,
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

    // Call ACP API directly (like the working implementation)
    let agents: any[] = [];
    
    try {
      const baseUrl = baseSepoliaAcpConfig.acpUrl; // https://acpx.virtuals.gg
      let url = `${baseUrl}/api/agents/v2/search?search=${keyword}`;
      
      if (top_k) {
        url += `&top_k=${top_k}`;
      }
      
      // Exclude current wallet address
      url += `&walletAddressesToExclude=${sessionSigner.address}`;
      
      // Only add graduationStatus and onlineStatus if they have valid values
      // The API doesn't accept BOTH/ALL values
      if (graduationStatus && graduationStatus !== 'BOTH') {
        url += `&graduationStatus=${graduationStatus}`;
      }
      
      if (onlineStatus && onlineStatus !== 'ALL') {
        url += `&onlineStatus=${onlineStatus}`;
      }
      
      console.log('🔍 Calling ACP API directly:', { url, keyword, top_k });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`ACP API returned ${response.status}: ${response.statusText}`);
      }
      
      const apiData = await response.json();
      console.log('📡 Raw ACP API response:', JSON.stringify(apiData, null, 2));
      
      // Handle the response structure properly
      if (apiData && apiData.data && Array.isArray(apiData.data)) {
        agents = apiData.data.map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          description: agent.description,
          walletAddress: agent.walletAddress,
          twitterHandle: agent.twitterHandle,
          offerings: agent.offerings || [],
          metrics: agent.metrics || {}
        }));
        console.log('✅ Successfully parsed agents from API response');
      } else if (apiData && apiData.data === null) {
        console.log('⚠️ ACP API returned data: null - no agents found');
        agents = [];
      } else {
        console.log('⚠️ Unexpected ACP API response format:', apiData);
        agents = [];
      }
      
    } catch (apiError: any) {
      console.error('❌ Direct ACP API call failed:', apiError.message);
      agents = [];
    }

    console.log('✅ Browse agents completed:', {
      keyword,
      foundAgents: agents.length
    });

    return res.status(200).json({
      success: true,
      agents
    });

  } catch (error: any) {
    console.error('❌ Browse agents error:', error);
    return res.status(500).json({
      error: 'Failed to browse agents',
      message: error.message,
      details: error.stack
    });
  }
}