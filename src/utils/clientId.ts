import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistKeys } from '../config/supabase';

/**
 * Ensure we have a stable client id for guest/anonymous flows.
 * Mirrors Swift version's ensureClientId()
 */
export const ensureClientId = async (): Promise<string> => {
  const existing = await AsyncStorage.getItem(PersistKeys.clientId);
  if (existing) {
    return existing;
  }
  const generated = cryptoRandomId();
  await AsyncStorage.setItem(PersistKeys.clientId, generated);
  return generated;
};

/**
 * Return currently stored client id if any.
 */
export const getClientId = async (): Promise<string | null> => {
  const existing = await AsyncStorage.getItem(PersistKeys.clientId);
  return existing;
};

/**
 * Remove cached client id (used after account deletion).
 */
export const clearClientId = async (): Promise<void> => {
  await AsyncStorage.removeItem(PersistKeys.clientId);
};

const cryptoRandomId = (): string => {
  try {
    const randomBytes =
      typeof globalThis.crypto?.getRandomValues === 'function'
        ? globalThis.crypto.getRandomValues(new Uint8Array(16))
        : null;
    if (randomBytes) {
      // Convert to UUID v4 format
      randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
      randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;
      const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0'));
      return [
        hex.slice(0, 4).join(''),
        hex.slice(4, 6).join(''),
        hex.slice(6, 8).join(''),
        hex.slice(8, 10).join(''),
        hex.slice(10, 16).join(''),
      ].join('-');
    }
  } catch {
    // Ignore and fallback below
  }
  // Fallback to Date.now + Math.random
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};


