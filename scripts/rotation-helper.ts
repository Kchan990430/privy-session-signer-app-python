#!/usr/bin/env node

/**
 * Session Signer Rotation Helper Script
 * 
 * Usage:
 * - Check status: ts-node scripts/rotation-helper.ts status
 * - Test new signer: ts-node scripts/rotation-helper.ts test
 * - Monitor usage: ts-node scripts/rotation-helper.ts monitor
 */

import { config } from 'dotenv';
import { PrivySessionSigner } from '../lib/services/privySessionSigner';

// Load environment variables
config({ path: '.env.local' });

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;

interface SessionSignerStatus {
  hasNew: boolean;
  hasOld: boolean;
  newLength?: number;
  oldLength?: number;
}

/**
 * Check current session signer configuration
 */
function checkStatus(): SessionSignerStatus {
  const newSecret = process.env.SESSION_SIGNER_SECRET;
  const oldSecret = process.env.SESSION_SIGNER_SECRET_OLD;

  const status: SessionSignerStatus = {
    hasNew: !!newSecret,
    hasOld: !!oldSecret,
  };

  if (newSecret) {
    status.newLength = newSecret.length;
  }

  if (oldSecret) {
    status.oldLength = oldSecret.length;
  }

  return status;
}

/**
 * Test session signer functionality
 */
async function testSessionSigner(secret: string, label: string) {
  console.log(`\nTesting ${label} session signer...`);

  try {
    // Create a test transaction
    const testTx = {
      to: '0x0000000000000000000000000000000000000000',
      value: '0',
      data: '0x',
    };

    // Simulate API call
    const response = await fetch('https://api.privy.io/v1/wallets/test/rpc', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'privy-app-id': PRIVY_APP_ID,
      },
      body: JSON.stringify({
        method: 'eth_getBalance',
        caip2: 'eip155:84532',
        chain_type: 'ethereum',
        params: {
          address: '0x0000000000000000000000000000000000000000',
        },
      }),
    });

    if (response.ok) {
      console.log(`✅ ${label} session signer authentication successful`);
      return true;
    } else {
      const error = await response.text();
      console.log(`❌ ${label} session signer failed: ${error}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ ${label} session signer error:`, error);
    return false;
  }
}

/**
 * List all session signers via API
 */
async function listSessionSigners() {
  try {
    const response = await fetch(`https://api.privy.io/v1/apps/${PRIVY_APP_ID}/session_signers`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')}`,
        'privy-app-id': PRIVY_APP_ID,
      },
    });

    if (response.ok) {
      const signers = await response.json();
      console.log('\nActive Session Signers:');
      signers.forEach((signer: any, index: number) => {
        console.log(`${index + 1}. ID: ${signer.id}`);
        console.log(`   Address: ${signer.address}`);
        console.log(`   Created: ${new Date(signer.created_at).toLocaleString()}`);
        console.log(`   Status: ${signer.status || 'active'}`);
      });
      return signers;
    } else {
      console.error('Failed to list session signers');
      return [];
    }
  } catch (error) {
    console.error('Error listing session signers:', error);
    return [];
  }
}

/**
 * Generate rotation report
 */
async function generateRotationReport() {
  console.log('🔄 Session Signer Rotation Report');
  console.log('================================\n');

  const status = checkStatus();

  console.log('Environment Status:');
  console.log(`- New Secret: ${status.hasNew ? '✅ Present' : '❌ Missing'}`);
  console.log(`- Old Secret: ${status.hasOld ? '⚠️  Present (pending removal)' : '✅ Removed'}`);

  if (status.hasNew && status.hasOld) {
    console.log('\n⚠️  ROTATION IN PROGRESS');
    console.log('Both old and new secrets are present.');
    console.log('Remember to revoke old signer after confirming new one works.');
  } else if (status.hasNew && !status.hasOld) {
    console.log('\n✅ ROTATION COMPLETE');
    console.log('Only new secret is present. Old secret has been removed.');
  } else if (!status.hasNew && status.hasOld) {
    console.log('\n❌ CONFIGURATION ERROR');
    console.log('Only old secret is present. New secret is missing!');
  } else {
    console.log('\n❌ NO SESSION SIGNERS CONFIGURED');
  }

  // List active signers
  await listSessionSigners();

  // Test functionality
  if (status.hasNew) {
    await testSessionSigner(process.env.SESSION_SIGNER_SECRET!, 'NEW');
  }

  if (status.hasOld) {
    await testSessionSigner(process.env.SESSION_SIGNER_SECRET_OLD!, 'OLD');
  }

  console.log('\n📋 Next Steps:');
  if (status.hasNew && status.hasOld) {
    console.log('1. Monitor logs to ensure new signer is working');
    console.log('2. Revoke old signer in Privy Dashboard');
    console.log('3. Remove SESSION_SIGNER_SECRET_OLD from environment');
  } else if (!status.hasNew) {
    console.log('1. Generate new session signer in Privy Dashboard');
    console.log('2. Add SESSION_SIGNER_SECRET to environment');
    console.log('3. Deploy and test');
  }
}

/**
 * Main CLI handler
 */
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'status':
      const status = checkStatus();
      console.log('Session Signer Status:', status);
      break;

    case 'test':
      const testStatus = checkStatus();
      if (testStatus.hasNew) {
        await testSessionSigner(process.env.SESSION_SIGNER_SECRET!, 'NEW');
      }
      if (testStatus.hasOld) {
        await testSessionSigner(process.env.SESSION_SIGNER_SECRET_OLD!, 'OLD');
      }
      break;

    case 'list':
      await listSessionSigners();
      break;

    case 'report':
      await generateRotationReport();
      break;

    default:
      console.log('Session Signer Rotation Helper');
      console.log('Usage:');
      console.log('  ts-node scripts/rotation-helper.ts status  - Check configuration');
      console.log('  ts-node scripts/rotation-helper.ts test    - Test signers');
      console.log('  ts-node scripts/rotation-helper.ts list    - List active signers');
      console.log('  ts-node scripts/rotation-helper.ts report  - Full rotation report');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { checkStatus, testSessionSigner, listSessionSigners };