import { useState, useEffect } from 'react';
import { Address } from 'viem';
import { PrivateKeyInput } from './PrivateKeyInput';
import { acpClient } from '@/lib/acp-python-client';
import { generatePrivyAuthSignatureNodeStyle } from '@/lib/privy-signature-node-style';

interface Agent {
  id: string;
  walletAddress: string;
  name: string;
  description: string;
  twitterHandle?: string;
  metrics?: {
    totalJobs?: number;
    successRate?: number;
    avgRating?: number;
  };
}

interface CreateJobPanelSDKPythonProps {
  agentWallet: {
    id: string;
    address: Address;
    name: string;
  };
}

export function CreateJobPanelSDKPython({ agentWallet }: CreateJobPanelSDKPythonProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [jobResults, setJobResults] = useState<any[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showPrivateKeyInput, setShowPrivateKeyInput] = useState(false);
  const [pythonApiUrl] = useState(process.env.NEXT_PUBLIC_ACP_API_URL || 'http://localhost:8000');
  // Frontend signing is mandatory - backend signing has been removed

  // Browse agents using Python API
  const browseAgents = async (keyword: string = '') => {
    setLoadingAgents(true);
    try {
      const response = await fetch(`${pythonApiUrl}/api/agents?keyword=${encodeURIComponent(keyword)}&limit=20`);

      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }

      const data = await response.json();
      
      // For now, using mock data since agent browsing isn't fully implemented
      // In production, this would return real agents from the Python SDK
      const mockAgents: Agent[] = [
        {
          id: '1',
          walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9',
          name: 'Test Agent 1',
          description: 'Test agent for development',
          metrics: { totalJobs: 10, successRate: 95, avgRating: 4.8 }
        },
        {
          id: '2',
          walletAddress: '0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed',
          name: 'Test Agent 2',
          description: 'Another test agent',
          metrics: { totalJobs: 5, successRate: 90, avgRating: 4.5 }
        }
      ];
      
      setAgents(mockAgents);
      console.log(`Found ${mockAgents.length} agents`);
    } catch (error) {
      console.error('Failed to browse agents:', error);
      setAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  };

  useEffect(() => {
    // Load initial agents
    browseAgents('');
  }, []);

  const handleCreateConcurrentJobs = async () => {
    if (agents.length === 0) {
      alert('No agents available. Please browse agents first.');
      return;
    }

    // ALWAYS prompt for private key - no stored keys (simpler, avoids bugs)
    console.log('🔑 Frontend signing requires private key input...');
    setShowPrivateKeyInput(true);
  };

  const executeJobCreation = async (privateKeyBase64: string) => {
    setIsCreating(true);
    setJobResults([]);

    try {
      console.log(`Creating jobs for ${agents.length} agents using Python API...`);

      const results = [];
      const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Create jobs concurrently for all agents
      const jobPromises = agents.map(async (agent) => {
        try {
          // Step 1: Prepare transaction
          // Use the actual wallet ID from the agent wallet (Privy ID if available)
          const walletId = agentWallet.id.startsWith('agent-') ? "ulkh8i0f6hkg2uu9ns1dt267" : agentWallet.id;
          console.log(`Preparing job for agent ${agent.name} with wallet ID: ${walletId}`);
          
          const prepareResponse = await fetch(`${pythonApiUrl}/api/prepare/create-job`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wallet_id: walletId,
              provider_address: agent.walletAddress,
              evaluator_address: agentWallet.address, // Using self as evaluator for testing
              expired_at: expiredAt.toISOString()
            })
          });

          if (!prepareResponse.ok) {
            throw new Error(`Failed to prepare transaction for ${agent.name}`);
          }

          const prepareData = await prepareResponse.json();

          // Step 2: Generate authorization signature (FRONTEND ONLY - Required)
          if (!privateKeyBase64) {
            throw new Error('Private key is required for transaction signing');
          }
          
          let executePayload: any = {
            wallet_id: walletId,
            transaction_data: prepareData.transaction,
            sponsor: true
          };
          
          // Frontend signing is mandatory - no backend signing
          try {
            console.log('🔐 Generating authorization signature...');
            console.log('Transaction data:', prepareData.transaction);
            
            // Frontend signature generation - use RPC payload from backend
            const frontendSignature = await generateFrontendSignature(
              privateKeyBase64,
              prepareData.rpc_payload  // Use the exact RPC payload from backend
            );
            
            executePayload.authorization_signature = frontendSignature;
            console.log('✅ Authorization signature generated:', frontendSignature.substring(0, 30) + '...');
            
          } catch (signatureError: any) {
            console.error('❌ Failed to generate authorization signature:', signatureError.message);
            throw new Error(`Signature generation failed: ${signatureError.message}`);
          }
          
          console.log('Execute payload:', {
            wallet_id: executePayload.wallet_id,
            authorization_signature: executePayload.authorization_signature ? '[SIGNATURE PROVIDED]' : '[MISSING!]',
            sponsor: executePayload.sponsor
          });
          
          const executeResponse = await fetch(`${pythonApiUrl}/api/execute/transaction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(executePayload)
          });

          if (!executeResponse.ok) {
            const error = await executeResponse.json();
            throw new Error(error.detail || 'Failed to execute transaction');
          }

          const executeData = await executeResponse.json();

          return {
            success: true,
            agent: agent.name,
            txHash: executeData.hash,
            sponsored: executeData.sponsored
          };
        } catch (error: any) {
          console.error(`Failed to create job for ${agent.name}:`, error);
          return {
            success: false,
            agent: agent.name,
            error: error.message
          };
        }
      });

      const allResults = await Promise.all(jobPromises);
      setJobResults(allResults);

      const successCount = allResults.filter(r => r.success).length;
      const failureCount = allResults.filter(r => !r.success).length;

      alert(`✅ Created ${successCount} jobs successfully!\n${failureCount > 0 ? `⚠️ ${failureCount} jobs failed` : ''}`);
      
    } catch (error: any) {
      console.error('Concurrent job creation error:', error);
      alert(`Failed to create jobs: ${error.message || 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Generate frontend signature using Privy authorization key (P-256)
  const generateFrontendSignature = async (
    authorizationKey: string,
    rpcPayload: any
  ): Promise<string> => {
    // Get the wallet ID for the Privy API call
    const walletId = agentWallet.id.startsWith('agent-') ? "ulkh8i0f6hkg2uu9ns1dt267" : agentWallet.id;
    
    // Use Node.js style implementation that matches Privy docs exactly
    return generatePrivyAuthSignatureNodeStyle(authorizationKey, walletId, rpcPayload);
  };

  // Handle private key submission
  const handlePrivateKeySubmit = (_: string, privateKeyBase64: string) => {
    setShowPrivateKeyInput(false);
    const walletId = agentWallet.id.startsWith('agent-') ? "hpvztnex4emkfroblqcmzyfp" : agentWallet.id;
    console.log('🔑 Using private key for wallet ID:', walletId);
    console.log('🔑 Private key (first 20 chars):', privateKeyBase64.substring(0, 20));
    console.log('🔑 Key format:', privateKeyBase64.startsWith('wallet-auth:') ? 'wallet-auth format' : 'raw base64');
    executeJobCreation(privateKeyBase64);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold">Create Jobs (Python SDK)</h3>
          <p className="text-sm text-gray-600 mt-1">
            Create test jobs using Python backend with gas sponsorship
          </p>
          <p className="text-xs text-blue-600 mt-1">
            API: {pythonApiUrl}
          </p>
        </div>
        
        {/* Signing Mode - Frontend Only */}
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Signing:</label>
          <div className="px-3 py-1 text-xs rounded-full bg-green-100 text-green-800 border border-green-300">
            🌐 Frontend Only (Private Key Required)
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder="Search agents (optional)..."
          className="flex-1 px-3 py-2 border rounded"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              browseAgents(searchKeyword);
            }
          }}
        />
        <button
          onClick={() => browseAgents(searchKeyword)}
          disabled={loadingAgents}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loadingAgents ? 'Loading...' : 'Search'}
        </button>
      </div>

      {/* Agents List */}
      <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
        <div className="text-sm text-gray-600 mb-2">
          {agents.length > 0 ? `${agents.length} agents available` : 'No agents found'}
        </div>
        {agents.map((agent) => (
          <div key={agent.id} className="flex justify-between items-center py-2 border-b last:border-0">
            <div>
              <div className="font-medium">{agent.name}</div>
              <div className="text-xs text-gray-500">{agent.walletAddress.slice(0, 10)}...</div>
            </div>
            {agent.metrics && (
              <div className="text-xs text-gray-500">
                {agent.metrics.totalJobs} jobs | {agent.metrics.successRate}% success
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Jobs Button */}
      <button
        onClick={handleCreateConcurrentJobs}
        disabled={isCreating || agents.length === 0}
        className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 font-medium"
      >
        {isCreating ? 'Creating Jobs...' : `Create ${agents.length} Jobs with Python SDK`}
      </button>

      {/* Job Results */}
      {jobResults.length > 0 && (
        <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
          <div className="text-sm font-medium mb-2">Job Creation Results:</div>
          {jobResults.map((result, index) => (
            <div
              key={index}
              className={`text-xs py-1 ${result.success ? 'text-green-600' : 'text-red-600'}`}
            >
              {result.agent}: {result.success ? `✅ ${result.txHash?.slice(0, 10)}...` : `❌ ${result.error}`}
              {result.sponsored && ' (Gas Sponsored)'}
            </div>
          ))}
        </div>
      )}

      {/* Private Key Input Modal */}
      {showPrivateKeyInput && (
        <PrivateKeyInput
          walletId={agentWallet.id}
          walletAddress={agentWallet.address}
          action="Create jobs with Python SDK"
          onSubmit={handlePrivateKeySubmit}
          onCancel={() => setShowPrivateKeyInput(false)}
        />
      )}
    </div>
  );
}