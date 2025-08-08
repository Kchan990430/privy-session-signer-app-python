import { useEffect, useState } from 'react';

export function BalanceDisplay({ address }: { address?: string }) {
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;

    const fetchBalance = async () => {
      try {
        const response = await fetch('/api/agent-wallets/get-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: address }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setBalance(data.data.balanceFormatted);
        } else {
          setBalance('Error');
        }
      } catch (error) {
        setBalance('Error');
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
    
    // Refresh balance every 5 seconds
    const interval = setInterval(fetchBalance, 5000);
    return () => clearInterval(interval);
  }, [address]);

  if (loading) return <span className="text-gray-500">Loading...</span>;
  
  return (
    <span className={`font-mono ${parseFloat(balance) > 0 ? 'text-green-600' : 'text-gray-600'}`}>
      {parseFloat(balance).toFixed(6)} ETH
    </span>
  );
}