import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

import Button from '../Button';
import { CurrencyRepository } from '../../repositories/CurrencyRepository';
import { getSupabaseAuthHeaders } from '../../utils/supabaseHelpers';
import { SUPABASE_URL } from '../../config/supabase';
import { getAuthIdentifier } from '../../services/authIdentifier';

type CurrencyPackage = {
  id: string;
  storeIdentifier: string;
  displayName: string;
  vcoin: number;
  ruby: number;
  priceCents: number;
  imageUrl: string;
};

const CURRENCY_PACKAGES: CurrencyPackage[] = [
  {
    id: 'pink',
    storeIdentifier: 'pink.package.fun.vivivi',
    displayName: 'Pink Package',
    vcoin: 1000,
    ruby: 10,
    priceCents: 499,
    imageUrl: 'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Packages/Pink-min.png',
  },
  {
    id: 'brown',
    storeIdentifier: 'brown.package.fun.vivivi',
    displayName: 'Brown Package',
    vcoin: 4200,
    ruby: 42,
    priceCents: 1499,
    imageUrl: 'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Packages/Brown-min.png',
  },
  {
    id: 'silver',
    storeIdentifier: 'silver.package.fun.vivivi',
    displayName: 'Silver Package',
    vcoin: 11000,
    ruby: 110,
    priceCents: 2499,
    imageUrl: 'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Packages/Silver-min.png',
  },
  {
    id: 'gold',
    storeIdentifier: 'gold.package.fun.vivivi',
    displayName: 'Gold Package',
    vcoin: 24000,
    ruby: 240,
    priceCents: 4999,
    imageUrl: 'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Packages/Gold-min.png',
  },
  {
    id: 'titanium',
    storeIdentifier: 'titanium.package.fun.vivivi',
    displayName: 'Titanium Package',
    vcoin: 67500,
    ruby: 675,
    priceCents: 9999,
    imageUrl: 'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Packages/Titanium-min.png',
  },
  {
    id: 'diamond',
    storeIdentifier: 'diamond.package.fun.vivivi',
    displayName: 'Diamond Package',
    vcoin: 150000,
    ruby: 1500,
    priceCents: 19999,
    imageUrl: 'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Packages/Diamond-min.png',
  },
];

const BANNER_URL =
  'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Packages/Store_Banner2-min.png';

const TWO_X_DAY_KEY = 'currency.twoX.usedDay';
const TWO_X_FLAG_KEY = 'currency.twoX.usedFlag';

type CurrencyPurchaseSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPurchaseComplete?: (payload: { vcoinAdded: number; rubyAdded: number }) => void;
};

export const CurrencyPurchaseSheet: React.FC<CurrencyPurchaseSheetProps> = ({
  visible,
  onClose,
  onPurchaseComplete,
}) => {
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [twoXAvailable, setTwoXAvailable] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const repoRef = useRef<CurrencyRepository | null>(null);

  if (!repoRef.current) {
    repoRef.current = new CurrencyRepository();
  }

  const evaluateTwoXAvailability = useCallback(async () => {
    try {
      const todayKey = getDayKey(new Date());
      const storedDay = await AsyncStorage.getItem(TWO_X_DAY_KEY);
      const storedFlag = await AsyncStorage.getItem(TWO_X_FLAG_KEY);
      if (!storedDay || storedDay !== todayKey) {
        await AsyncStorage.multiSet([
          [TWO_X_DAY_KEY, todayKey],
          [TWO_X_FLAG_KEY, 'false'],
        ]);
        setTwoXAvailable(true);
      } else {
        setTwoXAvailable(storedFlag !== 'true');
      }
    } catch (error) {
      console.warn('[CurrencyPurchaseSheet] Failed to evaluate 2X state', error);
      setTwoXAvailable(true);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      evaluateTwoXAvailability();
    }
  }, [evaluateTwoXAvailability, visible]);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const multiplier = twoXAvailable ? 2 : 1;
  const countdown = useMemo(() => timeUntilNextQuarterHour(now), [now]);

  const handlePurchase = useCallback(
    async (pkg: CurrencyPackage) => {
      if (purchasingId) {
        return;
      }
      setErrorMessage(null);
      setPurchasingId(pkg.id);
      try {
        // Import dynamically to avoid cycle if any, or just standard import
        const { revenueCatManager } = await import('../../services/RevenueCatManager');
        
        // Find the package in RevenueCat offerings
        const rcPackage = await revenueCatManager.getPackageByIdentifier(pkg.storeIdentifier);
        
        if (!rcPackage) {
          throw new Error(`Package not found: ${pkg.storeIdentifier}`);
        }

        // Purchase via RevenueCat
        await revenueCatManager.purchasePackage(rcPackage);

        // If purchase successful, update currency
        // Note: In a real app, you might want to listen to a webhook or verify receipt on backend
        // But for now we trust the client success and update local/supabase state as before
        const balance = await repoRef.current!.fetchCurrency();
        const vcoinAdded = pkg.vcoin * multiplier;
        const rubyAdded = pkg.ruby * multiplier;
        await repoRef.current!.updateCurrency(balance.vcoin + vcoinAdded, balance.ruby + rubyAdded);
        await logPurchase(pkg, vcoinAdded, rubyAdded);
        
        if (twoXAvailable) {
          await markTwoXUsed();
          setTwoXAvailable(false);
        }
        
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Top up successful',
          `+${formatNumber(vcoinAdded)} VCoin\n+${formatNumber(rubyAdded)} Ruby`
        );
        onPurchaseComplete?.({ vcoinAdded, rubyAdded });
      } catch (error: any) {
        if (error.message === 'Purchase cancelled') {
          // User cancelled, do nothing
          console.log('Purchase cancelled by user');
        } else {
          console.error('[CurrencyPurchaseSheet] Purchase failed', error);
          setErrorMessage(error?.message ?? 'Unable to complete purchase right now.');
          Alert.alert('Purchase failed', error?.message ?? 'Please try again later.');
        }
      } finally {
        setPurchasingId(null);
      }
    },
    [multiplier, onPurchaseComplete, purchasingId, twoXAvailable]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.safeArea}>
        <View style={styles.header}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>Top up currency</Text>
          <Button
            size="md"
            variant="liquid"
            onPress={onClose}
            startIconName="close"
            isIconOnly
          />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ImageBackground
            source={{ uri: BANNER_URL }}
            style={styles.banner}
            resizeMode="cover"
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.65)']}
              style={styles.bannerOverlay}
            />
            <View style={styles.bannerContent}>
              <Text style={styles.bannerEyebrow}>2X REWARDS</Text>
              {twoXAvailable ? (
                <CountdownPills remaining={countdown} />
              ) : (
                <Text style={styles.bannerSubtitle}>Come back tomorrow</Text>
              )}
            </View>
          </ImageBackground>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>Heads up</Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.packageGrid}>
            {CURRENCY_PACKAGES.map((pkg, index) => (
              <CurrencyPackageCard
                key={pkg.id}
                pkg={pkg}
                multiplier={multiplier}
                onPress={() => handlePurchase(pkg)}
                isPurchasing={purchasingId === pkg.id}
                highlight={index === CURRENCY_PACKAGES.length - 1}
              />
            ))}
          </View>

          <Text style={styles.historyHint}>
            Purchase history lives under Settings → Purchase history.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const CurrencyPackageCard: React.FC<{
  pkg: CurrencyPackage;
  multiplier: number;
  onPress: () => void;
  isPurchasing: boolean;
  highlight?: boolean;
}> = ({ pkg, multiplier, onPress, isPurchasing, highlight }) => {
  const vcoinAmount = pkg.vcoin * multiplier;
  const rubyAmount = pkg.ruby * multiplier;
  return (
    <Pressable
      style={[styles.packageCard, highlight && styles.packageCardHighlight]}
      onPress={onPress}
      disabled={isPurchasing}
    >
      <ImageBackground
        source={{ uri: pkg.imageUrl }}
        style={styles.packageImage}
        imageStyle={styles.packageImageRound}
      >
        <View style={styles.priceChip}>
          {isPurchasing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.priceChipText}>{formatPrice(pkg.priceCents)}</Text>
          )}
        </View>
      </ImageBackground>
      <View style={styles.packageInfo}>
        <Text style={styles.packageTitle}>{pkg.displayName}</Text>
        <View style={styles.rewardRow}>
          <RewardPill label="VCoin" amount={vcoinAmount} />
          {rubyAmount > 0 ? <RewardPill label="Ruby" amount={rubyAmount} /> : null}
        </View>
      </View>
    </Pressable>
  );
};

const RewardPill: React.FC<{ label: string; amount: number }> = ({ label, amount }) => (
  <View style={styles.rewardPill}>
    <Text style={styles.rewardPillText}>{`${label} +${formatNumber(amount)}`}</Text>
  </View>
);

const CountdownPills: React.FC<{ remaining: number }> = ({ remaining }) => {
  const hours = Math.floor(remaining / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((remaining % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(remaining % 60)
    .toString()
    .padStart(2, '0');
  return (
    <View style={styles.countdownRow}>
      <TimePill value={hours} />
      <Text style={styles.countdownSeparator}>:</Text>
      <TimePill value={minutes} />
      <Text style={styles.countdownSeparator}>:</Text>
      <TimePill value={seconds} />
    </View>
  );
};

const TimePill: React.FC<{ value: string }> = ({ value }) => (
  <View style={styles.timePill}>
    <Text style={styles.timePillText}>{value}</Text>
  </View>
);

const formatNumber = (value: number) =>
  Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });

const formatPrice = (priceCents: number) => `$${(priceCents / 100).toFixed(2)}`;

const getDayKey = (date: Date) => date.toISOString().split('T')[0];

const markTwoXUsed = async () => {
  const todayKey = getDayKey(new Date());
  await AsyncStorage.multiSet([
    [TWO_X_DAY_KEY, todayKey],
    [TWO_X_FLAG_KEY, 'true'],
  ]);
};

const timeUntilNextQuarterHour = (date: Date) => {
  const nextQuarter = new Date(date);
  const minutes = date.getMinutes();
  const remainder = minutes % 15;
  const offset = remainder === 0 ? 15 : 15 - remainder;
  nextQuarter.setMinutes(minutes + offset);
  nextQuarter.setSeconds(0, 0);
  return Math.max(0, Math.floor((nextQuarter.getTime() - date.getTime()) / 1000));
};

const logPurchase = async (
  pkg: CurrencyPackage,
  vcoinAdded: number,
  rubyAdded: number
) => {
  try {
    const headers = await getSupabaseAuthHeaders();
    headers['Content-Type'] = 'application/json';
    const { clientId } = await getAuthIdentifier();
    if (clientId && !headers['X-Client-Id']) {
      headers['X-Client-Id'] = clientId;
    }
    const body = {
      p_product_id: pkg.storeIdentifier,
      p_transaction_id: `sim-${Date.now()}`,
      p_price_cents: pkg.priceCents,
      p_currency_code: 'USD',
      p_vcoin_added: vcoinAdded,
      p_ruby_added: rubyAdded,
      p_client_id: clientId ?? null,
    };
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/insert_purchase`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.warn('[CurrencyPurchaseSheet] Failed to log purchase', error);
  }
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFD7E7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f1f1f',
  },
  content: {
    paddingBottom: 40,
  },
  banner: {
    height: 220,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  bannerEyebrow: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  bannerSubtitle: {
    color: '#fff',
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(255,0,0,0.1)',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  errorTitle: {
    fontWeight: '700',
    color: '#a30000',
    marginBottom: 4,
  },
  errorMessage: {
    color: '#a30000',
  },
  packageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    rowGap: 16,
  },
  packageCard: {
    width: '48%',
    borderRadius: 18,
    backgroundColor: '#fff',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  packageCardHighlight: {
    borderWidth: 2,
    borderColor: '#FF91BD',
  },
  packageImage: {
    height: 140,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  packageImageRound: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  priceChip: {
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  priceChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
  },
  packageInfo: {
    padding: 12,
    gap: 8,
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  rewardRow: {
    gap: 8,
  },
  rewardPill: {
    backgroundColor: '#f2f2f2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rewardPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
  },
  historyHint: {
    marginTop: 32,
    textAlign: 'center',
    color: '#4c2b36',
    fontSize: 13,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countdownSeparator: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  timePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
  },
  timePillText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default CurrencyPurchaseSheet;


