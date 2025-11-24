import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureClientId } from '../utils/clientId';

// Singleton Supabase client
let supabaseClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseClient) {
    const originalFetch = (globalThis.fetch || fetch).bind(globalThis);
    const fetchWithClientId: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers ?? {});
      if (!headers.has('apikey')) {
        headers.set('apikey', SUPABASE_ANON_KEY);
      }
      const clientId = await ensureClientId();
      if (clientId) {
        headers.set('X-Client-Id', clientId);
      }
      return originalFetch(input, { ...init, headers });
    };

    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          apikey: SUPABASE_ANON_KEY,
        },
        fetch: fetchWithClientId,
      },
    });
  }
  return supabaseClient;
};

export const getAuthenticatedUserId = async (): Promise<string> => {
  const client = getSupabaseClient();
  const {
    data: { session },
  } = await client.auth.getSession();

  const userId = session?.user?.id;
  if (!userId) {
    throw new Error('User is not authenticated');
  }
  return userId.toLowerCase();
};

// Export default client instance
export default getSupabaseClient;

