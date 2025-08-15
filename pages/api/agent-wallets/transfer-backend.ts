import { NextApiRequest, NextApiResponse } from 'next';
import { parseEther, Address } from 'viem';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔍 Transfer backend API called');
    console.log('🔑 Environment variables check:', {
      hasPrivyAppId: !!PRIVY_APP_ID,
      privyAppIdLength: PRIVY_APP_ID?.length || 0,
      privyAppIdPrefix: PRIVY_APP_ID?.substring(0, 10) || 'undefined',
      hasPrivyAppSecret: !!PRIVY_APP_SECRET,
      privyAppSecretLength: PRIVY_APP_SECRET?.length || 0
    });
    
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
      console.error('❌ Missing Privy environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error: Privy credentials not found' 
      });
    }
    let { walletId, walletAddress, toAddress, amountEth, privateKeyBase64 } = req.body;
    
    // If walletId looks like "agent-0x..." it's not a real Privy wallet ID
    // We need to look up the actual wallet ID
    if (walletId && walletId.startsWith('agent-')) {
      console.log('Detected custom wallet ID format, looking up actual Privy wallet ID...');
      const addressFromId = walletId.replace('agent-', '');
      
      try {
        // Try to find the actual wallet ID
        const { PrivyClient } = await import('@privy-io/server-auth');
        const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
        const walletsResponse = await privy.walletApi.getWallets();
        
        const wallet = walletsResponse.data?.find(
          w => w.address.toLowerCase() === addressFromId.toLowerCase()
        );
        
        if (wallet) {
          console.log(`Found Privy wallet ID: ${wallet.id} for address: ${addressFromId}`);
          walletId = wallet.id;
          walletAddress = wallet.address;
        } else {
          console.error(`No Privy wallet found for address: ${addressFromId}`);
          return res.status(404).json({ 
            error: 'Wallet not found in Privy',
            details: `No Privy wallet exists for address ${addressFromId}. Please create the wallet through Privy first.`
          });
        }
      } catch (lookupError: any) {
        console.error('Failed to lookup wallet ID:', lookupError);
      }
    }

    if (!walletId || !walletAddress || !toAddress || !amountEth) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Backend transfer request:', {
      walletId,
      from: walletAddress,
      to: toAddress,
      amount: amountEth
    });

    // Private key must be provided per request - we don't store them
    if (!privateKeyBase64) {
      return res.status(400).json({ 
        error: 'Private key (base64 format) required for backend transfer' 
      });
    }
    
    // Dynamic import to avoid webpack bundling issues
    let PrivySessionSigner, WalletAuthStore;
    try {
      // Try using require for Node.js environment
      const acpNode = require('@virtuals-protocol/acp-node');
      console.log('Module loaded via require');
      PrivySessionSigner = acpNode.PrivySessionSigner;
      WalletAuthStore = acpNode.WalletAuthStore;
    } catch (requireError) {
      console.error('Require failed, trying dynamic import:', requireError);
      // Fallback to dynamic import
      const acpNode = await import('@virtuals-protocol/acp-node');
      PrivySessionSigner = acpNode.PrivySessionSigner;
      WalletAuthStore = acpNode.WalletAuthStore;
    }
    
    if (!PrivySessionSigner) {
      console.error('PrivySessionSigner not found in imported module');
      return res.status(500).json({ error: 'Module import error' });
    }
    
    console.log('Using provided private key for transfer');
    
    // Initialize the session signer with the provided private key
    // Note: keyQuorumId is not needed - the private key is sufficient for authorization
    const sessionSigner = new PrivySessionSigner({
      walletId: walletId,
      walletAddress: walletAddress as Address,
      privyAppId: PRIVY_APP_ID,
      privyAppSecret: PRIVY_APP_SECRET,
      sessionSignerPrivateKey: privateKeyBase64,
      chainId: 84532 // Base Sepolia
    });

    // Parse the amount to wei
    const amountWei = parseEther(amountEth);

    console.log('Sending transaction via backend session signer...');

    // Send the transfer transaction using the backend session signer
    // This should NOT require user approval
    const txHash = await sessionSigner.transferFunds(
      toAddress as Address,
      amountWei
    );

    console.log('Transaction sent successfully:', txHash);

    return res.status(200).json({
      success: true,
      message: 'Transfer sent without user approval',
      transactionHash: txHash,
      from: walletAddress,
      to: toAddress,
      amount: amountEth,
      usedAuthKey: true
    });

  } catch (error: any) {
    console.error('Backend transfer error:', error);
    
    // Provide helpful error messages
    if (error.message?.includes('authorization')) {
      return res.status(500).json({ 
        error: 'Authorization failed. Ensure the wallet has a properly configured auth key and key quorum.',
        details: error.message
      });
    }
    
    if (error.message?.includes('insufficient')) {
      return res.status(400).json({ 
        error: 'Insufficient balance in wallet',
        details: error.message
      });
    }
    
    return res.status(500).json({ 
      error: error.message || 'Failed to transfer funds',
      details: error.toString()
    });
  }
}