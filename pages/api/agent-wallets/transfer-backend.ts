import { NextApiRequest, NextApiResponse } from 'next';
import { 
  PrivySessionSigner,
  WalletAuthStore 
} from '@virtuals-protocol/acp-node';
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
    const { walletId, walletAddress, toAddress, amountEth, authConfig } = req.body;

    if (!walletId || !walletAddress || !toAddress || !amountEth) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    console.log('Backend transfer request:', {
      walletId,
      from: walletAddress,
      to: toAddress,
      amount: amountEth
    });

    // Get the wallet's auth configuration
    let walletAuthConfig = WalletAuthStore.get(walletId) || WalletAuthStore.getByAddress(walletAddress);
    
    // If auth config was passed from client (from localStorage), use it
    if (!walletAuthConfig && authConfig) {
      console.log('Using auth config from client localStorage');
      // Restore to in-memory store
      WalletAuthStore.save(walletId, {
        walletId: authConfig.walletId,
        walletAddress: authConfig.walletAddress,
        keyQuorumId: authConfig.keyQuorumId,
        authKeyId: authConfig.authKeyId || '',
        privateKey: authConfig.privateKey,
        privateKeyBase64: authConfig.privateKeyBase64,
        publicKey: authConfig.publicKey,
        createdAt: authConfig.createdAt ? new Date(authConfig.createdAt) : new Date()
      });
      walletAuthConfig = WalletAuthStore.get(walletId);
    }
    
    // Get the actual Privy wallet ID if we only have the address
    let privyWalletId = walletAuthConfig?.walletId;
    if (privyWalletId && privyWalletId.startsWith('0x')) {
      // This is an address, not a Privy wallet ID - need to fetch the actual ID
      console.log('Fetching Privy wallet ID for address:', privyWalletId);
      const { PrivyClient } = await import('@privy-io/server-auth');
      const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET, {
        walletApi: {}
      });
      
      try {
        const walletsResponse = await privy.walletApi.getWallets({
          addresses: [walletAddress]
        });
        if (walletsResponse.data && walletsResponse.data.length > 0) {
          privyWalletId = walletsResponse.data[0].id;
          console.log('✅ Found Privy wallet ID:', privyWalletId);
        }
      } catch (e) {
        console.error('Failed to get Privy wallet ID:', e);
      }
    }
    
    if (!walletAuthConfig) {
      // Check if we can retrieve auth info from the status endpoint
      console.log('Auth config not in memory, checking status...');
      
      // For now, return error - in production you'd want to persist this data
      return res.status(404).json({ 
        error: 'No authorization key found for this wallet. Please provide authConfig or ensure the wallet has an auth key.' 
      });
    }

    console.log('Found auth config for wallet:', {
      walletId: walletAuthConfig.walletId,
      keyQuorumId: walletAuthConfig.keyQuorumId,
      hasPrivateKey: !!walletAuthConfig.privateKeyBase64
    });
    
    console.log('🔑 Privy credentials for session signer:', {
      hasAppId: !!PRIVY_APP_ID,
      appIdPrefix: PRIVY_APP_ID?.substring(0, 10),
      hasAppSecret: !!PRIVY_APP_SECRET,
      secretLength: PRIVY_APP_SECRET?.length
    });

    // Initialize the session signer with the auth key
    const sessionSigner = new PrivySessionSigner({
      walletId: privyWalletId || walletAuthConfig.walletId, // Use the actual Privy wallet ID
      walletAddress: walletAuthConfig.walletAddress as Address,
      privyAppId: PRIVY_APP_ID,
      privyAppSecret: PRIVY_APP_SECRET,
      sessionSignerPrivateKey: walletAuthConfig.privateKeyBase64 || walletAuthConfig.privateKey,
      keyQuorumId: walletAuthConfig.keyQuorumId,
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