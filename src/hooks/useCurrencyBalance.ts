import { useCallback, useEffect, useRef, useState } from 'react';
import { CurrencyRepository } from '../repositories/CurrencyRepository';

type CurrencyBalance = {
  vcoin: number;
  ruby: number;
};

type UseCurrencyBalanceResult = {
  balance: CurrencyBalance;
  loading: boolean;
  refresh: () => Promise<void>;
};

const DEFAULT_BALANCE: CurrencyBalance = { vcoin: 0, ruby: 0 };

export const useCurrencyBalance = (): UseCurrencyBalanceResult => {
  const [balance, setBalance] = useState<CurrencyBalance>(DEFAULT_BALANCE);
  const [loading, setLoading] = useState(true);
  const repoRef = useRef<CurrencyRepository>();

  if (!repoRef.current) {
    repoRef.current = new CurrencyRepository();
  }

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    try {
      const data = await repoRef.current!.fetchCurrency();
      setBalance(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    loading,
    refresh: fetchBalance,
  };
};

