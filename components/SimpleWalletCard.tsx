import { useState } from 'react';
import { WalletWithMetadata } from '@privy-io/react-auth';
import { CopyButton } from './CopyButton';
import { BalanceDisplay } from './BalanceDisplay';
import { AuthKeyGenerator } from './AuthKeyGenerator';
import { WalletSignerManager } from './WalletSignerManager';

interface SimpleWalletCardProps {
  wallet: WalletWithMetadata;
  isPrimary?: boolean;
}

export default function SimpleWalletCard({ wallet, isPrimary = false }: SimpleWalletCardProps) {
  const [showKeyGenerator, setShowKeyGenerator] = useState(false);
  const [hasAuthKey, setHasAuthKey] = useState(false);

  const handleKeyGenerated = (publicKey: string, keyQuorumId: string) => {
    setHasAuthKey(true);
    // Refresh the page to update wallet status
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
    <div className={`p-4 border rounded-lg ${isPrimary ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}>
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {isPrimary && (
              <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">PRIMARY</span>
            )}
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
              {wallet.walletClientType === 'privy' ? 'EMBEDDED' : wallet.walletClientType?.toUpperCase() || 'EOA'}
            </span>
            {wallet.delegated && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                DELEGATED
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono">
              {wallet.address.slice(0, 12)}...{wallet.address.slice(-8)}
            </code>
            <CopyButton text={wallet.address} />
          </div>
        </div>
        
        <div className="text-right">
          <BalanceDisplay address={wallet.address} />
          {!hasAuthKey && wallet.walletClientType === 'privy' && (
            <button
              onClick={() => setShowKeyGenerator(true)}
              className="mt-2 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
            >
              Setup Auth Key
            </button>
          )}
        </div>
      </div>
      
      {/* Wallet Signer Manager */}
      <WalletSignerManager
        walletId={(wallet as any).id || wallet.address}
        walletAddress={wallet.address}
        onSignerRemoved={() => {
          // Refresh the page to update wallet status
          setTimeout(() => window.location.reload(), 1000);
        }}
      />
      
      {/* Auth Key Generator Modal */}
      {showKeyGenerator && (
        <AuthKeyGenerator
          walletId={(wallet as any).id || wallet.address}
          walletAddress={wallet.address}
          onKeyGenerated={handleKeyGenerated}
          onClose={() => setShowKeyGenerator(false)}
        />
      )}
    </div>
  );
}