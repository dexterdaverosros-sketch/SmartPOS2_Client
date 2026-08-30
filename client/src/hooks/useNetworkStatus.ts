import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  clearWasOffline: () => void;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const clearWasOffline = () => {
    setWasOffline(false);
  };

  return { isOnline, wasOffline, clearWasOffline };
}
