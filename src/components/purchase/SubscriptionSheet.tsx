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
  Animated,
  Easing,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';

import Button from '../Button';
import { revenueCatManager } from '../../services/RevenueCatManager';
import { LEGAL_TEXT } from '../../content/legalText';
import type { PurchasesPackage, PurchasesOffering } from 'react-native-purchases';

type SubscriptionTier = 'free' | 'pro' | 'unlimited';

type SubscriptionPlan = {
  id: string;
  displayName: string;
  tier: SubscriptionTier;
  price: string;
  features: string[];
  isRecommended: boolean;
};

type SubscriptionSheetProps = {
  visible: boolean;
  onClose: () => void;
  contentType?: 'character' | 'background' | 'costume' | 'media';
  contentName?: string;
  requiredTier?: SubscriptionTier;
  onPurchaseComplete?: () => void;
};

const HERO_URL =
  'https://pub-14a49f54cd754145a7362876730a1a52.r2.dev/Packages/Store_Banner-min.png';

const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'pro_monthly',
    displayName: 'Pro',
    tier: 'pro',
    price: '$9.99/month',
    features: [
      'Access to Pro characters',
      'Access to Pro backgrounds',
      'Access to Pro costumes',
      'Unlimited conversations',
    ],
    isRecommended: true,
  },
  {
    id: 'unlimited_monthly',
    displayName: 'Unlimited',
    tier: 'unlimited',
    price: '$19.99/month',
    features: [
      'Everything in Pro',
      'Access to Unlimited tier content',
      'Priority support',
      'Early access to new features',
    ],
    isRecommended: false,
  },
];

const getContentTypeDisplayName = (type?: string): string => {
  switch (type) {
    case 'character':
      return 'Character';
    case 'background':
      return 'Background';
    case 'costume':
      return 'Costume';
    case 'media':
      return 'Media';
    default:
      return 'Content';
  }
};

const getSubscriptionPlanFromPackage = (pkg: PurchasesPackage): SubscriptionPlan | null => {
  const productId = pkg.product.identifier.toLowerCase();
  const storeProduct = pkg.product;

  let tier: SubscriptionTier;
  let displayName: string;
  let features: string[];

  if (productId.includes('unlimited')) {
    tier = 'unlimited';
    displayName = 'Unlimited';
    features = [
      'Everything in Pro',
      'Access to Unlimited tier content',
      'Priority support',
      'Early access to new features',
    ];
  } else {
    tier = 'pro';
    if (productId.includes('weekly')) {
      displayName = 'Pro Weekly';
    } else if (productId.includes('yearly')) {
      displayName = 'Pro Yearly';
    } else {
      displayName = 'Pro Monthly';
    }
    features = [
      'Access to Pro characters',
      'Access to Pro backgrounds',
      'Access to Pro costumes',
      'Unlimited conversations',
    ];
  }

  const price = storeProduct.priceString || '$0.00';
  const period = storeProduct.subscriptionPeriod;
  let finalPrice = price;
  if (period) {
    if (period.unit === 'MONTH') {
      finalPrice = `${price}/month`;
    } else if (period.unit === 'YEAR') {
      finalPrice = `${price}/year`;
    } else if (period.unit === 'WEEK') {
      finalPrice = `${price}/week`;
    }
  }

  return {
    id: productId,
    displayName,
    tier,
    price: finalPrice,
    features,
    isRecommended: false,
  };
};

export const SubscriptionSheet: React.FC<SubscriptionSheetProps> = ({
  visible,
  onClose,
  contentType,
  contentName,
  requiredTier,
  onPurchaseComplete,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [showTermsSheet, setShowTermsSheet] = useState(false);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [showEulaSheet, setShowEulaSheet] = useState(false);

  const loadOfferings = useCallback(async () => {
    setIsLoadingOfferings(true);
    try {
      const currentOfferings = await revenueCatManager.loadOfferings();
      setOfferings(currentOfferings);
    } catch (error) {
      console.error('[SubscriptionSheet] Failed to load offerings', error);
    } finally {
      setIsLoadingOfferings(false);
    }
  }, []);

  const heroFade = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    heroFade.setValue(0);
    contentFade.setValue(0);
    Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 650,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 450,
        delay: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [heroFade, contentFade]);

  useEffect(() => {
    if (visible) {
      animateIn();
      loadOfferings();
    }
  }, [visible, animateIn, loadOfferings]);

  const handleSelectPlan = useCallback((pkg: PurchasesPackage | null, plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setSelectedPackage(pkg);
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const handlePurchase = useCallback(async () => {
    if (!selectedPlan) {
      return;
    }

    if (selectedPackage) {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await revenueCatManager.purchasePackage(selectedPackage);
        await revenueCatManager.loadOfferings();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', `Subscribed to ${selectedPlan.displayName} successfully!`);
        onPurchaseComplete?.();
        onClose();
      } catch (error: any) {
        if (error.message === 'Purchase cancelled') {
          console.log('Purchase cancelled by user');
        } else {
          console.error('[SubscriptionSheet] Purchase failed', error);
          setErrorMessage(error?.message ?? 'Unable to complete purchase right now.');
          Alert.alert('Purchase failed', error?.message ?? 'Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      Alert.alert(
        'Subscription not available',
        'RevenueCat is not properly configured. Please contact support.'
      );
    }
  }, [selectedPackage, selectedPlan, onClose, onPurchaseComplete]);

  const handleRestore = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await revenueCatManager.restorePurchases();
      await revenueCatManager.loadOfferings();
      Alert.alert('Success', 'Purchases restored successfully');
      onClose();
    } catch (error: any) {
      console.error('[SubscriptionSheet] Restore failed', error);
      setErrorMessage(error?.message ?? 'Unable to restore purchases');
      Alert.alert('Restore failed', error?.message ?? 'Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [onClose]);

  const contentTypeDisplayName = useMemo(() => getContentTypeDisplayName(contentType), [contentType]);
  const headerTitle = contentName ? `Premium ${contentTypeDisplayName}` : 'Subscription';

  const availablePlans = useMemo(() => {
    if (!offerings?.availablePackages?.length) {
      return [] as Array<{ package: PurchasesPackage; plan: SubscriptionPlan }>;
    }
    return offerings.availablePackages
      .map(pkg => {
        const plan = getSubscriptionPlanFromPackage(pkg);
        if (!plan) {
          return null;
        }
        return { package: pkg, plan };
      })
      .filter(Boolean) as Array<{ package: PurchasesPackage; plan: SubscriptionPlan }>;
  }, [offerings]);

  const plansToShow: Array<{ package: PurchasesPackage | null; plan: SubscriptionPlan }> =
    availablePlans.length > 0 ? availablePlans : DEFAULT_PLANS.map(plan => ({ package: null, plan }));

  const subscribeDisabled = !selectedPlan || isLoading || isLoadingOfferings;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Button
              size="md"
              variant="liquid"
              onPress={onClose}
              startIconName="close"
              isIconOnly
            />
          </View>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Animated.View style={[styles.heroWrapper, { opacity: heroFade }]}
            >
              <ImageBackground
                source={{ uri: HERO_URL }}
                style={styles.heroImage}
                imageStyle={styles.heroImageRadius}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.heroCopy}>
                  <Text style={styles.heroTitle}>{headerTitle}</Text>
                  <Text style={styles.heroSubtitle}>Choose a plan</Text>
                </View>
              </ImageBackground>
            </Animated.View>

            <Animated.View
              style={[
                styles.plansContainer,
                {
                  opacity: contentFade,
                  transform: [
                    {
                      translateY: contentFade.interpolate({
                        inputRange: [0, 1],
                        outputRange: [16, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {isLoadingOfferings ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              ) : (
                plansToShow.map(({ package: pkg, plan }) => {
                  const isSelected =
                    !!selectedPlan &&
                    (selectedPlan.id === plan.id ||
                      (pkg && selectedPackage?.identifier === pkg.identifier));

                  return (
                    <SubscriptionPlanCard
                      key={pkg?.identifier ?? plan.id}
                      plan={plan}
                      isSelected={isSelected}
                      isRecommended={plan.isRecommended}
                      onPress={() => handleSelectPlan(pkg, plan)}
                    />
                  );
                })
              )}
            </Animated.View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handlePurchase}
              disabled={subscribeDisabled}
              style={({ pressed }) => [
                styles.subscribeButton,
                subscribeDisabled && styles.subscribeButtonDisabled,
                pressed && !subscribeDisabled && styles.subscribeButtonPressed,
              ]}
            >
              <LinearGradient
                colors={
                  subscribeDisabled
                    ? ['rgba(120,120,120,0.6)', 'rgba(120,120,120,0.6)']
                    : ['#1B52FF', '#5A8BFF']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.subscribeGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.subscribeLabel}>
                    {selectedPlan ? `Subscribe to ${selectedPlan.displayName}` : 'Select a plan'}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.bottomLinks}>
              <Pressable hitSlop={8} onPress={() => setShowTermsSheet(true)}>
                <Text style={styles.linkText}>Terms</Text>
              </Pressable>
              <Text style={styles.linkSeparator}>•</Text>
              <Pressable hitSlop={8} onPress={() => setShowPrivacySheet(true)}>
                <Text style={styles.linkText}>Privacy</Text>
              </Pressable>
              <Text style={styles.linkSeparator}>•</Text>
              <Pressable hitSlop={8} onPress={() => setShowEulaSheet(true)}>
                <Text style={styles.linkText}>EULA</Text>
              </Pressable>
              <Text style={styles.linkSeparator}>•</Text>
              <Pressable hitSlop={8} onPress={handleRestore}>
                <Text style={styles.linkText}>Restore</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <LegalSheet
        visible={showTermsSheet}
        title="Terms of Service"
        content={LEGAL_TEXT.terms}
        onClose={() => setShowTermsSheet(false)}
      />
      <LegalSheet
        visible={showPrivacySheet}
        title="Privacy Policy"
        content={LEGAL_TEXT.privacy}
        onClose={() => setShowPrivacySheet(false)}
      />
      <LegalSheet
        visible={showEulaSheet}
        title="End User License Agreement"
        content={LEGAL_TEXT.eula || ''}
        onClose={() => setShowEulaSheet(false)}
      />
    </>
  );
};

const SubscriptionPlanCard: React.FC<{
  plan: SubscriptionPlan;
  isSelected: boolean;
  isRecommended: boolean;
  onPress: () => void;
}> = ({ plan, isSelected, isRecommended, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.planCard,
        isSelected && styles.planCardSelected,
        pressed && styles.planCardPressed,
      ]}
    >
      <View style={styles.planHeader}>
        <View style={styles.planHeaderLeft}>
          <View style={styles.planTitleRow}>
            <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
              {plan.displayName}
            </Text>
            {isRecommended ? (
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>RECOMMENDED</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
            {plan.price}
          </Text>
        </View>
        <Ionicons
          name={isSelected ? 'checkmark.circle.fill' : 'circle-outline'}
          size={24}
          color={isSelected ? '#fff' : 'rgba(0,0,0,0.35)'}
        />
      </View>
      <View style={styles.planFeatures}>
        {plan.features.map(feature => (
          <View key={feature} style={styles.planFeature}>
            <Ionicons
              name="checkmark"
              size={14}
              color={isSelected ? '#fff' : '#FF0059'}
            />
            <Text style={[styles.planFeatureText, isSelected && styles.planFeatureTextSelected]}>
              {feature}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
};

const LegalSheet: React.FC<{
  visible: boolean;
  title: string;
  content: string;
  onClose: () => void;
}> = ({ visible, title, content, onClose }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.legalSafeArea}>
        <View style={styles.legalHeader}>
          <View style={styles.headerSpacer} />
          <Text style={styles.legalTitle}>{title}</Text>
          <Button
            size="md"
            variant="liquid"
            onPress={onClose}
            startIconName="close"
            isIconOnly
          />
        </View>
        <ScrollView contentContainerStyle={styles.legalContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.legalBody}>{content}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
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
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f1f1f',
  },
  content: {
    paddingBottom: 32,
  },
  heroWrapper: {
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#FF4686',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  heroImage: {
    height: 240,
    justifyContent: 'flex-end',
  },
  heroImageRadius: {
    borderRadius: 28,
  },
  heroCopy: {
    padding: 24,
    gap: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  plansContainer: {
    paddingHorizontal: 16,
    gap: 16,
    marginTop: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  planCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(255,145,189,0.25)',
    borderWidth: 1,
    borderColor: '#FF5D9D',
    shadowColor: '#FF5D9D',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  planCardSelected: {
    backgroundColor: '#FF91BD',
    borderColor: '#FF7AB1',
  },
  planCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  planHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
  },
  planNameSelected: {
    color: '#fff',
  },
  recommendedBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(0,0,0,0.72)',
  },
  planPriceSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  planFeatures: {
    gap: 10,
  },
  planFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureText: {
    fontSize: 14,
    color: 'rgba(0,0,0,0.82)',
  },
  planFeatureTextSelected: {
    color: 'rgba(255,255,255,0.85)',
  },
  errorBox: {
    backgroundColor: 'rgba(255,0,0,0.12)',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
  },
  errorText: {
    color: '#B00303',
    fontSize: 14,
  },
  subscribeButton: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  subscribeGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 12,
    paddingBottom: 26,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  linkSeparator: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.45)',
  },
  legalSafeArea: {
    flex: 1,
    backgroundColor: '#050505',
  },
  legalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  legalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  legalContent: {
    padding: 20,
  },
  legalBody: {
    color: '#fff',
    lineHeight: 20,
  },
});

export default SubscriptionSheet;
