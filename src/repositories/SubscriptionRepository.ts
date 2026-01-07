import { BaseRepository } from './BaseRepository';

export type Subscription = {
    id: string;
    user_id: string;
    status?: string | null;
    tier?: string | null;
    plan?: string | null;
    current_period_end?: string | null;
    created_at: string;
};

export class SubscriptionRepository extends BaseRepository {
    async fetchSubscriptionHistory(userId: string): Promise<Subscription[]> {
        try {
            const { data, error } = await this.client
                .from('subscriptions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[SubscriptionRepository] Failed to fetch subscriptions:', error);
                return [];
            }

            return (data as Subscription[]) ?? [];
        } catch (error) {
            console.error('[SubscriptionRepository] Error fetching subscriptions:', error);
            return [];
        }
    }
}
