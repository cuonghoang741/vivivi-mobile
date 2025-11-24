import { BaseRepository } from './BaseRepository';
import { getAuthIdentifier } from '../services/authIdentifier';

type CreateTransactionPayload = {
  itemId: string;
  itemType: string;
  vcoinSpent?: number;
  rubySpent?: number;
};

export class TransactionRepository extends BaseRepository {
  async createTransaction(payload: CreateTransactionPayload): Promise<string> {
    const { userId, clientId } = await getAuthIdentifier();
    if (!userId && !clientId) {
      throw new Error('User is not authenticated');
    }

    const { itemId, itemType, vcoinSpent = 0, rubySpent = 0 } = payload;
    const currencyType = vcoinSpent > 0 ? 'vcoin' : rubySpent > 0 ? 'ruby' : 'vcoin';
    const amountPaid = vcoinSpent > 0 ? vcoinSpent : rubySpent > 0 ? rubySpent : 0;

    const body: Record<string, any> = {
      item_id: itemId,
      item_type: itemType,
      currency_type: currencyType,
      amount_paid: amountPaid,
    };

    if (userId) {
      body.user_id = userId;
    } else if (clientId) {
      body.client_id = clientId;
    }

    const { data, error } = await this.client
      .from('transactions')
      .insert(body)
      .select('id')
      .single<{ id: string }>();

    if (error || !data?.id) {
      throw new Error(`Failed to create transaction: ${error?.message ?? 'unknown error'}`);
    }

    return data.id;
  }
}


