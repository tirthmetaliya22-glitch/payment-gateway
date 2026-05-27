import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/api';

export function useConnectivity(intervalMs: number = 5000) {
  const [isBackendOnline, setIsBackendOnline] = useState(true);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_URL}/`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      setIsBackendOnline(response.ok);
      setLastChecked(new Date());
    } catch (err) {
      setIsBackendOnline(false);
      setLastChecked(new Date());
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, intervalMs);
    return () => clearInterval(interval);
  }, [checkHealth, intervalMs]);

  return { isBackendOnline, isCheckingHealth, lastChecked, checkHealth };
}
