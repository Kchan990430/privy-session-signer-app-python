import { useState } from 'react';
import { CopyButton } from './CopyButton';

interface SessionSignerPanelProps {
  agentWallet: {
    id: string;
    address: string;
    name: string;
  };
  primaryWalletAddress?: string;
}

export function SessionSignerPanel({ agentWallet, primaryWalletAddress }: SessionSignerPanelProps) {
  const [testResult, setTestResult] = useState<string>('');
  const SESSION_SIGNER_ID = process.env.NEXT_PUBLIC_SESSION_SIGNER_ID || 'qcug48gr4n08hjtzllu4v1o4';

  const testBackendAuth = async () => {
    try {
      setTestResult('Testing backend authorization...');
      
      const response = await fetch('/api/test-with-proper-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: agentWallet.address,
          testMessage: `Test from ${agentWallet.name}`
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setTestResult(`✅ Success: ${data.message || 'Backend can sign transactions'}`);
      } else {
        setTestResult(`❌ Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      setTestResult(`❌ Error: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Session Signer Configuration</h3>
      
      <div className="p-4 bg-gray-50 rounded-lg space-y-3">
        <div>
          <p className="text-sm text-gray-600">Session Signer ID</p>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono">{SESSION_SIGNER_ID}</code>
            <CopyButton text={SESSION_SIGNER_ID} />
          </div>
        </div>
        
        <div>
          <p className="text-sm text-gray-600">Agent Wallet</p>
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono">{agentWallet.address}</code>
            <CopyButton text={agentWallet.address} />
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800 mb-3">
          Test if the backend can sign transactions for this wallet without user approval.
        </p>
        <button
          onClick={testBackendAuth}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Test Backend Authorization
        </button>
        
        {testResult && (
          <div className={`mt-3 text-sm ${
            testResult.includes('✅') ? 'text-green-700' :
            testResult.includes('❌') ? 'text-red-700' :
            'text-gray-700'
          }`}>
            {testResult}
          </div>
        )}
      </div>

      <div className="p-4 bg-yellow-50 rounded-lg">
        <h4 className="font-medium text-yellow-900 mb-2">Important Notes</h4>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>Session signers allow backend to sign without user approval</li>
          <li>The wallet must have the session signer added first</li>
          <li>Check the Overview tab to add/remove session signers</li>
          <li>Backend uses the private key configured in environment variables</li>
        </ul>
      </div>
    </div>
  );
}