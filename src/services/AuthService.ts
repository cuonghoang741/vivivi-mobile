import { getSupabaseClient } from './supabase';
import { ensureClientId } from './supabase';

export interface AuthUser {
  id: string;
  email?: string;
}

export class AuthService {
  private client = getSupabaseClient();

  /**
   * Get current session
   */
  async getSession() {
    const { data: { session } } = await this.client.auth.getSession();
    return session;
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const { data: { user } } = await this.client.auth.getUser();
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
    };
  }

  /**
   * Check if user is guest
   */
  async isGuest(): Promise<boolean> {
    const session = await this.getSession();
    return !session;
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Sign out
   */
  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Get or create client ID for guest users
   */
  async getClientId(): Promise<string> {
    return ensureClientId();
  }
}

// Singleton instance
export const authService = new AuthService();

