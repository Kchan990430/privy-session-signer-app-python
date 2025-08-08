/**
 * Server-side agent wallet registry
 * Uses global variable for demo purposes
 * In production, use a database
 */

interface WalletOwnershipRecord {
  walletId: string;
  walletAddress: string;
  creatorAddress: string;
  agentId: string;
  createdAt: string;
}

// Global in-memory store for demo
// In production, this would be a database connection
const globalRegistry: Record<string, WalletOwnershipRecord> = {};

class ServerAgentWalletRegistry {
  /**
   * Register a new agent wallet with its creator
   */
  async registerWallet(record: WalletOwnershipRecord): Promise<void> {
    globalRegistry[record.walletId] = record;
  }

  /**
   * Get all wallets created by a specific address
   */
  async getWalletsByCreator(creatorAddress: string): Promise<WalletOwnershipRecord[]> {
    const records = Object.values(globalRegistry).filter(
      record => record.creatorAddress.toLowerCase() === creatorAddress.toLowerCase()
    );
    return records;
  }

  /**
   * Get a wallet by ID
   */
  async getWallet(walletId: string): Promise<WalletOwnershipRecord | null> {
    return globalRegistry[walletId] || null;
  }

  /**
   * Check if a wallet belongs to a creator
   */
  async isWalletOwnedBy(walletId: string, creatorAddress: string): Promise<boolean> {
    const record = globalRegistry[walletId];
    return record?.creatorAddress.toLowerCase() === creatorAddress.toLowerCase();
  }

  /**
   * Get all registered wallets (for debugging)
   */
  getAllWallets(): WalletOwnershipRecord[] {
    return Object.values(globalRegistry);
  }
}

export const serverAgentWalletRegistry = new ServerAgentWalletRegistry();
export type { WalletOwnershipRecord };