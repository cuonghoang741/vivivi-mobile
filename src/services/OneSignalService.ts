import { LogLevel, OneSignal, NotificationWillDisplayEvent, NotificationClickEvent } from 'react-native-onesignal';
import Constants from 'expo-constants';

/**
 * OneSignal Push Notification Service
 * Singleton service to manage OneSignal push notifications
 */
class OneSignalService {
  private static instance: OneSignalService;
  private isInitialized = false;

  private constructor() {}

  static get shared(): OneSignalService {
    if (!OneSignalService.instance) {
      OneSignalService.instance = new OneSignalService();
    }
    return OneSignalService.instance;
  }

  /**
   * Initialize OneSignal with the App ID from config
   * Should be called once when the app starts
   */
  initialize(): void {
    if (this.isInitialized) {
      console.log('[OneSignal] Already initialized');
      return;
    }

    const appId = Constants.expoConfig?.extra?.oneSignalAppId;
    
    if (!appId) {
      console.error('[OneSignal] App ID not found in config');
      return;
    }

    try {
      // Enable verbose logging for debugging (remove in production)
      OneSignal.Debug.setLogLevel(LogLevel.Verbose);

      // Initialize OneSignal
      OneSignal.initialize(appId);

      this.isInitialized = true;
      console.log('[OneSignal] Initialized successfully');
    } catch (error) {
      console.error('[OneSignal] Failed to initialize:', error);
    }
  }

  /**
   * Request notification permission from the user
   * @returns Promise<boolean> - true if permission granted
   */
  async requestPermission(): Promise<boolean> {
    try {
      const granted = await OneSignal.Notifications.requestPermission(true);
      console.log('[OneSignal] Permission granted:', granted);
      return granted;
    } catch (error) {
      console.error('[OneSignal] Failed to request permission:', error);
      return false;
    }
  }

  /**
   * Check if notifications are enabled
   */
  hasPermission(): boolean {
    return OneSignal.Notifications.hasPermission();
  }

  /**
   * Set the external user ID to link with your backend user
   * @param userId - Your Supabase user ID
   */
  async setExternalUserId(userId: string): Promise<void> {
    if (!userId) {
      console.warn('[OneSignal] Cannot set empty external user ID');
      return;
    }

    try {
      await OneSignal.login(userId);
      console.log('[OneSignal] External user ID set:', userId);
    } catch (error) {
      console.error('[OneSignal] Failed to set external user ID:', error);
    }
  }

  /**
   * Remove the external user ID (call on logout)
   */
  async removeExternalUserId(): Promise<void> {
    try {
      await OneSignal.logout();
      console.log('[OneSignal] External user ID removed');
    } catch (error) {
      console.error('[OneSignal] Failed to remove external user ID:', error);
    }
  }

  /**
   * Add tags to segment users for targeted notifications
   * @param tags - Key-value pairs to add as tags
   */
  async setTags(tags: Record<string, string>): Promise<void> {
    try {
      OneSignal.User.addTags(tags);
      console.log('[OneSignal] Tags set:', tags);
    } catch (error) {
      console.error('[OneSignal] Failed to set tags:', error);
    }
  }

  /**
   * Remove specific tags
   * @param keys - Keys of tags to remove
   */
  async removeTags(keys: string[]): Promise<void> {
    try {
      OneSignal.User.removeTags(keys);
      console.log('[OneSignal] Tags removed:', keys);
    } catch (error) {
      console.error('[OneSignal] Failed to remove tags:', error);
    }
  }

  /**
   * Set up notification received handler (for foreground notifications)
   * @param callback - Function to call when notification is received
   */
  onNotificationReceived(callback: (notification: any) => void): void {
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: NotificationWillDisplayEvent) => {
      console.log('[OneSignal] Notification received:', event.notification);
      callback(event.notification);
      // Allow the notification to display
      event.preventDefault();
      event.getNotification().display();
    });
  }

  /**
   * Set up notification opened handler
   * @param callback - Function to call when notification is opened
   */
  onNotificationOpened(callback: (notification: any) => void): void {
    OneSignal.Notifications.addEventListener('click', (event: NotificationClickEvent) => {
      console.log('[OneSignal] Notification opened:', event.notification);
      callback(event.notification);
    });
  }
}

export const oneSignalService = OneSignalService.shared;
