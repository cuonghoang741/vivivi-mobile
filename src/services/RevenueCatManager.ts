import Purchases, {
  CustomerInfo,
  PurchasesPackage,
  PurchasesOffering,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { authManager } from './AuthManager';

// RevenueCat Public SDK Keys
const REVENUECAT_API_KEY_IOS = 'appl_CjxgHOafWEJNsMPLMtQgAULbupx';
const REVENUECAT_API_KEY_ANDROID = 'goog_CjxgHOafWEJNsMPLMtQgAULbupx'; // TODO: Replace with actual Android key

class RevenueCatManager {
  private static instance: RevenueCatManager;
  private customerInfo: CustomerInfo | null = null;
  private offerings: PurchasesOffering | null = null;

  private constructor() {}

  static getInstance(): RevenueCatManager {
    if (!RevenueCatManager.instance) {
      RevenueCatManager.instance = new RevenueCatManager();
    }
    return RevenueCatManager.instance;
  }

  async configure() {
    // Tự động chọn key dựa trên platform
    const apiKey = Platform.OS === 'ios' 
      ? REVENUECAT_API_KEY_IOS 
      : REVENUECAT_API_KEY_ANDROID;

    try {
      Purchases.configure({ apiKey });
      console.log(`RevenueCat configured for ${Platform.OS} with key: ${apiKey.substring(0, 10)}...`);
    } catch (e) {
      console.error(`RevenueCat configure error for ${Platform.OS}:`, e);
      return;
    }

    if (authManager.user?.id) {
      await Purchases.logIn(authManager.user.id);
    }

    try {
      this.customerInfo = await Purchases.getCustomerInfo();
      await this.loadOfferings();
    } catch (e) {
      console.error('RevenueCat configure error:', e);
    }
  }

  async loadOfferings(): Promise<PurchasesOffering | null> {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null) {
        this.offerings = offerings.current;
        return offerings.current;
      }
    } catch (e) {
      console.error('RevenueCat loadOfferings error:', e);
    }
    return null;
  }

  async purchasePackage(pkg: PurchasesPackage): Promise<{
    customerInfo: CustomerInfo;
    productIdentifier: string;
  }> {
    try {
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(pkg);
      this.customerInfo = customerInfo;
      return { customerInfo, productIdentifier };
    } catch (e: any) {
      if (!e.userCancelled) {
        console.error('RevenueCat purchase error:', e);
        throw e;
      } else {
        throw new Error('Purchase cancelled');
      }
    }
  }

  async restorePurchases(): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      this.customerInfo = customerInfo;
      return customerInfo;
    } catch (e) {
      console.error('RevenueCat restore error:', e);
      throw e;
    }
  }

  getOfferings(): PurchasesOffering | null {
    return this.offerings;
  }

  async getPackageByIdentifier(identifier: string): Promise<PurchasesPackage | undefined> {
    if (!this.offerings) {
      await this.loadOfferings();
    }
    return this.offerings?.availablePackages.find(
      (p) => p.identifier === identifier || p.product.identifier === identifier
    );
  }
}

export const revenueCatManager = RevenueCatManager.getInstance();
