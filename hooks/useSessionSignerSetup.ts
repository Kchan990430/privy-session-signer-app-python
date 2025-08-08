import { useState, useCallback } from 'react';
import { useSessionSigners } from '@privy-io/react-auth';
import { Address } from 'viem';

/**
 * Hook for properly setting up session signers on user wallets
 * Based on official Privy documentation
 */
export function useSessionSignerSetup() {
  const { addSessionSigners } = useSessionSigners();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Add a session signer to a wallet
   * This gives your backend permission to transact without user approval
   */
  const setupSessionSigner = useCallback(async (
    walletAddress: Address,
    keyQuorumId: string,
    policyIds?: string[]
  ) => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔐 Adding session signer to wallet...');
      console.log('  Wallet:', walletAddress);
      console.log('  Key Quorum ID:', keyQuorumId);
      console.log('  Policies:', policyIds || 'None');

      // Add session signer to the wallet
      // This requires one-time user consent
      const result = await addSessionSigners({
        address: walletAddress,
        signers: [{
          signerId: keyQuorumId,
          policyIds: policyIds || []
        }]
      });

      console.log('✅ Session signer added successfully!');
      console.log('  Result:', result);
      
      return {
        success: true,
        message: 'Session signer added! Backend can now transact without user approval.',
        result
      };
    } catch (err: any) {
      console.error('❌ Failed to add session signer:', err);
      
      // Handle specific error for wrong app
      if (err.message?.includes('do not belong to the app')) {
        const errorMsg = `Wrong App: This Key Quorum was registered in a different Privy app. 
        Please register it in your current app at:
        https://dashboard.privy.io/apps/cmdwhqego00u3jp0bmkz0iliq/wallet-infrastructure/authorization-keys`;
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
          solution: 'Register the key in the correct Privy app dashboard'
        };
      }
      
      setError(err.message || 'Failed to add session signer');
      
      return {
        success: false,
        error: err.message || 'Failed to add session signer'
      };
    } finally {
      setLoading(false);
    }
  }, [addSessionSigners]);

  /**
   * Generate instructions for creating authorization key
   */
  const getSetupInstructions = useCallback(() => {
    return {
      step1: {
        title: 'Generate P-256 Key Pair',
        commands: [
          'openssl ecparam -name prime256v1 -genkey -noout -out private.pem',
          'openssl ec -in private.pem -pubout -out public.pem'
        ],
        note: 'Run these commands in your terminal'
      },
      step2: {
        title: 'Register in Privy Dashboard',
        steps: [
          'Go to Privy Dashboard',
          'Navigate to Wallet infrastructure > Authorization keys',
          'Click "New key" → "Register key quorum"',
          'Paste your public key',
          'Set threshold to 1',
          'Save the Key Quorum ID'
        ]
      },
      step3: {
        title: 'Add to Wallet',
        note: 'Use the setupSessionSigner function with the Key Quorum ID'
      },
      step4: {
        title: 'Configure Backend',
        steps: [
          'Add private key to .env as AUTHORIZATION_PRIVATE_KEY',
          'Use the private key to sign backend requests',
          'Transactions will work without user approval!'
        ]
      }
    };
  }, []);

  return {
    setupSessionSigner,
    loading,
    error,
    getSetupInstructions
  };
}