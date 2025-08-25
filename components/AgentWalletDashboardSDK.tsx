import { useState, useEffect } from 'react';
import { usePrivy, useWallets, useCreateWallet, WalletWithMetadata } from '@privy-io/react-auth';
import { usePrivyAgentWallets } from '../hooks/usePrivyAgentWallets';
// import { useAutoAuthKeySetup } from '../hooks/useAutoAuthKeySetup'; // Disabled - was causing excessive API calls
import { TransferFundsPanelSDK } from './TransferFundsPanelSDK';
import { CreateJobPanelSDK } from './CreateJobPanelSDK';
import { CreateJobPanelSDKPython } from './CreateJobPanelSDKPython';
import { DebugWallets } from './DebugWallets';
import { BrowseJobsPanel } from './BrowseJobsPanel';
import { BalanceDisplay } from './BalanceDisplay';
import { CopyButton } from './CopyButton';
import SimpleWalletCard from './SimpleWalletCard';
import { parseEther, Address } from 'viem';
import { baseSepolia } from 'viem/chains';

type TabType = 'overview' | 'transfer' | 'create-job' | 'browse-jobs';

export function AgentWalletDashboardSDK() {
  const { authenticated, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { createWallet} = useCreateWallet();
  // Auth keys are no longer stored in localStorage for security
  // AUTO-SETUP DISABLED: Was causing excessive API calls and errors with Privy
  // const { setupStatus } = useAutoAuthKeySetup(); 
  const setupStatus = {}; // Empty status for now
  const { 
    agentWallets,
    primaryWallet,
    loading,
    error,
    ready,
    signMessageAsAgent,
    transferFundsFromAgent
  } = usePrivyAgentWallets();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  

  // Update selected agent when agentWallets change
  useEffect(() => {
    if (selectedAgent && agentWallets.length > 0) {
      const updated = agentWallets.find(w => w.id === selectedAgent.id);
      if (updated) {
        setSelectedAgent(updated);
      }
    }
  }, [agentWallets, selectedAgent]);

  // Debug: Check actual wallet status
  useEffect(() => {
    const checkWallets = async () => {
      if (user?.id) {
        try {
          const response = await fetch('/api/debug/check-wallets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id })
          });
          if (response.ok) {
            const data = await response.json();
            setDebugInfo(data);
            console.log('Debug wallet info:', data);
          }
        } catch (error) {
          console.error('Failed to get debug info:', error);
        }
      }
    };
    checkWallets();
  }, [user?.id, wallets]);

  const handleCreateAgent = async () => {
    setIsCreating(true);
    try {
      console.log('Creating new embedded wallet using Privy SDK...');
      
      // Check current wallet count
      const embeddedWallets = wallets.filter(w => w.walletClientType === 'privy');
      console.log('Current embedded wallets:', embeddedWallets.length);
      
      if (embeddedWallets.length >= 10) {
        alert(`Cannot create more wallets. You have ${embeddedWallets.length} embedded wallets (max 10).`);
        setIsCreating(false);
        return;
      }
      
      // Create wallet using Privy SDK directly
      console.log('🚀 Creating new wallet with Privy SDK...');
      
      const newWallet = await createWallet({
        createAdditional: true
      });
      console.log('Create wallet result:', newWallet);

      if (newWallet) {
        console.log('✅ Wallet created successfully:', newWallet.address);
        
        alert(`✅ Wallet created successfully!\n\nAddress: ${newWallet.address}\n\nTo enable backend transactions, use the 'Setup Auth Key' button to generate authorization keys.`);
        
        // The wallet list will automatically update via the useWallets hook
        // No need to reload the page
      } else {
        throw new Error('Failed to create wallet - no wallet returned');
      }
    } catch (error: any) {
      console.error('❌ Wallet creation failed with error:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      if (error.message?.includes('TEE execution') || error.message?.includes('on-device execution')) {
        const detailedMessage = `Cannot create additional wallets with TEE execution mode.

This limitation occurs because:
- Your app is configured to use TEE (Trusted Execution Environment) for wallet operations
- TEE mode doesn't support creating additional embedded wallets
- Only on-device execution supports multiple wallets per user

Solutions:
1. Use your primary wallet as an agent wallet (recommended for testing)
2. Configure your Privy app to use on-device execution instead of TEE
3. Use backend-managed unowned wallets for agent operations

Would you like to use your primary wallet as an agent instead?`;
          
          if (confirm(detailedMessage)) {
            // Use primary wallet as agent
            if (primaryWallet) {
              setSelectedAgent({
                id: `primary-${primaryWallet.address}`,
                address: primaryWallet.address as Address,
                name: 'Primary Wallet (as Agent)',
                description: 'Using primary wallet for agent operations',
                createdAt: new Date(),
                hasSessionSigner: true,
                chainId: baseSepolia.id,
              });
            }
          }
        } else {
          alert(`Failed to create agent wallet:\n${error.message || error}`);
        }
    } finally {
      setIsCreating(false);
    }
  };

  const fundAgent = async (amountEth: string = '0.001') => {
    if (!selectedAgent || !primaryWallet) return;
    
    try {
      const provider = await primaryWallet.getEthereumProvider();
      const amount = parseEther(amountEth);
      
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: primaryWallet.address,
          to: selectedAgent.address,
          value: `0x${amount.toString(16)}`,
        }],
      });
      
      alert(`Funding transaction sent: ${txHash}\nAmount: ${amountEth} ETH`);
    } catch (error: any) {
      alert(`Funding failed: ${error.message}`);
    }
  };

  if (!authenticated) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Please login to access the Agent Wallet Dashboard</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">Loading wallets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">🤖 Agent Wallet Dashboard (Privy SDK)</h1>
            <p className="text-gray-600">User-owned agent wallets with session signers</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            🚪 Logout
          </button>
        </div>
        
        {/* User Info */}
        <div className="p-3 bg-gray-50 rounded-lg text-sm">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-gray-600">Primary Wallet:</span>
              <code className="ml-2 font-mono">
                {primaryWallet?.address.slice(0, 10)}...{primaryWallet?.address.slice(-8)}
              </code>
              <CopyButton text={primaryWallet?.address || ''} className="ml-2" successText="✓" />
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                {primaryWallet?.walletClientType === 'privy' ? 'Embedded' : primaryWallet?.walletClientType || 'EOA'}
              </span>
            </div>
            <div>
              Balance: <BalanceDisplay address={primaryWallet?.address} />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">Error: {error}</p>
          </div>
        )}
        
      </div>

      {/* Agent Selection */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Agent Wallet Options</h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleCreateAgent()}
              disabled={isCreating || loading}
              className={`px-4 py-2 rounded ${
                isCreating || loading
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isCreating ? 'Creating...' : '+ User Wallet'}
            </button>
          </div>
        </div>

        {/* Use Primary Wallet Option */}
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Use Your Primary Wallet as Agent</h3>
          <p className="text-sm text-blue-700 mb-3">
            Due to TEE execution mode, additional wallets cannot be created. You can use your primary wallet for testing ACP operations.
          </p>
          <button
            onClick={() => {
              if (primaryWallet) {
                setSelectedAgent({
                  id: `primary-${primaryWallet.address}`,
                  address: primaryWallet.address as Address,
                  name: 'Primary Wallet (as Agent)',
                  description: 'Using primary wallet for agent operations',
                  createdAt: new Date(),
                  hasSessionSigner: true,
                  chainId: baseSepolia.id,
                });
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Use Primary Wallet
          </button>
        </div>

        {agentWallets.length === 0 && !selectedAgent ? (
          <div className="text-center py-8 text-gray-500">
            <p>No additional agent wallets available.</p>
            <p className="text-sm mt-2">Use your primary wallet above or switch to backend-managed wallets.</p>
            {debugInfo && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-left text-xs">
                <p className="font-semibold">Debug Info:</p>
                <p>Total Embedded Wallets: {debugInfo.embeddedWallets.count}</p>
                <p>Total EOA Wallets: {debugInfo.eoaWallets.count}</p>
                <p>Can Create More: {debugInfo.embeddedWallets.canCreateMore ? 'Yes' : 'No'}</p>
                {debugInfo.embeddedWallets.wallets.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold">Embedded Wallets Found:</p>
                    {debugInfo.embeddedWallets.wallets.map((w: any, i: number) => (
                      <p key={i} className="font-mono">{w.address}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agentWallets.map((agent) => (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedAgent?.id === agent.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <h3 className="font-medium">{agent.name}</h3>
                <div className="text-sm text-gray-600 mt-1">
                  <p>ID: {agent.id}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs font-mono">{agent.address.slice(0, 10)}...</code>
                    <CopyButton text={agent.address} successText="✓" />
                  </div>
                  <p className="mt-1">
                    Balance: <BalanceDisplay address={agent.address} />
                  </p>
                  {agent.hasSessionSigner ? (
                    <span className="inline-block mt-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      ✓ Auth Ready
                    </span>
                  ) : (
                    <span className="inline-block mt-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                      ⚠️ Auth Key Required
                    </span>
                  )}
                </div>
                {selectedAgent?.id === agent.id && (
                  <div className="mt-2">
                    <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Selected</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Operations Tabs */}
      {selectedAgent && (
        <>
          <div className="bg-white shadow rounded-lg">
            <div className="border-b">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-6 py-3 font-medium ${
                    activeTab === 'overview'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('transfer')}
                  className={`px-6 py-3 font-medium ${
                    activeTab === 'transfer'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Transfer Funds
                </button>
                <button
                  onClick={() => setActiveTab('create-job')}
                  className={`px-6 py-3 font-medium ${
                    activeTab === 'create-job'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Create Job
                </button>
                <button
                  onClick={() => setActiveTab('browse-jobs')}
                  className={`px-6 py-3 font-medium ${
                    activeTab === 'browse-jobs'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Browse Jobs
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Auto Setup Status */}
                  {Object.keys(setupStatus).length > 0 && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="text-sm font-semibold text-blue-800 mb-2">🔐 Automatic Auth Key Setup</h4>
                      <div className="space-y-1">
                        {Object.entries(setupStatus).map(([walletId, status]) => {
                          const wallet = wallets.find(w => (w as any).id === walletId || w.address === walletId);
                          return (
                            <div key={walletId} className="text-xs text-blue-700">
                              {wallet ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : walletId.slice(0, 8)}...: 
                              {status === 'success' && ' ✅ Auth key created automatically'}
                              {status === 'existing' && ' ✔️ Already configured'}
                              {status === 'setting-up' && ' ⏳ Setting up...'}
                              {status === 'failed' && ' ❌ Failed to create'}
                              {status === 'error' && ' ⚠️ Error occurred'}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-blue-600 mt-2">New wallets are automatically configured with auth keys</p>
                    </div>
                  )}
                  
                  {/* Selected Wallet Info */}
                  {selectedAgent && (
                    <div className="mt-6">
                      <h3 className="text-lg font-bold mb-4">Selected Wallet Details</h3>
                      <SimpleWalletCard 
                        wallet={{
                          address: selectedAgent.address,
                          walletClientType: 'privy',
                          delegated: selectedAgent.hasSessionSigner,
                          ...selectedAgent
                        } as unknown as WalletWithMetadata}
                      />
                    </div>
                  )}
                  
                  {/* Agent Overview Section */}
                  {selectedAgent && (
                    <>
                      <hr className="border-gray-200" />
                      <h3 className="text-lg font-bold">Selected Agent Overview</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Agent Name</p>
                      <p className="font-medium">{selectedAgent.name}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Agent ID</p>
                      <p className="font-mono text-sm">{selectedAgent.id}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Wallet Address</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono">{selectedAgent.address}</code>
                        <CopyButton text={selectedAgent.address} successText="✓" />
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Balance</p>
                      <p className="font-medium">
                        <BalanceDisplay address={selectedAgent.address} />
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">Quick Fund Options:</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => fundAgent('0.0001')}
                        className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        💰 0.0001 ETH
                      </button>
                      <button
                        onClick={() => fundAgent('0.01')}
                        className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        💰 0.01 ETH
                      </button>
                      <button
                        onClick={() => fundAgent('0.1')}
                        className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                      >
                        💰 0.1 ETH
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const message = `Test message from ${selectedAgent.name}`;
                            const signature = await signMessageAsAgent(selectedAgent.id, message);
                            alert(`Message signed! Signature: ${signature?.slice(0, 20) || ''}...`);
                          } catch (error: any) {
                            alert(`Signing failed: ${error.message}`);
                          }
                        }}
                        className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                      >
                        ✍️ Test Sign
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      💡 This is a user-owned wallet with session signers. Transactions are signed 
                      through the Privy SDK using your wallet password.
                    </p>
                  </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'transfer' && (
                <TransferFundsPanelSDK
                  agentWallet={selectedAgent}
                  primaryWalletAddress={primaryWallet?.address as Address}
                  onTransfer={transferFundsFromAgent}
                />
              )}


              {activeTab === 'create-job' && (
                <CreateJobPanelSDKPython
                  agentWallet={selectedAgent}
                />
              )}

              {activeTab === 'browse-jobs' && (
                <BrowseJobsPanel
                  agentWallet={selectedAgent}
                />
              )}


            </div>
          </div>

          {/* Info Box */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">✅ Backend Transfer System</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• User-owned wallets with authorization keys</li>
              <li>• Backend transfers without user approval</li>
              <li>• Per-wallet unique P-256 keypairs</li>
              <li>• Auth keys stored in localStorage for persistence</li>
              <li>• Compatible with ACP protocol for agent operations</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}