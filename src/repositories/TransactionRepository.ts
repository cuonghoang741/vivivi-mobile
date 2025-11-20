import { BaseRepository } from './BaseRepository';
import { getClientId } from '../utils/clientId';

export class TransactionRepository extends BaseRepository {
  /**
   * Create a transaction record and return its ID.
   */
  async createTransaction(params: {
    itemId: string;
    itemType: string;
    vcoinSpent?: number;
    rubySpent?: number;
  }): Promise<string> {
    const { itemId, itemType, vcoinSpent, rubySpent } = params;

    const currencyType =
      vcoinSpent && vcoinSpent > 0
        ? 'vcoin'
        : rubySpent && rubySpent > 0
          ? 'ruby'
          : 'vcoin';
    const amountPaid =
      currencyType === 'vcoin'
        ? vcoinSpent ?? 0
        : rubySpent ?? 0;

    const payload: Record<string, any> = {
      item_id: itemId,
      item_type: itemType,
      currency_type: currencyType,
      amount_paid: amountPaid,
    };

    const userId = this.getUserId();
    if (userId) {
      payload.user_id = userId;
    } else {
      const clientId = await getClientId();
      if (clientId) {
        payload.client_id = clientId;
      }
    }

    const { data, error } = await this.client
      .from('transactions')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    if (!data?.id) {
      throw new Error('Transaction response missing id');
    }

    return data.id as string;
  }
}


