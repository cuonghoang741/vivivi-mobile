/**
 * TelegramUserHelper - Helper to get user info for Telegram notifications
 */

import { authManager } from '../services/AuthManager';
import { revenueCatManager } from '../services/RevenueCatManager';
import { getLocales } from 'expo-localization';

interface TelegramUserInfo {
  userId: string;
  userName: string;
  userCountry: string;
  userAge: string; // Time since user started using the app (e.g., "5d 3h", "2h 30m")
  isPro: boolean;
}

/**
 * Get user info for Telegram notifications
 */
export async function getTelegramUserInfo(): Promise<TelegramUserInfo> {
  const user = authManager.user;

  if (!user) {
    return {
      userId: 'Unknown',
      userName: 'Unknown',
      userCountry: 'Unknown',
      userAge: 'Unknown',
      isPro: false,
    };
  }

  const userId = user.id || 'Unknown';
  const displayName = (user.user_metadata?.display_name as string) || 'Unknown';

  // Calculate time since user started using the app (from created_at)
  let userAge: string = 'Unknown';
  if (user.created_at) {
    const createdAt = new Date(user.created_at);
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) {
      userAge = `${diffDays}d ${diffHours}h`;
    } else if (diffHours > 0) {
      userAge = `${diffHours}h ${diffMinutes}m`;
    } else {
      userAge = `${diffMinutes}m`;
    }
  }

  // Get country from locale or default
  // Note: React Native doesn't have direct country access, we'll use locale or timezone
  let userCountry = 'Unknown';
  try {
    // Try to get from user metadata if available
    if (user.user_metadata?.country) {
      userCountry = user.user_metadata.country as string;
    } else {
      // Use the Localication API to get locale info
      const locales = getLocales();
      if (locales && locales.length > 0) {
        userCountry = locales[0].regionCode || 'Unknown';
      }
    }
  } catch (e) {
    console.warn('[TelegramUserHelper] Failed to get country:', e);
  }

  const isPro = revenueCatManager.isProUser();

  console.log("isProssxx", isPro)

  return {
    userId,
    userName: displayName,
    userCountry,
    userAge,
    isPro,
  };
}
