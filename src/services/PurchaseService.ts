import { CurrencyRepository } from '../repositories/CurrencyRepository';
import AssetRepository from '../repositories/AssetRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';

type PurchaseParams = {
  itemId: string;
  itemType: string;
  priceVcoin?: number;
  priceRuby?: number;
};

export type PurchaseResult = {
  newBalance: {
    vcoin: number;
    ruby: number;
  };
  vcoinSpent: number;
  rubySpent: number;
};

export class PurchaseError extends Error {
  constructor(message: string, readonly code: 'INSUFFICIENT_VCOIN' | 'INSUFFICIENT_RUBY' | 'PURCHASE_FAILED') {
    super(message);
    this.name = 'PurchaseError';
  }
}

export class PurchaseService {
  private currencyRepository = new CurrencyRepository();
  private assetRepository = new AssetRepository();
  private transactionRepository = new TransactionRepository();

  async purchaseWithCurrency(params: PurchaseParams): Promise<PurchaseResult> {
    const priceVcoin = params.priceVcoin ?? 0;
    const priceRuby = params.priceRuby ?? 0;

    if (priceVcoin <= 0 && priceRuby <= 0) {
      const assetCreated = await this.assetRepository.createAsset(params.itemId, params.itemType);
      if (!assetCreated) {
        throw new PurchaseError('Không thể thêm vật phẩm vào kho', 'PURCHASE_FAILED');
      }
      const balance = await this.currencyRepository.fetchCurrency();
      return {
        newBalance: balance,
        vcoinSpent: 0,
        rubySpent: 0,
      };
    }

    const balance = await this.currencyRepository.fetchCurrency();

    if (priceVcoin > 0 && balance.vcoin < priceVcoin) {
      throw new PurchaseError('Không đủ VCoin', 'INSUFFICIENT_VCOIN');
    }
    if (priceRuby > 0 && balance.ruby < priceRuby) {
      throw new PurchaseError('Không đủ Ruby', 'INSUFFICIENT_RUBY');
    }

    const nextBalance = {
      vcoin: balance.vcoin - priceVcoin,
      ruby: balance.ruby - priceRuby,
    };

    await this.currencyRepository.updateCurrency(nextBalance.vcoin, nextBalance.ruby);

    const transactionId = await this.transactionRepository.createTransaction({
      itemId: params.itemId,
      itemType: params.itemType,
      vcoinSpent: priceVcoin,
      rubySpent: priceRuby,
    });

    const assetCreated = await this.assetRepository.createAsset(
      params.itemId,
      params.itemType,
      transactionId
    );

    if (!assetCreated) {
      throw new PurchaseError('Không thể lưu quyền sở hữu vật phẩm', 'PURCHASE_FAILED');
    }

    return {
      newBalance: nextBalance,
      vcoinSpent: priceVcoin,
      rubySpent: priceRuby,
    };
  }
}


