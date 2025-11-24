import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../services/supabase';
import { authManager } from '../services/AuthManager';
import { SUPABASE_ANON_KEY } from '../config/supabase';
import { ensureClientId } from './clientId';

/**
 * Helper functions similar to Swift version's Supabase helpers
 */

/**
 * Get auth headers similar to Swift's setSupabaseAuthHeaders
 * Returns headers object that can be used with fetch or other HTTP clients
 * Matching Swift's setSupabaseAuthHeaders() behavior
 */
export const getSupabaseAuthHeaders = async (): Promise<Record<string, string>> => {
  const session = authManager.session || await authManager.getSession();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
  };

  // Add Authorization header (matching Swift)
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else {
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const clientId = await ensureClientId();
  if (clientId) {
    headers['X-Client-Id'] = clientId;
  }

  return headers;
};

/**
 * Make Supabase request similar to Swift's makeSupabaseRequest
 * Returns URL and RequestInit for fetch
 */
export const makeSupabaseRequest = async (
  path: string,
  queryItems?: Record<string, string>,
  method: string = 'GET',
  body?: any
): Promise<{ url: string; init: RequestInit }> => {
  const { SUPABASE_URL } = await import('../config/supabase');
  
  const url = new URL(path, SUPABASE_URL);
  
  // Add query parameters
  if (queryItems) {
    Object.entries(queryItems).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const headers = await getSupabaseAuthHeaders();

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    requestInit.body = JSON.stringify(body);
  }

  return {
    url: url.toString(),
    init: requestInit,
  };
};

/**
 * Execute Supabase REST API request
 * Similar to Swift's performRequest but using fetch
 */
export const executeSupabaseRequest = async <T = any>(
  path: string,
  queryItems?: Record<string, string>,
  method: string = 'GET',
  body?: any
): Promise<T> => {
  const { url, init } = await makeSupabaseRequest(path, queryItems, method, body);
  
  const response = await fetch(url, init);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
};

