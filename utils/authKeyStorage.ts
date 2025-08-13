// Client-side storage for auth keys
const AUTH_KEY_STORAGE_KEY = 'privy_wallet_auth_keys';

export interface StoredAuthConfig {
  walletId: string;
  walletAddress: string;
  keyQuorumId: string;
  authKeyId: string;
  privateKey: string;
  privateKeyBase64: string;
  publicKey: string;
  createdAt: string;
  userId?: string;
}

export class AuthKeyStorage {
  // Save auth config to localStorage
  static save(walletId: string, config: StoredAuthConfig): void {
    if (typeof window === 'undefined') {
      console.error('❌ Cannot save to localStorage: window is undefined (running on server)');
      return;
    }
    
    try {
      console.log(`🔄 Starting save for wallet ${walletId}...`);
      
      // Get existing data
      const stored = this.getAll();
      console.log('📂 Current localStorage entries before save:', Object.keys(stored));
      
      // Add new config
      stored[walletId] = config;
      console.log('📝 Adding new config for:', walletId);
      
      // Save to localStorage
      const jsonString = JSON.stringify(stored);
      console.log('💾 Attempting to save to localStorage...');
      localStorage.setItem(AUTH_KEY_STORAGE_KEY, jsonString);
      
      // Verify it was saved
      const verification = localStorage.getItem(AUTH_KEY_STORAGE_KEY);
      if (verification) {
        const parsed = JSON.parse(verification);
        const hasNewWallet = parsed[walletId] !== undefined;
        console.log(`✅ Save verification for ${walletId}: ${hasNewWallet ? 'SUCCESS' : 'FAILED'}`);
        console.log('📂 Current localStorage entries after save:', Object.keys(parsed));
      } else {
        console.error('❌ localStorage.getItem returned null after save attempt!');
      }
      
    } catch (error) {
      console.error('❌ Failed to save auth config to localStorage:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
  }

  // Get auth config for a specific wallet
  static get(walletId: string): StoredAuthConfig | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = this.getAll();
      return stored[walletId] || null;
    } catch (error) {
      console.error('Failed to get auth config from localStorage:', error);
      return null;
    }
  }

  // Get auth config by wallet address
  static getByAddress(address: string): StoredAuthConfig | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = this.getAll();
      for (const config of Object.values(stored)) {
        if (config.walletAddress.toLowerCase() === address.toLowerCase()) {
          return config;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to get auth config by address:', error);
      return null;
    }
  }

  // Get all stored auth configs
  static getAll(): Record<string, StoredAuthConfig> {
    if (typeof window === 'undefined') {
      console.log('🔍 getAll() called on server side, returning empty object');
      return {};
    }
    
    try {
      console.log('🔍 Getting all auth configs from localStorage...');
      const stored = localStorage.getItem(AUTH_KEY_STORAGE_KEY);
      
      if (!stored) {
        console.log('📂 No auth configs found in localStorage (key not found)');
        return {};
      }
      
      console.log('📂 Raw localStorage data length:', stored.length);
      const parsed = JSON.parse(stored);
      console.log('📂 Parsed auth configs:', Object.keys(parsed));
      return parsed;
    } catch (error) {
      console.error('❌ Failed to parse stored auth configs:', error);
      return {};
    }
  }

  // Delete auth config for a wallet
  static delete(walletId: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = this.getAll();
      delete stored[walletId];
      localStorage.setItem(AUTH_KEY_STORAGE_KEY, JSON.stringify(stored));
      console.log(`Deleted auth config for wallet ${walletId}`);
    } catch (error) {
      console.error('Failed to delete auth config:', error);
    }
  }

  // Clear all stored auth configs
  static clear(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(AUTH_KEY_STORAGE_KEY);
      console.log('Cleared all auth configs from localStorage');
    } catch (error) {
      console.error('Failed to clear auth configs:', error);
    }
  }

  // Restore all auth configs to backend
  static async restoreToBackend(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    try {
      const stored = this.getAll();
      const authConfigs = Object.values(stored);
      
      if (authConfigs.length === 0) {
        console.log('No auth configs to restore');
        return true;
      }

      console.log(`Restoring ${authConfigs.length} auth configs to backend...`);
      
      const response = await fetch('/api/agent-wallets/auth-key/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authConfigs })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Restored ${data.restoredCount} auth configs to backend`);
        return true;
      } else {
        const error = await response.json();
        console.error('Failed to restore auth configs:', error);
        return false;
      }
    } catch (error) {
      console.error('Error restoring auth configs to backend:', error);
      return false;
    }
  }
}