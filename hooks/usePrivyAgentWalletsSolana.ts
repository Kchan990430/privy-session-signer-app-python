import { useState, useCallback } from 'react';
import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth';

/**
 * Alternative approach: Try creating Solana wallets as a workaround
 * TEE mode might allow multiple Solana wallets even if Ethereum is restricted
 */
export function usePrivyAgentWalletsSolana() {
  const { authenticated } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Try to create a Solana wallet as alternative
  const createSolanaWallet = useCallback(async () => {
    if (!authenticated) {
      setError('Not authenticated');
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Attempting to create Solana wallet as alternative...');
      
      // Try to create a Solana wallet
      const wallet = await createWallet({ 
        createAdditional: true,
        // @ts-ignore - Try passing chain type if supported
        chainType: 'solana'
      });
      
      if (wallet) {
        console.log('Solana wallet created:', wallet);
        return wallet;
      }
    } catch (err: any) {
      console.error('Failed to create Solana wallet:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
    
    return null;
  }, [authenticated, createWallet]);
  
  // Check what wallet types are available
  const checkWalletTypes = useCallback(() => {
    console.log('Available wallets:', wallets);
    console.log('Embedded wallets:', wallets.filter(w => w.walletClientType === 'privy'));
    console.log('External wallets:', wallets.filter(w => w.walletClientType !== 'privy'));
  }, [wallets]);
  
  return {
    loading,
    error,
    ready: walletsReady,
    wallets,
    createSolanaWallet,
    checkWalletTypes
  };
}