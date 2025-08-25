import { useWallets } from '@privy-io/react-auth';
import { useEffect } from 'react';

export function DebugWallets() {
  const { wallets } = useWallets();
  
  useEffect(() => {
    console.log('=== WALLET DEBUG INFO ===');
    wallets.forEach((wallet, index) => {
      console.log(`Wallet ${index + 1}:`, {
        address: wallet.address,
        walletClientType: wallet.walletClientType,
        chainId: wallet.chainId,
        // Check if wallet has Privy ID
        privyId: (wallet as any).id,
        // Check all properties
        allProps: Object.keys(wallet),
        // Full wallet object
        fullWallet: wallet
      });
    });
    console.log('=== END WALLET DEBUG ===');
  }, [wallets]);
  
  return (
    <div className="p-4 bg-gray-100 rounded">
      <h3 className="font-bold mb-2">Wallet Debug Info (check console)</h3>
      {wallets.map((wallet, index) => (
        <div key={index} className="text-xs mb-1">
          <span className="font-mono">{wallet.address}</span>
          <span className="ml-2">Type: {wallet.walletClientType}</span>
          <span className="ml-2">ID: {(wallet as any).id || 'No Privy ID'}</span>
        </div>
      ))}
    </div>
  );
}