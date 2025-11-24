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

    console.log('🔍 [CurrencyRepository] Updating currency:', { vcoin, ruby, userId, clientId });

    const updateData: any = {};
    if (vcoin !== undefined) updateData.vcoin = vcoin;
    if (ruby !== undefined) updateData.ruby = ruby;

    // Check if record exists first
    let checkQuery = this.client
      .from('user_currency')
      .select('vcoin,ruby')
      .limit(1);

    checkQuery = await this.addAuthFilters(checkQuery);

    const { data: existingData, error: checkError } = await checkQuery;

    if (checkError) {
      console.error('🔍 [CurrencyRepository] Check error:', checkError);
    }

    const recordExists = existingData && existingData.length > 0;

    console.log('🔍 [CurrencyRepository] Record exists:', recordExists);

    if (recordExists) {
      // Update existing record
      let updateQuery = this.client
        .from('user_currency')
        .update(updateData);

      updateQuery = await this.addAuthFilters(updateQuery);

      const { error: updateError } = await updateQuery;

      if (updateError) {
        throw new Error(`Failed to update currency: ${updateError.message}`);
      }

      console.log('✅ [CurrencyRepository] Updated existing record');
    } else {
      // Insert new record (no onConflict needed since we already checked record doesn't exist)
      const insertData: any = { ...updateData };
      if (userId) {
        insertData.user_id = userId;
      } else if (clientId) {
        insertData.client_id = clientId;
      }

      const { error: insertError } = await this.client
        .from('user_currency')
        .insert(insertData);

      if (insertError) {
        throw new Error(`Failed to insert currency: ${insertError.message}`);
      }

      console.log('✅ [CurrencyRepository] Inserted new record');
    }
  }
}

