import { getSupabaseClient } from "./supabase";
import { APP_SCHEME, AUTH_REDIRECT_PATH, PersistKeys, SUPABASE_URL } from "../config/supabase";
import type { Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ensureClientId, clearClientId } from "../utils/clientId";
import { getSupabaseAuthHeaders } from "../utils/supabaseHelpers";

WebBrowser.maybeCompleteAuthSession();

type AuthManagerState = {
  session: Session | null;
  user: User | null;
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
  private _hasRestoredSession: boolean = false;
  private _isDeletingAccount: boolean = false;

  // Listeners for state changes (for React components)
  private listeners: Set<() => void> = new Set();

  private constructor() {
    // Attempt to restore existing session on startup (similar to Swift)
    this.restoreSession();
  }

  private buildRedirectUri(): string {
    return AuthSession.makeRedirectUri({
      scheme: APP_SCHEME,
      path: AUTH_REDIRECT_PATH,
    });
  }

  private async refreshSessionFromClient(): Promise<void> {
    const {
      data: { session },
    } = await this.client.auth.getSession();
    const {
      data: { user },
    } = await this.client.auth.getUser();

    this.setState({
      session: session ?? null,
      user: user ?? null,
    });
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

  get hasRestoredSession(): boolean {
    return this._hasRestoredSession;
  }

  get isDeletingAccount(): boolean {
    return this._isDeletingAccount;
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
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Helper to update state slices with a single notification
   */
  private setState(partial: Partial<AuthManagerState>): void {
    let changed = false;
    if ("session" in partial) {
      const next = partial.session ?? null;
      if (this._session !== next) {
        this._session = next;
        changed = true;
      }
    }
    if ("user" in partial) {
      const next = partial.user ?? null;
      if (this._user !== next) {
        this._user = next;
        changed = true;
      }
    }
    if (
      "isLoading" in partial &&
      typeof partial.isLoading === "boolean" &&
      this._isLoading !== partial.isLoading
    ) {
      this._isLoading = partial.isLoading;
      changed = true;
    }
    if (
      "errorMessage" in partial &&
      this._errorMessage !== (partial.errorMessage ?? null)
    ) {
      this._errorMessage = partial.errorMessage ?? null;
      changed = true;
    }

    if (changed) {
      this.notifyListeners();
    }
  }

  private setDeletingAccount(value: boolean) {
    if (this._isDeletingAccount !== value) {
      this._isDeletingAccount = value;
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
      this._hasRestoredSession = true;
      this.notifyListeners();
    } catch (error) {
      console.error("Error restoring session:", error);
      this._hasRestoredSession = true;
      this.notifyListeners();
    }
  }

  /**
   * Get current session
   */
  async getSession(): Promise<Session | null> {
    const {
      data: { session },
    } = await this.client.auth.getSession();
    this._session = session;
    this.notifyListeners();
    return session;
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    this._user = user;
    this.notifyListeners();
    return user;
  }

  /**
   * Update display name metadata (parity with Swift AuthManager)
   */
  async updateDisplayName(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    try {
      await this.client.auth.updateUser({
        data: {
          display_name: trimmed,
        },
      });
      await this.refreshSessionFromClient();
    } catch (error: any) {
      const message = error?.message || "Không thể cập nhật tên hiển thị";
      this.setState({ errorMessage: message });
      throw error;
    }
  }

  /**
   * Update birth year metadata
   */
  async updateBirthYear(year: number): Promise<void> {
    if (!Number.isFinite(year) || year < 1900 || year > 2100) {
      return;
    }
    try {
      await this.client.auth.updateUser({
        data: {
          birth_year: String(year),
        },
      });
      await this.refreshSessionFromClient();
    } catch (error: any) {
      const message = error?.message || "Không thể cập nhật năm sinh";
      this.setState({ errorMessage: message });
      throw error;
    }
  }

  /**
   * Delete account and local storage, mirroring Swift deleteAccountLocally()
   */
  async deleteAccountLocally(): Promise<void> {
    if (this._isDeletingAccount) {
      return;
    }
    this.setDeletingAccount(true);
    try {
      const userId = this._user?.id?.toLowerCase() ?? null;
      const clientId = userId ? null : await ensureClientId();

      if (!userId && !clientId) {
        // No identifiers, just logout
        await this.clearLocalStateAfterDeletion();
        await this.logout();
        return;
      }

      const tablesToDelete = [
        "relationship_milestones",
        "character_relationship",
        "level_up_rewards",
        "user_daily_quests",
        "user_level_quests",
        "user_login_rewards",
        "user_streaks",
        "user_medals",
        "user_character",
        "user_stats",
        "user_currency",
        "user_assets",
        "transactions",
        "purchases",
        "subscriptions",
        "user_preferences",
        "api_characters",
        "conversation",
        "app_feedback",
        "calls",
        "scheduled_notifications",
        "user_notification_preferences",
        "spicy_content_notifications",
        "notification_counters",
      ];
      const tablesWithoutClientId = new Set(["api_characters", "subscriptions"]);

      for (const table of tablesToDelete) {
        try {
          const params = new URLSearchParams();
          if (userId) {
            params.append("user_id", `eq.${userId}`);
            if (!tablesWithoutClientId.has(table)) {
              params.append("client_id", "is.null");
            }
          } else if (clientId) {
            params.append("client_id", `eq.${clientId}`);
            params.append("user_id", "is.null");
          }

          const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
          const headers = await getSupabaseAuthHeaders();
          headers["Prefer"] = "return=minimal";
          if (!userId && clientId) {
            headers["X-Client-Id"] = clientId;
          }

          const response = await fetch(url, {
            method: "DELETE",
            headers,
          });

          if (!response.ok) {
            console.warn(
              `[AuthManager] Failed to delete ${table}: ${response.status} ${await response.text()}`
            );
          }
        } catch (error) {
          console.warn(`[AuthManager] Error deleting ${table}`, error);
        }
      }

      await this.clearLocalStateAfterDeletion();
      await this.logout();
    } catch (error) {
      console.error("[AuthManager] deleteAccountLocally failed", error);
      throw error;
    } finally {
      this.setDeletingAccount(false);
    }
  }

  private async clearLocalStateAfterDeletion() {
    try {
      const keysToClear = [
        PersistKeys.characterId,
        PersistKeys.modelName,
        PersistKeys.modelURL,
        PersistKeys.backgroundName,
        PersistKeys.backgroundURL,
        PersistKeys.hasRatedApp,
        PersistKeys.lastReviewPromptAt,
        PersistKeys.ageVerified18,
        "persist.hasCompletedImageOnboarding",
        "persist.hasSeenImageOnboarding",
        "persist.hasClaimedGift",
        "settings.hapticsEnabled",
        "settings.autoPlayMusic",
        "settings.autoEnterTalking",
        "settings.enableNSFW",
        "settings.kidsMode",
        "settings.dictation",
        "settings.voiceMode",
        "subscription.tier",
      ];
      await AsyncStorage.multiRemove(keysToClear);
      await AsyncStorage.setItem(PersistKeys.ageVerified18, "false");
      await clearClientId();
    } catch (error) {
      console.warn("[AuthManager] Failed clearing local state", error);
    }
  }

  /**
   * Sign out (similar to Swift's logout)
   */
  async logout(): Promise<void> {
    this.setState({ isLoading: true, errorMessage: null });

    try {
      await this.client.auth.signOut();
      this.setState({ session: null, user: null });
    } catch (error: any) {
      this.setState({ errorMessage: error.message || "Failed to sign out" });
      throw error;
    } finally {
      this.setState({ isLoading: false });
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(
    email: string,
    password: string
  ): Promise<{ session: Session; user: User }> {
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
        });
      }

      this.setState({ isLoading: false });

      return { session: data.session!, user: data.user! };
    } catch (error: any) {
      this.setState({
        isLoading: false,
        errorMessage: error.message || "Failed to sign in",
      });
      throw error;
    }
  }

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(
    email: string,
    password: string
  ): Promise<{ session: Session | null; user: User | null }> {
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
        });
      }

      this.setState({ isLoading: false });

      return { session: data.session, user: data.user };
    } catch (error: any) {
      this.setState({
        isLoading: false,
        errorMessage: error.message || "Failed to sign up",
      });
      throw error;
    }
  }

  /**
   * Sign in with Apple (mirrors Swift AuthManager behavior)
   */
  async signInWithApple(): Promise<void> {
    if (Platform.OS !== "ios") {
      this.setState({
        errorMessage: "Sign in with Apple chỉ khả dụng trên iOS",
      });
      return;
    }

    this.setState({ isLoading: true, errorMessage: null });

    try {
      const nonce =
        typeof Crypto.randomUUID === "function"
          ? Crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        throw new Error("Không thể lấy Apple identity token");
      }

      const { data, error } = await this.client.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce,
      });

      if (error) {
        throw error;
      }

      this.setState({
        session: data.session ?? null,
        user: data.user ?? null,
      });
    } catch (error: any) {
      if (error?.code === "ERR_CANCELED") {
        console.log("[AuthManager] User cancelled Sign in with Apple");
        this.setState({ errorMessage: null });
        return;
      }
      console.error("[AuthManager] Sign in with Apple failed", error);
      this.setState({
        errorMessage: error?.message || "Failed to sign in with Apple",
      });
    } finally {
      this.setState({ isLoading: false });
    }
  }

  /**
   * Sign in with Google using Supabase OAuth + Expo AuthSession
   */
  async signInWithGoogle() {
    this.setState({ isLoading: true, errorMessage: null });
  
    try {
      const redirectUri = this.buildRedirectUri();
  
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });
  
      if (error) throw error;
      if (!data?.url) throw new Error("Failed to get OAuth URL from Supabase");
  
      // Dùng WebBrowser.openAuthSessionAsync (KHÔNG dùng AuthSession.startAsync)
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri
      );
  
      if (result.type !== "success") {
        throw new Error("User cancelled Google login");
      }
  
      // Sau khi redirect về app → Supabase đã xử lý token
      await this.refreshSessionFromClient();
    } catch (err: any) {
      console.error(err);
      this.setState({ errorMessage: err.message });
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
}

// Export singleton instance
export const authManager = AuthManager.shared;
