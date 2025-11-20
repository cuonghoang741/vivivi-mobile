import AssetRepository from '../repositories/AssetRepository';
import { CurrencyRepository, CurrencyBalance } from '../repositories/CurrencyRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';

export type PurchaseResult = {
  newBalance: CurrencyBalance;
  vcoinSpent: number;
  rubySpent: number;
};

export enum PurchaseErrorCode {
  INSUFFICIENT_VCOIN = 'INSUFFICIENT_VCOIN',
  INSUFFICIENT_RUBY = 'INSUFFICIENT_RUBY',
  INVALID_PRICE = 'INVALID_PRICE',
  UNKNOWN = 'UNKNOWN',
}

export class PurchaseError extends Error {
  code: PurchaseErrorCode;

  constructor(code: PurchaseErrorCode, message?: string) {
    super(message || code);
    this.code = code;
  }
}

export class PurchaseService {
  private currencyRepository = new CurrencyRepository();
  private assetRepository = new AssetRepository();
  private transactionRepository = new TransactionRepository();

  async purchaseWithCurrency(params: {
    itemId: string;
    itemType: string;
    priceVcoin?: number;
    priceRuby?: number;
  }): Promise<PurchaseResult> {
    const priceVcoin = params.priceVcoin ?? 0;
    const priceRuby = params.priceRuby ?? 0;

    if (priceVcoin <= 0 && priceRuby <= 0) {
      throw new PurchaseError(PurchaseErrorCode.INVALID_PRICE, 'No price defined for this item');
    }

    const balance = await this.currencyRepository.fetchCurrency();

    if (priceVcoin > 0 && balance.vcoin < priceVcoin) {
      throw new PurchaseError(PurchaseErrorCode.INSUFFICIENT_VCOIN);
    }

    if (priceRuby > 0 && balance.ruby < priceRuby) {
      throw new PurchaseError(PurchaseErrorCode.INSUFFICIENT_RUBY);
    }

    const newBalance: CurrencyBalance = {
      vcoin: Math.max(0, balance.vcoin - priceVcoin),
      ruby: Math.max(0, balance.ruby - priceRuby),
    };

    // Update currency
    await this.currencyRepository.updateCurrency(newBalance.vcoin, newBalance.ruby);

    // Create transaction + asset
    const transactionId = await this.transactionRepository.createTransaction({
      itemId: params.itemId,
      itemType: params.itemType,
      vcoinSpent: priceVcoin > 0 ? priceVcoin : undefined,
      rubySpent: priceRuby > 0 ? priceRuby : undefined,
    });

    await this.assetRepository.createAsset(params.itemId, params.itemType, transactionId);

    return {
      newBalance,
      vcoinSpent: priceVcoin,
      rubySpent: priceRuby,
    };
  }
}


