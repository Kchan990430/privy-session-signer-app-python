import { NextApiRequest, NextApiResponse } from 'next';
import { 
  PrivyAuthKeyManager,
  WalletAuthStore 
} from '@virtuals-protocol/acp-node';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { walletId, walletAddress } = req.body;

    if (!walletId || !walletAddress) {
      return res.status(400).json({ error: 'Missing walletId or walletAddress' });
    }

    console.log('Adding auth key to existing wallet:', walletId, walletAddress);

    // Check if wallet already has auth config
    const existingConfig = WalletAuthStore.get(walletId) || WalletAuthStore.getByAddress(walletAddress);
    if (existingConfig && existingConfig.keyQuorumId) {
      return res.status(200).json({
        success: true,
        message: 'Wallet already has auth key configured',
        authKeyId: existingConfig.authKeyId,
        keyQuorumId: existingConfig.keyQuorumId,
        createdAt: existingConfig.createdAt,
        exists: true
      });
    }

    // Initialize auth key manager
    const authKeyManager = new PrivyAuthKeyManager(PRIVY_APP_ID, PRIVY_APP_SECRET);

    // Generate unique P-256 keypair for this wallet
    console.log('Generating unique auth key for wallet...');
    const authKey = await authKeyManager.generateWalletAuthKey();

    // Create Key Quorum with the public key
    console.log('Creating Key Quorum...');
    const keyQuorumId = await authKeyManager.createKeyQuorum(
      authKey.publicKey,
      walletAddress
    );

    // Add the key quorum as a signer to the wallet
    console.log('Adding key quorum to wallet as signer...');
    try {
      // Use Privy SDK to update the wallet
      const { PrivyClient } = await import('@privy-io/server-auth');
      const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
      
      // Update wallet to add the key quorum
      await privy.walletApi.updateWallet({
        id: walletId,
        additionalSigners: [{
          signerId: keyQuorumId
        }]
      });
      
      console.log('Key quorum added to wallet successfully');
    } catch (updateError: any) {
      console.error('Error updating wallet:', updateError);
      // Continue anyway - the key quorum is created
    }

    // Store the auth configuration
    const authConfig = {
      walletId,
      walletAddress,
      keyQuorumId,
      authKeyId: '', // No longer using authorization key API
      privateKey: authKey.privateKey,
      privateKeyBase64: authKey.privateKeyBase64,
      publicKey: authKey.publicKey,
      createdAt: new Date(),
      retrofitted: true // Mark as retrofitted to existing wallet
    };

    WalletAuthStore.save(walletId, authConfig);

    console.log(`✅ Auth key added to wallet ${walletId}`);

    return res.status(200).json({
      success: true,
      message: 'Authorization key added to wallet successfully',
      walletId,
      address: walletAddress,
      authKeyId: keyQuorumId,
      keyQuorumId,
      createdAt: new Date(),
      retrofitted: true,
      // Include full auth config for client storage
      authConfig: {
        walletId,
        walletAddress,
        keyQuorumId,
        authKeyId: '',
        privateKey: authKey.privateKey,
        privateKeyBase64: authKey.privateKeyBase64,
        publicKey: authKey.publicKey,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Error adding auth key to wallet:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to add auth key',
      details: error.toString()
    });
  }
}