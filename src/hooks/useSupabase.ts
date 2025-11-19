import { useEffect, useState } from 'react';
import { authService, type AuthUser } from '../services';
import { characterRepository, backgroundRepository, currencyRepository } from '../repositories';
import type { CharacterItem, BackgroundItem, CurrencyBalance } from '../repositories';

/**
 * Hook to manage authentication state
 */
export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        const guest = await authService.isGuest();
        setUser(currentUser);
        setIsGuest(guest);
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsGuest(true);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  return { user, isGuest, loading };
};

/**
 * Hook to fetch characters
 */
export const useCharacters = () => {
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCharacters = async () => {
      try {
        setLoading(true);
        const data = await characterRepository.fetchAllCharacters();
        setCharacters(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch characters'));
      } finally {
        setLoading(false);
      }
    };

    fetchCharacters();
  }, []);

  return { characters, loading, error };
};

/**
 * Hook to fetch backgrounds
 */
export const useBackgrounds = () => {
  const [backgrounds, setBackgrounds] = useState<BackgroundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchBackgrounds = async () => {
      try {
        setLoading(true);
        const data = await backgroundRepository.fetchAllBackgrounds();
        setBackgrounds(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch backgrounds'));
      } finally {
        setLoading(false);
      }
    };

    fetchBackgrounds();
  }, []);

  return { backgrounds, loading, error };
};

/**
 * Hook to fetch currency balance
 */
export const useCurrency = () => {
  const [balance, setBalance] = useState<CurrencyBalance>({ vcoin: 0, ruby: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCurrency = async () => {
      try {
        setLoading(true);
        const data = await currencyRepository.fetchCurrency();
        setBalance(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch currency'));
      } finally {
        setLoading(false);
      }
    };

    fetchCurrency();
  }, []);

  return { balance, loading, error, refetch: async () => {
    try {
      setLoading(true);
      const data = await currencyRepository.fetchCurrency();
      setBalance(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch currency'));
    } finally {
      setLoading(false);
    }
  }};
};

