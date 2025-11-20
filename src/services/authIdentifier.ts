import { authManager } from './AuthManager';
import { ensureClientId } from '../utils/clientId';

type AuthIdentifier = {
  userId: string | null;
  clientId: string | null;
};

/**
 * Helper to determine whether we should use user_id or client_id
 * when hitting Supabase REST endpoints (mirrors Swift helpers).
 */
export const getAuthIdentifier = async (): Promise<AuthIdentifier> => {
  const userId = authManager.user?.id?.toLowerCase() ?? null;
  if (userId) {
    return { userId, clientId: null };
  }
  const clientId = await ensureClientId();
  return { userId: null, clientId };
};


