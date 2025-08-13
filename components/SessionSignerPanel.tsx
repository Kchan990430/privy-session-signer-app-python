import { useState, useEffect } from 'react';
import { CopyButton } from './CopyButton';

interface SessionSignerPanelProps {
  agentWallet: {
    id: string;
    address: string;
    name: string;
  };
}

export function SessionSignerPanel({ agentWallet }: SessionSignerPanelProps) {
  const [testResult, setTestResult] = useState<string>('');
  const [authKeyInfo, setAuthKeyInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const SESSION_SIGNER_ID = process.env.NEXT_PUBLIC_SESSION_SIGNER_ID || 'qcug48gr4n08hjtzllu4v1o4';

  useEffect(() => {
    checkAuthKeyStatus();
  }, [agentWallet.id]);

  const checkAuthKeyStatus = async () => {
    try {
      const response = await fetch('/api/agent-wallets/auth-key/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletId: agentWallet.id,
          walletAddress: agentWallet.address 
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          setAuthKeyInfo(data);
        }
      }
    } catch (error) {
      console.error('Error checking auth key status:', error);
    }
  };

  const testWithAuthKey = async (testType: string = 'simple') => {
    try {
      setIsLoading(true);
      setTestResult(`Testing ${testType} transaction with auth key...`);
      
      const response = await fetch('/api/agent-wallets/auth-key/test-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: agentWallet.id,
          walletAddress: agentWallet.address,
          testType
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setTestResult(`✅ ${data.message}\nTx Hash: ${data.transactionHash}`);
      } else {
        setTestResult(`❌ Failed: ${data.error}`);
      }
    } catch (error: any) {
      setTestResult(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

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
      
      {/* Per-Wallet Auth Key Info */}
      {authKeyInfo && (
        <div className="p-4 bg-green-50 rounded-lg space-y-3">
          <h4 className="font-semibold text-green-900">✅ Per-Wallet Authorization Key Active</h4>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-gray-600">Auth Key ID</p>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs">{authKeyInfo.authKeyId}</code>
                <CopyButton text={authKeyInfo.authKeyId} />
              </div>
            </div>
            <div>
              <p className="text-gray-600">Key Quorum ID</p>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs">{authKeyInfo.keyQuorumId}</code>
                <CopyButton text={authKeyInfo.keyQuorumId} />
              </div>
            </div>
            <div>
              <p className="text-gray-600">Created</p>
              <code className="font-mono text-xs">{new Date(authKeyInfo.createdAt).toLocaleString()}</code>
            </div>
          </div>
          
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => testWithAuthKey('simple')}
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              Test Simple Tx
            </button>
            <button
              onClick={() => testWithAuthKey('memo')}
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              Test Memo
            </button>
            <button
              onClick={() => testWithAuthKey('job')}
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              Test Job
            </button>
          </div>
        </div>
      )}
      
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
          {authKeyInfo 
            ? "Test transactions using the per-wallet authorization key."
            : "Test if the backend can sign transactions for this wallet without user approval."}
        </p>
        <button
          onClick={testBackendAuth}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          Test Legacy Backend Authorization
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
          <li>Per-wallet auth keys provide enhanced security - each wallet has unique keys</li>
          <li>Auth keys can be rotated for security without affecting other wallets</li>
          <li>Session signers allow backend to sign without user approval</li>
          <li>The wallet must have the session signer added first</li>
          <li>Check the Overview tab to manage authorization keys</li>
        </ul>
      </div>
    </div>
  );
}