import { BaseRepository } from './BaseRepository';

/**
 * Asset Repository
 * Matching Swift version's AssetRepository
 */
export class AssetRepository extends BaseRepository {
  /**
   * Fetch owned assets by item type
   * Matching Swift version's fetchOwnedAssets(itemType:)
   */
  async fetchOwnedAssets(itemType: string): Promise<Set<string>> {
    try {
      let query = this.client
        .from('user_assets')
        .select('item_id')
        .eq('item_type', itemType)
        .not('item_id', 'is', null);

      query = await this.addAuthFilters(query);

      const { data, error } = await query;

      if (error) {
        console.error(`❌ [AssetRepository] Failed to fetch owned ${itemType}:`, error);
        return new Set();
      }

      return new Set((data || []).map((item: any) => item.item_id).filter(Boolean));
    } catch (error) {
      console.error(`❌ [AssetRepository] Error fetching owned ${itemType}:`, error);
      return new Set();
    }
  }

  /**
   * Create asset (add item to user's owned items)
   * Matching Swift version's createAsset
   */
  async createAsset(itemId: string, itemType: string): Promise<boolean> {
    try {
      const userId = this.getUserId();
      const clientId = await this.getClientId();

      const assetData: any = {
        item_id: itemId,
        item_type: itemType,
      };

      // Ensure only one of user_id or client_id is set (not both)
      // RLS policy requires: (auth.uid() = user_id) OR ((client_id IS NOT NULL) AND (user_id IS NULL))
      if (userId) {
        assetData.user_id = userId;
        // Explicitly set client_id to null for authenticated users
        assetData.client_id = null;
      } else if (clientId) {
        assetData.client_id = clientId;
        // Explicitly set user_id to null for guest users (required by RLS policy)
        assetData.user_id = null;
      } else {
        console.error('❌ [AssetRepository] No user ID or client ID available');
        return false;
      }

      console.log('📦 [AssetRepository] Creating asset:', {
        itemId,
        itemType,
        userId: assetData.user_id,
        clientId: assetData.client_id,
      });

      // Use RPC function to bypass RLS and properly validate client_id
      const { data, error } = await this.client.rpc('insert_user_asset', {
        p_item_id: itemId,
        p_item_type: itemType,
        p_client_id: assetData.client_id || null,
        p_user_id: assetData.user_id || null,
        p_transaction_id: null,
      });

      if (error) {
        // Check if it's a duplicate key error (23505)
        // The RPC function should handle this, but just in case
        if (error.code === '23505') {
          console.log('ℹ️ [AssetRepository] Asset already exists (duplicate), treating as success');
          return true;
        }
        console.error('❌ [AssetRepository] Failed to create asset:', error);
        console.error('❌ [AssetRepository] Asset data:', assetData);
        return false;
      }

      // If data is null, it means asset already existed (handled by RPC function)
      if (data) {
        console.log('✅ [AssetRepository] Asset created successfully, ID:', data);
      } else {
        console.log('ℹ️ [AssetRepository] Asset already exists, ID:', data);
      }
      return true; // Return true even if already exists
    } catch (error) {
      console.error('❌ [AssetRepository] Error creating asset:', error);
      return false;
    }
  }
}

