import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import Purchases, { CustomerInfo, PurchasesPackage, PurchasesOffering } from 'react-native-purchases';
import { Platform } from 'react-native';
import { authManager } from '../services/AuthManager';
import { getSupabaseClient } from '../services/supabase';
import { callQuotaService } from '../services/CallQuotaService';

// RevenueCat Public SDK Keys
// const REVENUECAT_API_KEY_IOS = 'appl_CjxgHOafWEJNsMPLMtQgAULbupx';
const REVENUECAT_API_KEY_IOS = 'appl_CjxgHOafWEJNsMPLMtQgAULbupx';
const REVENUECAT_API_KEY_ANDROID = 'test_wVyIadouWMklglQRNajjGPxGCAc';

type SubscriptionState = {
    isPro: boolean;
    isLoading: boolean;
    customerInfo: CustomerInfo | null;
    packages: PurchasesPackage[];
    offerings: PurchasesOffering | null;
    packagesLoaded: boolean;
    error: string | null;
};

type SubscriptionContextValue = SubscriptionState & {
    refreshSubscription: () => Promise<void>;
    loadPackages: () => Promise<void>;
    purchasePackage: (pkg: PurchasesPackage) => Promise<{ success: boolean; error?: string }>;
    restorePurchases: () => Promise<{ success: boolean; isPro: boolean; error?: string }>;
    logout: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export const useSubscription = (): SubscriptionContextValue => {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return context;
};

/**
 * SubscriptionProvider manages the PRO subscription status via RevenueCat.
 * It automatically:
 * - Configures RevenueCat on mount
 * - Pre-loads subscription packages for instant display
 * - Links/unlinks user ID when auth state changes
 * - Re-fetches subscription status on auth changes
 * - Clears cache on logout
 */
export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<SubscriptionState>({
        isPro: false,
        isLoading: true,
        customerInfo: null,
        packages: [],
        offerings: null,
        packagesLoaded: false,
        error: null,
    });

    const [isConfigured, setIsConfigured] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Configure RevenueCat once on mount
    useEffect(() => {
        const configure = async () => {
            try {
                const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

                // Always configure on mount/reload to ensure fresh state
                await Purchases.configure({ apiKey });
                setIsConfigured(true);
                console.log('[SubscriptionProvider] RevenueCat configured');
            } catch (error) {
                console.error('[SubscriptionProvider] Failed to configure RevenueCat:', error);
                setState(prev => ({ ...prev, isLoading: false, error: 'Failed to initialize subscription service' }));
            }
        };

        configure();
    }, []);

    // Pre-load subscription packages
    const loadPackages = useCallback(async () => {
        if (!isConfigured) {
            return;
        }

        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current) {
                setState(prev => ({
                    ...prev,
                    offerings: offerings.current,
                    packages: offerings.current?.availablePackages || [],
                    packagesLoaded: true,
                }));
                console.log('[SubscriptionProvider] Packages loaded:', offerings.current?.availablePackages.length);
            }
        } catch (error) {
            console.error('[SubscriptionProvider] Failed to load packages:', error);
        }
    }, [isConfigured]);

    // Fetch subscription status from RevenueCat and verify with DB
    const fetchSubscriptionStatus = useCallback(async () => {
        if (!isConfigured) {
            return;
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const customerInfo = await Purchases.getCustomerInfo();

            // Check RevenueCat entitlements
            const activeEntitlements = Object.keys(customerInfo.entitlements.active);
            let isPro = activeEntitlements.length > 0 ||
                !!customerInfo.entitlements.active['pro'] ||
                !!customerInfo.entitlements.active['premium'];

            console.log('[SubscriptionProvider] RevenueCat status:', { isPro, activeEntitlements, originalAppUserId: customerInfo.originalAppUserId });

            // Perform validation using a separate variable to avoid TS narrowing issues
            let finalIsPro: boolean = isPro;

            // VALIDATION: Verify with Supabase DB if user is logged in
            // This prevents "ghost" Pro status from previous accounts on same device
            const userId = authManager.user?.id;
            if (userId && isPro) {
                try {
                    const { data: dbSub, error } = await getSupabaseClient()
                        .from('subscriptions')
                        .select('status, expires_at')
                        .eq('user_id', userId)
                        .in('status', ['active', 'trialing'])
                        .gt('expires_at', new Date().toISOString())
                        .maybeSingle();

                    if (error) {
                        console.warn('[SubscriptionProvider] DB check failed, falling back to RevenueCat:', error);
                    } else if (!dbSub) {
                        console.log('[SubscriptionProvider] User has no active subscription in DB. Overriding Pro status to false.');
                        finalIsPro = false;
                    } else {
                        console.log('[SubscriptionProvider] DB confirmed active subscription:', dbSub);
                    }
                } catch (dbError) {
                    console.warn('[SubscriptionProvider] DB validation error:', dbError);
                }
            }

            setState(prev => ({
                ...prev,
                isPro: finalIsPro,
                isLoading: false,
                customerInfo,
                error: null,
            }));

            console.log('[SubscriptionProvider] Final Subscription status:', { isPro: finalIsPro });
        } catch (error: any) {
            console.error('[SubscriptionProvider] Failed to fetch subscription:', error);
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: error?.message || 'Failed to fetch subscription status',
            }));
        }
    }, [isConfigured]);

    // Handle auth changes - link/unlink user and refresh subscription
    useEffect(() => {
        if (!isConfigured) {
            return;
        }

        const handleAuthChange = async () => {
            const newUserId = authManager.user?.id ?? null;

            // User changed (login, logout, or switched accounts)
            if (newUserId !== currentUserId) {
                console.log('[SubscriptionProvider] Auth changed:', { from: currentUserId, to: newUserId });

                if (newUserId) {
                    // New user logged in - link to RevenueCat
                    try {
                        await Purchases.logIn(newUserId.toLowerCase());
                        console.log('[SubscriptionProvider] Logged in to RevenueCat:', newUserId);
                    } catch (error) {
                        console.error('[SubscriptionProvider] Failed to log in to RevenueCat:', error);
                    }
                } else {
                    // User logged out - reset to anonymous and clear state
                    try {
                        await Purchases.logOut();
                        console.log('[SubscriptionProvider] Logged out from RevenueCat');
                    } catch (error) {
                        console.error('[SubscriptionProvider] Failed to log out from RevenueCat:', error);
                    }

                    // Clear PRO status immediately on logout
                    setState(prev => ({
                        ...prev,
                        isPro: false,
                        isLoading: false,
                        customerInfo: null,
                        error: null,
                    }));
                }

                setCurrentUserId(newUserId);

                // Fetch fresh subscription status and packages
                if (newUserId) {
                    await Promise.all([fetchSubscriptionStatus(), loadPackages()]);
                }
            }
        };

        // Initial check
        handleAuthChange();

        // Subscribe to auth changes
        const unsubscribe = authManager.subscribe(() => {
            handleAuthChange();
        });

        return unsubscribe;
    }, [isConfigured, currentUserId, fetchSubscriptionStatus, loadPackages]);

    // Initial fetch when configured
    useEffect(() => {
        if (isConfigured) {
            // Pre-load packages immediately
            loadPackages();

            // If user is logged in, also fetch subscription status
            if (authManager.user?.id) {
                fetchSubscriptionStatus();
            } else {
                setState(prev => ({ ...prev, isLoading: false }));
            }
        }
    }, [isConfigured, loadPackages, fetchSubscriptionStatus]);

    // Listen for purchase updates from RevenueCat
    useEffect(() => {
        if (!isConfigured) {
            return;
        }

        const listener = (info: CustomerInfo) => {
            console.log('[SubscriptionProvider] Customer info updated');
            const activeEntitlements = Object.keys(info.entitlements.active);
            const isPro = activeEntitlements.length > 0;

            setState(prev => ({
                ...prev,
                isPro,
                customerInfo: info,
            }));
        };

        Purchases.addCustomerInfoUpdateListener(listener);

        return () => {
            Purchases.removeCustomerInfoUpdateListener(listener);
        };
    }, [isConfigured]);

    const refreshSubscription = useCallback(async () => {
        await fetchSubscriptionStatus();
    }, [fetchSubscriptionStatus]);

    const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<{ success: boolean; error?: string }> => {
        try {
            setState(prev => ({ ...prev, isLoading: true }));
            const { customerInfo } = await Purchases.purchasePackage(pkg);

            const activeEntitlements = Object.keys(customerInfo.entitlements.active);
            const isPro = activeEntitlements.length > 0;

            // Reset call quota to PRO limits BEFORE updating state
            // This ensures the DB has the new quota before the UI tries to fetch it
            if (isPro) {
                try {
                    const newQuota = await callQuotaService.resetProQuota();
                    console.log('[SubscriptionProvider] Call quota reset to PRO limits:', newQuota);
                } catch (quotaError) {
                    console.warn('[SubscriptionProvider] Failed to reset call quota:', quotaError);
                }
            }

            // Now update state - this will trigger UI refresh which will fetch the new quota
            setState(prev => ({
                ...prev,
                isPro,
                customerInfo,
                isLoading: false,
            }));

            return { success: isPro };
        } catch (error: any) {
            setState(prev => ({ ...prev, isLoading: false }));
            if (error.userCancelled) {
                return { success: false, error: 'cancelled' };
            }
            return { success: false, error: error.message || 'Purchase failed' };
        }
    }, []);

    const restorePurchases = useCallback(async (): Promise<{ success: boolean; isPro: boolean; error?: string }> => {
        try {
            setState(prev => ({ ...prev, isLoading: true }));
            const customerInfo = await Purchases.restorePurchases();

            const activeEntitlements = Object.keys(customerInfo.entitlements.active);
            const isPro = activeEntitlements.length > 0;

            // Reset call quota to PRO limits BEFORE updating state
            if (isPro) {
                try {
                    const newQuota = await callQuotaService.resetProQuota();
                    console.log('[SubscriptionProvider] Call quota reset to PRO limits after restore:', newQuota);
                } catch (quotaError) {
                    console.warn('[SubscriptionProvider] Failed to reset call quota:', quotaError);
                }
            }

            // Now update state
            setState(prev => ({
                ...prev,
                isPro,
                customerInfo,
                isLoading: false,
            }));

            return { success: true, isPro };
        } catch (error: any) {
            setState(prev => ({ ...prev, isLoading: false }));
            return { success: false, isPro: false, error: error.message || 'Restore failed' };
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await Purchases.logOut();
            setState(prev => ({
                ...prev,
                isPro: false,
                isLoading: false,
                customerInfo: null,
                error: null,
            }));
            setCurrentUserId(null);
            console.log('[SubscriptionProvider] Subscription state cleared on logout');
        } catch (error) {
            console.error('[SubscriptionProvider] Failed to logout from RevenueCat:', error);
        }
    }, []);

    const value = useMemo<SubscriptionContextValue>(
        () => ({
            ...state,
            refreshSubscription,
            loadPackages,
            purchasePackage,
            restorePurchases,
            logout,
        }),
        [state, refreshSubscription, loadPackages, purchasePackage, restorePurchases, logout]
    );

    return (
        <SubscriptionContext.Provider value={value}>
            {children}
        </SubscriptionContext.Provider>
    );
};
