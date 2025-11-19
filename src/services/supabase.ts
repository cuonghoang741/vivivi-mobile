import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Singleton Supabase client
let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
        },
      },
    });
  }
  return supabaseClient;
};

// Helper to get Supabase client with X-Client-Id header for guest users
// Similar to Swift's setSupabaseAuthHeaders function
export const getSupabaseClientWithHeaders = async (): Promise<SupabaseClient> => {
  const client = getSupabaseClient();
  
  // Add X-Client-Id header for guest users (similar to Swift version)
  const { clientId } = await getAuthIdentifier();
  if (clientId) {
    // Note: Supabase JS client doesn't support dynamic headers per request
    // We'll handle this in BaseRepository.getAuthHeaders() instead
  }
  
  return client;
};

/**
 * Generate UUID v4 format (matching Swift's UUID().uuidString)
 */
function generateUUID(): string {
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where x is any hexadecimal digit and y is one of 8, 9, A, or B
  const hex = '0123456789abcdef';
  const generateHex = (count: number) => {
    let result = '';
    for (let i = 0; i < count; i++) {
      result += hex[Math.floor(Math.random() * 16)];
    }
    return result;
  };
  
  return [
    generateHex(8),
    generateHex(4),
    '4' + generateHex(3), // Version 4
    ((Math.floor(Math.random() * 4) + 8).toString(16) + generateHex(3)), // y is 8, 9, a, or b
    generateHex(12)
  ].join('-');
}

// Helper to get client ID for guest users
// Match Swift's ensureClientId() which uses UUID().uuidString
export const ensureClientId = async (): Promise<string> => {
  const { PersistKeys } = await import('../config/supabase');
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  
  const existing = await AsyncStorage.getItem(PersistKeys.clientId);
  if (existing) {
    return existing;
  }
  
  // Generate UUID format matching Swift's UUID().uuidString
  const newId = generateUUID();
  await AsyncStorage.setItem(PersistKeys.clientId, newId);
  return newId;
};

// Helper to get current user ID or client ID
export const getAuthIdentifier = async (): Promise<{ userId?: string; clientId?: string }> => {
  const client = getSupabaseClient();
  const { data: { session } } = await client.auth.getSession();
  
  if (session?.user?.id) {
    return { userId: session.user.id.toLowerCase() };
  }
  
  const clientId = await ensureClientId();
  return { clientId };
};

// Export default client instance
export default getSupabaseClient;

