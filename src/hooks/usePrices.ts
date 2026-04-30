import { useState, useEffect, useCallback } from 'react';

const CACHE_KEY = 'tokena_crypto_prices';
const TIME_KEY = 'tokena_crypto_prices_time';
const CACHE_MS = 60_000; // Cache for 60 seconds

interface Prices {
  solPrice: number;
  ethPrice: number;
  bnbPrice: number;
}

let _cachedPrices: Prices | null = null;
try {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) _cachedPrices = JSON.parse(cached);
} catch (e) {
  // Ignored
}

let _lastFetch = Number(localStorage.getItem(TIME_KEY)) || 0;

export function usePrices() {
  const [prices, setPrices] = useState<Prices>(_cachedPrices ?? { solPrice: 0, ethPrice: 0, bnbPrice: 0 });
  const [loading, setLoading] = useState(!_cachedPrices);

  const fetchPrices = useCallback(async () => {
    if (_cachedPrices && Date.now() - _lastFetch < CACHE_MS) {
      setPrices(_cachedPrices);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana,ethereum,binancecoin&vs_currencies=usd'
      );
      const data = await res.json();
      
      const newPrices = {
        solPrice: data?.solana?.usd ?? 150,
        ethPrice: data?.ethereum?.usd ?? 3000,
        bnbPrice: data?.binancecoin?.usd ?? 600,
      };

      _cachedPrices = newPrices;
      _lastFetch = Date.now();
      
      localStorage.setItem(CACHE_KEY, JSON.stringify(newPrices));
      localStorage.setItem(TIME_KEY, _lastFetch.toString());
      
      setPrices(newPrices);
    } catch (err) {
      console.warn('Failed to fetch crypto prices:', err);
      // Fallback
      if (!_cachedPrices) {
        const fallback = { solPrice: 150, ethPrice: 3000, bnbPrice: 600 };
        _cachedPrices = fallback;
        setPrices(fallback);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, CACHE_MS);
    return () => clearInterval(id);
  }, [fetchPrices]);

  return { ...prices, loading };
}

export function getCachedPrices(): Prices {
  if (_cachedPrices) return _cachedPrices;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return { solPrice: 0, ethPrice: 0, bnbPrice: 0 };
}
