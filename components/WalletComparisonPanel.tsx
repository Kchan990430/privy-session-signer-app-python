import { useState } from 'react';
import { Address, parseEther } from 'viem';

export function WalletComparisonPanel({ primaryWalletAddress }: { primaryWalletAddress?: Address }) {
  const [unownedWallet, setUnownedWallet] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const createUnownedWallet = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/agent-wallets/create-unowned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Autonomous Agent',
          description: 'Backend-controlled wallet for autonomous operations'
        }),
      });

      if (!response.ok) throw new Error('Failed to create wallet');
      
      const wallet = await response.json();
      setUnownedWallet(wallet);
      alert(`Unowned wallet created!\nAddress: ${wallet.address}\n\nThis wallet can execute transactions WITHOUT user approval.`);
    } catch (error: any) {
      alert(`Failed to create unowned wallet: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const transferFromUnowned = async () => {
    if (!unownedWallet || !primaryWalletAddress) return;
    
    setTransferring(true);
    try {
      const response = await fetch('/api/agent-wallets/transfer-unowned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: unownedWallet.id,
          toAddress: primaryWalletAddress,
          amountWei: parseEther('0.0001').toString(), // 0.0001 ETH
        }),
      });

      if (!response.ok) throw new Error('Failed to transfer');
      
      const result = await response.json();
      alert(`Transfer completed WITHOUT user approval!\nTx Hash: ${result.txHash}`);
    } catch (error: any) {
      alert(`Transfer failed: ${error.message}`);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Wallet Types Comparison</h3>
      
      {/* Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Feature</th>
              <th className="border p-2 text-left">User-Owned (with Session Signer)</th>
              <th className="border p-2 text-left">Unowned (Backend)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-2 font-medium">Ownership</td>
              <td className="border p-2">User owns the wallet</td>
              <td className="border p-2">App owns the wallet</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border p-2 font-medium">Transaction Approval</td>
              <td className="border p-2 text-red-600">❌ Requires user approval</td>
              <td className="border p-2 text-green-600">✅ No approval needed</td>
            </tr>
            <tr>
              <td className="border p-2 font-medium">Session Signers</td>
              <td className="border p-2">Can add session signers (for pre-signing)</td>
              <td className="border p-2">Not needed (app controls directly)</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border p-2 font-medium">Autonomous Operations</td>
              <td className="border p-2 text-red-600">❌ Limited (user must approve)</td>
              <td className="border p-2 text-green-600">✅ Fully autonomous</td>
            </tr>
            <tr>
              <td className="border p-2 font-medium">Security</td>
              <td className="border p-2">User retains control</td>
              <td className="border p-2">App has full control</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border p-2 font-medium">Use Case</td>
              <td className="border p-2">User wallets, DeFi</td>
              <td className="border p-2">Agent wallets, automation</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Unowned Wallet Demo */}
      <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
        <h4 className="font-bold text-green-900 mb-2">Unowned Wallet (Autonomous)</h4>
        
        {!unownedWallet ? (
          <div>
            <p className="text-sm text-green-700 mb-3">
              Create an unowned wallet that can execute transactions without user approval.
            </p>
            <button
              onClick={createUnownedWallet}
              disabled={creating}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
            >
              {creating ? 'Creating...' : 'Create Unowned Wallet'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm">
              <p><strong>Address:</strong> {unownedWallet.address}</p>
              <p><strong>ID:</strong> {unownedWallet.id}</p>
              <p className="text-green-600 font-medium mt-1">✅ Can transfer without approval</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={transferFromUnowned}
                disabled={transferring || !primaryWalletAddress}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {transferring ? 'Transferring...' : 'Test Transfer (No Approval)'}
              </button>
              <p className="text-xs text-gray-600 self-center">
                Will transfer 0.0001 ETH to your primary wallet
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Explanation */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">💡 Key Insight</h4>
        <p className="text-sm text-blue-800">
          <strong>User-owned wallets with session signers</strong> still require user approval because the user owns the wallet.
          Session signers can pre-sign transactions but cannot bypass user consent.
        </p>
        <p className="text-sm text-blue-800 mt-2">
          <strong>Unowned wallets</strong> are controlled entirely by your app's credentials, allowing autonomous operations
          without any user interaction. Perfect for agent wallets that need to operate independently.
        </p>
      </div>
    </div>
  );
}