/**
 * TelegramUserHelper - Helper to get user info for Telegram notifications
 */

import { authManager } from '../services/AuthManager';

interface TelegramUserInfo {
  userId: string;
  userName: string;
  userCountry: string;
  userAge: number | string;
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
    };
  }

  const userId = user.id || 'Unknown';
  const displayName = (user.user_metadata?.display_name as string) || 'Unknown';
  
  // Calculate age from birth_year
  const birthYear = user.user_metadata?.birth_year;
  let userAge: number | string = 'Unknown';
  if (birthYear) {
    const currentYear = new Date().getFullYear();
    const birthYearNum = typeof birthYear === 'string' ? parseInt(birthYear, 10) : birthYear;
    if (!isNaN(birthYearNum)) {
      userAge = currentYear - birthYearNum;
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
      // Use the Intl API to get locale info
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      if (locale) {
        // Extract country code from locale (e.g., "en-US" -> "US")
        const parts = locale.split('-');
        if (parts.length > 1) {
          userCountry = parts[parts.length - 1];
        }
      }
    }
  } catch (e) {
    console.warn('[TelegramUserHelper] Failed to get country:', e);
  }

  return {
    userId,
    userName: displayName,
    userCountry,
    userAge,
  };
}
