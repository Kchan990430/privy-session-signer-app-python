import { useEffect, useState } from 'react';
import { useWallets } from '@privy-io/react-auth';

/**
 * Hook that automatically sets up auth keys for new wallets
 */
export function useAutoAuthKeySetup() {
  const { wallets } = useWallets();
  const [processedWallets, setProcessedWallets] = useState<Set<string>>(new Set());
  const [setupStatus, setSetupStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    const setupNewWallets = async () => {
      // Small delay to let Privy process new wallets
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      for (const wallet of wallets) {
        const walletId = (wallet as any).id || wallet.address;
        
        // Skip if already processed
        if (processedWallets.has(walletId)) {
          continue;
        }

        // Mark as processed to avoid duplicate attempts
        setProcessedWallets(prev => new Set([...prev, walletId]));

        // Check if wallet already has auth key
        try {
          const statusResponse = await fetch('/api/agent-wallets/auth-key/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletId,
              walletAddress: wallet.address
            })
          });

          const statusData = await statusResponse.json();
          
          // If auth key already exists, skip
          if (statusData.exists) {
            setSetupStatus(prev => ({
              ...prev,
              [walletId]: 'existing'
            }));
            continue;
          }

          // Create auth key for new wallet using auto endpoint
          console.log(`Setting up auth key for new wallet ${wallet.address}...`);
          setSetupStatus(prev => ({
            ...prev,
            [walletId]: 'setting-up'
          }));

          const createResponse = await fetch('/api/agent-wallets/auth-key/create-auto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              walletId,
              walletAddress: wallet.address
            })
          });

          if (createResponse.ok) {
            const createData = await createResponse.json();
            console.log(`✅ Auth key created for wallet ${wallet.address}`, createData);
            setSetupStatus(prev => ({
              ...prev,
              [walletId]: 'success'
            }));
          } else {
            const error = await createResponse.json();
            console.error(`Failed to create auth key for wallet ${wallet.address}:`, error);
            setSetupStatus(prev => ({
              ...prev,
              [walletId]: 'failed'
            }));
          }
        } catch (error) {
          console.error(`Error setting up auth key for wallet ${wallet.address}:`, error);
          setSetupStatus(prev => ({
            ...prev,
            [walletId]: 'error'
          }));
        }
      }
    };

    if (wallets.length > 0) {
      setupNewWallets();
    }
  }, [wallets.length]); // Only re-run when number of wallets changes

  return {
    setupStatus,
    processedWallets: Array.from(processedWallets)
  };
}