import { useState, useEffect } from 'react';
import { Address } from 'viem';
import { PrivateKeyInput } from './PrivateKeyInput';
import { acpClient } from '@/lib/acp-python-client';
// V2: Private key needed for backend to generate auth signature

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
      
      // Use real agents from the Python SDK
      if (data.success && data.agents) {
        setAgents(data.agents);
        console.log(`Found ${data.agents.length} agents from SDK`);
      } else {
        console.warn('No agents returned from API:', data);
        setAgents([]);
      }
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

    // V2: Private key required for backend to generate authorization signature
    console.log('🔑 V2 backend auth generation requires private key input...');
    setShowPrivateKeyInput(true);
  };

  const executeJobCreation = async (privateKeyBase64: string) => {
    setIsCreating(true);
    setJobResults([]);

    try {
      console.log(`Creating jobs for ${agents.length} agents using Python API with V2 auth generation...`);

      const results = [];
      const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Create jobs concurrently for all agents
      const jobPromises = agents.map(async (agent) => {
        try {
          // V2 Direct Execution: One call that handles prepare + sign + execute
          console.log(`Creating job for agent ${agent.name} with V2 direct execution`);
          
          const createJobResponse = await fetch(`${pythonApiUrl}/api/prepare/create-job`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider_address: agent.walletAddress,
              evaluator_address: agentWallet.address, // Using self as evaluator for testing
              expired_at: expiredAt.toISOString(),
              private_key_base64: privateKeyBase64  // V2: Pass private key for direct execution
            })
          });

          if (!createJobResponse.ok) {
            throw new Error(`Failed to create job for ${agent.name}`);
          }

          const jobResult = await createJobResponse.json();

          // V2 now returns final transaction result (not preparation data)
          if (!jobResult.success || !jobResult.hash) {
            throw new Error(`V2 job creation failed for ${agent.name}: ${jobResult.message || 'Unknown error'}`);
          }

          console.log('✅ V2 job created successfully:', {
            hash: jobResult.hash,
            sponsored: jobResult.sponsored,
            v2_executed: jobResult.v2_executed,
            transaction_id: jobResult.transaction_id
          });

          return {
            success: true,
            agent: agent.name,
            txHash: jobResult.hash,
            sponsored: jobResult.sponsored,
            v2_execution: jobResult.v2_executed
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

  // Handle private key submission for V2 backend auth generation
  const handlePrivateKeySubmit = (_: string, privateKeyBase64: string) => {
    setShowPrivateKeyInput(false);
    console.log('🔑 Using private key for V2 backend auth generation');
    console.log('🔑 Private key format:', privateKeyBase64.startsWith('wallet-auth:') ? 'wallet-auth format' : 'raw base64');
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

      {/* Private Key Input Modal for V2 Backend Auth Generation */}
      {showPrivateKeyInput && (
        <PrivateKeyInput
          walletId={agentWallet.id}
          walletAddress={agentWallet.address}
          action="Create jobs with V2 backend auth generation"
          onSubmit={handlePrivateKeySubmit}
          onCancel={() => setShowPrivateKeyInput(false)}
        />
      )}
    </div>
  );
}