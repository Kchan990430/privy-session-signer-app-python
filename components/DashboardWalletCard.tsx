import { useCallback, useState } from "react";
import {
  useSessionSigners,
  WalletWithMetadata,
} from "@privy-io/react-auth";
import { CopyButton } from "./CopyButton";
import { BalanceDisplay } from "./BalanceDisplay";

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

  // Check if this specific wallet has session signers
  const hasSessionSigners = wallet.delegated === true;

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

      {/* Session Signer Controls */}
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
          {isLoading && !hasSessionSigners ? "Adding..." : hasSessionSigners ? "Has Signer ✓" : "Add Session Signer"}
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
          {isLoading && hasSessionSigners ? "Removing..." : "Remove Signer"}
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