import { useState } from 'react';
import { Address, Hash } from 'viem';
import { usePrivy } from '@privy-io/react-auth';
import { parseEther } from 'viem';

interface TransferFundsPanelSDKProps {
  agentWallet: {
    id: string;
    address: Address;
    name: string;
  };
  primaryWalletAddress: Address;
  onTransfer: (agentId: string, toAddress: Address, amountEth: string) => Promise<Hash | null>;
}

export function TransferFundsPanelSDK({ 
  agentWallet, 
  primaryWalletAddress,
  onTransfer 
}: TransferFundsPanelSDKProps) {
  const [transferDirection, setTransferDirection] = useState<'to-agent' | 'from-agent'>('from-agent');
  const [amount, setAmount] = useState('0.001');
  const [customAddress, setCustomAddress] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleTransfer = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsTransferring(true);
    setTxHash(null);

    try {
      let hash: Hash | null = null;
      
      if (transferDirection === 'from-agent') {
        // Transfer from agent to user or custom address
        const toAddress = customAddress || primaryWalletAddress;
        if (!toAddress) {
          alert('Please enter a recipient address');
          return;
        }
        
        hash = await onTransfer(agentWallet.id, toAddress as Address, amount);
      } else {
        // Transfer from user to agent (handled by primary wallet)
        alert('Use the fund options in the Overview tab to send funds to the agent');
        return;
      }

      if (hash) {
        setTxHash(hash);
        alert(`Transfer successful! Transaction hash: ${hash}`);
        setAmount('0.001');
        setCustomAddress('');
      } else {
        alert('Transfer failed');
      }
    } catch (error: any) {
      console.error('Transfer error:', error);
      alert(`Transfer failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Transfer Funds (Privy SDK)</h3>
      
      {/* Direction Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setTransferDirection('from-agent')}
          className={`px-4 py-2 rounded ${
            transferDirection === 'from-agent'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          From Agent → User/Other
        </button>
        <button
          onClick={() => setTransferDirection('to-agent')}
          className={`px-4 py-2 rounded ${
            transferDirection === 'to-agent'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          From User → Agent
        </button>
      </div>

      {/* Transfer Details */}
      <div className="p-4 bg-gray-50 rounded-lg space-y-3">
        <div>
          <p className="text-sm text-gray-600 mb-1">From:</p>
          <code className="text-sm font-mono">
            {transferDirection === 'from-agent' 
              ? `${agentWallet.name} (${agentWallet.address.slice(0, 10)}...)`
              : `Primary Wallet (${primaryWalletAddress?.slice(0, 10) || ''}...)`
            }
          </code>
        </div>
        
        <div>
          <p className="text-sm text-gray-600 mb-1">To:</p>
          {transferDirection === 'from-agent' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="to-user"
                  checked={!customAddress}
                  onChange={() => setCustomAddress('')}
                />
                <label htmlFor="to-user" className="text-sm">
                  Primary Wallet ({primaryWalletAddress?.slice(0, 10) || ''}...)
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="to-custom"
                  checked={!!customAddress}
                  onChange={() => setCustomAddress('0x')}
                />
                <label htmlFor="to-custom" className="text-sm">
                  Custom Address:
                </label>
              </div>
              {customAddress !== '' && (
                <input
                  type="text"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3 py-2 border rounded text-sm font-mono"
                />
              )}
            </div>
          ) : (
            <code className="text-sm font-mono">
              {agentWallet.name} ({agentWallet.address.slice(0, 10)}...)
            </code>
          )}
        </div>

        <div>
          <label className="text-sm text-gray-600">Amount (ETH):</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="0.0001"
            min="0"
            className="w-full px-3 py-2 border rounded mt-1"
            disabled={isTransferring}
          />
        </div>

        {transferDirection === 'to-agent' && (
          <div className="p-3 bg-blue-50 rounded text-sm text-blue-800">
            💡 Use the quick fund buttons in the Overview tab to send ETH to your agent wallet
          </div>
        )}
      </div>

      {/* Transfer Button */}
      <button
        onClick={handleTransfer}
        disabled={isTransferring || transferDirection === 'to-agent'}
        className={`w-full py-3 rounded font-medium ${
          isTransferring || transferDirection === 'to-agent'
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isTransferring ? 'Transferring...' : 
         transferDirection === 'to-agent' ? 'Use Overview Tab to Fund' : 
         'Transfer Funds'}
      </button>

      {/* Transaction Hash */}
      {txHash && (
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-sm text-green-800">
            ✅ Transaction sent: 
            <code className="ml-2 font-mono text-xs">{txHash.slice(0, 20)}...</code>
          </p>
        </div>
      )}

      {/* Info */}
      <div className="p-3 bg-blue-50 rounded text-sm text-blue-700">
        <p className="font-medium mb-1">ℹ️ Using Privy SDK</p>
        <p>All transactions are signed through the Privy SDK using session signers.</p>
      </div>
    </div>
  );
}