/**
 * ACP Python Client - TypeScript wrapper for Python ACP SDK API
 * 
 * This client replaces the acp-node SDK by calling the Python backend API
 * and handling authorization signature generation locally.
 */

import { 
  generateAuthorizationSignature,
  generateAuthorizationSignatureFromBase64 
} from './acp-auth-signature';

// Types matching the Python SDK
export interface PrepareJobRequest {
  provider_address: string;
  evaluator_address: string;
  expired_at: string; // ISO format
  wallet_id: string;
}

export interface ExecuteTransactionRequest {
  wallet_id: string;
  authorization_signature: string;
  transaction_data: any;
  sponsor?: boolean;
}

export interface CreateMemoRequest {
  job_id: number;
  content: string;
  memo_type: number;
  is_secured: boolean;
  next_phase: number;
}

export interface SignMemoRequest {
  memo_id: number;
  is_approved: boolean;
  reason?: string;
}

export interface SetBudgetRequest {
  job_id: number;
  budget: number;
}

export interface TransactionResponse {
  success: boolean;
  hash?: string;
  transaction?: any;
  requires_signature?: boolean;
  chain_id?: number;
  error?: string;
}

export enum ACPJobPhase {
  CREATED = 0,
  IN_PROGRESS = 1,
  COMPLETED = 2,
  CANCELLED = 3,
  EVALUATED = 4
}

export enum MemoType {
  GENERAL = 0,
  PAYMENT = 1,
  DELIVERY = 2,
  EVALUATION = 3
}

export class ACPPythonClient {
  private apiUrl: string;
  private ws: WebSocket | null = null;

  constructor(apiUrl: string = 'http://localhost:8000') {
    this.apiUrl = apiUrl;
  }

  // ===== Job Management =====

  async prepareCreateJob(
    walletId: string,
    providerAddress: string,
    evaluatorAddress: string,
    expiredAt: Date
  ): Promise<TransactionResponse> {
    const response = await fetch(`${this.apiUrl}/api/prepare/create-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_id: walletId,
        provider_address: providerAddress,
        evaluator_address: evaluatorAddress,
        expired_at: expiredAt.toISOString()
      })
    });

    return response.json();
  }

  async executeCreateJob(
    walletId: string,
    authorizationSignature: string,
    transactionData: any
  ): Promise<TransactionResponse> {
    const response = await fetch(`${this.apiUrl}/api/execute/create-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_id: walletId,
        authorization_signature: authorizationSignature,
        transaction_data: transactionData,
        sponsor: true
      })
    });

    return response.json();
  }

  async createJob(
    walletId: string,
    privateKeyBase64: string,
    providerAddress: string,
    evaluatorAddress: string,
    expiredAt: Date
  ): Promise<string> {
    // Step 1: Prepare transaction
    const prepareResult = await this.prepareCreateJob(
      walletId,
      providerAddress,
      evaluatorAddress,
      expiredAt
    );

    if (!prepareResult.success || !prepareResult.transaction) {
      throw new Error('Failed to prepare transaction');
    }

    // Step 2: Generate authorization signature
    const signature = generateAuthorizationSignatureFromBase64(
      privateKeyBase64,
      prepareResult.transaction,
      prepareResult.chain_id || 84532
    );

    // Step 3: Execute transaction
    const executeResult = await this.executeCreateJob(
      walletId,
      signature,
      prepareResult.transaction
    );

    if (!executeResult.success || !executeResult.hash) {
      throw new Error('Failed to execute transaction');
    }

    return executeResult.hash;
  }

  // ===== Memo Management =====

  async prepareCreateMemo(
    jobId: number,
    content: string,
    memoType: MemoType,
    isSecured: boolean,
    nextPhase: ACPJobPhase
  ): Promise<TransactionResponse> {
    const response = await fetch(`${this.apiUrl}/api/prepare/create-memo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        content,
        memo_type: memoType,
        is_secured: isSecured,
        next_phase: nextPhase
      })
    });

    return response.json();
  }

  async executeCreateMemo(
    walletId: string,
    authorizationSignature: string,
    transactionData: any
  ): Promise<TransactionResponse> {
    const response = await fetch(`${this.apiUrl}/api/execute/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_id: walletId,
        authorization_signature: authorizationSignature,
        transaction_data: transactionData,
        sponsor: true
      })
    });

    return response.json();
  }

  async createMemo(
    walletId: string,
    privateKeyBase64: string,
    jobId: number,
    content: string,
    memoType: MemoType,
    isSecured: boolean,
    nextPhase: ACPJobPhase
  ): Promise<string> {
    // Step 1: Prepare transaction
    const prepareResult = await this.prepareCreateMemo(
      jobId,
      content,
      memoType,
      isSecured,
      nextPhase
    );

    if (!prepareResult.success || !prepareResult.transaction) {
      throw new Error('Failed to prepare memo transaction');
    }

    // Step 2: Generate authorization signature
    const signature = generateAuthorizationSignatureFromBase64(
      privateKeyBase64,
      prepareResult.transaction,
      prepareResult.chain_id || 84532
    );

    // Step 3: Execute transaction
    const executeResult = await this.executeCreateMemo(
      walletId,
      signature,
      prepareResult.transaction
    );

    if (!executeResult.success || !executeResult.hash) {
      throw new Error('Failed to create memo');
    }

    return executeResult.hash;
  }

  // ===== Sign Memo =====

  async prepareSignMemo(
    memoId: number,
    isApproved: boolean,
    reason?: string
  ): Promise<TransactionResponse> {
    const response = await fetch(`${this.apiUrl}/api/prepare/sign-memo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memo_id: memoId,
        is_approved: isApproved,
        reason: reason || ''
      })
    });

    return response.json();
  }

  async signMemo(
    walletId: string,
    privateKeyBase64: string,
    memoId: number,
    isApproved: boolean,
    reason?: string
  ): Promise<string> {
    // Step 1: Prepare transaction
    const prepareResult = await this.prepareSignMemo(memoId, isApproved, reason);

    if (!prepareResult.success || !prepareResult.transaction) {
      throw new Error('Failed to prepare sign memo transaction');
    }

    // Step 2: Generate authorization signature
    const signature = generateAuthorizationSignatureFromBase64(
      privateKeyBase64,
      prepareResult.transaction,
      prepareResult.chain_id || 84532
    );

    // Step 3: Execute transaction
    const executeResult = await this.executeCreateMemo(
      walletId,
      signature,
      prepareResult.transaction
    );

    if (!executeResult.success || !executeResult.hash) {
      throw new Error('Failed to sign memo');
    }

    return executeResult.hash;
  }

  // ===== Budget Management =====

  async prepareSetBudget(
    jobId: number,
    budget: number
  ): Promise<TransactionResponse> {
    const response = await fetch(`${this.apiUrl}/api/prepare/set-budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        budget
      })
    });

    return response.json();
  }

  async setBudget(
    walletId: string,
    privateKeyBase64: string,
    jobId: number,
    budget: number
  ): Promise<string> {
    // Step 1: Prepare transaction
    const prepareResult = await this.prepareSetBudget(jobId, budget);

    if (!prepareResult.success || !prepareResult.transaction) {
      throw new Error('Failed to prepare set budget transaction');
    }

    // Step 2: Generate authorization signature
    const signature = generateAuthorizationSignatureFromBase64(
      privateKeyBase64,
      prepareResult.transaction,
      prepareResult.chain_id || 84532
    );

    // Step 3: Execute transaction
    const executeResult = await this.executeCreateMemo(
      walletId,
      signature,
      prepareResult.transaction
    );

    if (!executeResult.success || !executeResult.hash) {
      throw new Error('Failed to set budget');
    }

    return executeResult.hash;
  }

  // ===== WebSocket Support =====

  connectWebSocket(walletId: string, onMessage: (event: any) => void): void {
    const wsUrl = this.apiUrl.replace('http', 'ws');
    this.ws = new WebSocket(`${wsUrl}/ws/${walletId}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Implement reconnection logic if needed
    };
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ===== Utility Methods =====

  async getConfig(): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/config`);
    return response.json();
  }

  async healthCheck(): Promise<any> {
    const response = await fetch(`${this.apiUrl}/health`);
    return response.json();
  }
}

// Export singleton instance
export const acpClient = new ACPPythonClient(
  process.env.NEXT_PUBLIC_ACP_API_URL || 'http://localhost:8000'
);