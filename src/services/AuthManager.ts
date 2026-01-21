import { getSupabaseClient } from "./supabase";
import { APP_SCHEME, AUTH_REDIRECT_PATH, PersistKeys, SUPABASE_URL } from "../config/supabase";
import type { Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { getLocales } from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ensureClientId, clearClientId } from "../utils/clientId";
import { getSupabaseAuthHeaders } from "../utils/supabaseHelpers";
import { analyticsService } from "./AnalyticsService";
import { revenueCatManager } from "./RevenueCatManager";
import { telegramNotificationService } from "./TelegramNotificationService";

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
      // If we restored a session, we assume they are NOT new for now, 
      // or we could run checkUserStatus here. 
      // But typically restored sessions are existing users.
      // Let's set it to false to be safe, so we don't accidentally trigger preview on cold start if logic is flaky.
      this._isNewUser = false;
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
   * @param onBeforeLogout - Optional callback that runs after deletion is complete but before logout
   */
  async deleteAccountLocally(onBeforeLogout?: () => void | Promise<void>): Promise<void> {
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
        await onBeforeLogout?.();
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
        "user_call_quota",
      ];
      const tablesWithoutClientId = new Set(["api_characters", "subscriptions", "user_call_quota"]);

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

      // Reset RevenueCat before callback to ensure no lingering pro state
      await revenueCatManager.logout();

      // Call callback before logout (so UI can respond before redirect)
      await onBeforeLogout?.();

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
      // Clear ALL AsyncStorage data to ensure clean state
      await AsyncStorage.clear();
      console.log('[AuthManager] Cleared all AsyncStorage data');

      // Reset age verification to false (safety measure)
      await AsyncStorage.setItem(PersistKeys.ageVerified18, "false");

      // Clear client ID
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
      await revenueCatManager.logout();
      this._isNewUser = null;
      this.setState({ session: null, user: null });
      analyticsService.logSignOut();
    } catch (error: any) {
      this.setState({ errorMessage: error.message || "Failed to sign out" });
      throw error;
    } finally {
      this.setState({ isLoading: false });
    }
  }

  /**
   * Notify Telegram about new user registration
   */
  private async notifyNewUserToTelegram(user: User): Promise<void> {
    try {
      // Check if this is a fresh registration (created within last 60 mins)
      const createdAt = new Date(user.created_at);
      const now = new Date();
      const diffInMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

      console.log(`[AuthManager] Checking new user notification. Created: ${user.created_at}, Diff: ${diffInMinutes.toFixed(2)} mins, UserID: ${user.id}, IsNewUserFlag: ${this._isNewUser}`);

      // Notify if created recently OR if flagged as new user (0 assets found)
      // This covers cases where user "deleted" account (cleared assets) and re-joined
      if (diffInMinutes <= 60 || this._isNewUser === true) {
        const key = `telegram_notified_new_user_${user.id}`;
        const hasNotified = await AsyncStorage.getItem(key);

        if (!hasNotified) {
          console.log('[AuthManager] Sending new user notification to Telegram...');
          const meta = user.user_metadata || {};
          const name = meta.full_name || meta.display_name || meta.name || user.email || "Unknown";

          // Fallback for country if metadata is missing/stale
          let country = meta.country;
          if (!country) {
            const locales = getLocales();
            country = locales?.[0]?.regionCode || "Unknown";
          }

          await telegramNotificationService.notifyNewUser({
            userId: user.id,
            userName: name,
            userCountry: country,
            userAge: diffInMinutes <= 60 ? "New Registration" : "Re-registration (Reset)",
            isPro: revenueCatManager.isProUser(),
          });

          await AsyncStorage.setItem(key, "true");
          console.log('[AuthManager] Notification sent and flagged as done.');
        } else {
          console.log('[AuthManager] Notification already sent for this user.');
        }
      } else {
        console.log('[AuthManager] User account is too old for "New User" notification and not flagged as new.');
      }
    } catch (error) {
      console.warn("[AuthManager] Failed to notify Telegram:", error);
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
        await this.checkUserStatus(data.user.id);
        analyticsService.logSignIn('email');
        analyticsService.setUserId(data.user.id);
        await revenueCatManager.login(data.user.id);
        await this.ensureUserCountry(data.user);
        await this.notifyNewUserToTelegram(data.user);

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
        await revenueCatManager.login(data.user.id);
        await this.ensureUserCountry(data.user);
        await this.notifyNewUserToTelegram(data.user);
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

      if (data.user) {
        await this.checkUserStatus(data.user.id);
        analyticsService.logSignIn('apple');
        analyticsService.setUserId(data.user.id);
        await revenueCatManager.login(data.user.id);
        await this.ensureUserCountry(data.user);
        await this.notifyNewUserToTelegram(data.user);
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

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri
      );

      if (result.type !== "success" || !result.url) {
        console.log(
          `[AuthManager] Google login aborted with result type: ${result.type}`
        );
        this.setState({ errorMessage: null });
        return;
      }

      const authPayload = this.extractAuthPayloadFromUrl(result.url);

      console.log("[AuthManager] authPayload", authPayload);

      if (authPayload.authCode) {
        const { data: sessionData, error: exchangeError } =
          await this.client.auth.exchangeCodeForSession(
            authPayload.authCode
          );

        console.log("sessionData", sessionData)
        if (exchangeError) {
          throw exchangeError;
        }

        if (sessionData.user) {
          await this.checkUserStatus(sessionData.user.id);
          analyticsService.logSignIn('google');
          analyticsService.setUserId(sessionData.user.id);
          await revenueCatManager.login(sessionData.user.id);
          await this.ensureUserCountry(sessionData.user);
          await this.notifyNewUserToTelegram(sessionData.user);
        }

        this.setState({
          session: sessionData.session ?? null,
          user: sessionData.user ?? null,
        });
        return;
      }

      if (authPayload.accessToken && authPayload.refreshToken) {
        const { data: sessionData, error: setSessionError } =
          await this.client.auth.setSession({
            access_token: authPayload.accessToken,
            refresh_token: authPayload.refreshToken,
          });

        if (setSessionError) {
          throw setSessionError;
        }

        if (sessionData.user) {
          await this.checkUserStatus(sessionData.user.id);
          analyticsService.logSignIn('google');
          analyticsService.setUserId(sessionData.user.id);
          await revenueCatManager.login(sessionData.user.id);
          await this.ensureUserCountry(sessionData.user);
          await this.notifyNewUserToTelegram(sessionData.user);
        }

        this.setState({
          session: sessionData.session ?? null,
          user: sessionData.user ?? null,
        });
        return;
      }

      throw new Error("Không tìm thấy mã xác thực từ Google");
    } catch (err: any) {
      console.error("[AuthManager] signInWithGoogle failed", err);
      this.setState({ errorMessage: err.message || "Failed to sign in" });
    } finally {
      this.setState({ isLoading: false });
    }
  }

  private extractAuthPayloadFromUrl(url: string) {
    const parsedUrl = new URL(url);
    const queryParams = parsedUrl.searchParams;
    const fragment = parsedUrl.hash?.startsWith("#")
      ? parsedUrl.hash.slice(1)
      : parsedUrl.hash;
    const fragmentParams = fragment ? new URLSearchParams(fragment) : null;

    const authCode =
      queryParams.get("code") ||
      fragmentParams?.get("code") ||
      fragmentParams?.get("auth_code");
    const accessToken =
      queryParams.get("access_token") || fragmentParams?.get("access_token");
    const refreshToken =
      queryParams.get("refresh_token") || fragmentParams?.get("refresh_token");

    const errorDescription =
      queryParams.get("error_description") ||
      fragmentParams?.get("error_description");
    const error = queryParams.get("error") || fragmentParams?.get("error");

    if (error || errorDescription) {
      throw new Error(
        errorDescription || error || "Google sign-in returned an error"
      );
    }

    return { authCode, accessToken, refreshToken };
  }

  /**
   * Helper: Check if 'country' is in user_metadata; if not, fetch from device locale and save.
   */
  private async ensureUserCountry(user: User): Promise<void> {
    try {
      const rawMeta = user.user_metadata || {};
      console.log('🔍 [AuthManager] Checking country for user:', user.id);
      console.log('🔍 [AuthManager] Current metadata:', JSON.stringify(rawMeta, null, 2));

      if (rawMeta.country) {
        console.log('✅ [AuthManager] Country already exists:', rawMeta.country);
        return;
      }

      console.log('⚠️ [AuthManager] Country missing. Fetching device locales...');
      const locales = getLocales();
      console.log('🔍 [AuthManager] Device locales:', JSON.stringify(locales, null, 2));

      const deviceCountry = locales?.[0]?.regionCode; // e.g. "VN", "US"

      if (deviceCountry) {
        console.log(`🚀 [AuthManager] Attempting to save country: ${deviceCountry}`);
        // Save to Supabase (this updates raw_user_meta_json)
        const { data, error } = await this.client.auth.updateUser({
          data: {
            country: deviceCountry,
          },
        });

        if (error) {
          console.warn('❌ [AuthManager] Error saving country metadata:', error);
        } else {
          console.log(`✅ [AuthManager] Saved user country: ${deviceCountry}`);
          console.log('🔍 [AuthManager] Updated user:', JSON.stringify(data.user, null, 2));
        }
      } else {
        console.warn('⚠️ [AuthManager] Could not determine device country from locales.');
      }
    } catch (err) {
      console.warn('❌ [AuthManager] ensureUserCountry failed:', err);
    }
  }

  /**
   * Get user ID (lowercase, matching Swift's getUserId())
   */
  getUserId(): string | null {
    return this._user?.id?.toLowerCase() || null;
  }

  // New property to track if user is new (checked during sign-in)
  private _isNewUser: boolean | null = null;

  get isNewUser(): boolean | null {
    return this._isNewUser;
  }

  setIsNewUser(value: boolean) {
    this._isNewUser = value;
    // Also update notification listener to force re-render in App?
    this.notifyListeners();
  }

  /**
   * Internal helper to check if user is new based on assets
   * Sets AsyncStorage flags to avoid flash in App.tsx
   */
  private async checkUserStatus(userId: string): Promise<void> {
    try {
      // Dynamic import to avoid circular dependency if any
      const { default: AssetRepository } = await import('../repositories/AssetRepository');
      const assetRepo = new AssetRepository();

      // Check if user has any character assets
      // Use count only for efficiency
      const { count, error } = await this.client
        .from('user_assets')
        .select('*', { count: 'exact', head: true })
        .eq('item_type', 'character')
        .eq('user_id', userId);

      if (error) {
        console.warn('[AuthManager] Failed to check assets, defaulting to existing user:', error);
        this._isNewUser = false; // Safe fallback
        await AsyncStorage.setItem('isNewUser', 'false');
        return;
      }

      const isNew = count === 0;

      this._isNewUser = isNew;

      if (isNew) {
        console.log('[AuthManager] Detected NEW user (no assets)');
        await AsyncStorage.setItem('isNewUser', 'true');
        // Ensure V2 flag is NOT set so onboarding triggers
        // await AsyncStorage.removeItem('persist.hasCompletedOnboardingV2'); 
      } else {
        console.log('[AuthManager] Detected EXISTING user');
        await AsyncStorage.setItem('isNewUser', 'false');
        // Auto-fix V2 flag for existing users to prevent unnecessary onboarding
        await AsyncStorage.setItem('persist.hasCompletedOnboardingV2', 'true');
      }
    } catch (error) {
      console.warn('[AuthManager] Check user status failed:', error);
      // Fallback: assume not new to be safe, or leave null to let App check
      // this._isNewUser = false; 
    }
  }
}

// Export singleton instance
export const authManager = AuthManager.shared;
