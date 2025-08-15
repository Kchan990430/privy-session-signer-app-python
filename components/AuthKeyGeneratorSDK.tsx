import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { generateAuthKeyPair, storePrivateKeyTemporarily } from '../utils/keyGeneration';
import { CopyButton } from './CopyButton';

interface AuthKeyGeneratorSDKProps {
  walletAddress: string;
  onKeyGenerated: (publicKey: string, keyQuorumId: string) => void;
  onClose: () => void;
}

export function AuthKeyGeneratorSDK({ walletAddress, onKeyGenerated, onClose }: AuthKeyGeneratorSDKProps) {
  const { createWalletSigner } = usePrivy();
  const [step, setStep] = useState<'generate' | 'display' | 'creating' | 'complete'>('generate');
  const [generatedKeys, setGeneratedKeys] = useState<any>(null);
  const [keyQuorumId, setKeyQuorumId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [acknowledged, setAcknowledged] = useState(false);

  const handleGenerateKeys = async () => {
    try {
      setStep('creating');
      setError('');
      
      // Generate keys in the browser
      console.log('Generating P-256 key pair...');
      const keys = await generateAuthKeyPair();
      setGeneratedKeys(keys);
      console.log('Keys generated successfully');
      
      // Create wallet signer using Privy SDK
      console.log('Creating wallet signer with Privy SDK...');
      console.log('Wallet address:', walletAddress);
      console.log('Public key:', keys.publicKey);
      
      try {
        // Create the signer directly with Privy SDK
        const signer = await createWalletSigner({
          walletAddress,
          publicKey: keys.publicKey
        });
        
        console.log('Wallet signer created:', signer);
        setKeyQuorumId(signer.id || keys.publicKey.slice(0, 20));
        
        // Store private key temporarily in session storage (15 min expiry)
        storePrivateKeyTemporarily(walletAddress, keys.privateKey, keys.privateKeyBase64);
        
        setStep('display');
      } catch (privyError: any) {
        console.error('Failed to create wallet signer with Privy:', privyError);
        
        // Fallback to backend API if SDK fails
        console.log('Falling back to backend API...');
        const response = await fetch('/api/agent-wallets/auth-key/create-quorum', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletId: walletAddress,
            walletAddress,
            publicKey: keys.publicKey
          })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create key quorum');
        }

        const data = await response.json();
        setKeyQuorumId(data.keyQuorumId);
        
        // Store private key temporarily
        storePrivateKeyTemporarily(walletAddress, keys.privateKey, keys.privateKeyBase64);
        
        setStep('display');
      }
    } catch (err: any) {
      console.error('Key generation error:', err);
      setError(err.message || 'Failed to generate keys');
      setStep('generate');
    }
  };

  const handleComplete = () => {
    if (!acknowledged) {
      alert('Please acknowledge that you have saved your private key');
      return;
    }
    
    onKeyGenerated(generatedKeys.publicKey, keyQuorumId);
    setStep('complete');
    
    // Close after a short delay
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Generate Authorization Keys</h2>
        
        {step === 'generate' && (
          <div className="space-y-4">
            <p className="text-gray-600">
              This will generate a new P-256 key pair for authorizing backend transactions.
              The private key will be shown only once - make sure to save it securely!
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 font-semibold mb-2">⚠️ Important:</p>
              <ul className="list-disc list-inside text-yellow-700 space-y-1">
                <li>The private key will be displayed only once</li>
                <li>You must save it securely - it cannot be recovered</li>
                <li>You'll need this key to authorize transactions</li>
                <li>Do not share your private key with anyone</li>
              </ul>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-800">{error}</p>
              </div>
            )}
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateKeys}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Generate Keys
              </button>
            </div>
          </div>
        )}
        
        {step === 'creating' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Generating keys and creating wallet signer...</p>
          </div>
        )}
        
        {step === 'display' && generatedKeys && (
          <div className="space-y-4">
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <p className="text-red-800 font-bold text-lg mb-2">
                🔐 SAVE YOUR PRIVATE KEY NOW - IT WON'T BE SHOWN AGAIN!
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Signer ID:
                </label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 p-2 bg-gray-100 rounded text-xs break-all">
                    {keyQuorumId}
                  </code>
                  <CopyButton text={keyQuorumId} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Private Key (PEM Format):
                </label>
                <div className="flex items-start space-x-2">
                  <textarea
                    readOnly
                    value={generatedKeys.privateKey}
                    className="flex-1 p-2 bg-gray-100 rounded font-mono text-xs h-32 resize-none"
                  />
                  <CopyButton text={generatedKeys.privateKey} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Private Key (Base64 Format for Privy):
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedKeys.privateKeyBase64}
                    className="flex-1 p-2 bg-gray-100 rounded font-mono text-xs"
                  />
                  <CopyButton text={generatedKeys.privateKeyBase64} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Public Key:
                </label>
                <div className="flex items-start space-x-2">
                  <textarea
                    readOnly
                    value={generatedKeys.publicKey}
                    className="flex-1 p-2 bg-gray-100 rounded font-mono text-xs h-24 resize-none"
                  />
                  <CopyButton text={generatedKeys.publicKey} />
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-blue-800 text-sm">
                💡 The private key has been temporarily stored in your browser session (15 minutes).
                After that, you'll need to provide it manually for transactions.
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="acknowledge"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="acknowledge" className="text-sm text-gray-700">
                I have securely saved my private key and understand it cannot be recovered
              </label>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleComplete}
                disabled={!acknowledged}
                className={`px-4 py-2 rounded-lg ${
                  acknowledged 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Complete Setup
              </button>
            </div>
          </div>
        )}
        
        {step === 'complete' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-green-600 text-6xl mb-4">✓</div>
            <p className="text-lg font-semibold text-gray-800">Authorization Key Setup Complete!</p>
            <p className="text-gray-600 mt-2">Your wallet is now configured for backend transactions.</p>
          </div>
        )}
      </div>
    </div>
  );
}