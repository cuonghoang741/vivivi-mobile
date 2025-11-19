import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../services/supabase';
import { authManager } from '../services/AuthManager';
import { PersistKeys } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureClientId } from '../services/supabase';

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
   * Get client ID (for guest users, matching Swift's getClientId())
   */
  protected async getClientId(): Promise<string | null> {
    if (authManager.isGuest) {
      const existing = await AsyncStorage.getItem(PersistKeys.clientId);
      return existing || await ensureClientId();
    }
    return null;
  }

  /**
   * Add authentication query filters (user_id or client_id)
   * Matching Swift's addAuthQueryItems() behavior
   * Returns a new query builder with auth filters applied
   * 
   * Swift format: user_id=eq.{userId}&client_id=is.null
   * PostgREST format: .eq('user_id', userId).is('client_id', null)
   * These are equivalent in Supabase PostgREST
   */
  protected async addAuthFilters<T = any>(query: any): Promise<any> {
    const userId = this.getUserId();
    const clientId = await this.getClientId();
    
    if (userId) {
      // Match Swift: user_id=eq.{userId}&client_id=is.null
      return query.eq('user_id', userId).is('client_id', null);
    } else if (clientId) {
      // Match Swift: client_id=eq.{clientId}&user_id=is.null
      return query.eq('client_id', clientId).is('user_id', null);
    }
    
    return query;
  }

  /**
   * Add authentication headers (X-Client-Id for guest users)
   * Matching Swift's addAuthHeaders() behavior
   */
  protected async addAuthHeaders(headers: Record<string, string>): Promise<Record<string, string>> {
    const clientId = await this.getClientId();
    if (clientId) {
      headers['X-Client-Id'] = clientId;
    }
    return headers;
  }

  /**
   * Get headers with authentication
   * Similar to Swift's setSupabaseAuthHeaders function
   */
  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const { getSupabaseAuthHeaders } = await import('../utils/supabaseHelpers');
    const headers = await getSupabaseAuthHeaders();
    // Add X-Client-Id header if guest user
    return this.addAuthHeaders(headers);
  }
}

