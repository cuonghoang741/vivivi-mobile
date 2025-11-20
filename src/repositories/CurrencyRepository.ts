import { BaseRepository } from './BaseRepository';
import { getAuthIdentifier } from '../services/authIdentifier';

export interface CurrencyBalance {
  vcoin: number;
  ruby: number;
}

export class CurrencyRepository extends BaseRepository {
  /**
   * Fetch currency balance for current user
   */
  async fetchCurrency(): Promise<CurrencyBalance> {
    let query = this.client
      .from('user_currency')
      .select('vcoin,ruby');

    query = await this.addAuthFilters(query);

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch currency:', error);
      // Return zero balance if no record exists
      return { vcoin: 0, ruby: 0 };
    }

    if (!data || data.length === 0) {
      return { vcoin: 0, ruby: 0 };
    }

    const firstRow = data[0];
    return {
      vcoin: firstRow.vcoin || 0,
      ruby: firstRow.ruby || 0,
    };
  }

  /**
   * Update currency balance
   */
  async updateCurrency(vcoin?: number, ruby?: number): Promise<void> {
    const { userId, clientId } = await getAuthIdentifier();

    const updateData: any = {};
    if (vcoin !== undefined) updateData.vcoin = vcoin;
    if (ruby !== undefined) updateData.ruby = ruby;

    // Try PATCH first (update existing row)
    let query = this.client
      .from('user_currency')
      .update(updateData);

    query = await this.addAuthFilters(query);

    const { error: patchError } = await query;

    // If PATCH fails (no existing row), use POST with upsert
    if (patchError) {
      const insertData: any = { ...updateData };
      if (userId) {
        insertData.user_id = userId;
      } else if (clientId) {
        insertData.client_id = clientId;
      }

      const { error: insertError } = await this.client
        .from('user_currency')
        .upsert(insertData, {
          onConflict: 'owner_key',
        });

      if (insertError) {
        throw new Error(`Failed to update currency: ${insertError.message}`);
      }
    }
  }
}

