import { useState, useEffect } from 'react';
import { Address } from 'viem';
import type { SessionSigner } from '../hooks/usePrivyAgentWallets';

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
  offerings?: Array<{
    name: string;
    price: string;
    requirementSchema?: any;
  }>;
}

interface CreateJobPanelSDKProps {
  agentWallet: {
    id: string;
    address: Address;
    name: string;
  };
  getSessionSigner: () => SessionSigner | null;
}

export function CreateJobPanelSDK({ agentWallet, getSessionSigner }: CreateJobPanelSDKProps) {
  const [providerAddress, setProviderAddress] = useState('');
  const [evaluatorAddress, setEvaluatorAddress] = useState('');
  const [expirationHours, setExpirationHours] = useState('24');
  const [isCreating, setIsCreating] = useState(false);
  const [jobResult, setJobResult] = useState<{ txHash: string; jobId: number } | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [showAgentBrowser, setShowAgentBrowser] = useState(false);
  const [selectedAgentType, setSelectedAgentType] = useState<'provider' | 'evaluator'>('provider');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [jobAmount, setJobAmount] = useState('0.001');
  const [serviceRequirement, setServiceRequirement] = useState('');

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
            top_k: 10,
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

  const selectAgent = (agent: Agent, type: 'provider' | 'evaluator') => {
    if (type === 'provider') {
      setProviderAddress(agent.walletAddress);
    } else {
      setEvaluatorAddress(agent.walletAddress);
    }
    setShowAgentBrowser(false);
  };

  const handleCreateJob = async () => {
    const signer = getSessionSigner();
    if (!signer) {
      alert('Session signer not available');
      return;
    }

    if (!providerAddress || !evaluatorAddress) {
      alert('Please enter both provider and evaluator addresses');
      return;
    }

    // Validate addresses
    if (!providerAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      alert('Invalid provider address format');
      return;
    }
    if (!evaluatorAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      alert('Invalid evaluator address format');
      return;
    }

    setIsCreating(true);
    setJobResult(null);

    try {
      // Use ACP SDK to create job
      const response = await fetch('/api/acp/initiate-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerAddress,
          evaluatorAddress,
          serviceRequirement: serviceRequirement || 'Complete the requested task',
          amount: parseFloat(jobAmount),
          expirationHours: parseInt(expirationHours),
          agentWalletAddress: agentWallet.address,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create job');
      }

      const result = await response.json();
      setJobResult(result);

      alert(`Job created successfully!\nJob ID: ${result.jobId}${result.txHash ? `\nTx Hash: ${result.txHash}` : ''}`);
      
      // Reset form
      setProviderAddress('');
      setEvaluatorAddress('');
      setServiceRequirement('');
      setJobAmount('0.001');
      setExpirationHours('24');
    } catch (error: any) {
      console.error('Job creation error:', error);
      alert(`Failed to create job: ${error.message || 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Create ACP Job</h3>
        <button
          onClick={() => {
            setShowAgentBrowser(true);
            browseAgents(searchKeyword);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Browse Agents
        </button>
      </div>

      {/* Agent Browser Modal */}
      {showAgentBrowser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Browse Agents</h3>
              <button
                onClick={() => setShowAgentBrowser(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Search agents..."
                className="flex-1 px-3 py-2 border rounded"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    browseAgents(searchKeyword);
                  }
                }}
              />
              <button
                onClick={() => browseAgents(searchKeyword)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Search
              </button>
            </div>

            {/* Agent Type Selection */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700">
                Selecting for:
              </label>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setSelectedAgentType('provider')}
                  className={`px-3 py-1 rounded ${
                    selectedAgentType === 'provider'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  Provider
                </button>
                <button
                  onClick={() => setSelectedAgentType('evaluator')}
                  className={`px-3 py-1 rounded ${
                    selectedAgentType === 'evaluator'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  Evaluator
                </button>
              </div>
            </div>

            {/* Agents List */}
            {loadingAgents ? (
              <div className="text-center py-8">Loading agents...</div>
            ) : agents.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => selectAgent(agent, selectedAgentType)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold">{agent.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {agent.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="font-mono">
                            {agent.walletAddress.slice(0, 8)}...
                          </span>
                          {agent.metrics?.totalJobs && (
                            <span>Jobs: {agent.metrics.totalJobs}</span>
                          )}
                          {agent.metrics?.avgRating && (
                            <span>Rating: {agent.metrics.avgRating}/5</span>
                          )}
                          {agent.twitterHandle && (
                            <span>@{agent.twitterHandle}</span>
                          )}
                        </div>
                        {agent.offerings && agent.offerings.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-gray-600">Services: </span>
                            {agent.offerings.map((offer, idx) => (
                              <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded mr-1">
                                {offer.name} ({offer.price} ETH)
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No agents found. Try a different search keyword.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Job Parameters */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Provider Address
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={providerAddress}
              onChange={(e) => setProviderAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 px-3 py-2 border rounded font-mono text-sm"
              disabled={isCreating}
            />
            <button
              onClick={() => {
                setSelectedAgentType('provider');
                setShowAgentBrowser(true);
              }}
              className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              Browse
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Evaluator Address
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={evaluatorAddress}
              onChange={(e) => setEvaluatorAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 px-3 py-2 border rounded font-mono text-sm"
              disabled={isCreating}
            />
            <button
              onClick={() => {
                setSelectedAgentType('evaluator');
                setShowAgentBrowser(true);
              }}
              className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
            >
              Browse
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Service Requirement
          </label>
          <textarea
            value={serviceRequirement}
            onChange={(e) => setServiceRequirement(e.target.value)}
            placeholder="Describe the task or service required..."
            className="w-full px-3 py-2 border rounded text-sm"
            rows={3}
            disabled={isCreating}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Job Amount (ETH)
          </label>
          <input
            type="number"
            value={jobAmount}
            onChange={(e) => setJobAmount(e.target.value)}
            step="0.001"
            min="0"
            placeholder="0.001"
            className="w-full px-3 py-2 border rounded text-sm"
            disabled={isCreating}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expiration (hours)
          </label>
          <input
            type="number"
            value={expirationHours}
            onChange={(e) => setExpirationHours(e.target.value)}
            min="1"
            placeholder="24"
            className="w-full px-3 py-2 border rounded text-sm"
            disabled={isCreating}
          />
        </div>
      </div>

      {/* Create Job Button */}
      <button
        onClick={handleCreateJob}
        disabled={isCreating || !providerAddress || !evaluatorAddress}
        className={`w-full py-3 rounded font-medium ${
          isCreating || !providerAddress || !evaluatorAddress
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        {isCreating ? 'Creating Job...' : 'Create Job'}
      </button>

      {/* Job Result */}
      {jobResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <h4 className="font-medium text-green-900 mb-2">Job Created Successfully!</h4>
          <div className="text-sm space-y-1">
            <p>Job ID: <span className="font-mono">{jobResult.jobId}</span></p>
            <p>Tx Hash: <span className="font-mono text-xs">{jobResult.txHash}</span></p>
          </div>
        </div>
      )}
    </div>
  );
}