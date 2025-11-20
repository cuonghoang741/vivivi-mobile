import { BaseRepository } from './BaseRepository';

/**
 * Asset Repository
 * Matching Swift version's AssetRepository
 */
export default class AssetRepository extends BaseRepository {
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
      if (!userId) {
        throw new Error('User is not authenticated');
      }

      const assetData = {
        item_id: itemId,
        item_type: itemType,
        user_id: userId,
      };

      const { data, error } = await this.client
        .from('user_assets')
        .insert(assetData)
        .select()
        .single();

      if (error) {
        console.error('❌ [AssetRepository] Failed to create asset:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('❌ [AssetRepository] Error creating asset:', error);
      return false;
    }
  }
}
