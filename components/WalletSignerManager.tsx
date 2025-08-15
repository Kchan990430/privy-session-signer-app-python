import { useState, useEffect } from 'react';
import { Address } from 'viem';

interface WalletSignerManagerProps {
  walletId: string;
  walletAddress: Address;
  onSignerRemoved?: () => void;
}

interface Signer {
  id: string;
  type: string;
  address?: string;
  name?: string;
}

export function WalletSignerManager({ walletId, walletAddress, onSignerRemoved }: WalletSignerManagerProps) {
  const [signers, setSigners] = useState<Signer[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [showSigners, setShowSigners] = useState(false);

  const fetchSigners = async () => {
    setLoading(true);
    try {
      // Get wallet details including signers
      const response = await fetch('/api/agent-wallets/auth-key/get-signers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, walletAddress })
      });

      if (response.ok) {
        const data = await response.json();
        setSigners(data.signers || []);
      }
    } catch (error) {
      console.error('Failed to fetch signers:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeSigner = async (signerId: string) => {
    if (!confirm(`Are you sure you want to remove signer ${signerId}?`)) {
      return;
    }

    setRemoving(signerId);
    try {
      const response = await fetch('/api/agent-wallets/auth-key/remove-signer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletId, 
          walletAddress,
          signerId 
        })
      });

      if (response.ok) {
        alert('Signer removed successfully');
        await fetchSigners(); // Refresh the list
        if (onSignerRemoved) onSignerRemoved();
      } else {
        const error = await response.json();
        alert(`Failed to remove signer: ${error.error}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setRemoving(null);
    }
  };

  useEffect(() => {
    if (showSigners) {
      fetchSigners();
    }
  }, [showSigners]);

  return (
    <div className="mt-3">
      <button
        onClick={() => setShowSigners(!showSigners)}
        className="text-sm text-blue-600 hover:text-blue-700"
      >
        {showSigners ? 'Hide' : 'Show'} Wallet Signers ({signers.length})
      </button>

      {showSigners && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg">
          {loading ? (
            <p className="text-sm text-gray-600">Loading signers...</p>
          ) : signers.length === 0 ? (
            <p className="text-sm text-gray-600">No signers found</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">Current Signers:</p>
              {signers.map((signer) => (
                <div key={signer.id} className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex-1">
                    <p className="text-xs font-mono">{signer.id}</p>
                    <p className="text-xs text-gray-600">
                      Type: {signer.type}
                      {signer.name && ` - ${signer.name}`}
                    </p>
                  </div>
                  {signer.type !== 'user' && ( // Don't allow removing user signer
                    <button
                      onClick={() => removeSigner(signer.id)}
                      disabled={removing === signer.id}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                    >
                      {removing === signer.id ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}