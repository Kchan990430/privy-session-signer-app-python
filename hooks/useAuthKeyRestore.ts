import { useEffect, useState } from 'react';
import { AuthKeyStorage } from '../utils/authKeyStorage';

export function useAuthKeyRestore() {
  const [restored, setRestored] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const restoreAuthKeys = async () => {
      try {
        setRestoring(true);
        setError(null);
        
        // Check if we have any stored auth keys
        const storedConfigs = AuthKeyStorage.getAll();
        const configCount = Object.keys(storedConfigs).length;
        
        if (configCount === 0) {
          console.log('No auth keys to restore from localStorage');
          setRestored(true);
          return;
        }
        
        console.log(`Found ${configCount} auth keys in localStorage, restoring to backend...`);
        
        // Restore all auth keys to backend
        const success = await AuthKeyStorage.restoreToBackend();
        
        if (success) {
          console.log(`✅ Successfully restored ${configCount} auth keys to backend`);
          setRestored(true);
        } else {
          throw new Error('Failed to restore auth keys to backend');
        }
      } catch (err: any) {
        console.error('Error restoring auth keys:', err);
        setError(err.message || 'Failed to restore auth keys');
        setRestored(false);
      } finally {
        setRestoring(false);
      }
    };

    // Only restore once on mount
    restoreAuthKeys();
  }, []);

  return { restored, restoring, error };
}