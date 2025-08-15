import { useState } from 'react';

interface PrivateKeyInputProps {
  walletId: string;
  walletAddress: string;
  onSubmit: (privateKey: string, privateKeyBase64: string) => void;
  onCancel: () => void;
  action: string; // Description of what the key will be used for
}

export function PrivateKeyInput({ 
  walletId, 
  walletAddress, 
  onSubmit, 
  onCancel,
  action 
}: PrivateKeyInputProps) {
  const [privateKeyBase64, setPrivateKeyBase64] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!privateKeyBase64) {
      setError('Please enter your private key');
      return;
    }

    // Ensure the key has the correct format
    const finalPrivateKeyBase64 = privateKeyBase64.startsWith('wallet-auth:') 
      ? privateKeyBase64 
      : `wallet-auth:${privateKeyBase64}`;
    
    // Pass empty string for PEM format - server only needs base64
    onSubmit('', finalPrivateKeyBase64);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Authorization Required</h3>
        
        <div className="space-y-4">
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium">⚠️ Private Key Required</p>
            <p className="text-xs mt-1">
              Backend operations require your authorization private key to sign transactions.
            </p>
          </div>

          <p className="text-gray-600 text-sm mb-4">
            This action requires your authorization: <strong>{action}</strong>
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Private Key (Base64):
            </label>
            <input
              type="password"
              value={privateKeyBase64}
              onChange={(e) => setPrivateKeyBase64(e.target.value)}
              placeholder="wallet-auth:... or base64 string"
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the wallet-auth:BASE64 format or plain base64 string from when you created the auth key
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
            <p className="text-yellow-800 text-xs">
              🔒 Your private key is sent to the backend for transaction signing only and is never stored.
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Authorize
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}