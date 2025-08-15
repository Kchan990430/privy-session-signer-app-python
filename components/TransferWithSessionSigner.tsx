import { useState } from 'react';
import { useSendTransaction, useWallets } from '@privy-io/react-auth';
import { Address } from 'viem';

interface TransferWithSessionSignerProps {
  agentWallet: {
    id: string;
    address: string;
  };
}

export function TransferWithSessionSigner({ agentWallet }: TransferWithSessionSignerProps) {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('0.00001');
  const [isTransferring, setIsTransferring] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  
  const { sendTransaction } = useSendTransaction();
  const { wallets } = useWallets();

  const handleTransfer = async () => {
    if (!toAddress || !amount) {
      alert('Please enter recipient address and amount');
      return;
    }

    setIsTransferring(true);
    
    try {
      // Find the agent wallet
      const wallet = wallets.find(w => w.address.toLowerCase() === agentWallet.address.toLowerCase());
      
      if (!wallet) {
        throw new Error('Agent wallet not found in Privy wallets');
      }

      console.log('Sending transaction with session signer...');
      console.log('From:', agentWallet.address);
      console.log('To:', toAddress);
      console.log('Amount:', amount, 'ETH');

      // Convert ETH to wei (Privy expects wei as number/string)
      const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18));

      // Send transaction using Privy SDK with session signer
      const receipt = await sendTransaction(
        {
          to: toAddress as Address,
          value: amountWei,
          data: '0x'
        },
        {
          address: agentWallet.address // Specify which wallet to use
        }
      );

      if (receipt) {
        const hash = receipt.transactionHash;
        setTxHash(hash);
        console.log('✅ Transaction sent successfully:', hash);
        alert(`Transfer successful! Transaction hash: ${hash}`);
      }
    } catch (error: any) {
      console.error('Transfer error:', error);
      alert(`Transfer failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="text-lg font-bold">Transfer with Session Signer (Frontend)</h3>
      
      <div className="text-sm text-gray-600">
        Using Privy SDK to send transactions with session signers
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          From (Agent Wallet):
        </label>
        <input
          type="text"
          value={agentWallet.address}
          disabled
          className="w-full p-2 border border-gray-300 rounded bg-gray-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          To Address:
        </label>
        <input
          type="text"
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          placeholder="0x..."
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Amount (ETH):
        </label>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.001"
          className="w-full p-2 border border-gray-300 rounded"
        />
      </div>

      <button
        onClick={handleTransfer}
        disabled={isTransferring}
        className={`w-full py-2 px-4 rounded ${
          isTransferring
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isTransferring ? 'Transferring...' : 'Send Transaction'}
      </button>

      {txHash && (
        <div className="text-sm text-green-600 break-all">
          Transaction sent: {txHash}
        </div>
      )}

      <div className="text-xs text-gray-500 bg-yellow-50 p-2 rounded">
        ⚠️ Note: This uses Privy's frontend SDK with session signers. 
        The transaction is signed by the session signer automatically if configured.
      </div>
    </div>
  );
}