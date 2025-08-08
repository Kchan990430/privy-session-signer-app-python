import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets, useCreateWallet, useSetWalletPassword } from '@privy-io/react-auth';
import { Address, Hash, parseEther, encodeFunctionData } from 'viem';
import { base, baseSepolia } from 'viem/chains';

// Define SessionSigner interface locally (to avoid importing Node.js package in browser)
export interface SessionSigner {
  address: Address;
  sendTransaction: (tx: {
    to: Address;
    data?: `0x${string}`;
    value?: bigint;
    gas?: bigint;
    maxFeePerGas?: bigint;
    chain?: any;
  }) => Promise<Hash>;
}

interface AgentWallet {
  id: string;
  address: Address;
  name: string;
  description?: string;
  createdAt: Date;
  hasSessionSigner: boolean;
  chainId: number;
}

class SessionSignerWrapper implements SessionSigner {
  address: Address;
  wallet: any; // Privy wallet instance
  
  constructor(wallet: any) {
    this.wallet = wallet;
    this.address = wallet.address as Address;
  }
  
  async sendTransaction(tx: {
    to: Address;
    data?: `0x${string}`;
    value?: bigint;
    gas?: bigint;
    maxFeePerGas?: bigint;
    chain?: any;
  }): Promise<Hash> {
    const provider = await this.wallet.getEthereumProvider();
    
    // Build transaction params
    const params = {
      from: this.wallet.address,
      to: tx.to,
      data: tx.data,
      value: tx.value ? `0x${tx.value.toString(16)}` : undefined,
      gas: tx.gas ? `0x${tx.gas.toString(16)}` : undefined,
    };
    
    // Send transaction through Privy provider
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [params],
    });
    
    return txHash as Hash;
  }
}

/**
 * Hook for managing user-owned agent wallets with session signers using Privy SDK
 * Uses createAdditional to create multiple wallets per user
 */
export function usePrivyAgentWallets() {
  const { authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  const { setWalletPassword } = useSetWalletPassword();
  
  const [agentWallets, setAgentWallets] = useState<AgentWallet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionSigners, setSessionSigners] = useState<Map<string, SessionSignerWrapper>>(new Map());
  
  // Get current network (default to Base Sepolia for testing)
  const chainId = baseSepolia.id;
  
  /**
   * Determine the primary wallet based on login method:
   * 1. If user logged in with EOA wallet (MetaMask, etc.) -> use EOA as primary
   * 2. If user logged in with social (email, Google, etc.) -> use first embedded wallet as primary
   * 
   * This ensures the wallet used for login is always the primary wallet.
   */
  const getPrimaryWallet = () => {
    if (!wallets || wallets.length === 0) return null;
    
    // Check if user logged in with EOA wallet (MetaMask, WalletConnect, etc.)
    // These wallets have walletClientType !== 'privy'
    const eoaWallet = wallets.find(w => w.walletClientType !== 'privy');
    if (eoaWallet) {
      // User logged in with external wallet, use it as primary
      console.log('Primary wallet: EOA wallet', eoaWallet.address);
      return eoaWallet;
    }
    
    // If no EOA wallet, user logged in with social (email, Google, etc.)
    // Use the first embedded wallet as primary
    const embeddedWallets = wallets.filter(w => w.walletClientType === 'privy');
    if (embeddedWallets.length > 0) {
      // Return the first embedded wallet (oldest one, likely the login wallet)
      console.log('Primary wallet: First embedded wallet', embeddedWallets[0].address);
      return embeddedWallets[0];
    }
    
    // Fallback to first wallet
    return wallets[0];
  };
  
  // Load agent wallets from Privy wallets
  useEffect(() => {
    if (walletsReady && wallets.length > 0) {
      const agents: AgentWallet[] = [];
      const signers = new Map<string, SessionSignerWrapper>();
      
      // Get the primary wallet based on login method
      const primaryWallet = getPrimaryWallet();
      
      // Create a session signer wrapper for the primary wallet
      if (primaryWallet) {
        const primaryId = `primary-${primaryWallet.address}`;
        signers.set(primaryId, new SessionSignerWrapper(primaryWallet));
      }
      
      // All wallets except the primary are agent wallets
      let agentIndex = 0;
      wallets.forEach((wallet) => {
        // Skip if this is the primary wallet
        if (primaryWallet && wallet.address === primaryWallet.address) {
          return;
        }
        
        const agentId = `agent-${wallet.address}`;
        agents.push({
          id: agentId,
          address: wallet.address as Address,
          name: `Agent Wallet ${agentIndex + 1}`,
          description: `Autonomous agent wallet ${agentIndex + 1}`,
          createdAt: new Date(),
          hasSessionSigner: true, // All SDK wallets have session signers
          chainId,
        });
        
        // Create session signer wrapper for this wallet
        signers.set(agentId, new SessionSignerWrapper(wallet));
        agentIndex++;
      });
      
      setAgentWallets(agents);
      setSessionSigners(signers);
    }
  }, [walletsReady, wallets, chainId]);
  
  // Create a new agent wallet
  const createAgentWallet = useCallback(async (
    name?: string,
    description?: string
  ): Promise<AgentWallet | null> => {
    if (!authenticated) {
      setError('Not authenticated');
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Attempting to create additional wallet...');
      
      // Try different approaches for creating additional wallet
      let wallet = null;
      
      try {
        // Method 1: Using createAdditional parameter
        console.log('Method 1: Using createAdditional parameter');
        wallet = await createWallet({ createAdditional: true });
      } catch (err1: any) {
        console.error('Method 1 failed:', err1);
        
        try {
          // Method 2: Force create without createAdditional
          console.log('Method 2: Trying without parameters');
          wallet = await createWallet();
        } catch (err2: any) {
          console.error('Method 2 failed:', err2);
          throw new Error(`Cannot create additional wallet: ${err1.message || err2.message}`);
        }
      }
      
      if (!wallet) {
        throw new Error('Failed to create wallet - no wallet returned');
      }
      
      console.log('Wallet created successfully:', wallet.address);
      
      const agentId = `agent-${wallet.address}`;
      const agentWallet: AgentWallet = {
        id: agentId,
        address: wallet.address as Address,
        name: name || `Agent Wallet ${agentWallets.length + 1}`,
        description: description || `Autonomous agent wallet ${agentWallets.length + 1}`,
        createdAt: new Date(),
        hasSessionSigner: true,
        chainId,
      };
      
      // Create session signer wrapper
      const signer = new SessionSignerWrapper(wallet);
      setSessionSigners(prev => new Map(prev).set(agentId, signer));
      
      // Update state
      setAgentWallets(prev => [...prev, agentWallet]);
      
      return agentWallet;
    } catch (err: any) {
      console.error('Failed to create agent wallet:', err);
      setError(err.message || 'Failed to create agent wallet');
      return null;
    } finally {
      setLoading(false);
    }
  }, [authenticated, createWallet, agentWallets.length, chainId]);
  
  // Get session signer for an agent wallet
  const getSessionSigner = useCallback((agentId: string): SessionSigner | null => {
    return sessionSigners.get(agentId) || null;
  }, [sessionSigners]);
  
  // Sign message with agent wallet
  const signMessageAsAgent = useCallback(async (
    agentId: string,
    message: string
  ): Promise<string | null> => {
    const signer = sessionSigners.get(agentId);
    if (!signer) {
      setError('Agent wallet not found');
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const provider = await signer.wallet.getEthereumProvider();
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, signer.wallet.address],
      });
      
      return signature as string;
    } catch (err: any) {
      setError(err.message || 'Failed to sign message');
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionSigners]);
  
  // Transfer funds from agent wallet
  const transferFundsFromAgent = useCallback(async (
    agentId: string,
    toAddress: Address,
    amountEth: string
  ): Promise<Hash | null> => {
    const signer = sessionSigners.get(agentId);
    if (!signer) {
      setError('Agent wallet not found');
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const amount = parseEther(amountEth);
      const txHash = await signer.sendTransaction({
        to: toAddress,
        value: amount,
        chain: chainId === base.id ? base : baseSepolia,
      });
      
      return txHash;
    } catch (err: any) {
      setError(err.message || 'Failed to transfer funds');
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionSigners, chainId]);
  
  // Transfer ERC20 tokens from agent wallet
  const transferTokensFromAgent = useCallback(async (
    agentId: string,
    tokenAddress: Address,
    toAddress: Address,
    amount: bigint
  ): Promise<Hash | null> => {
    const signer = sessionSigners.get(agentId);
    if (!signer) {
      setError('Agent wallet not found');
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // ERC20 transfer function signature
      const data = encodeFunctionData({
        abi: [{
          name: 'transfer',
          type: 'function',
          inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [{ name: '', type: 'bool' }]
        }],
        functionName: 'transfer',
        args: [toAddress, amount]
      });
      
      const txHash = await signer.sendTransaction({
        to: tokenAddress,
        data: data as `0x${string}`,
        chain: chainId === base.id ? base : baseSepolia,
      });
      
      return txHash;
    } catch (err: any) {
      setError(err.message || 'Failed to transfer tokens');
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionSigners, chainId]);
  
  // Send raw transaction from agent wallet
  const sendTransaction = useCallback(async (
    agentId: string,
    tx: {
      to: Address;
      data?: `0x${string}`;
      value?: bigint;
    }
  ): Promise<Hash | null> => {
    const signer = sessionSigners.get(agentId);
    if (!signer) {
      setError('Agent wallet not found');
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const txHash = await signer.sendTransaction({
        ...tx,
        chain: chainId === base.id ? base : baseSepolia,
      });
      
      return txHash;
    } catch (err: any) {
      setError(err.message || 'Failed to send transaction');
      return null;
    } finally {
      setLoading(false);
    }
  }, [sessionSigners, chainId]);
  
  // Get balance of agent wallet
  const getAgentBalance = useCallback(async (
    agentId: string
  ): Promise<bigint | null> => {
    const signer = sessionSigners.get(agentId);
    if (!signer) {
      setError('Agent wallet not found');
      return null;
    }
    
    try {
      const provider = await signer.wallet.getEthereumProvider();
      const balance = await provider.request({
        method: 'eth_getBalance',
        params: [signer.wallet.address, 'latest'],
      });
      
      return BigInt(balance as string);
    } catch (err: any) {
      setError(err.message || 'Failed to get balance');
      return null;
    }
  }, [sessionSigners]);
  
  // Set wallet password for session signers
  const setupWalletPassword = useCallback(async (password: string) => {
    try {
      await setWalletPassword({ password });
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to set wallet password');
      return false;
    }
  }, [setWalletPassword]);
  
  return {
    // State
    agentWallets,
    loading,
    error,
    ready: walletsReady,
    
    // Primary wallet (EOA preferred over embedded)
    primaryWallet: getPrimaryWallet(),
    
    // Methods
    createAgentWallet,
    getSessionSigner,
    signMessageAsAgent,
    transferFundsFromAgent,
    transferTokensFromAgent,
    sendTransaction,
    getAgentBalance,
    setupWalletPassword,
    
    // Helper methods
    getAgentWallet: (agentId: string) => agentWallets.find(w => w.id === agentId),
    hasAgentWallet: (agentId: string) => agentWallets.some(w => w.id === agentId),
  };
}