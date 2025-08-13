import { useCallback, useState, useEffect } from "react";
import {
  useSessionSigners,
  WalletWithMetadata,
} from "@privy-io/react-auth";
import { CopyButton } from "./CopyButton";
import { BalanceDisplay } from "./BalanceDisplay";
import { AuthKeyStorage } from "../utils/authKeyStorage";

const SESSION_SIGNER_ID = process.env.NEXT_PUBLIC_SESSION_SIGNER_ID || 'qcug48gr4n08hjtzllu4v1o4';

interface DashboardWalletCardProps {
  wallet: WalletWithMetadata;
  isPrimary?: boolean;
  onUpdate?: () => void;
}

export default function DashboardWalletCard({ wallet, isPrimary = false, onUpdate }: DashboardWalletCardProps) {
  const { addSessionSigners, removeSessionSigners } = useSessionSigners();
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [authKeyInfo, setAuthKeyInfo] = useState<any>(null);
  const [showAuthKeyPanel, setShowAuthKeyPanel] = useState(false);

  // Check if this specific wallet has session signers
  const hasSessionSigners = wallet.delegated === true;

  // Check auth key status only on mount and when explicitly needed
  useEffect(() => {
    // First check localStorage
    const walletId = (wallet as any).id || 
                   (wallet as any).wallet_id || 
                   `agent-${wallet.address}` ||
                   wallet.address;
    
    const storedConfig = AuthKeyStorage.get(walletId) || AuthKeyStorage.getByAddress(wallet.address);
    if (storedConfig) {
      setAuthKeyInfo({
        exists: true,
        authKeyId: storedConfig.authKeyId,
        keyQuorumId: storedConfig.keyQuorumId,
        walletAddress: storedConfig.walletAddress,
        createdAt: storedConfig.createdAt
      });
    }
    
    checkAuthKeyStatus();
  }, [wallet.address]); // Only re-run if wallet address changes
  
  // Refresh auth key status after create/rotate/revoke operations
  const refreshAuthKeyStatus = () => {
    checkAuthKeyStatus();
  };

  const checkAuthKeyStatus = async () => {
    try {
      const response = await fetch('/api/agent-wallets/auth-key/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletId: (wallet as any).id || wallet.address,
          walletAddress: wallet.address 
        })
      });
      if (response.ok) {
        const data = await response.json();
        setAuthKeyInfo(data);
      }
    } catch (error) {
      console.error('Error checking auth key status:', error);
    }
  };

  // Create per-wallet authorization key
  const createAuthKey = async () => {
    setIsLoading(true);
    setStatusMessage("Creating authorization key...");
    
    try {
      // Try to add auth key to existing wallet first
      const walletId = (wallet as any).id || 
                      (wallet as any).wallet_id || 
                      `agent-${wallet.address}` ||
                      wallet.address;
      
      const response = await fetch('/api/agent-wallets/add-auth-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId,
          walletAddress: wallet.address
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatusMessage("✅ Auth key created and session signer added!");
        setAuthKeyInfo(data);
        
        // Save to localStorage
        if (data.authConfig) {
          AuthKeyStorage.save(walletId, data.authConfig);
          console.log('Auth config saved to localStorage');
          
          // Also restore to backend immediately
          await AuthKeyStorage.restoreToBackend();
        }
        
        refreshAuthKeyStatus(); // Refresh to get latest status
        if (onUpdate) onUpdate();
        
        // Reload page after successful auth key creation
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setStatusMessage(`❌ Failed: ${data.error}`);
      }
      
      setTimeout(() => setStatusMessage(""), 3000);
    } catch (error: any) {
      setStatusMessage(`❌ Error: ${error.message}`);
      setTimeout(() => setStatusMessage(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Rotate authorization key
  const rotateAuthKey = async () => {
    setIsLoading(true);
    setStatusMessage("Rotating authorization key...");
    
    try {
      const response = await fetch('/api/agent-wallets/auth-key/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: (wallet as any).id || wallet.address,
          walletAddress: wallet.address
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatusMessage("✅ Auth key rotated successfully!");
        setAuthKeyInfo(data);
        refreshAuthKeyStatus(); // Refresh to get latest status
        if (onUpdate) onUpdate();
      } else {
        setStatusMessage(`❌ Failed: ${data.error}`);
      }
      
      setTimeout(() => setStatusMessage(""), 3000);
    } catch (error: any) {
      setStatusMessage(`❌ Error: ${error.message}`);
      setTimeout(() => setStatusMessage(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Revoke authorization
  const revokeAuth = async () => {
    if (!confirm('Are you sure you want to revoke authorization? This will remove backend control.')) {
      return;
    }
    
    setIsLoading(true);
    setStatusMessage("Revoking authorization...");
    
    try {
      const response = await fetch('/api/agent-wallets/auth-key/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: (wallet as any).id || wallet.address
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatusMessage("✅ Authorization revoked!");
        setAuthKeyInfo(null);
        refreshAuthKeyStatus(); // Refresh to confirm revocation
        if (onUpdate) onUpdate();
      } else {
        setStatusMessage(`❌ Failed: ${data.error}`);
      }
      
      setTimeout(() => setStatusMessage(""), 3000);
    } catch (error: any) {
      setStatusMessage(`❌ Error: ${error.message}`);
      setTimeout(() => setStatusMessage(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Test transaction with auth key
  const testTransaction = async (testType: string = 'simple') => {
    setIsLoading(true);
    setStatusMessage(`Testing ${testType} transaction...`);
    
    try {
      const response = await fetch('/api/agent-wallets/auth-key/test-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: (wallet as any).id || wallet.address,
          walletAddress: wallet.address,
          testType
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatusMessage(`✅ ${data.message}`);
      } else {
        setStatusMessage(`❌ Failed: ${data.error}`);
      }
      
      setTimeout(() => setStatusMessage(""), 5000);
    } catch (error: any) {
      setStatusMessage(`❌ Error: ${error.message}`);
      setTimeout(() => setStatusMessage(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const addSessionSigner = useCallback(
    async () => {
      if (!SESSION_SIGNER_ID) {
        setStatusMessage("❌ SESSION_SIGNER_ID not configured");
        return;
      }

      setIsLoading(true);
      setStatusMessage("Adding session signer...");
      
      try {
        await addSessionSigners({
          address: wallet.address,
          signers: [
            {
              signerId: SESSION_SIGNER_ID,
              policyIds: [], // No policies for now
            },
          ],
        });
        
        setStatusMessage("✅ Session signer added successfully!");
        
        // Register with backend
        await fetch('/api/agent-wallets/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletId: (wallet as any).id || wallet.address,
            walletAddress: wallet.address,
            sessionSignerId: SESSION_SIGNER_ID,
            chainType: wallet.chainType || 'ethereum'
          })
        });
        
        // Call onUpdate to refresh parent component
        if (onUpdate) onUpdate();
        
        // Clear status after 3 seconds
        setTimeout(() => setStatusMessage(""), 3000);
      } catch (error: any) {
        console.error("Error adding session signer:", error);
        setStatusMessage(`❌ Failed: ${error.message}`);
        setTimeout(() => setStatusMessage(""), 5000);
      } finally {
        setIsLoading(false);
      }
    },
    [wallet, addSessionSigners, onUpdate]
  );

  const removeSessionSigner = useCallback(
    async () => {
      setIsLoading(true);
      setStatusMessage("Removing session signers...");
      
      try {
        await removeSessionSigners({ address: wallet.address });
        setStatusMessage("✅ Session signers removed!");
        
        // Call onUpdate to refresh parent component
        if (onUpdate) onUpdate();
        
        // Clear status after 3 seconds
        setTimeout(() => setStatusMessage(""), 3000);
      } catch (error: any) {
        console.error("Error removing session signer:", error);
        setStatusMessage(`❌ Failed: ${error.message}`);
        setTimeout(() => setStatusMessage(""), 5000);
      } finally {
        setIsLoading(false);
      }
    },
    [wallet, removeSessionSigners, onUpdate]
  );

  return (
    <div className={`p-4 border rounded-lg ${isPrimary ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            {isPrimary && (
              <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">PRIMARY</span>
            )}
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
              {wallet.walletClientType === 'privy' ? 'EMBEDDED' : wallet.walletClientType?.toUpperCase() || 'EOA'}
            </span>
            {hasSessionSigners && (
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">
                DELEGATED
              </span>
            )}
          </div>
          
          <div className="mt-2 flex items-center gap-2">
            <code className="text-sm font-mono">
              {wallet.address.slice(0, 12)}...{wallet.address.slice(-8)}
            </code>
            <CopyButton text={wallet.address} />
          </div>
          
          {(wallet as any).id && (
            <div className="text-xs text-gray-500 mt-1">
              ID: {(wallet as any).id}
            </div>
          )}
        </div>
        
        <div className="text-right">
          <BalanceDisplay address={wallet.address} />
        </div>
      </div>

      {/* Auth Key Management Toggle */}
      <button
        onClick={() => setShowAuthKeyPanel(!showAuthKeyPanel)}
        className="w-full mt-3 text-sm py-2 px-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
      >
        {showAuthKeyPanel ? "Hide" : "Show"} Per-Wallet Auth Key Management
      </button>

      {/* Auth Key Management Panel */}
      {showAuthKeyPanel && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-3">
          {authKeyInfo ? (
            <div className="space-y-2">
              <div className="text-xs">
                <span className="font-semibold">Auth Key ID:</span> {authKeyInfo.authKeyId}
              </div>
              <div className="text-xs">
                <span className="font-semibold">Key Quorum ID:</span> {authKeyInfo.keyQuorumId}
              </div>
              <div className="text-xs">
                <span className="font-semibold">Created:</span> {new Date(authKeyInfo.createdAt).toLocaleString()}
              </div>
              
              {/* Test Buttons */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => testTransaction('simple')}
                  disabled={isLoading}
                  className="flex-1 text-xs py-1 px-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Test Simple Tx
                </button>
                <button
                  onClick={() => testTransaction('memo')}
                  disabled={isLoading}
                  className="flex-1 text-xs py-1 px-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Test Memo
                </button>
                <button
                  onClick={() => testTransaction('job')}
                  disabled={isLoading}
                  className="flex-1 text-xs py-1 px-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Test Job
                </button>
              </div>
              
              {/* Management Buttons */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={rotateAuthKey}
                  disabled={isLoading}
                  className="flex-1 text-xs py-1 px-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-gray-400"
                >
                  Rotate Key
                </button>
                <button
                  onClick={revokeAuth}
                  disabled={isLoading}
                  className="flex-1 text-xs py-1 px-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                >
                  Revoke Auth
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">No authorization key found</p>
              <button
                onClick={createAuthKey}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                Create Auth Key & Add Signer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Original Session Signer Controls (Legacy) */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={addSessionSigner}
          disabled={isLoading || hasSessionSigners}
          className={`flex-1 text-sm py-2 px-3 rounded-md text-white transition-colors ${
            isLoading || hasSessionSigners
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {isLoading && !hasSessionSigners ? "Adding..." : hasSessionSigners ? "Has Signer ✓" : "Add Legacy Signer"}
        </button>

        <button
          onClick={removeSessionSigner}
          disabled={isLoading || !hasSessionSigners}
          className={`flex-1 text-sm py-2 px-3 rounded-md text-white transition-colors ${
            isLoading || !hasSessionSigners
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {isLoading && hasSessionSigners ? "Removing..." : "Remove Legacy Signer"}
        </button>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className={`mt-2 text-sm ${
          statusMessage.includes('✅') ? 'text-green-600' :
          statusMessage.includes('❌') ? 'text-red-600' :
          'text-blue-600'
        }`}>
          {statusMessage}
        </div>
      )}

      {/* Info */}
      {hasSessionSigners && !statusMessage && (
        <div className="mt-2 text-xs text-gray-600">
          Backend can sign transactions without user approval
        </div>
      )}
    </div>
  );
}