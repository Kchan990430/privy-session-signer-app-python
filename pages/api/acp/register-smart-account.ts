import { NextApiRequest, NextApiResponse } from 'next';

// This endpoint helps register the smart account address as an agent
// The smart account address needs to be registered in the ACP system
// for it to be able to create jobs

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { smartAccountAddress } = req.body;

  if (!smartAccountAddress) {
    return res.status(400).json({ error: 'Smart account address required' });
  }

  // Instructions for registering the smart account:
  return res.status(200).json({
    message: 'Smart account registration required',
    smartAccountAddress,
    instructions: [
      '1. The smart account address needs to be registered as an agent in ACP',
      '2. Visit https://acp-staging.virtuals.io/ (for testnet)',
      '3. Register the smart account address as an agent',
      '4. Or use the original EOA wallet for transactions instead of smart account',
    ],
    note: 'The ACP contract checks msg.sender, which is the smart account address when using AA'
  });
}