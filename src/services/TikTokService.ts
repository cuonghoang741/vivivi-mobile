/**
 * TikTok Business SDK Service
 * 
 * This service provides TikTok event tracking functionality.
 * Currently implemented as a stub that logs events - the expo-tiktok-business
 * package is not yet compatible with Expo 54.
 * 
 * TODO: When expo-tiktok-business adds Expo 54 support, re-enable native SDK integration.
 * 
 * Configuration:
 * - App ID: 6755465004
 * - TikTok App ID: 7595783343162048529
 * - Secret: TTimOQKvZ8TK3D73cS3iOGV6JIYI2tQi (use server-side only)
 */

/**
 * TikTok Event Names - Standard events recognized by TikTok
 */
export const TikTokEventName = {
    LAUNCH: 'Launch',
    APP_INSTALL: 'InstallApp',
    SEARCH: 'Search',
    VIEW_CONTENT: 'ViewContent',
    CLICK: 'ClickButton',
    ADD_TO_WISHLIST: 'AddToWishlist',
    ADD_TO_CART: 'AddToCart',
    INITIATE_CHECKOUT: 'InitiateCheckout',
    ADD_PAYMENT_INFO: 'AddPaymentInfo',
    COMPLETE_PAYMENT: 'CompletePayment',
    PLACE_AN_ORDER: 'PlaceAnOrder',
    SUBSCRIBE: 'Subscribe',
    CONTACT: 'Contact',
    CUSTOM: 'CustomEvent',
} as const;

type TikTokEventNameType = typeof TikTokEventName[keyof typeof TikTokEventName];
type EventParams = Record<string, string | number | boolean | undefined>;

/**
 * TikTok App ID config
 * - Apple App ID (iOS): Your numeric App Store ID
 * - TikTok App ID: From TikTok Business Center
 */
const APPLE_APP_ID = '6755465004';
const ANDROID_PACKAGE = 'com.eduto.bonie';
const TIKTOK_APP_ID = '7595783343162048529';

// Track initialization state
let isInitialized = false;
let debugMode = __DEV__;

export const TikTokService = {
    /**
     * Initialize TikTok SDK
     * Should be called once at app startup
     * 
     * Note: Currently stubbed. When expo-tiktok-business supports Expo 54,
     * this will initialize the native SDK.
     */
    init: () => {
        try {
            isInitialized = true;
            console.log('✅ [TikTok] SDK Initialized (stub mode)');
            console.log(`   App ID: ${APPLE_APP_ID}`);
            console.log(`   TikTok App ID: ${TIKTOK_APP_ID}`);
        } catch (error) {
            console.error('❌ [TikTok] Init error:', error);
        }
    },

    /**
     * Log a custom event to TikTok
     * Maps internal event names to TikTok standard events
     */
    logEvent: async (eventName: string, params: EventParams = {}) => {
        if (!isInitialized) {
            console.warn('[TikTok] SDK not initialized, skipping event:', eventName);
            return;
        }

        try {
            // Map generic event names to TikTok specific ones
            let tiktokEvent: TikTokEventNameType;
            let eventParams: Record<string, any> = { ...params };

            switch (eventName) {
                case 'sign_up':
                    tiktokEvent = TikTokEventName.CUSTOM;
                    eventParams.event_name = 'complete_registration';
                    break;

                case 'sign_in':
                    tiktokEvent = TikTokEventName.CUSTOM;
                    eventParams.event_name = 'login';
                    break;

                case 'purchase_complete':
                case 'subscription_purchase':
                    tiktokEvent = TikTokEventName.COMPLETE_PAYMENT;
                    eventParams.value = params.amount || params.price || 0;
                    eventParams.currency = params.currency || 'USD';
                    eventParams.content_id = params.item_id || params.plan_id || '';
                    eventParams.content_type = params.item_type || 'subscription';
                    break;

                case 'currency_purchase_start':
                case 'purchase_start':
                    tiktokEvent = TikTokEventName.INITIATE_CHECKOUT;
                    break;

                case 'subscription_view':
                    tiktokEvent = TikTokEventName.VIEW_CONTENT;
                    eventParams.content_type = 'subscription';
                    break;

                case 'character_select':
                case 'costume_change':
                case 'background_change':
                case 'character_detail_view':
                    tiktokEvent = TikTokEventName.VIEW_CONTENT;
                    eventParams.content_type = eventName.replace(/_/g, ' ');
                    eventParams.content_id = params.character_id || params.costume_id || params.background_id || '';
                    break;

                case 'onboarding_complete':
                    tiktokEvent = TikTokEventName.CUSTOM;
                    eventParams.event_name = 'tutorial_complete';
                    break;

                case 'voice_call_start':
                case 'video_call_start':
                    tiktokEvent = TikTokEventName.CLICK;
                    eventParams.content_type = eventName.replace('_start', '');
                    break;

                case 'send_message':
                case 'chat_open':
                    tiktokEvent = TikTokEventName.CONTACT;
                    break;

                default:
                    tiktokEvent = TikTokEventName.CUSTOM;
                    eventParams.event_name = eventName;
                    break;
            }

            // Log to console in debug mode
            if (debugMode) {
                console.log(`[TikTok] Event: ${tiktokEvent}`, eventParams);
            }

            // TODO: When native SDK is available, replace with actual tracking call:
            // TiktokSDK.trackEvent(tiktokEvent, eventParams);

            // Alternative: Send to TikTok Events API via backend
            // This would require implementing a Supabase Edge Function
            // await sendToTikTokEventsAPI(tiktokEvent, eventParams);

        } catch (error) {
            console.warn(`[TikTok] Failed to log event ${eventName}:`, error);
        }
    },

    /**
     * Log a purchase event
     * TikTok has a specific method for purchases which is better for ad optimization
     */
    logPurchase: async (
        amount: number,
        currency: string,
        contentId: string,
        contentType: string = 'product',
        contentName: string = '',
        params: EventParams = {}
    ) => {
        if (!isInitialized) {
            console.warn('[TikTok] SDK not initialized, skipping purchase event');
            return;
        }

        try {
            const purchaseParams = {
                value: amount,
                currency,
                content_id: contentId,
                content_type: contentType,
                content_name: contentName,
                quantity: 1,
                ...params,
            };

            if (debugMode) {
                console.log(`[TikTok] Purchase: ${amount} ${currency}`, purchaseParams);
            }

            // TODO: TiktokSDK.trackCompletePurchase(amount, currency, [...], params);
        } catch (error) {
            console.warn('[TikTok] Failed to log purchase:', error);
        }
    },

    /**
     * Track search event
     */
    trackSearch: async (query: string, params: EventParams = {}) => {
        if (!isInitialized) return;

        try {
            if (debugMode) {
                console.log(`[TikTok] Search: ${query}`, params);
            }
            // TODO: TiktokSDK.trackSearch(query, params);
        } catch (error) {
            console.warn('[TikTok] Failed to log search:', error);
        }
    },

    /**
     * Track content view
     */
    trackViewContent: async (contentId: string, contentType: string, params: EventParams = {}) => {
        if (!isInitialized) return;

        try {
            if (debugMode) {
                console.log(`[TikTok] View Content: ${contentId}`, { contentType, ...params });
            }
            // TODO: TiktokSDK.trackEvent(TikTokEventName.VIEW_CONTENT, {...});
        } catch (error) {
            console.warn('[TikTok] Failed to log view content:', error);
        }
    },

    /**
     * Track add to cart
     */
    trackAddToCart: async (contentId: string, price: number, currency: string = 'USD', params: EventParams = {}) => {
        if (!isInitialized) return;

        try {
            if (debugMode) {
                console.log(`[TikTok] Add to Cart: ${contentId}`, { price, currency, ...params });
            }
            // TODO: TiktokSDK.trackEvent(TikTokEventName.ADD_TO_CART, {...});
        } catch (error) {
            console.warn('[TikTok] Failed to log add to cart:', error);
        }
    },

    /**
     * Track subscribe event
     */
    trackSubscribe: async (params: EventParams = {}) => {
        if (!isInitialized) return;

        try {
            if (debugMode) {
                console.log(`[TikTok] Subscribe`, params);
            }
            // TODO: TiktokSDK.trackEvent(TikTokEventName.SUBSCRIBE, params);
        } catch (error) {
            console.warn('[TikTok] Failed to log subscribe:', error);
        }
    },

    /**
     * Set debug mode
     */
    setDebugMode: (enabled: boolean) => {
        debugMode = enabled;
        console.log(`[TikTok] Debug mode: ${enabled}`);
    },

    /**
     * Check if SDK is initialized
     */
    isReady: () => isInitialized,
};
