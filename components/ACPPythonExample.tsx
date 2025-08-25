/**
 * Example component demonstrating ACP Python SDK integration
 * Shows how to replace acp-node with Python backend API calls
 */

import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useACPPython } from '@/hooks/useACPPython';
import { ACPJobPhase, MemoType } from '@/lib/acp-python-client';

interface WalletInfo {
  walletId: string;
  address: string;
  privateKeyBase64?: string; // Session signer private key
}

export default function ACPPythonExample() {
  const { user, wallets, ready } = usePrivy();
  const {
    createJob,
    createMemo,
    signMemo,
    setBudget,
    connectToEvents,
    disconnectFromEvents,
    isConnected,
    isProcessing,
    error,
    lastTransactionHash
  } = useACPPython();

  const [selectedWallet, setSelectedWallet] = useState<WalletInfo | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [memoId, setMemoId] = useState<number | null>(null);

  // Connect to WebSocket events when wallet is selected
  useEffect(() => {
    if (selectedWallet?.walletId) {
      connectToEvents(selectedWallet.walletId);
    }
    return () => {
      disconnectFromEvents();
    };
  }, [selectedWallet, connectToEvents, disconnectFromEvents]);

  // Example: Create a new job
  const handleCreateJob = async () => {
    if (!selectedWallet || !selectedWallet.privateKeyBase64) {
      alert('Please select a wallet with session signer');
      return;
    }

    try {
      const providerAddress = '0x...'; // Replace with actual provider address
      const evaluatorAddress = '0x...'; // Replace with actual evaluator address
      const expiredAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      const txHash = await createJob(
        selectedWallet.walletId,
        selectedWallet.privateKeyBase64,
        providerAddress,
        evaluatorAddress,
        expiredAt
      );

      console.log('Job created successfully:', txHash);
      // Extract job ID from transaction receipt (implementation needed)
      setJobId(1); // Placeholder
    } catch (err) {
      console.error('Failed to create job:', err);
    }
  };

  // Example: Create a memo for the job
  const handleCreateMemo = async () => {
    if (!selectedWallet || !selectedWallet.privateKeyBase64 || !jobId) {
      alert('Please create a job first');
      return;
    }

    try {
      const txHash = await createMemo(
        selectedWallet.walletId,
        selectedWallet.privateKeyBase64,
        jobId,
        'Job accepted and in progress',
        MemoType.GENERAL,
        false,
        ACPJobPhase.IN_PROGRESS
      );

      console.log('Memo created successfully:', txHash);
      setMemoId(1); // Placeholder
    } catch (err) {
      console.error('Failed to create memo:', err);
    }
  };

  // Example: Sign a memo
  const handleSignMemo = async (approved: boolean) => {
    if (!selectedWallet || !selectedWallet.privateKeyBase64 || !memoId) {
      alert('Please create a memo first');
      return;
    }

    try {
      const txHash = await signMemo(
        selectedWallet.walletId,
        selectedWallet.privateKeyBase64,
        memoId,
        approved,
        approved ? 'Approved' : 'Rejected - requirements not met'
      );

      console.log('Memo signed successfully:', txHash);
    } catch (err) {
      console.error('Failed to sign memo:', err);
    }
  };

  // Example: Set budget for the job
  const handleSetBudget = async () => {
    if (!selectedWallet || !selectedWallet.privateKeyBase64 || !jobId) {
      alert('Please create a job first');
      return;
    }

    try {
      const budget = 100; // 100 USDC
      const txHash = await setBudget(
        selectedWallet.walletId,
        selectedWallet.privateKeyBase64,
        jobId,
        budget
      );

      console.log('Budget set successfully:', txHash);
    } catch (err) {
      console.error('Failed to set budget:', err);
    }
  };

  // Get session signer private key for wallet
  const getSessionSignerKey = (walletId: string): string | undefined => {
    // This would need to be retrieved from your session signer storage
    // For example, from localStorage or a secure store
    const storageKey = `wallet-auth-${walletId}`;
    const authData = localStorage.getItem(storageKey);
    if (authData) {
      const parsed = JSON.parse(authData);
      return parsed.privateKeyBase64;
    }
    return undefined;
  };

  // Load wallets with session signers
  useEffect(() => {
    if (ready && wallets && wallets.length > 0) {
      const walletsWithKeys = wallets.map(wallet => ({
        walletId: wallet.walletClientType === 'privy' ? wallet.address : '',
        address: wallet.address,
        privateKeyBase64: getSessionSignerKey(wallet.address)
      }));
      
      // Select first wallet with session signer
      const walletWithKey = walletsWithKeys.find(w => w.privateKeyBase64);
      if (walletWithKey) {
        setSelectedWallet(walletWithKey);
      }
    }
  }, [ready, wallets]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">ACP Python SDK Integration Example</h1>
      
      {/* Connection Status */}
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="font-semibold mb-2">Connection Status</h2>
        <p>WebSocket: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
        <p>Processing: {isProcessing ? '⏳ Yes' : 'No'}</p>
        {error && <p className="text-red-500">Error: {error}</p>}
        {lastTransactionHash && (
          <p className="text-green-600">Last TX: {lastTransactionHash.slice(0, 10)}...</p>
        )}
      </div>

      {/* Wallet Selection */}
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="font-semibold mb-2">Selected Wallet</h2>
        {selectedWallet ? (
          <div>
            <p>Address: {selectedWallet.address}</p>
            <p>Wallet ID: {selectedWallet.walletId}</p>
            <p>Session Signer: {selectedWallet.privateKeyBase64 ? '✅' : '❌'}</p>
          </div>
        ) : (
          <p>No wallet selected</p>
        )}
      </div>

      {/* Job Management */}
      <div className="mb-6 p-4 bg-blue-50 rounded">
        <h2 className="font-semibold mb-4">Job Management</h2>
        
        <div className="space-y-4">
          {/* Create Job */}
          <div>
            <button
              onClick={handleCreateJob}
              disabled={isProcessing || !selectedWallet?.privateKeyBase64}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            >
              Create Job
            </button>
            {jobId && <span className="ml-2">Job ID: {jobId}</span>}
          </div>

          {/* Set Budget */}
          <div>
            <button
              onClick={handleSetBudget}
              disabled={isProcessing || !jobId}
              className="px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-300"
            >
              Set Budget (100 USDC)
            </button>
          </div>

          {/* Create Memo */}
          <div>
            <button
              onClick={handleCreateMemo}
              disabled={isProcessing || !jobId}
              className="px-4 py-2 bg-purple-500 text-white rounded disabled:bg-gray-300"
            >
              Create Memo
            </button>
            {memoId && <span className="ml-2">Memo ID: {memoId}</span>}
          </div>

          {/* Sign Memo */}
          <div className="flex gap-2">
            <button
              onClick={() => handleSignMemo(true)}
              disabled={isProcessing || !memoId}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-300"
            >
              Approve Memo
            </button>
            <button
              onClick={() => handleSignMemo(false)}
              disabled={isProcessing || !memoId}
              className="px-4 py-2 bg-red-600 text-white rounded disabled:bg-gray-300"
            >
              Reject Memo
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-yellow-50 rounded">
        <h2 className="font-semibold mb-2">Instructions</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Ensure Python API server is running on localhost:8000</li>
          <li>Configure Privy app credentials in the Python backend</li>
          <li>Create session signers for your wallets using PrivyAuthKeyManager</li>
          <li>The frontend generates authorization signatures locally</li>
          <li>Python backend relays transactions with gas sponsorship</li>
        </ol>
      </div>

      {/* Migration Notes */}
      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h2 className="font-semibold mb-2">Migration from acp-node</h2>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>Replace VirtualsACP imports with ACPPythonClient</li>
          <li>Update transaction methods to use prepare/execute pattern</li>
          <li>Session signers are managed on frontend, not backend</li>
          <li>Authorization signatures are generated client-side</li>
          <li>Gas sponsorship is handled by Python backend via Privy</li>
        </ul>
      </div>
    </div>
  );
}