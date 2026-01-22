import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';

export const FacebookService = {
    /**
     * Log a custom event to Facebook Analytics
     */
    logEvent: async (eventName: string, params: Record<string, any> = {}) => {
        try {
            // Map generic event names to Facebook specific ones
            let mappedEventName = eventName;

            // Standard Facebook Events Mapping
            // Reference: https://developers.facebook.com/docs/app-events/reference
            switch (eventName) {
                case 'sign_up':
                    mappedEventName = 'fb_mobile_complete_registration'; // AppEventsLogger.AppEvents.CompletedRegistration
                    break;
                case 'purchase_complete':
                    // Note: logPurchase should be used for actual purchases, but if this event is called generically:
                    mappedEventName = 'fb_mobile_purchase'; // AppEventsLogger.AppEvents.Purchased
                    break;
                case 'currency_purchase_start':
                case 'purchase_start':
                    mappedEventName = 'fb_mobile_initiated_checkout'; // AppEventsLogger.AppEvents.InitiatedCheckout
                    break;
                case 'character_select':
                case 'costume_change':
                case 'background_change':
                    mappedEventName = 'fb_mobile_content_view'; // AppEventsLogger.AppEvents.ViewedContent
                    break;
                case 'onboarding_complete':
                    mappedEventName = 'fb_mobile_tutorial_completion'; // AppEventsLogger.AppEvents.CompletedTutorial
                    break;
                // 'sign_in' doesn't have a direct standard event in standard list except 'fb_login' usage in some docs, 
                // but usually considered custom or covered by custom login flows. We'll keep it custom or map to 'fb_mobile_login' if supported by platform.
            }

            await AppEventsLogger.logEvent(mappedEventName, params);
            console.log(`[Facebook] Event logged: ${mappedEventName} (was ${eventName})`);
        } catch (error) {
            console.warn(`[Facebook] Failed to log event ${eventName}:`, error);
        }
    },

    /**
     * Log a purchase event
     * Facebook has a specific method for purchases which is better for ad optimization
     */
    logPurchase: async (amount: number, currency: string, params: Record<string, any> = {}) => {
        try {
            await AppEventsLogger.logPurchase(amount, currency, params);
            console.log(`[Facebook] Purchase logged: ${amount} ${currency}`);
        } catch (error) {
            console.warn('[Facebook] Failed to log purchase:', error);
        }
    },

    /**
     * Initialize or configure settings if needed
     * Most init is handled by the native manifest/plist
     */
    init: () => {
        Settings.setAdvertiserTrackingEnabled(false);
        Settings.setAutoLogAppEventsEnabled(true);
        Settings.initializeSDK();
        console.log('[Facebook] SDK Initialized');
    }
};
