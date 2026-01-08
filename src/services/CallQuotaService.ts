import { SUPABASE_URL } from '../config/supabase';
import { getSupabaseAuthHeaders } from '../utils/supabaseHelpers';
import { authManager } from './AuthManager';

// MARK: - Call Quota Service
/// Service for managing user call time quota

const FREE_USER_QUOTA_SECONDS = 30;      // 30 seconds for free users
const PRO_USER_QUOTA_SECONDS = 30 * 60;  // 30 minutes for pro users

interface CallQuota {
    id: string;
    user_id: string;
    remaining_seconds: number;
    last_reset_at: string | null;
    created_at: string;
    updated_at: string;
}

export class CallQuotaService {
    // MARK: - Fetch Quota

    async fetchQuota(isPro: boolean = false): Promise<number> {
        try {
            // For Pro users, check and reset quota if it's a new month
            if (isPro) {
                return this.checkAndResetProQuotaIfNeeded(isPro);
            }

            const headers = await getSupabaseAuthHeaders();

            const response = await fetch(`${SUPABASE_URL}/rest/v1/user_call_quota?select=remaining_seconds`, {
                method: 'GET',
                headers,
            });

            if (!response.ok) {
                console.error('[CallQuotaService] Failed to fetch quota:', response.status);
                // Return default instead of 0 on error
                return FREE_USER_QUOTA_SECONDS;
            }

            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                return data[0].remaining_seconds ?? 0;
            }

            // No quota record exists yet - auto-initialize and return
            console.log('[CallQuotaService] No quota record found, initializing...');
            return this.initializeQuota(isPro);
        } catch (error) {
            console.error('[CallQuotaService] Error fetching quota:', error);
            // Return default instead of 0 on error
            return isPro ? PRO_USER_QUOTA_SECONDS : FREE_USER_QUOTA_SECONDS;
        }
    }

    // MARK: - Initialize Quota (for new users)

    async initializeQuota(isPro: boolean): Promise<number> {
        try {
            const headers = await getSupabaseAuthHeaders();
            const defaultSeconds = isPro ? PRO_USER_QUOTA_SECONDS : FREE_USER_QUOTA_SECONDS;

            const body = {
                remaining_seconds: defaultSeconds,
                last_reset_at: isPro ? new Date().toISOString() : null,
            };

            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/user_call_quota?on_conflict=user_id`,
                {
                    method: 'POST',
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json',
                        Prefer: 'return=representation, resolution=merge-duplicates',
                    },
                    body: JSON.stringify(body),
                }
            );

            if (!response.ok) {
                console.error('[CallQuotaService] Failed to initialize quota:', response.status);
                return defaultSeconds;
            }

            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                return data[0].remaining_seconds ?? defaultSeconds;
            }

            return defaultSeconds;
        } catch (error) {
            console.error('[CallQuotaService] Error initializing quota:', error);
            return isPro ? PRO_USER_QUOTA_SECONDS : FREE_USER_QUOTA_SECONDS;
        }
    }

    // MARK: - Deduct Quota

    /**
     * Update remaining quota in DB
     * @param newRemainingSeconds - The new remaining seconds value to save
     */
    async updateQuota(newRemainingSeconds: number): Promise<void> {
        try {
            const headers = await getSupabaseAuthHeaders();
            const safeValue = Math.max(0, Math.floor(newRemainingSeconds));

            // Get user_id from authManager
            const userId = authManager.getUserId();
            if (!userId) {
                console.error('[CallQuotaService] No user_id found');
                return;
            }

            // Add user_id filter to URL (required for PATCH)
            const url = `${SUPABASE_URL}/rest/v1/user_call_quota?user_id=eq.${userId}`;
            const body = {
                remaining_seconds: safeValue,
                updated_at: new Date().toISOString(),
            };

            console.log('[CallQuotaService] Updating quota:', { userId, safeValue });

            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[CallQuotaService] Failed to update quota:', response.status, errorText);
            } else {
                console.log('[CallQuotaService] Quota updated successfully to:', safeValue);
            }
        } catch (error) {
            console.error('[CallQuotaService] Error updating quota:', error);
        }
    }

    /**
     * @deprecated Use updateQuota instead
     */
    async deductQuota(secondsUsed: number): Promise<number> {
        try {
            const headers = await getSupabaseAuthHeaders();
            const userId = authManager.getUserId();

            if (!userId) {
                console.error('[CallQuotaService] No user_id found for deductQuota');
                return 0;
            }

            // First get current quota
            const currentQuota = await this.fetchQuota();
            const newQuota = Math.max(0, currentQuota - secondsUsed);

            const url = `${SUPABASE_URL}/rest/v1/user_call_quota?user_id=eq.${userId}`;
            const body = {
                remaining_seconds: newQuota,
                updated_at: new Date().toISOString(),
            };

            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                console.error('[CallQuotaService] Failed to deduct quota:', response.status);
            }

            return newQuota;
        } catch (error) {
            console.error('[CallQuotaService] Error deducting quota:', error);
            return 0;
        }
    }

    // MARK: - Reset Pro Quota (called when subscription renews)

    async resetProQuota(): Promise<number> {
        try {
            const headers = await getSupabaseAuthHeaders();
            const userId = authManager.getUserId();

            if (!userId) {
                console.error('[CallQuotaService] No user_id found for resetProQuota');
                return PRO_USER_QUOTA_SECONDS;
            }

            // Use POST with upsert to handle both new and existing records
            const url = `${SUPABASE_URL}/rest/v1/user_call_quota?on_conflict=user_id`;
            const body = {
                user_id: userId,
                remaining_seconds: PRO_USER_QUOTA_SECONDS,
                last_reset_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            console.log('[CallQuotaService] Resetting PRO quota for user:', userId, 'to', PRO_USER_QUOTA_SECONDS);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[CallQuotaService] Failed to reset pro quota:', response.status, errorText);
                return PRO_USER_QUOTA_SECONDS;
            }

            console.log('[CallQuotaService] Successfully reset PRO quota to', PRO_USER_QUOTA_SECONDS);
            return PRO_USER_QUOTA_SECONDS;
        } catch (error) {
            console.error('[CallQuotaService] Error resetting pro quota:', error);
            return PRO_USER_QUOTA_SECONDS;
        }
    }

    // MARK: - Check if Pro Quota Should Reset

    async checkAndResetProQuotaIfNeeded(isPro: boolean): Promise<number> {
        if (!isPro) {
            return this.fetchQuota();
        }

        try {
            const headers = await getSupabaseAuthHeaders();

            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/user_call_quota?select=remaining_seconds,last_reset_at`,
                {
                    method: 'GET',
                    headers,
                }
            );

            if (!response.ok) {
                return this.initializeQuota(isPro);
            }

            const data = await response.json();
            if (!Array.isArray(data) || data.length === 0) {
                return this.initializeQuota(isPro);
            }

            const { remaining_seconds, last_reset_at } = data[0];

            // Check if we need to reset (new month)
            if (last_reset_at) {
                const lastReset = new Date(last_reset_at);
                const now = new Date();

                // Reset if different month
                if (
                    lastReset.getMonth() !== now.getMonth() ||
                    lastReset.getFullYear() !== now.getFullYear()
                ) {
                    return this.resetProQuota();
                }
            }

            return remaining_seconds ?? PRO_USER_QUOTA_SECONDS;
        } catch (error) {
            console.error('[CallQuotaService] Error checking quota reset:', error);
            return PRO_USER_QUOTA_SECONDS;
        }
    }

    // MARK: - Helpers

    static getDefaultQuota(isPro: boolean): number {
        return isPro ? PRO_USER_QUOTA_SECONDS : FREE_USER_QUOTA_SECONDS;
    }

    static formatRemainingTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

export const callQuotaService = new CallQuotaService();
