/**
 * React hook for ACP Python SDK integration
 * Replaces acp-node SDK with Python backend API calls
 */

import { useState, useCallback, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { acpClient, ACPJobPhase, MemoType } from '@/lib/acp-python-client';

export interface ACPJob {
  id: number;
  provider: string;
  evaluator: string;
  client: string;
  expiredAt: Date;
  phase: ACPJobPhase;
  budget?: number;
}

export interface ACPMemo {
  id: number;
  jobId: number;
  content: string;
  memoType: MemoType;
  isSecured: boolean;
  creator: string;
  nextPhase: ACPJobPhase;
}

export interface UseACPPythonReturn {
  // Job operations
  createJob: (
    walletId: string,
    privateKey: string,
    providerAddress: string,
    evaluatorAddress: string,
    expiredAt: Date
  ) => Promise<string>;
  
  // Memo operations
  createMemo: (
    walletId: string,
    privateKey: string,
    jobId: number,
    content: string,
    memoType: MemoType,
    isSecured: boolean,
    nextPhase: ACPJobPhase
  ) => Promise<string>;
  
  signMemo: (
    walletId: string,
    privateKey: string,
    memoId: number,
    isApproved: boolean,
    reason?: string
  ) => Promise<string>;
  
  // Budget operations
  setBudget: (
    walletId: string,
    privateKey: string,
    jobId: number,
    budget: number
  ) => Promise<string>;
  
  // WebSocket events
  connectToEvents: (walletId: string) => void;
  disconnectFromEvents: () => void;
  
  // State
  isConnected: boolean;
  isProcessing: boolean;
  error: string | null;
  lastTransactionHash: string | null;
}

export function useACPPython(): UseACPPythonReturn {
  const { user, ready } = usePrivy();
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTransactionHash, setLastTransactionHash] = useState<string | null>(null);

  // Create job with gas sponsorship
  const createJob = useCallback(async (
    walletId: string,
    privateKey: string,
    providerAddress: string,
    evaluatorAddress: string,
    expiredAt: Date
  ): Promise<string> => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const hash = await acpClient.createJob(
        walletId,
        privateKey,
        providerAddress,
        evaluatorAddress,
        expiredAt
      );
      
      setLastTransactionHash(hash);
      return hash;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create job';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Create memo
  const createMemo = useCallback(async (
    walletId: string,
    privateKey: string,
    jobId: number,
    content: string,
    memoType: MemoType,
    isSecured: boolean,
    nextPhase: ACPJobPhase
  ): Promise<string> => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const hash = await acpClient.createMemo(
        walletId,
        privateKey,
        jobId,
        content,
        memoType,
        isSecured,
        nextPhase
      );
      
      setLastTransactionHash(hash);
      return hash;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create memo';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Sign memo
  const signMemo = useCallback(async (
    walletId: string,
    privateKey: string,
    memoId: number,
    isApproved: boolean,
    reason?: string
  ): Promise<string> => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const hash = await acpClient.signMemo(
        walletId,
        privateKey,
        memoId,
        isApproved,
        reason
      );
      
      setLastTransactionHash(hash);
      return hash;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign memo';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Set budget
  const setBudget = useCallback(async (
    walletId: string,
    privateKey: string,
    jobId: number,
    budget: number
  ): Promise<string> => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const hash = await acpClient.setBudget(
        walletId,
        privateKey,
        jobId,
        budget
      );
      
      setLastTransactionHash(hash);
      return hash;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set budget';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Connect to WebSocket events
  const connectToEvents = useCallback((walletId: string) => {
    acpClient.connectWebSocket(walletId, (event) => {
      console.log('WebSocket event:', event);
      
      // Handle different event types
      switch (event.type) {
        case 'new_task':
          // Handle new task event
          console.log('New task received:', event.data);
          break;
        case 'job_update':
          // Handle job update event
          console.log('Job updated:', event.data);
          break;
        case 'transaction_confirmed':
          // Handle transaction confirmation
          console.log('Transaction confirmed:', event.data);
          break;
        default:
          console.log('Unknown event type:', event.type);
      }
    });
    
    setIsConnected(true);
  }, []);

  // Disconnect from WebSocket events
  const disconnectFromEvents = useCallback(() => {
    acpClient.disconnectWebSocket();
    setIsConnected(false);
  }, []);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      disconnectFromEvents();
    };
  }, [disconnectFromEvents]);

  return {
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
  };
}