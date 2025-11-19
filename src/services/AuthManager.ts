import { getSupabaseClient, ensureClientId } from './supabase';
import { PersistKeys } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

type AuthManagerState = {
  session: Session | null;
  user: User | null;
  isGuest: boolean;
  isLoading: boolean;
  errorMessage: string | null;
};

/**
 * AuthManager - Singleton class matching Swift's AuthManager
 * Manages authentication state, session, and user
 */
export class AuthManager {
  private static instance: AuthManager;
  private client = getSupabaseClient();
  
  // State properties (similar to Swift's @Published)
  private _session: Session | null = null;
  private _user: User | null = null;
  private _isLoading: boolean = false;
  private _errorMessage: string | null = null;
  private _isGuest: boolean = false;
  private _hasRestoredSession: boolean = false;
  
  // Listeners for state changes (for React components)
  private listeners: Set<() => void> = new Set();
  
  private constructor() {
    // Attempt to restore existing session on startup (similar to Swift)
    this.restoreSession();
  }
  
  static get shared(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }
  
  // Getters
  get session(): Session | null {
    return this._session;
  }
  
  get user(): User | null {
    return this._user;
  }
  
  get isLoading(): boolean {
    return this._isLoading;
  }
  
  get errorMessage(): string | null {
    return this._errorMessage;
  }
  
  get isGuest(): boolean {
    return this._isGuest;
  }
  
  get hasRestoredSession(): boolean {
    return this._hasRestoredSession;
  }
  
  /**
   * Subscribe to state changes (for React components)
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  private async persistGuestMode(enabled: boolean): Promise<void> {
    if (enabled) {
      await AsyncStorage.setItem(PersistKeys.guestMode, 'true');
    } else {
      await AsyncStorage.removeItem(PersistKeys.guestMode);
    }
  }

  /**
   * Helper to update state slices with a single notification
   */
  private setState(partial: Partial<AuthManagerState>): void {
    let changed = false;
    if ('session' in partial) {
      const next = partial.session ?? null;
      if (this._session !== next) {
        this._session = next;
        changed = true;
      }
    }
    if ('user' in partial) {
      const next = partial.user ?? null;
      if (this._user !== next) {
        this._user = next;
        changed = true;
      }
    }
    if ('isGuest' in partial && typeof partial.isGuest === 'boolean' && this._isGuest !== partial.isGuest) {
      this._isGuest = partial.isGuest;
      changed = true;
    }
    if ('isLoading' in partial && typeof partial.isLoading === 'boolean' && this._isLoading !== partial.isLoading) {
      this._isLoading = partial.isLoading;
      changed = true;
    }
    if ('errorMessage' in partial && this._errorMessage !== (partial.errorMessage ?? null)) {
      this._errorMessage = partial.errorMessage ?? null;
      changed = true;
    }

    if (changed) {
      this.notifyListeners();
    }
  }
  
  /**
   * Restore session from storage (similar to Swift's init)
   */
  private async restoreSession(): Promise<void> {
    try {
      const {
        data: { session },
      } = await this.client.auth.getSession();
      const {
        data: { user },
      } = await this.client.auth.getUser();

      this._session = session;
      this._user = user;

      if (session || user) {
        await this.persistGuestMode(false);
        this._isGuest = false;
      } else {
        const guestFlag = await AsyncStorage.getItem(PersistKeys.guestMode);
        this._isGuest = guestFlag === 'true';
      }

      this._hasRestoredSession = true;
      this.notifyListeners();
    } catch (error) {
      console.error('Error restoring session:', error);
      this._hasRestoredSession = true;
      this.notifyListeners();
    }
  }
  
  /**
   * Get current session
   */
  async getSession(): Promise<Session | null> {
    const { data: { session } } = await this.client.auth.getSession();
    this._session = session;
    this.notifyListeners();
    return session;
  }
  
  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await this.client.auth.getUser();
    this._user = user;
    this.notifyListeners();
    return user;
  }
  
  /**
   * Check if user is guest
   */
  async checkIsGuest(): Promise<boolean> {
    const session = await this.getSession();
    if (session) {
      this._isGuest = false;
      await this.persistGuestMode(false);
    } else {
      const guestFlag = await AsyncStorage.getItem(PersistKeys.guestMode);
      this._isGuest = guestFlag === 'true';
    }
    this.notifyListeners();
    return this._isGuest;
  }
  
  /**
   * Sign out (similar to Swift's logout)
   */
  async logout(): Promise<void> {
    this.setState({ isLoading: true, errorMessage: null });
    
    try {
      await this.client.auth.signOut();
      await this.persistGuestMode(false);
      this.setState({ session: null, user: null, isGuest: false });
    } catch (error: any) {
      this.setState({ errorMessage: error.message || 'Failed to sign out' });
      throw error;
    } finally {
      this.setState({ isLoading: false });
    }
  }
  
  /**
   * Continue as guest (similar to Swift's continueAsGuest)
   */
  async continueAsGuest(): Promise<void> {
    this.setState({ errorMessage: null });
    
    // Ensure client ID exists (similar to Swift)
    await ensureClientId();
    await this.persistGuestMode(true);
    
    this.setState({ isGuest: true, session: null, user: null });
  }
  
  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<{ session: Session; user: User }> {
    this.setState({ isLoading: true, errorMessage: null });
    
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        this.setState({ errorMessage: error.message });
        throw error;
      }
      
      if (data.session && data.user) {
        this.setState({
          session: data.session,
          user: data.user,
          isGuest: false,
        });
        await this.persistGuestMode(false);
      }
      
      this.setState({ isLoading: false });
      
      return { session: data.session!, user: data.user! };
    } catch (error: any) {
      this.setState({
        isLoading: false,
        errorMessage: error.message || 'Failed to sign in',
      });
      throw error;
    }
  }
  
  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email: string, password: string): Promise<{ session: Session | null; user: User | null }> {
    this.setState({ isLoading: true, errorMessage: null });
    
    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        this.setState({ errorMessage: error.message });
        throw error;
      }
      
      if (data.session && data.user) {
        this.setState({
          session: data.session,
          user: data.user,
          isGuest: false,
        });
        await this.persistGuestMode(false);
      }
      
      this.setState({ isLoading: false });
      
      return { session: data.session, user: data.user };
    } catch (error: any) {
      this.setState({
        isLoading: false,
        errorMessage: error.message || 'Failed to sign up',
      });
      throw error;
    }
  }

  /**
   * Sign in with Apple (mirrors Swift AuthManager behavior)
   */
  async signInWithApple(): Promise<void> {
    if (Platform.OS !== 'ios') {
      this.setState({ errorMessage: 'Sign in with Apple chỉ khả dụng trên iOS' });
      return;
    }

    this.setState({ isLoading: true, errorMessage: null });

    try {
      const nonce =
        typeof Crypto.randomUUID === 'function'
          ? Crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error('Không thể lấy Apple identity token');
      }

      const { data, error } = await this.client.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce,
      });

      if (error) {
        throw error;
      }

      this.setState({
        session: data.session ?? null,
        user: data.user ?? null,
        isGuest: false,
      });
      await this.persistGuestMode(false);
    } catch (error: any) {
      if (error?.code === 'ERR_CANCELED') {
        console.log('[AuthManager] User cancelled Sign in with Apple');
        this.setState({ errorMessage: null });
        return;
      }
      console.error('[AuthManager] Sign in with Apple failed', error);
      this.setState({
        errorMessage: error?.message || 'Failed to sign in with Apple',
      });
    } finally {
      this.setState({ isLoading: false });
    }
  }
  
  /**
   * Get user ID (lowercase, matching Swift's getUserId())
   */
  getUserId(): string | null {
    return this._user?.id?.toLowerCase() || null;
  }
  
  /**
   * Get client ID (for guest users)
   */
  async getClientId(): Promise<string | null> {
    if (this._isGuest) {
      return await AsyncStorage.getItem(PersistKeys.clientId) || await ensureClientId();
    }
    return null;
  }
}

// Export singleton instance
export const authManager = AuthManager.shared;

