import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../services/supabase';
import { authManager } from '../services/AuthManager';
import { getAuthIdentifier } from '../services/authIdentifier';

/**
 * Base repository class matching Swift's SupabaseRepository protocol
 */
export abstract class BaseRepository {
  protected client: SupabaseClient;

  constructor() {
    this.client = getSupabaseClient();
  }

  /**
   * Get user ID (lowercase, matching Swift's getUserId())
   * Normalize UUID to lowercase for consistent database queries
   */
  protected getUserId(): string | null {
    const userId = authManager.user?.id;
    return userId ? userId.toLowerCase() : null;
  }

  /**
   * Add authentication query filters (user_id)
   * Matching Swift's addAuthQueryItems() behavior
   * Returns a new query builder with auth filters applied
   */
  protected async addAuthFilters<T = any>(query: any): Promise<any> {
    const userId = this.getUserId();
    if (userId) {
      return query.eq('user_id', userId).is('client_id', null);
    }
    const { clientId } = await getAuthIdentifier();
    if (clientId) {
      return query.eq('client_id', clientId).is('user_id', null);
    }
    throw new Error('User is not authenticated');
  }

  /**
   * Hook for subclasses to tweak headers if needed.
   */
  protected async addAuthHeaders(headers: Record<string, string>): Promise<Record<string, string>> {
    return headers;
  }

  /**
   * Get headers with authentication
   * Similar to Swift's setSupabaseAuthHeaders function
   */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const { getSupabaseAuthHeaders } = await import('../utils/supabaseHelpers');
    const headers = await getSupabaseAuthHeaders();
    return this.addAuthHeaders(headers);
  }
}

