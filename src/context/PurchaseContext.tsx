import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  useLayoutEffect,
} from "react";
import { Alert } from "react-native";
import { PurchaseService, PurchaseError } from "../services/PurchaseService";
import {
  CurrencyRepository,
  type CurrencyBalance,
} from "../repositories/CurrencyRepository";
import { useVRMContext } from "./VRMContext";
import { CurrencyPurchaseSheet } from "../components/purchase/CurrencyPurchaseSheet";
import {
  ConfirmPurchaseModal,
  type ConfirmPurchaseType,
} from "../components/purchase/ConfirmPurchaseModal";
import type { CostumeItem } from "../repositories/CostumeRepository";
import type { CharacterItem } from "../repositories/CharacterRepository";
import type { BackgroundItem } from "../repositories/BackgroundRepository";

type PendingPurchase =
  | {
      type: "character";
      item: CharacterItem;
      useVcoin: boolean;
      useRuby: boolean;
    }
  | {
      type: "background";
      item: BackgroundItem;
      useVcoin: boolean;
      useRuby: boolean;
    }
  | { type: "costume"; item: CostumeItem; useVcoin: boolean; useRuby: boolean };

type PurchaseContextValue = {
  // Currency management
  balance: CurrencyBalance;
  animatedBalance: CurrencyBalance;
  loading: boolean;
  refresh: () => Promise<void>;
  animateIncrease: (delta: { vcoin?: number; ruby?: number }) => void;
  showPurchaseSheet: boolean;
  setShowPurchaseSheet: React.Dispatch<React.SetStateAction<boolean>>;
  setPurchaseCompleteCallback: (
    callback:
      | ((payload: { vcoinAdded: number; rubyAdded: number }) => Promise<void>)
      | undefined
  ) => void;
  // Purchase management
  confirmPurchase: (
    title: string,
    priceVcoin?: number,
    priceRuby?: number
  ) => Promise<boolean>;
  confirmCostumePurchase: (
    costume: CostumeItem
  ) => Promise<{ useVcoin: boolean; useRuby: boolean } | null>;
  confirmCharacterPurchase: (
    character: CharacterItem
  ) => Promise<{ useVcoin: boolean; useRuby: boolean } | null>;
  confirmBackgroundPurchase: (
    background: BackgroundItem
  ) => Promise<{ useVcoin: boolean; useRuby: boolean } | null>;
  performPurchase: (payload: {
    itemId: string;
    itemType: string;
    priceVcoin?: number;
    priceRuby?: number;
      autoCloseOnSuccess?: boolean;
  }) => Promise<void>;
  handlePurchaseError: (error: unknown) => void;
  resumePendingPurchase: () => Promise<{
    type: "costume" | "character" | "background";
    itemId: string;
  } | null>;
  pendingPurchase: PendingPurchase | null;
  // Sheet management
  showBackgroundSheet: boolean;
  setShowBackgroundSheet: React.Dispatch<React.SetStateAction<boolean>>;
  showCharacterSheet: boolean;
  setShowCharacterSheet: React.Dispatch<React.SetStateAction<boolean>>;
  showCostumeSheet: boolean;
  setShowCostumeSheet: React.Dispatch<React.SetStateAction<boolean>>;
  confirmPurchaseRequest: ConfirmPurchaseType | null;
  clearConfirmPurchaseRequest: () => void;
  activeConfirmPortalHost: string | null;
  updateConfirmPortalHost: (hostId: string, isActive: boolean) => void;
};

const DEFAULT_BALANCE: CurrencyBalance = { vcoin: 0, ruby: 0 };

const PurchaseContext = createContext<PurchaseContextValue | undefined>(
  undefined
);

export const usePurchaseContext = (): PurchaseContextValue => {
  const context = useContext(PurchaseContext);
  if (!context) {
    throw new Error(
      "usePurchaseContext phải được dùng bên trong PurchaseProvider"
    );
  }
  return context;
};

// Export useCurrencyContext as alias for backward compatibility
export const useCurrencyContext = usePurchaseContext;

const formatPriceLabel = (priceVcoin = 0, priceRuby = 0) => {
  const parts: string[] = [];
  if (priceVcoin > 0) {
    parts.push(`${priceVcoin} VCoin`);
  }
  if (priceRuby > 0) {
    parts.push(`${priceRuby} Ruby`);
  }
  return parts.join(" + ") || "0";
};

type PurchaseProviderProps = {
  children: React.ReactNode;
  onPurchaseComplete?: (payload: {
    vcoinAdded: number;
    rubyAdded: number;
  }) => Promise<void>;
};

export const PurchaseProvider: React.FC<PurchaseProviderProps> = ({
  children,
  onPurchaseComplete,
}) => {
  const {
    authState: { session, hasRestoredSession },
  } = useVRMContext();

  const purchaseServiceRef = useRef<PurchaseService | null>(null);
  if (!purchaseServiceRef.current) {
    purchaseServiceRef.current = new PurchaseService();
  }

  const repoRef = useRef<CurrencyRepository | null>(null);
  if (!repoRef.current) {
    repoRef.current = new CurrencyRepository();
  }

  // Currency state
  const [balance, setBalance] = useState<CurrencyBalance>(DEFAULT_BALANCE);
  const [animatedBalance, setAnimatedBalance] =
    useState<CurrencyBalance>(DEFAULT_BALANCE);
  const [loading, setLoading] = useState(false);
  const [showPurchaseSheet, setShowPurchaseSheet] = useState(false);
  const purchaseCompleteCallbackRef = useRef<
    | ((payload: { vcoinAdded: number; rubyAdded: number }) => Promise<void>)
    | undefined
  >(undefined);

  // Purchase state
  const [pendingPurchase, setPendingPurchase] =
    useState<PendingPurchase | null>(null);
  const [confirmPurchaseRequest, setConfirmPurchaseRequest] =
    useState<ConfirmPurchaseType | null>(null);
  const confirmPortalStackRef = useRef<string[]>([]);
  const [activeConfirmPortalHost, setActiveConfirmPortalHost] = useState<string | null>(null);

  // Sheet state
  const [showBackgroundSheet, setShowBackgroundSheet] = useState(false);
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);
  const [showCostumeSheet, setShowCostumeSheet] = useState(false);

  // Animation logic
  const animatedRef = useRef<CurrencyBalance>(DEFAULT_BALANCE);
  useEffect(() => {
    animatedRef.current = animatedBalance;
  }, [animatedBalance]);

  const rafRefs = useRef<{ vcoin?: number; ruby?: number }>({});

  const stopAnimation = useCallback((key: keyof CurrencyBalance) => {
    if (rafRefs.current[key]) {
      cancelAnimationFrame(rafRefs.current[key]!);
      rafRefs.current[key] = undefined;
    }
  }, []);

  const animateToValue = useCallback(
    (key: keyof CurrencyBalance, target: number) => {
      stopAnimation(key);
      const from = animatedRef.current[key];

      if (from === target) {
        setAnimatedBalance((prev) => {
          if (prev[key] === target) {
            return prev;
          }
          return { ...prev, [key]: target };
        });
        return;
      }

      const duration = 1000;
      const start = Date.now();
      const diff = target - from;

      const tick = () => {
        const elapsed = Date.now() - start;
        const progress = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(from + diff * eased);

        setAnimatedBalance((prev) => ({ ...prev, [key]: value }));

        if (progress < 1) {
          rafRefs.current[key] = requestAnimationFrame(tick);
        } else {
          rafRefs.current[key] = undefined;
        }
      };

      rafRefs.current[key] = requestAnimationFrame(tick);
    },
    [stopAnimation]
  );

  useEffect(() => {
    return () => {
      stopAnimation("vcoin");
      stopAnimation("ruby");
    };
  }, [stopAnimation]);

  const applyImmediateBalance = useCallback(
    (next: CurrencyBalance) => {
      stopAnimation("vcoin");
      stopAnimation("ruby");
      const cloned = { vcoin: next.vcoin, ruby: next.ruby };
      setBalance(cloned);
      setAnimatedBalance(cloned);
    },
    [stopAnimation]
  );

  const refresh = useCallback(async () => {
    if (!session) {
      applyImmediateBalance(DEFAULT_BALANCE);
      return;
    }

    setLoading(true);
    try {
      const data = await repoRef.current!.fetchCurrency();
      applyImmediateBalance(data);
    } catch (error) {
      console.warn("[PurchaseProvider] refresh thất bại:", error);
    } finally {
      setLoading(false);
    }
  }, [applyImmediateBalance, session]);

  const animateIncrease = useCallback(
    ({ vcoin = 0, ruby = 0 }: { vcoin?: number; ruby?: number }) => {
      if (vcoin === 0 && ruby === 0) {
        return;
      }

      setBalance((prev) => {
        const next = {
          vcoin: prev.vcoin + vcoin,
          ruby: prev.ruby + ruby,
        };

        if (vcoin !== 0) {
          animateToValue("vcoin", next.vcoin);
        }
        if (ruby !== 0) {
          animateToValue("ruby", next.ruby);
        }

        return next;
      });
    },
    [animateToValue]
  );

  useEffect(() => {
    if (!hasRestoredSession) {
      return;
    }

    if (!session) {
      applyImmediateBalance(DEFAULT_BALANCE);
      setShowPurchaseSheet(false);
      return;
    }

    refresh();
  }, [session, hasRestoredSession, refresh, applyImmediateBalance]);

  const handlePurchaseComplete = useCallback(
    async (payload: { vcoinAdded: number; rubyAdded: number }) => {
      await refresh();
      animateIncrease({ vcoin: payload.vcoinAdded, ruby: payload.rubyAdded });
      if (onPurchaseComplete) {
        await onPurchaseComplete(payload);
      }
      if (purchaseCompleteCallbackRef.current) {
        await purchaseCompleteCallbackRef.current(payload);
      }
    },
    [refresh, animateIncrease, onPurchaseComplete]
  );

  const setPurchaseCompleteCallback = useCallback(
    (
      callback:
        | ((payload: {
            vcoinAdded: number;
            rubyAdded: number;
          }) => Promise<void>)
        | undefined
    ) => {
      purchaseCompleteCallbackRef.current = callback;
    },
    []
  );

  const updateConfirmPortalHost = useCallback((hostId: string, isActive: boolean) => {
    confirmPortalStackRef.current = confirmPortalStackRef.current.filter(id => id !== hostId);
    if (isActive) {
      confirmPortalStackRef.current.push(hostId);
    }
    const next =
      confirmPortalStackRef.current[confirmPortalStackRef.current.length - 1] ?? null;
    setActiveConfirmPortalHost(next);
  }, []);

  const clearConfirmPurchaseRequest = useCallback(
    () => setConfirmPurchaseRequest(null),
    []
  );

  const confirmPurchase = useCallback(
    (title: string, priceVcoin = 0, priceRuby = 0) =>
      new Promise<boolean>((resolve) => {
        const request: ConfirmPurchaseType = {
          type: 'simple',
          title,
          message: `This purchase will cost ${formatPriceLabel(
            priceVcoin,
            priceRuby
          )}. Do you want to continue?`,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        };
        setConfirmPurchaseRequest(request);
      }),
    []
  );

  const confirmCostumePurchase = useCallback(
    (
      costume: CostumeItem
    ): Promise<{ useVcoin: boolean; useRuby: boolean } | null> =>
      new Promise((resolve) => {
        const priceVcoin = costume.price_vcoin ?? 0;
        const priceRuby = costume.price_ruby ?? 0;
        const hasVcoinPrice = priceVcoin > 0;
        const hasRubyPrice = priceRuby > 0;

        if (!hasVcoinPrice && !hasRubyPrice) {
          resolve(null);
          return;
        }

        const request: ConfirmPurchaseType = {
          type: 'currency-choice',
          title: 'Purchase Costume',
          itemName: costume.costume_name,
          priceVcoin,
          priceRuby,
          balanceVcoin: balance.vcoin,
          balanceRuby: balance.ruby,
          previewImage: costume.thumbnail ?? undefined,
          autoCloseOnSuccess: false,
          onConfirm: (choice) => resolve(choice),
          onCancel: () => resolve(null),
          onTopUp: (choice) => {
            console.log('🔄 [PurchaseContext] Top Up pressed', choice);

            setShowBackgroundSheet(false);
            setShowCharacterSheet(false);
            setShowCostumeSheet(false);

            // Save pending purchase (like Swift version)
            setPendingPurchase({
              type: 'costume',
              item: costume,
              useVcoin: choice.useVcoin,
              useRuby: choice.useRuby,
            });
            setShowPurchaseSheet(true);
            resolve(null);
          },
        };
        setConfirmPurchaseRequest(request);
      }),
    [balance, setShowPurchaseSheet]
  );

  const confirmCharacterPurchase = useCallback(
    (
      character: CharacterItem
    ): Promise<{ useVcoin: boolean; useRuby: boolean } | null> =>
      new Promise(resolve => {
        const priceVcoin = character.price_vcoin ?? 0;
        const priceRuby = character.price_ruby ?? 0;
        const hasVcoinPrice = priceVcoin > 0;
        const hasRubyPrice = priceRuby > 0;

        if (!hasVcoinPrice && !hasRubyPrice) {
          resolve(null);
          return;
        }

        const request: ConfirmPurchaseType = {
          type: 'currency-choice',
          title: 'Purchase Character',
          itemName: character.name,
          priceVcoin,
          priceRuby,
          balanceVcoin: balance.vcoin,
          balanceRuby: balance.ruby,
          previewImage: character.thumbnail_url ?? character.avatar ?? undefined,
          autoCloseOnSuccess: false,
          onConfirm: choice => resolve(choice),
          onCancel: () => resolve(null),
          onTopUp: choice => {
            console.log('🔄 [PurchaseContext] Character Top Up pressed', choice);
            setShowBackgroundSheet(false);
            setShowCharacterSheet(false);
            setShowCostumeSheet(false);

            setPendingPurchase({
              type: 'character',
              item: character,
              useVcoin: choice.useVcoin,
              useRuby: choice.useRuby,
            });
            setShowPurchaseSheet(true);
            resolve(null);
          },
        };
        setConfirmPurchaseRequest(request);
      }),
    [balance, setShowPurchaseSheet]
  );

  const confirmBackgroundPurchase = useCallback(
    (
      background: BackgroundItem
    ): Promise<{ useVcoin: boolean; useRuby: boolean } | null> =>
      new Promise((resolve) => {
        const priceVcoin = background.price_vcoin ?? 0;
        const priceRuby = background.price_ruby ?? 0;
        const hasVcoinPrice = priceVcoin > 0;
        const hasRubyPrice = priceRuby > 0;

        if (!hasVcoinPrice && !hasRubyPrice) {
          resolve(null);
          return;
        }

        const request: ConfirmPurchaseType = {
          type: 'currency-choice',
          title: 'Purchase Background',
          itemName: background.name,
          priceVcoin,
          priceRuby,
          balanceVcoin: balance.vcoin,
          balanceRuby: balance.ruby,
          previewImage: background.thumbnail ?? background.image ?? undefined,
          autoCloseOnSuccess: false,
          onConfirm: (choice) => resolve(choice),
          onCancel: () => resolve(null),
          onTopUp: (choice) => {
            console.log('🔄 [PurchaseContext] Top Up pressed', choice);

            setShowBackgroundSheet(false);
            setShowCharacterSheet(false);
            setShowCostumeSheet(false);

            // Save pending purchase (like Swift version)
            setPendingPurchase({
              type: 'background',
              item: background,
              useVcoin: choice.useVcoin,
              useRuby: choice.useRuby,
            });
            setShowPurchaseSheet(true);
            resolve(null);
          },
        };
        setConfirmPurchaseRequest(request);
      }),
    [balance, setShowPurchaseSheet]
  );

  const handlePurchaseError = useCallback(
    (error: unknown) => {
      if (error instanceof PurchaseError) {
        if (
          error.code === "INSUFFICIENT_VCOIN" ||
          error.code === "INSUFFICIENT_RUBY"
        ) {
          const currencyName =
            error.code === "INSUFFICIENT_VCOIN" ? "VCoin" : "Ruby";
          Alert.alert(`Insufficient ${currencyName}`, error.message, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Top Up",
              onPress: () => {
                console.log("🔄 [PurchaseContext] Top Up pressed");
                setShowBackgroundSheet(false);
                setShowCharacterSheet(false);
                setShowCostumeSheet(false);
                setShowPurchaseSheet(true);
              },
            },
          ]);
          return;
        }
        Alert.alert("Unable to purchase", error.message);
        return;
      }
      Alert.alert(
        "Unable to purchase",
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    },
    [setShowPurchaseSheet]
  );

  const performPurchase = useCallback(
    async (payload: {
      itemId: string;
      itemType: string;
      priceVcoin?: number;
      priceRuby?: number;
    }) => {
      console.log("💰 [PurchaseContext] performPurchase called:", payload);
      try {
        const result = await purchaseServiceRef.current!.purchaseWithCurrency(
          payload
        );
        console.log("✅ [PurchaseContext] Purchase successful:", result);
        await refresh();
      } catch (error) {
        console.error("❌ [PurchaseContext] Purchase failed:", error);
        throw error;
      }
    },
    [refresh]
  );

  const resumePendingPurchase = useCallback(async (): Promise<{
    type: "costume" | "character" | "background";
    itemId: string;
  } | null> => {
    if (!pendingPurchase) {
      return null;
    }

    const pending = pendingPurchase;
    setPendingPurchase(null);

    console.log("🔄 [PurchaseContext] Resuming pending purchase:", pending);

    try {
      let priceVcoin = 0;
      let priceRuby = 0;

      if (pending.type === "costume") {
        priceVcoin = pending.useVcoin ? pending.item.price_vcoin ?? 0 : 0;
        priceRuby = pending.useRuby ? pending.item.price_ruby ?? 0 : 0;

        await performPurchase({
          itemId: pending.item.id,
          itemType: "character_costume",
          priceVcoin,
          priceRuby,
        });

        return { type: "costume", itemId: pending.item.id };
      } else if (pending.type === "character") {
        priceVcoin = pending.useVcoin ? pending.item.price_vcoin ?? 0 : 0;
        priceRuby = pending.useRuby ? pending.item.price_ruby ?? 0 : 0;

        await performPurchase({
          itemId: pending.item.id,
          itemType: "character",
          priceVcoin,
          priceRuby,
        });

        return { type: "character", itemId: pending.item.id };
      } else if (pending.type === "background") {
        priceVcoin = pending.useVcoin ? pending.item.price_vcoin ?? 0 : 0;
        priceRuby = pending.useRuby ? pending.item.price_ruby ?? 0 : 0;

        await performPurchase({
          itemId: pending.item.id,
          itemType: "background",
          priceVcoin,
          priceRuby,
        });

        return { type: "background", itemId: pending.item.id };
      }
    } catch (error) {
      console.error(
        "❌ [PurchaseContext] Failed to resume pending purchase:",
        error
      );
      handlePurchaseError(error);
    }

    return null;
  }, [pendingPurchase, performPurchase, handlePurchaseError]);

  const value = useMemo<PurchaseContextValue>(
    () => ({
      // Currency
      balance,
      animatedBalance,
      loading,
      refresh,
      animateIncrease,
      showPurchaseSheet,
      setShowPurchaseSheet,
      setPurchaseCompleteCallback,
      // Purchase
      confirmPurchase,
      confirmCostumePurchase,
      confirmCharacterPurchase,
      confirmBackgroundPurchase,
      performPurchase,
      handlePurchaseError,
      resumePendingPurchase,
      pendingPurchase,
      // Sheets
      showBackgroundSheet,
      setShowBackgroundSheet,
      showCharacterSheet,
      setShowCharacterSheet,
      showCostumeSheet,
      setShowCostumeSheet,
      confirmPurchaseRequest,
      clearConfirmPurchaseRequest,
      activeConfirmPortalHost,
      updateConfirmPortalHost,
    }),
    [
      balance,
      animatedBalance,
      loading,
      refresh,
      animateIncrease,
      showPurchaseSheet,
      setPurchaseCompleteCallback,
      confirmPurchase,
      confirmCostumePurchase,
      confirmCharacterPurchase,
      confirmBackgroundPurchase,
      performPurchase,
      handlePurchaseError,
      resumePendingPurchase,
      pendingPurchase,
      showBackgroundSheet,
      showCharacterSheet,
      showCostumeSheet,
      confirmPurchaseRequest,
      clearConfirmPurchaseRequest,
      activeConfirmPortalHost,
      updateConfirmPortalHost,
    ]
  );

  return (
    <PurchaseContext.Provider value={value}>
      {children}
      <CurrencyPurchaseSheet
        visible={showPurchaseSheet}
        onClose={() => setShowPurchaseSheet(false)}
        onPurchaseComplete={handlePurchaseComplete}
      />
      <ConfirmPurchasePortal hostId="global" active />
    </PurchaseContext.Provider>
  );
};

type ConfirmPurchasePortalProps = {
  hostId?: string;
  active?: boolean;
};

export const ConfirmPurchasePortal: React.FC<ConfirmPurchasePortalProps> = ({
  hostId,
  active = true,
}) => {
  const generatedId = useId();
  const resolvedHostId = hostId ?? generatedId;
  const {
    confirmPurchaseRequest,
    clearConfirmPurchaseRequest,
    activeConfirmPortalHost,
    updateConfirmPortalHost,
  } = usePurchaseContext();

  useLayoutEffect(() => {
    updateConfirmPortalHost(resolvedHostId, active);
    return () => {
      updateConfirmPortalHost(resolvedHostId, false);
    };
  }, [resolvedHostId, active, updateConfirmPortalHost]);

  if (!confirmPurchaseRequest || activeConfirmPortalHost !== resolvedHostId) {
    return null;
  }

  return (
    <ConfirmPurchaseModal
      visible
      purchase={confirmPurchaseRequest}
      onClose={clearConfirmPurchaseRequest}
    />
  );
};
