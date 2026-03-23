import { BaseRepository } from './BaseRepository';
import { getAuthIdentifier } from '../services/authIdentifier';

export type DanceItem = {
    id: string;
    name: string;
    file_name: string;
    tier: 'free' | 'pro';
    emoji: string | null;
    icon_url: string | null;
    price_ruby: number;
    display_order: number;
    available: boolean;
};

export class DanceRepository extends BaseRepository {
    /**
     * Fetch all available dances ordered by display_order
     */
    async fetchAllDances(): Promise<DanceItem[]> {
        try {
            const { data, error } = await this.client
                .from('dances')
                .select('*')
                .eq('available', true)
                .order('display_order', { ascending: true });

            if (error) {
                console.error('❌ [DanceRepository] Failed to fetch dances:', error);
                return [];
            }

            return (data || []) as DanceItem[];
        } catch (error) {
            console.error('❌ [DanceRepository] Error fetching dances:', error);
            return [];
        }
    }

    /**
     * Fetch owned dance IDs from user_assets
     */
    async fetchOwnedDanceIds(): Promise<Set<string>> {
        try {
            let query = this.client
                .from('user_assets')
                .select('item_id')
                .eq('item_type', 'dance')
                .not('item_id', 'is', null);

            query = await this.addAuthFilters(query);

            const { data, error } = await query;

            if (error) {
                console.error('❌ [DanceRepository] Failed to fetch owned dances:', error);
                return new Set();
            }

            return new Set((data || []).map((item: any) => item.item_id).filter(Boolean));
        } catch (error) {
            console.error('❌ [DanceRepository] Error fetching owned dances:', error);
            return new Set();
        }
    }

    /**
     * Purchase a dance: create transaction, deduct ruby, add to user_assets
     * Returns the transaction ID on success, null on failure
     */
    async purchaseDance(danceId: string, rubyAmount: number): Promise<string | null> {
        try {
            const { userId, clientId } = await getAuthIdentifier();
            if (!userId && !clientId) {
                throw new Error('User is not authenticated');
            }

            // 1. Create transaction record
            const txData: Record<string, any> = {
                item_type: 'dance',
                item_id: danceId,
                currency_type: 'ruby',
                amount_paid: rubyAmount,
            };
            if (userId) txData.user_id = userId;
            if (clientId) txData.client_id = clientId;

            const { data: txRecord, error: txError } = await this.client
                .from('transactions')
                .insert(txData)
                .select('id')
                .single();

            if (txError || !txRecord) {
                console.error('❌ [DanceRepository] Failed to create transaction:', txError);
                return null;
            }

            const transactionId = txRecord.id;

            // 2. Deduct ruby from user_currency
            const ownerFilter = userId
                ? { user_id: userId }
                : { client_id: clientId! };

            const { data: currencyData, error: currFetchError } = await this.client
                .from('user_currency')
                .select('ruby')
                .match(ownerFilter)
                .single();

            if (currFetchError || !currencyData) {
                console.error('❌ [DanceRepository] Failed to fetch currency:', currFetchError);
                return null;
            }

            const newRuby = Math.max(0, (currencyData.ruby || 0) - rubyAmount);
            const { error: currUpdateError } = await this.client
                .from('user_currency')
                .update({ ruby: newRuby, updated_at: new Date().toISOString() })
                .match(ownerFilter);

            if (currUpdateError) {
                console.error('❌ [DanceRepository] Failed to deduct ruby:', currUpdateError);
                return null;
            }

            // 3. Add to user_assets
            const assetData: Record<string, any> = {
                item_type: 'dance',
                item_id: danceId,
                transaction_id: transactionId,
            };
            if (userId) assetData.user_id = userId;
            if (clientId) assetData.client_id = clientId;

            const { error: assetError } = await this.client
                .from('user_assets')
                .insert(assetData);

            if (assetError) {
                console.error('❌ [DanceRepository] Failed to create asset:', assetError);
                // Transaction was created, but asset failed - not ideal but recoverable
            }

            console.log('✅ [DanceRepository] Dance purchased:', danceId, 'txId:', transactionId);
            return transactionId;
        } catch (error) {
            console.error('❌ [DanceRepository] Error purchasing dance:', error);
            return null;
        }
    }
}
