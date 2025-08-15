import { useState, useEffect } from 'react';
import { Address } from 'viem';
import { PrivateKeyInput } from './PrivateKeyInput';

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

interface CreateJobPanelSDKProps {
  agentWallet: {
    id: string;
    address: Address;
    name: string;
  };
}

export function CreateJobPanelSDK({ agentWallet }: CreateJobPanelSDKProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [jobResults, setJobResults] = useState<any[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showPrivateKeyInput, setShowPrivateKeyInput] = useState(false);

  // Browse agents using ACP SDK
  const browseAgents = async (keyword: string = '') => {
    setLoadingAgents(true);
    try {
      const response = await fetch('/api/acp/browse-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword || 'agent',
          options: {
            top_k: 20, // Get more agents for concurrent testing
            graduationStatus: 'BOTH',
            onlineStatus: 'ALL'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch agents');
      }

      const data = await response.json();
      setAgents(data.agents || []);
      console.log(`Found ${data.agents?.length || 0} agents`);
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

    // Show private key input modal
    setShowPrivateKeyInput(true);
  };

  const executeJobCreation = async (privateKeyBase64: string) => {
    setIsCreating(true);
    setJobResults([]);

    try {
      console.log(`Creating jobs for ${agents.length} agents with authorization...`);

      // Call the concurrent job creation API with private key
      const response = await fetch('/api/acp/create-concurrent-jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletId: agentWallet.id,
          walletAddress: agentWallet.address,
          privateKeyBase64,
          agents: agents.map(agent => ({
            name: agent.name,
            walletAddress: agent.walletAddress
          }))
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create concurrent jobs');
      }

      const result = await response.json();
      setJobResults(result.results || []);

      alert(`✅ Created ${result.successCount} jobs successfully!\n${result.failureCount > 0 ? `⚠️ ${result.failureCount} jobs failed` : ''}`);
      
    } catch (error: any) {
      console.error('Concurrent job creation error:', error);
      alert(`Failed to create jobs: ${error.message || 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle private key submission
  const handlePrivateKeySubmit = (_: string, privateKeyBase64: string) => {
    setShowPrivateKeyInput(false);
    executeJobCreation(privateKeyBase64);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold">Create Concurrent Jobs</h3>
          <p className="text-sm text-gray-600 mt-1">
            Create test jobs for all available agents (Amount: 0 ETH, Service: "testing create concurrent jobs")
          </p>
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
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loadingAgents ? 'Loading...' : 'Browse Agents'}
        </button>
      </div>

      {/* Available Agents */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h4 className="font-medium mb-3">Available Agents ({agents.length})</h4>
        {loadingAgents ? (
          <div className="text-center py-4 text-gray-500">Loading agents...</div>
        ) : agents.length > 0 ? (
          <div className="max-h-60 overflow-y-auto space-y-2">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between p-2 bg-white rounded border">
                <div className="flex-1">
                  <span className="font-medium text-sm">{agent.name}</span>
                  <span className="ml-2 text-xs text-gray-500 font-mono">
                    {agent.walletAddress.slice(0, 8)}...{agent.walletAddress.slice(-6)}
                  </span>
                  {agent.metrics?.totalJobs !== undefined && (
                    <span className="ml-2 text-xs text-gray-600">
                      ({agent.metrics.totalJobs} jobs)
                    </span>
                  )}
                </div>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Ready
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            No agents found. Try browsing agents first.
          </div>
        )}
      </div>

      {/* Create Jobs Button */}
      <button
        onClick={handleCreateConcurrentJobs}
        disabled={isCreating || agents.length === 0}
        className={`w-full py-3 rounded font-medium text-white transition-colors ${
          isCreating || agents.length === 0
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        {isCreating 
          ? `Creating Jobs for ${agents.length} Agents...` 
          : `Create Jobs for All ${agents.length} Agents`
        }
      </button>

      {/* Job Results */}
      {jobResults.length > 0 && (
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Job Creation Results</h4>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {jobResults.map((result, index) => (
              <div 
                key={index} 
                className={`p-2 rounded text-sm ${
                  result.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {result.agent || `Agent ${index + 1}`}
                  </span>
                  {result.success ? (
                    <span className="text-green-700">
                      ✅ Job ID: {result.jobId}
                    </span>
                  ) : (
                    <span className="text-red-700">
                      ❌ {result.error || 'Failed'}
                    </span>
                  )}
                </div>
                {result.txHash && (
                  <div className="text-xs text-gray-600 mt-1 font-mono">
                    Tx: {result.txHash.slice(0, 10)}...{result.txHash.slice(-8)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t text-sm">
            <div className="flex justify-between">
              <span>Total Success:</span>
              <span className="font-medium text-green-700">
                {jobResults.filter(r => r.success).length}
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span>Total Failed:</span>
              <span className="font-medium text-red-700">
                {jobResults.filter(r => !r.success).length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 This will create test jobs with all available agents using:
        </p>
        <ul className="text-sm text-blue-700 mt-2 space-y-1">
          <li>• Amount: 0 ETH (test jobs)</li>
          <li>• Service: "testing create concurrent jobs"</li>
          <li>• Provider & Evaluator: Same agent (for testing)</li>
          <li>• Requires authorization key for backend signing</li>
        </ul>
      </div>

      {/* Private Key Input Modal */}
      {showPrivateKeyInput && (
        <PrivateKeyInput
          walletId={agentWallet.id}
          walletAddress={agentWallet.address}
          onSubmit={handlePrivateKeySubmit}
          onCancel={() => setShowPrivateKeyInput(false)}
          action={`Create ${agents.length} concurrent jobs`}
        />
      )}
    </div>
  );
}