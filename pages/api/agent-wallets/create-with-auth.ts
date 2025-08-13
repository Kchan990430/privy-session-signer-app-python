import { NextApiRequest, NextApiResponse } from 'next';
import { 
  PrivySessionSigner,
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
    const { chainType = 'ethereum', userId, serverControlled = false } = req.body;

    console.log(`Creating new ${serverControlled ? 'server-controlled' : 'user-linked'} wallet with auth key...`);

    // Step 1: Initialize auth key manager
    const authKeyManager = new PrivyAuthKeyManager(PRIVY_APP_ID, PRIVY_APP_SECRET);

    // Step 2: Generate unique P-256 keypair for this wallet
    console.log('Generating unique auth key...');
    const authKey = await authKeyManager.generateWalletAuthKey();

    // Step 3: Create Key Quorum with the public key
    console.log('Creating Key Quorum with public key...');
    const tempAddress = `0x${Date.now().toString(16).padEnd(40, '0')}`;
    const keyQuorumId = await authKeyManager.createKeyQuorum(
      authKey.publicKey,
      tempAddress
    );

    let walletId: string;
    let address: string;

    if (userId && !serverControlled) {
      // Create user-linked wallet using Privy SDK
      console.log(`Creating user-linked wallet for user: ${userId}...`);
      const { PrivyClient } = await import('@privy-io/server-auth');
      const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
      
      try {
        // First check if user exists and get current wallet count
        console.log('🔍 Getting user details before wallet creation...');
        const existingUser = await privy.getUser(userId);
        
        console.log('👤 User object structure:', {
          id: existingUser.id,
          email: existingUser.email?.address,
          hasLinkedAccounts: !!existingUser.linked_accounts,
          linkedAccountsLength: existingUser.linked_accounts?.length || 0,
          linkedAccountsType: typeof existingUser.linked_accounts,
          allKeys: Object.keys(existingUser)
        });
        
        // Log detailed linked accounts info
        if (existingUser.linked_accounts && existingUser.linked_accounts.length > 0) {
          console.log('🔗 Linked accounts details:');
          existingUser.linked_accounts.forEach((account: any, index: number) => {
            console.log(`  ${index + 1}. Type: ${account.type}, Address: ${account.address}, ClientType: ${account.walletClientType}`);
          });
        } else {
          console.log('❌ No linked accounts found or linked_accounts is null/undefined');
          console.log('   This might indicate a Privy API issue or user not properly authenticated');
        }
        
        const existingWallets = existingUser.linked_accounts
          ?.filter((account: any) => account.type === 'wallet') || [];
        console.log(`📊 Summary: User ${userId} has ${existingWallets.length} existing wallet accounts`);

        console.log('Calling privy.createWallets with createAdditional: true...');
        console.log('User ID format check:', {
          userId,
          userIdType: typeof userId,
          userIdLength: userId?.length,
          startsWithDid: userId?.startsWith('did:privy:')
        });
        
        // Verify user exists and get user details
        console.log('Verifying user before wallet creation...');
        const userCheck = await privy.getUser(userId);
        console.log('User verification result:', {
          id: userCheck.id,
          email: userCheck.email?.address,
          linkedAccountsLength: userCheck.linked_accounts?.length || 0,
          linkedAccountTypes: userCheck.linked_accounts?.map(acc => acc.type) || []
        });
        
        console.log('Request payload:', {
          userId,
          createAdditional: true,
          wallets: [{
            chainType: chainType as 'ethereum' | 'solana',
            additionalSigners: [{
              signerId: keyQuorumId
            }]
          }]
        });
        
        const updatedUser = await privy.createWallets({
          userId,
          createAdditional: true, // Allow multiple wallets per user - MUST be at top level
          wallets: [{
            chainType: chainType as 'ethereum' | 'solana',
            additionalSigners: [{
              signerId: keyQuorumId
            }]
          }]
        });

        console.log('createWallets completed, response type:', typeof updatedUser);
        console.log('createWallets response keys:', Object.keys(updatedUser || {}));
        
        // Check if the response contains newly created wallets directly
        if (updatedUser.linkedAccounts) {
          console.log('linkedAccounts in createWallets response:', updatedUser.linkedAccounts.length);
          const walletsInResponse = updatedUser.linkedAccounts
            .filter((acc: any) => acc.type === 'wallet')
            .map((acc: any) => ({
              address: acc.address,
              walletClientType: acc.walletClientType,
              created_at: acc.created_at
            }));
          console.log('Wallet accounts in response:', walletsInResponse);
          
          // Find the newly created embedded wallet by comparing with existing wallets
          const newEmbeddedWallets = walletsInResponse.filter((w: any) => w.walletClientType === 'privy');
          console.log('All embedded wallets found:', newEmbeddedWallets.length);
          
          // Find which embedded wallet is actually NEW (wasn't in existingWallets)
          let actuallyNewWallet = null;
          for (const wallet of newEmbeddedWallets) {
            const existedBefore = existingWallets.some(existing => 
              existing.address.toLowerCase() === wallet.address.toLowerCase()
            );
            if (!existedBefore) {
              actuallyNewWallet = wallet;
              console.log(`🆕 Found truly NEW embedded wallet: ${wallet.address}`);
              break;
            } else {
              console.log(`⏭️ Skipping existing embedded wallet: ${wallet.address}`);
            }
          }
          
          if (actuallyNewWallet) {
            // Try to get the actual wallet ID from Privy
            try {
              const walletsResponse = await privy.walletApi.getWallets({
                addresses: [actuallyNewWallet.address]
              });
              if (walletsResponse.data && walletsResponse.data.length > 0) {
                walletId = walletsResponse.data[0].id; // Use actual Privy wallet ID
                console.log(`✅ Got Privy wallet ID: ${walletId}`);
              } else {
                walletId = actuallyNewWallet.address; // Fallback to address
              }
            } catch (e) {
              walletId = actuallyNewWallet.address; // Fallback to address
            }
            address = actuallyNewWallet.address;
            console.log(`✅ Using newly created embedded wallet: ${walletId} at ${address}`);
            
            // Skip the rest of the detection logic since we found the wallet
            // Jump to storing auth configuration
          } else {
            console.log('❌ No truly new embedded wallets found - all were pre-existing');
          }
        }

        // Only run fallback detection if we didn't find wallet in createWallets response
        if (!walletId) {
          console.log('Wallet not found in createWallets response, trying fallback detection...');
          
          // Check if wallet is directly in the response
          if (updatedUser.wallet) {
            console.log('Found wallet in direct response:', {
              address: updatedUser.wallet.address,
              id: updatedUser.wallet.id
            });
          }

          // Parse the newest wallet from the response
          console.log('Parsing wallet from createWallets response...');
          
          // Wait a moment for wallet to be linked to user account
          console.log('Waiting 2 seconds for wallet to be properly linked...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Get the user again to find the newest wallet
          const userWithWallets = await privy.getUser(userId);
          console.log('Fresh user object keys:', Object.keys(userWithWallets));
          console.log('Fresh user linked_accounts length:', userWithWallets.linked_accounts?.length || 0);
          console.log('All linked accounts:', userWithWallets.linked_accounts?.map(acc => ({
            type: acc.type,
            address: acc.address,
            walletClientType: acc.walletClientType,
            created_at: acc.created_at
          })));
          
          // Try multiple places to find wallets
          let wallets: any[] = [];
          
          // 1. Check linked_accounts
          if (userWithWallets.linked_accounts) {
            wallets = userWithWallets.linked_accounts
              .filter((account: any) => account.type === 'wallet')
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
            console.log('Filtered wallet accounts from linked_accounts:', wallets.length);
            console.log('Wallet details from linked_accounts:', wallets.map(w => ({
              address: w.address,
              walletClientType: w.walletClientType,
              created_at: w.created_at,
              type: w.type
            })));
          }
          
          // 2. Check direct wallet field if no wallets found in linked_accounts
          if (!wallets.length && userWithWallets.wallet) {
            console.log('Checking wallet field:', userWithWallets.wallet);
            const directWallet = userWithWallets.wallet;
            
            // Only use embedded wallets (not external like MetaMask)
            // Also check if this is a newly created wallet by comparing creation times
            if (directWallet.walletClientType === 'privy') {
              // Check if this wallet was created after our request started
              const walletCreatedAt = new Date(directWallet.created_at);
              const requestStartTime = new Date(Date.now() - 30000); // 30 seconds ago
              
              if (walletCreatedAt > requestStartTime) {
                console.log('Found newly created embedded wallet:', {
                  address: directWallet.address,
                  walletClientType: directWallet.walletClientType,
                  created_at: directWallet.created_at
                });
                wallets = Array.isArray(directWallet) ? directWallet : [directWallet];
              } else {
                console.log('Skipping old embedded wallet (not newly created):', {
                  address: directWallet.address,
                  walletClientType: directWallet.walletClientType,
                  created_at: directWallet.created_at
                });
              }
            } else {
              console.log('Skipping external wallet:', {
                address: directWallet.address,
                walletClientType: directWallet.walletClientType
              });
            }
          }
          
          console.log(`After creation, user has ${wallets.length} embedded wallets`);
          console.log('Wallet details:', wallets.map(w => ({ 
            address: w.address, 
            created_at: w.created_at, 
            id: w.id,
            walletClientType: w.walletClientType 
          })));
          
          // Only count embedded wallets for comparison
          const embeddedExistingWallets = existingWallets.filter(w => w.walletClientType === 'privy');
          
          if (wallets.length > 0) {
            // Find the newest wallet that wasn't in the existing list
            let newestWallet = null;
            
            for (const wallet of wallets) {
              // Check if this wallet existed before
              const existedBefore = existingWallets.some(existing => existing.address === wallet.address);
              if (!existedBefore) {
                newestWallet = wallet;
                break;
              }
            }
            
            if (newestWallet) {
              walletId = newestWallet.address; // Use address as ID for consistency
              address = newestWallet.address;
              console.log(`✅ Created NEW user-linked embedded wallet: ${walletId} at ${address}`);
            } else {
              console.error('No new wallet found - all wallets existed before creation');
              console.error('Existing wallets:', existingWallets.map(w => ({ address: w.address, created_at: w.created_at })));
              console.error('Current wallets:', wallets.map(w => ({ address: w.address, created_at: w.created_at })));
              throw new Error('No new wallet was created - all returned wallets existed before.');
            }
          } else {
            console.error('Wallet creation failed - possible causes:');
            console.error('1. TEE execution mode prevents additional wallet creation');
            console.error('2. User has reached wallet limit');
            console.error('3. Privy app configuration issue');
            console.error('4. createAdditional parameter not working');
            throw new Error(`No new wallet was created. User had ${existingWallets.length} wallets before and ${wallets.length} after creation.`);
          }
        }
      } catch (error: any) {
        console.error('User-linked wallet creation failed:', error.message);
        console.log('Error details:', error);
        throw error; // Don't fallback - just fail if user-linked wallet creation fails
      }
    } else {
      throw new Error('User ID is required for wallet creation');
    }

    // Step 5: Store the auth configuration
    const authConfig = {
      walletId,
      walletAddress: address,
      keyQuorumId,
      authKeyId: '',
      privateKey: authKey.privateKey,
      privateKeyBase64: authKey.privateKeyBase64,
      publicKey: authKey.publicKey,
      createdAt: new Date(),
      userId: userId || null // Optional: associate with user for tracking
    };

    WalletAuthStore.save(walletId, authConfig);
    console.log('✅ Auth configuration saved to backend store');

    const isUserLinked = userId && !serverControlled;
    const response = {
      success: true,
      message: isUserLinked 
        ? 'User-linked wallet created with auth key for backend control'
        : 'Server-controlled wallet created with auth key for backend control',
      walletId,
      address,
      authKeyId: keyQuorumId,
      keyQuorumId,
      chainType,
      hasAuthKey: true,
      linkedToUser: isUserLinked,
      userId: userId || null,
      createdAt: new Date().toISOString(),
      // Include auth configuration for localStorage storage
      authConfig: {
        walletId,
        walletAddress: address,
        keyQuorumId,
        authKeyId: '',
        privateKey: authKey.privateKey,
        privateKeyBase64: authKey.privateKeyBase64,
        publicKey: authKey.publicKey,
        createdAt: new Date().toISOString()
      }
    };
    
    console.log('✅ Returning success response with auth config');
    return res.status(200).json(response);

  } catch (error: any) {
    console.error('❌ Error creating wallet with auth:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create wallet',
      details: error.toString()
    });
  }
}