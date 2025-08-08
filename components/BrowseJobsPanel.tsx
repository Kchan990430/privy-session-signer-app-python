import { useState } from 'react';
import { Address } from 'viem';
import { BalanceDisplay } from './BalanceDisplay';

interface BrowseJobsPanelProps {
  agentWallet: {
    agentId: string;
    walletAddress: Address;
    walletId: string;
    name: string;
  };
}

export function BrowseJobsPanel({ agentWallet }: BrowseJobsPanelProps) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const browseJobs = async () => {
    setIsBrowsing(true);
    try {
      const response = await fetch('/api/agent-wallets/browse-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: agentWallet.walletId,
          walletAddress: agentWallet.walletAddress,
          limit: 20
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setJobs(data.data.jobs);
        setResult({
          success: true,
          message: `Found ${data.data.count} jobs`
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to browse jobs');
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setIsBrowsing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          📋 Browse Jobs for Agent Wallet
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          View jobs related to this agent wallet (created by or assigned to)
        </p>
        <div className="mt-2 text-xs text-gray-500">
          Agent: {agentWallet.name} | Balance: <BalanceDisplay address={agentWallet.walletAddress} />
        </div>
      </div>

      <div className="mb-4">
        <button
          onClick={browseJobs}
          disabled={isBrowsing}
          className={`px-4 py-2 rounded ${
            isBrowsing 
              ? 'bg-gray-300 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isBrowsing ? 'Loading Jobs...' : '🔍 Load Jobs'}
        </button>
      </div>

      {/* Result Display */}
      {result && (
        <div className={`mb-4 p-3 rounded-lg ${
          result.success 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`text-sm font-medium ${
            result.success ? 'text-green-800' : 'text-red-800'
          }`}>
            {result.success ? '✅' : '❌'} {result.message || result.error}
          </p>
        </div>
      )}

      {/* Jobs List */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Jobs ({jobs.length})</h4>
          
          {jobs.map((job, idx) => (
            <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <h5 className="font-medium">Job #{job.id || idx + 1}</h5>
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(job.status)}`}>
                    {job.status || 'Unknown'}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'Unknown date'}
                </div>
              </div>
              
              <div className="text-sm space-y-1">
                {job.requirement && (
                  <div>
                    <span className="text-gray-600">Requirement:</span>
                    <p className="mt-1 text-gray-800 bg-gray-50 p-2 rounded text-xs">
                      {job.requirement}
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 mt-2">
                  {job.provider && (
                    <div>
                      <span className="text-gray-600">Provider:</span>
                      <code className="text-xs font-mono block">
                        {job.provider.slice(0, 10)}...{job.provider.slice(-8)}
                      </code>
                    </div>
                  )}
                  
                  {job.requester && (
                    <div>
                      <span className="text-gray-600">Requester:</span>
                      <code className="text-xs font-mono block">
                        {job.requester.slice(0, 10)}...{job.requester.slice(-8)}
                      </code>
                    </div>
                  )}
                  
                  {job.amount && (
                    <div>
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-mono text-sm">{job.amount} BMW</span>
                    </div>
                  )}
                  
                  {job.evaluator && (
                    <div>
                      <span className="text-gray-600">Evaluator:</span>
                      <code className="text-xs font-mono block">
                        {job.evaluator.slice(0, 10)}...{job.evaluator.slice(-8)}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {jobs.length === 0 && result && result.success && (
        <div className="text-center py-8 text-gray-500">
          <p>No jobs found for this agent wallet.</p>
          <p className="text-xs mt-1">
            Jobs will appear here when you create them or when other agents assign jobs to this wallet.
          </p>
        </div>
      )}
    </div>
  );
}