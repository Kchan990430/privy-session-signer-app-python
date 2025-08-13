import { useState, useEffect } from 'react';
import { usePrivy, useWallets, WalletWithMetadata } from '@privy-io/react-auth';
import { usePrivyAgentWallets } from '../hooks/usePrivyAgentWallets';
import { useAuthKeyRestore } from '../hooks/useAuthKeyRestore';
// import { useAutoAuthKeySetup } from '../hooks/useAutoAuthKeySetup'; // Disabled - was causing excessive API calls
import { TransferFundsPanelSDK } from './TransferFundsPanelSDK';
import { CreateJobPanelSDK } from './CreateJobPanelSDK';
import { BrowseJobsPanel } from './BrowseJobsPanel';
import { WalletComparisonPanel } from './WalletComparisonPanel';
import { SessionSignerPanel } from './SessionSignerPanel';
import { BalanceDisplay } from './BalanceDisplay';
import { CopyButton } from './CopyButton';
import DashboardWalletCard from './DashboardWalletCard';
import { parseEther, Address } from 'viem';
import { baseSepolia } from 'viem/chains';
import { AuthKeyStorage } from '../utils/authKeyStorage';

type TabType = 'overview' | 'transfer' | 'create-job' | 'browse-jobs' | 'operations' | 'comparison' | 'session-signer';

export function AgentWalletDashboardSDK() {
  const { authenticated, logout, user } = usePrivy();
  const { wallets } = useWallets();
  // Restore auth keys from localStorage on startup
  const { restored: authKeysRestored, restoring: authKeysRestoring, error: authKeyError } = useAuthKeyRestore();
  // AUTO-SETUP DISABLED: Was causing excessive API calls and errors with Privy
  // const { setupStatus } = useAutoAuthKeySetup(); 
  const setupStatus = {}; // Empty status for now
  const { 
    agentWallets,
    primaryWallet,
    loading,
    error,
    ready,
    createAgentWallet,
    signMessageAsAgent,
    transferFundsFromAgent,
    getAgentBalance,
    getSessionSigner
  } = usePrivyAgentWallets();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Force refresh of wallet list
  const handleWalletUpdate = () => {
    // Trigger re-render of wallet cards
    // The wallet list will refresh automatically through Privy hooks
  };

  // Update selected agent when agentWallets change
  useEffect(() => {
    if (selectedAgent && agentWallets.length > 0) {
      const updated = agentWallets.find(w => w.id === selectedAgent.id);
      if (updated) {
        setSelectedAgent(updated);
      }
    }
  }, [agentWallets, selectedAgent]);

  const handleCreateAgent = async () => {
    setIsCreating(true);
    try {
      console.log('Creating user-owned wallet with SDK (includes auth key)...');
      
      // Log frontend user info for comparison with backend
      console.log('👤 Frontend user info:', {
        userId: user?.id,
        userIdType: typeof user?.id,
        userIdLength: user?.id?.length,
        userEmail: user?.email?.address,
        walletCount: wallets?.length || 0,
        walletAddresses: wallets?.map(w => w.address) || []
      });
      
      // Use SDK to create wallet with auth key included
      console.log('🚀 Making API call to create wallet...');
      
      const response = await fetch('/api/agent-wallets/create-with-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chainType: 'ethereum',
          userId: user?.id || null,
          serverControlled: false // Always create user-linked wallets
        })
      });

      console.log('📡 API call completed. Status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('📋 API Response status:', response.status);
      console.log('📋 API Response data:', data);

      if (response.ok) {
        console.log('✅ Wallet created successfully, processing response...');
        console.log('Full response data:', data);
        
        // Save auth configuration to localStorage if provided
        if (data.authConfig) {
          console.log('Saving auth config to localStorage:', {
            walletId: data.walletId,
            walletAddress: data.address,
            authConfigKeys: Object.keys(data.authConfig),
            authConfig: data.authConfig
          });
          
          // Save with multiple ID formats to ensure compatibility
          AuthKeyStorage.save(data.walletId, data.authConfig);
          AuthKeyStorage.save(data.address, data.authConfig);
          AuthKeyStorage.save(`agent-${data.address}`, data.authConfig);
          
          console.log('✅ Auth configuration saved to localStorage with multiple IDs');
          console.log('- Saved with walletId:', data.walletId);
          console.log('- Saved with address:', data.address);
          console.log('- Saved with agent-address:', `agent-${data.address}`);
          
          // Verify it was saved with multiple methods
          const saved1 = AuthKeyStorage.get(data.walletId);
          const saved2 = AuthKeyStorage.get(data.address);
          const saved3 = AuthKeyStorage.get(`agent-${data.address}`);
          
          console.log('Verification - Auth config saved successfully:', {
            'by walletId': saved1 ? 'Yes' : 'No',
            'by address': saved2 ? 'Yes' : 'No', 
            'by agent-address': saved3 ? 'Yes' : 'No'
          });
          
          // Double-check localStorage directly
          const allStored = AuthKeyStorage.getAll();
          console.log('All stored auth configs after save:', Object.keys(allStored));
          console.log(`Total auth configs in localStorage: ${Object.keys(allStored).length}`);
        } else {
          console.error('❌ No authConfig found in response!');
          console.log('Response data:', data);
        }
        
        alert(`✅ User-owned wallet created successfully with auth key!\n\nAddress: ${data.address}\nWallet ID: ${data.walletId}\nAuth Key ID: ${data.authKeyId}\n\nReady for backend transactions without user approval!\n\nAuth keys saved to localStorage for backend transfers.`);
        
        // Wait longer before refresh to ensure localStorage saving is complete
        console.log('🔄 Waiting 3 seconds before page refresh to ensure localStorage is saved...');
        setTimeout(() => {
          console.log('🔄 Refreshing page now...');
          window.location.reload();
        }, 3000); // Increased from 1.5s to 3s
      } else {
        throw new Error(data.error || 'Failed to create wallet');
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
        
        {/* Auth Key Restoration Status */}
        {authKeysRestoring && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">🔄 Restoring auth keys from localStorage...</p>
          </div>
        )}
        
        {authKeysRestored && !authKeysRestoring && !authKeyError && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">✅ Auth keys restored from localStorage</p>
          </div>
        )}
        
        {authKeyError && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">⚠️ Auth key restore error: {authKeyError}</p>
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
                  {agent.hasSessionSigner && (
                    <span className="inline-block mt-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      ✓ Session Signer
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
                  onClick={() => setActiveTab('session-signer')}
                  className={`px-6 py-3 font-medium ${
                    activeTab === 'session-signer'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Session Signer
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
                <button
                  onClick={() => setActiveTab('operations')}
                  className={`px-6 py-3 font-medium ${
                    activeTab === 'operations'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Test Operations
                </button>
                <button
                  onClick={() => setActiveTab('comparison')}
                  className={`px-6 py-3 font-medium ${
                    activeTab === 'comparison'
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Wallet Types
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
                  
                  {/* All Wallets Section */}
                  <div>
                    <h3 className="text-lg font-bold mb-4">All Wallets</h3>
                    <div className="space-y-3">
                      {/* Primary Wallet */}
                      {primaryWallet && (
                        <DashboardWalletCard 
                          key={`primary-${primaryWallet.address}`}
                          wallet={primaryWallet as unknown as WalletWithMetadata} 
                          isPrimary={true}
                          onUpdate={handleWalletUpdate}
                        />
                      )}
                      
                      {/* Other Wallets */}
                      {wallets
                        .filter(w => primaryWallet ? w.address !== primaryWallet.address : true)
                        .map((wallet) => (
                          <DashboardWalletCard 
                            key={wallet.address}
                            wallet={wallet as unknown as WalletWithMetadata}
                            isPrimary={false}
                            onUpdate={handleWalletUpdate}
                          />
                        ))}
                    </div>
                    
                    {wallets.length === 0 && (
                      <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-600">
                        No wallets found. Create one to get started.
                      </div>
                    )}
                  </div>
                  
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

              {activeTab === 'session-signer' && (
                <SessionSignerPanel
                  agentWallet={selectedAgent}
                />
              )}

              {activeTab === 'create-job' && (
                <CreateJobPanelSDK
                  agentWallet={selectedAgent}
                  getSessionSigner={() => getSessionSigner(selectedAgent.id)}
                />
              )}

              {activeTab === 'browse-jobs' && (
                <BrowseJobsPanel
                  agentWallet={selectedAgent}
                />
              )}

              {activeTab === 'operations' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Test Operations & Debug</h3>
                  <p className="text-sm text-gray-600">
                    Test agent wallet operations and debug wallet creation
                  </p>
                  
                  {/* Debug Section */}
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                    <h4 className="font-medium text-yellow-900 mb-2">Debug Information</h4>
                    <div className="text-sm text-yellow-800 space-y-1">
                      <p>Total Wallets: {wallets.length}</p>
                      <p>Agent Wallets: {agentWallets.length}</p>
                      <p>Primary Wallet: {primaryWallet?.address?.slice(0, 10) || 'None'}... ({primaryWallet?.walletClientType || 'N/A'})</p>
                      <p>Wallets Ready: {ready ? 'Yes' : 'No'}</p>
                      {error && <p className="text-red-600">Last Error: {error}</p>}
                      <details className="mt-2">
                        <summary className="cursor-pointer font-medium">All Wallets Details</summary>
                        <div className="mt-1 space-y-1 text-xs">
                          {wallets.map((w, i) => (
                            <div key={i} className="pl-2">
                              {i+1}. {w.address.slice(0, 10)}... - Type: {w.walletClientType} {w.connectorType && `(${w.connectorType})`}
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                    <div className="mt-3 space-x-2">
                      <button
                        onClick={() => {
                          console.log('All wallets:', wallets);
                          console.log('Agent wallets:', agentWallets);
                          console.log('Session signers:', getSessionSigner);
                          alert('Check browser console for debug info');
                        }}
                        className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                      >
                        Log Debug Info
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            // Try to create without any parameters
                            const wallet = await createAgentWallet();
                            console.log('Created wallet:', wallet);
                            if (wallet) {
                              alert(`Success! Wallet created: ${wallet.address}`);
                            }
                          } catch (err: any) {
                            console.error('Direct creation failed:', err);
                            alert(`Failed: ${err.message}`);
                          }
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        Force Try Create
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={async () => {
                        try {
                          const balance = await getAgentBalance(selectedAgent.id);
                          alert(`Agent balance: ${balance?.toString() || '0'} wei`);
                        } catch (error: any) {
                          alert(`Balance check failed: ${error.message}`);
                        }
                      }}
                      className="p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <p className="font-medium">Check Balance</p>
                      <p className="text-sm text-gray-600 mt-1">Get agent wallet balance</p>
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          const signer = getSessionSigner(selectedAgent.id);
                          alert(`Has session signer: ${!!signer}\nAddress: ${signer?.address || 'N/A'}`);
                        } catch (error: any) {
                          alert(`Check failed: ${error.message}`);
                        }
                      }}
                      className="p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <p className="font-medium">Verify Session Signer</p>
                      <p className="text-sm text-gray-600 mt-1">Check session signer status</p>
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          const timestamp = new Date().toISOString();
                          const message = `Session signer test at ${timestamp}`;
                          const signature = await signMessageAsAgent(selectedAgent.id, message);
                          alert(`Signed: "${message}"\n\nSignature: ${signature?.slice(0, 50) || ''}...`);
                        } catch (error: any) {
                          alert(`Signing failed: ${error.message}`);
                        }
                      }}
                      className="p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <p className="font-medium">Sign Timestamp</p>
                      <p className="text-sm text-gray-600 mt-1">Sign with session signer</p>
                    </button>

                    <button
                      onClick={async () => {
                        const signer = getSessionSigner(selectedAgent.id);
                        if (signer) {
                          alert('Session signer is ready for AcpContractClient integration');
                        } else {
                          alert('No session signer found');
                        }
                      }}
                      className="p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <p className="font-medium">ACP Integration Ready</p>
                      <p className="text-sm text-gray-600 mt-1">Check ACP compatibility</p>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'comparison' && (
                <WalletComparisonPanel primaryWalletAddress={primaryWallet?.address as Address} />
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">✅ Session Signer Architecture</h4>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• User-owned wallets with createAdditional parameter</li>
              <li>• Session signers wrap Privy SDK wallet instances</li>
              <li>• Compatible with AcpContractClient via SessionSigner interface</li>
              <li>• All transactions signed through Privy SDK (no REST API)</li>
              <li>• Wallet password required for transaction signing</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}