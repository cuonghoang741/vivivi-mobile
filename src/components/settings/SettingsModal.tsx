import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { authManager } from '../../services/AuthManager';
import Button from '../Button';
import { getSupabaseClient } from '../../services/supabase';
import { getSupabaseAuthHeaders } from '../../utils/supabaseHelpers';
import { getAuthIdentifier } from '../../services/authIdentifier';
import { LEGAL_TEXT } from '../../content/legalText';
import { SUPABASE_URL } from '../../config/supabase';

type Props = {
  visible: boolean;
  onClose: () => void;
  email?: string | null;
  displayName?: string | null;
};

type ToggleKey =
  | 'settings.hapticsEnabled'
  | 'settings.autoPlayMusic'
  | 'settings.autoEnterTalking'
  | 'settings.enableNSFW';

const TOGGLE_DEFAULTS: Record<ToggleKey, boolean> = {
  'settings.hapticsEnabled': true,
  'settings.autoPlayMusic': false,
  'settings.autoEnterTalking': false,
  'settings.enableNSFW': true,
};

type SubscriptionTier = 'free' | 'pro' | 'unlimited';
const SUBSCRIPTION_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free plan',
  pro: 'Pro plan',
  unlimited: 'Unlimited plan',
};

type LegalDoc = 'terms' | 'privacy';
const LEGAL_TITLES: Record<LegalDoc, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
};

type FeedbackKind = 'problem' | 'feature';
const FEEDBACK_SUBJECT: Record<FeedbackKind, string> = {
  problem: 'Bug report',
  feature: 'Feature request',
};

type SettingsScreen =
  | { key: 'root' }
  | { key: 'editProfile' }
  | { key: 'purchaseHistory' }
  | { key: 'legal'; doc: LegalDoc }
  | { key: 'feedback'; kind: FeedbackKind }
  | { key: 'subscription' };

type SubscriptionPlan = {
  id: string;
  displayName: string;
  tier: SubscriptionTier;
  price: string;
  features: string[];
  recommended?: boolean;
};

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'pro',
    displayName: 'Pro',
    tier: 'pro',
    price: '$9.99 / month',
    features: [
      'Pro characters & backgrounds',
      'Unlimited conversations',
      'Exclusive events',
      'Priority support',
    ],
    recommended: true,
  },
  {
    id: 'unlimited',
    displayName: 'Unlimited',
    tier: 'unlimited',
    price: '$19.99 / month',
    features: [
      'Everything in Pro',
      'Unlimited-tier characters',
      'Early access to new features',
      'VIP support',
    ],
  },
];

type InAppPurchase = {
  id: string;
  productId: string;
  transactionId?: string;
  vcoinAdded: number;
  rubyAdded: number;
  priceCents?: number;
  currencyCode?: string;
  createdAt: Date;
};

type ItemPurchase = {
  id: string;
  itemId: string;
  itemType: string;
  transactionId?: string;
  createdAt: Date;
};

type PurchaseHistoryTab = 'iap' | 'items';

type AuthState = {
  user: UserMetadata | null;
  isDeletingAccount: boolean;
};

type UserMetadata = {
  id: string;
  email: string | null;
  user_metadata?: Record<string, any>;
};

export const SettingsModal: React.FC<Props> = ({ visible, onClose, email, displayName }) => {
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(TOGGLE_DEFAULTS);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [authState, setAuthState] = useState<AuthState>(() => ({
    user: authManager.user
      ? { id: authManager.user.id, email: authManager.user.email ?? null, user_metadata: authManager.user.user_metadata }
      : null,
    isDeletingAccount: authManager.isDeletingAccount,
  }));
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [screenStack, setScreenStack] = useState<SettingsScreen[]>([{ key: 'root' }]);

  const currentScreen = screenStack[screenStack.length - 1];
  const isRootScreen = currentScreen?.key === 'root';

  useEffect(() => {
    const unsubscribe = authManager.subscribe(() => {
      const nextUser = authManager.user
        ? { id: authManager.user.id, email: authManager.user.email ?? null, user_metadata: authManager.user.user_metadata }
        : null;
      setAuthState({
        user: nextUser,
        isDeletingAccount: authManager.isDeletingAccount,
      });
    });
    return unsubscribe;
  }, []);

  const loadToggles = useCallback(async () => {
      const entries = await Promise.all(
      (Object.keys(TOGGLE_DEFAULTS) as ToggleKey[]).map(async key => {
          const stored = await AsyncStorage.getItem(key);
        return [key, stored === null ? TOGGLE_DEFAULTS[key] : stored === 'true'] as const;
        })
      );
      setToggles(Object.fromEntries(entries) as Record<ToggleKey, boolean>);
  }, []);

  const loadSubscriptionTier = useCallback(async () => {
    setSubscriptionLoading(true);
    try {
      const cached = await AsyncStorage.getItem('subscription.tier');
      if (cached === 'pro' || cached === 'unlimited') {
        setSubscriptionTier(cached);
        return;
      }
      const userId = authManager.user?.id?.toLowerCase();
      if (!userId) {
        setSubscriptionTier('free');
        return;
      }
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('subscriptions')
        .select('tier')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ tier?: string | null }>();
      if (!error && data?.tier) {
        const normalized = normalizeTier(data.tier);
        setSubscriptionTier(normalized);
      } else {
        setSubscriptionTier('free');
      }
    } catch (err) {
      console.warn('[SettingsModal] Failed to load subscription tier', err);
      setSubscriptionTier('free');
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      setScreenStack([{ key: 'root' }]);
      return;
    }
    loadToggles();
    loadSubscriptionTier();
  }, [visible, loadToggles, loadSubscriptionTier]);

  const handleToggle = useCallback(async (key: ToggleKey, value: boolean) => {
      setToggles(prev => ({ ...prev, [key]: value }));
      await AsyncStorage.setItem(key, value ? 'true' : 'false');
      if (key === 'settings.hapticsEnabled' && value) {
        Haptics.selectionAsync().catch(() => {});
      }
  }, []);

  const pushScreen = useCallback((screen: SettingsScreen) => {
    setScreenStack(prev => [...prev, screen]);
  }, []);

  const popScreen = useCallback(() => {
    setScreenStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const handleModalClose = useCallback(() => {
    setScreenStack([{ key: 'root' }]);
    onClose();
  }, [onClose]);

  const handleBack = useCallback(() => {
    if (screenStack.length > 1) {
      popScreen();
      return;
    }
    handleModalClose();
  }, [screenStack.length, popScreen, handleModalClose]);

  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true);
      await authManager.logout();
      handleModalClose();
    } catch (error: any) {
      Alert.alert('Sign out failed', error?.message ?? 'Please try again');
    } finally {
      setIsLoggingOut(false);
    }
  }, [handleModalClose]);

  const resolvedDisplayName = useMemo(() => {
    const metaName =
      (authState.user?.user_metadata?.display_name as string | undefined) ??
      displayName ??
      '';
    if (metaName.trim().length > 0) {
      return metaName;
    }
    const fallbackEmail = authState.user?.email ?? email ?? '';
    if (fallbackEmail.includes('@')) {
      return fallbackEmail.split('@')[0];
    }
    return 'Vivivi user';
  }, [authState.user, displayName, email]);

  const resolvedEmail = authState.user?.email ?? email ?? 'Email not available';

  const avatarLetter = useMemo(() => resolvedDisplayName.charAt(0).toUpperCase() || '?', [resolvedDisplayName]);

  const headerTitle = useMemo(() => {
    switch (currentScreen?.key) {
      case 'editProfile':
        return 'Edit profile';
      case 'purchaseHistory':
        return 'Purchase history';
      case 'legal':
        return LEGAL_TITLES[currentScreen.doc];
      case 'feedback':
        return currentScreen.kind === 'problem' ? 'Report a problem' : 'Feature request';
      case 'subscription':
        return 'Manage subscription';
      default:
        return 'Settings';
    }
  }, [currentScreen]);

  const versionLabel = `VERSION ${Constants.expoConfig?.version ?? 'DEV'}`;

  const renderScreen = () => {
    switch (currentScreen?.key) {
      case 'editProfile':
  return (
          <EditProfileScreen
            user={authState.user}
            isDeleting={authState.isDeletingAccount}
            onDone={popScreen}
            onAccountDeleted={handleModalClose}
          />
        );
      case 'purchaseHistory':
        return <PurchaseHistoryScreen />;
      case 'legal':
        return <LegalDocumentScreen doc={currentScreen.doc} />;
      case 'feedback':
        return <FeedbackFormScreen kind={currentScreen.kind} onSubmitted={popScreen} />;
      case 'subscription':
        return <SubscriptionManagementScreen currentTier={subscriptionTier} />;
      default:
        return (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Pressable
              style={({ pressed }) => [
                styles.profileCard,
                pressed && styles.pressedCard,
              ]}
              onPress={() => pushScreen({ key: 'editProfile' })}
            >
            <View style={styles.avatar}>
              <Text style={styles.avatarLabel}>{avatarLetter}</Text>
            </View>
              <View style={styles.profileDetails}>
                <Text style={styles.profileName}>{resolvedDisplayName}</Text>
                <Text style={styles.profileEmail}>{resolvedEmail}</Text>
            </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
            </Pressable>

            <SubscriptionCard
              tier={subscriptionTier}
              loading={subscriptionLoading}
              onManage={() => pushScreen({ key: 'subscription' })}
            />

            <SettingsSection title="Preferences">
              <SettingToggleRow
                label="Haptics"
              value={toggles['settings.hapticsEnabled']}
              onValueChange={value => handleToggle('settings.hapticsEnabled', value)}
            />
              <SettingToggleRow
                label="Auto-play music"
              value={toggles['settings.autoPlayMusic']}
              onValueChange={value => handleToggle('settings.autoPlayMusic', value)}
            />
              <SettingToggleRow
                label="Auto enter talking mode"
              value={toggles['settings.autoEnterTalking']}
              onValueChange={value => handleToggle('settings.autoEnterTalking', value)}
            />
            </SettingsSection>

            <SettingsSection>
              <SettingToggleRow
                label="Enable NSFW content"
              value={toggles['settings.enableNSFW']}
              onValueChange={value => handleToggle('settings.enableNSFW', value)}
            />
            </SettingsSection>

            <SettingsSection title="Data & Information">
              <SettingsLinkRow
                icon="cart-outline"
                label="Purchase history"
                onPress={() => pushScreen({ key: 'purchaseHistory' })}
              />
            </SettingsSection>

            <SettingsSection title="Legal">
              <SettingsLinkRow
                icon="document-text-outline"
                label="Terms of Service"
                onPress={() => pushScreen({ key: 'legal', doc: 'terms' })}
              />
              <SettingsLinkRow
                icon="shield-checkmark-outline"
                label="Privacy Policy"
                onPress={() => pushScreen({ key: 'legal', doc: 'privacy' })}
              />
            </SettingsSection>

            <SettingsSection title="Support">
              <SettingsLinkRow
                icon="alert-circle-outline"
                label="Report a problem"
                onPress={() => pushScreen({ key: 'feedback', kind: 'problem' })}
              />
              <SettingsLinkRow
                icon="star-outline"
                label="Feature request"
                onPress={() => pushScreen({ key: 'feedback', kind: 'feature' })}
              />
            </SettingsSection>

          <Button
            variant="outline"
            color="error"
            fullWidth
            onPress={handleLogout}
              loading={isLoggingOut}
              style={styles.logoutButton}
          >
              Sign out
          </Button>

          <Text style={styles.version}>{versionLabel}</Text>
        </ScrollView>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleBack}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Button
            size="md"
            variant="liquid"
            startIconName={isRootScreen ? 'close' : 'chevron-back'}
            onPress={handleBack}
            isIconOnly
          />
          <Text style={styles.title}>{headerTitle}</Text>
          {!isRootScreen && (
            <Button
              size="md"
              variant="liquid"
              startIconName="close"
              onPress={handleModalClose}
              isIconOnly
            />
          )}
          {isRootScreen && <View style={{ width: 40 }} />}
        </View>
        <View style={styles.body}>{renderScreen()}</View>
      </SafeAreaView>
    </Modal>
  );
};

const SettingToggleRow: React.FC<{
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}> = ({ label, value, onValueChange }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Switch value={value} onValueChange={onValueChange} />
  </View>
);

const SettingsSection: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View style={styles.section}>
    {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
    {children}
  </View>
);

const SettingsLinkRow: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }> = ({
  icon,
  label,
  onPress,
}) => (
  <Pressable style={({ pressed }) => [styles.linkRow, pressed && styles.pressedCard]} onPress={onPress}>
    <View style={styles.linkRowLeft}>
      <Ionicons name={icon} size={18} color="#fff" style={styles.linkIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
  </Pressable>
);

const SubscriptionCard: React.FC<{
  tier: SubscriptionTier;
  loading: boolean;
  onManage: () => void;
}> = ({ tier, loading, onManage }) => (
  <LinearGradient
    colors={['#FF91BD', '#FF5D9D']}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.subscriptionCard}
  >
    <View style={{ flex: 1 }}>
      <Text style={styles.subscriptionLabel}>Subscription</Text>
      <Text style={styles.subscriptionTier}>{SUBSCRIPTION_LABELS[tier]}</Text>
      <Text style={styles.subscriptionStatus}>
        {tier === 'free' ? 'Upgrade to unlock all premium content' : 'Active subscription'}
      </Text>
    </View>
    <Button
      size="sm"
      variant="solid"
      color={tier === 'free' ? 'primary' : 'gray'}
      onPress={onManage}
      loading={loading}
    >
      {tier === 'free' ? 'Upgrade' : 'Manage'}
    </Button>
  </LinearGradient>
);

const EditProfileScreen: React.FC<{
  user: UserMetadata | null;
  isDeleting: boolean;
  onDone: () => void;
  onAccountDeleted: () => void;
}> = ({ user, isDeleting, onDone, onAccountDeleted }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setFirstName('');
      setLastName('');
      setBirthYear('');
      return;
    }
    const rawName = (user.user_metadata?.display_name as string | undefined) ?? '';
    if (rawName.trim().length > 0) {
      const parts = rawName.trim().split(' ');
      setFirstName(parts[0] ?? '');
      setLastName(parts.slice(1).join(' '));
    }
    const birth = user.user_metadata?.birth_year;
    if (typeof birth === 'string' || typeof birth === 'number') {
      setBirthYear(String(birth));
    }
  }, [user]);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ').trim();
      if (fullName.length) {
        await authManager.updateDisplayName(fullName);
      }
      const parsedYear = parseInt(birthYear, 10);
      if (!Number.isNaN(parsedYear)) {
        await authManager.updateBirthYear(parsedYear);
      }
      onDone();
    } catch (error: any) {
      Alert.alert('Save failed', error?.message ?? 'Please try again');
    } finally {
      setIsSaving(false);
    }
  }, [firstName, lastName, birthYear, onDone]);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      'Delete account?',
      'This will permanently delete your data and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await authManager.deleteAccountLocally();
              onAccountDeleted();
            } catch (error: any) {
              Alert.alert('Unable to delete account', error?.message ?? 'Please try again later.');
            }
          },
        },
      ]
    );
  }, [onAccountDeleted]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.editProfileContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.editAvatar}>
          <Text style={styles.editAvatarText}>
            {(firstName || user?.email || '?').charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            placeholder="First name"
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.textInput}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
          <TextInput
            placeholder="Last name"
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.textInput}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Birth year</Text>
          <TextInput
            placeholder="e.g. 1999"
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.textInput}
            value={birthYear}
            onChangeText={setBirthYear}
            keyboardType="number-pad"
          />
        </View>

        <Button fullWidth onPress={handleSave} loading={isSaving}>
          Save changes
        </Button>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerLabel}>Danger zone</Text>
          <Button
            fullWidth
            variant="outline"
            color="error"
            onPress={confirmDelete}
            loading={isDeleting}
          >
            Delete account
          </Button>
          <Text style={styles.dangerHint}>
            All of your data will be deleted from our servers. This cannot be undone.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const PurchaseHistoryScreen: React.FC = () => {
  const [tab, setTab] = useState<PurchaseHistoryTab>('iap');
  const [iapTransactions, setIapTransactions] = useState<InAppPurchase[]>([]);
  const [itemTransactions, setItemTransactions] = useState<ItemPurchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(
    async (target: PurchaseHistoryTab) => {
      try {
        setLoading(true);
        setError(null);
        if (target === 'iap') {
          const data = await fetchInAppPurchases();
          setIapTransactions(data);
        } else {
          const data = await fetchItemPurchases();
          setItemTransactions(data);
        }
      } catch (err: any) {
        setError(err?.message ?? 'Unable to load data');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadTransactions(tab);
  }, [tab, loadTransactions]);

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.historyState}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.historyStateText}>Loading data...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.historyState}>
          <Text style={styles.historyErrorTitle}>Failed to load</Text>
          <Text style={styles.historyErrorText}>{error}</Text>
          <Button size="sm" variant="outline" onPress={() => loadTransactions(tab)}>
            Retry
          </Button>
        </View>
      );
    }
    const hasData = tab === 'iap' ? iapTransactions.length > 0 : itemTransactions.length > 0;
    if (!hasData) {
      return (
        <View style={styles.historyState}>
          <Text style={styles.historyEmptyTitle}>No transactions yet</Text>
          <Text style={styles.historyStateText}>Your history will appear here.</Text>
        </View>
      );
    }
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {tab === 'iap'
          ? iapTransactions.map(item => <InAppPurchaseRow key={item.id} item={item} />)
          : itemTransactions.map(item => <ItemPurchaseRow key={item.id} item={item} />)}
      </ScrollView>
    );
  };

  return (
    <View style={styles.flex}>
      <View style={styles.segmentedControl}>
      <Pressable
          style={[styles.segmentButton, tab === 'iap' && styles.segmentButtonActive]}
          onPress={() => setTab('iap')}
      >
          <Text style={[styles.segmentText, tab === 'iap' && styles.segmentTextActive]}>
            In-app purchases
          </Text>
      </Pressable>
        <Pressable
          style={[styles.segmentButton, tab === 'items' && styles.segmentButtonActive]}
          onPress={() => setTab('items')}
        >
          <Text style={[styles.segmentText, tab === 'items' && styles.segmentTextActive]}>
            Item purchases
          </Text>
        </Pressable>
      </View>
      <View style={styles.historyContent}>{renderContent()}</View>
    </View>
  );
};

const InAppPurchaseRow: React.FC<{ item: InAppPurchase }> = ({ item }) => (
  <View style={styles.historyCard}>
    <Text style={styles.historyCardTitle}>{mapProductName(item.productId)}</Text>
    <Text style={styles.historyMeta}>
      {item.transactionId ? `Transaction ID: ${item.transactionId}` : 'No transaction ID'}
    </Text>
    <Text style={styles.historyMeta}>
      {item.vcoinAdded > 0 ? `${item.vcoinAdded} VCoin` : `${item.rubyAdded} Ruby`}
    </Text>
    <Text style={styles.historyMeta}>
      {item.priceCents
        ? formatPrice(item.priceCents, item.currencyCode)
        : 'No price info'}
    </Text>
    <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
  </View>
);

const ItemPurchaseRow: React.FC<{ item: ItemPurchase }> = ({ item }) => (
  <View style={styles.historyCard}>
    <Text style={styles.historyCardTitle}>{item.itemType.toUpperCase()}</Text>
    <Text style={styles.historyMeta}>Asset ID: {item.itemId}</Text>
    <Text style={styles.historyMeta}>
      {item.transactionId ? `Transaction ID: ${item.transactionId}` : 'No transaction ID'}
    </Text>
    <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
  </View>
);

const LegalDocumentScreen: React.FC<{ doc: LegalDoc }> = ({ doc }) => (
  <ScrollView contentContainerStyle={styles.legalContainer} showsVerticalScrollIndicator={false}>
    <Text style={styles.legalText}>{LEGAL_TEXT[doc]}</Text>
  </ScrollView>
);

const FeedbackFormScreen: React.FC<{ kind: FeedbackKind; onSubmitted: () => void }> = ({
  kind,
  onSubmitted,
}) => {
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = details.trim();
    if (!trimmed.length) {
      return;
    }
    try {
      setIsSubmitting(true);
      const { userId, clientId } = await getAuthIdentifier();
      const headers = await getSupabaseAuthHeaders();
      headers['Prefer'] = 'return=minimal';
      if (!userId && clientId) {
        headers['X-Client-Id'] = clientId;
      }

      const body: Record<string, any> = {
        kind,
        subject: FEEDBACK_SUBJECT[kind],
        message: trimmed,
      };
      if (userId) body.user_id = userId;
      if (clientId) body.client_id = clientId;

      await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const fallback = `mailto:hung@eduto.asia?subject=${encodeURIComponent(
        `VRM ${FEEDBACK_SUBJECT[kind]}`
      )}&body=${encodeURIComponent(trimmed)}`;
      Linking.openURL(fallback).catch(() => {});

      Alert.alert('Thank you!', 'We recorded your feedback.');
      onSubmitted();
    } catch (error: any) {
      Alert.alert('Send failed', error?.message ?? 'Please try again later');
    } finally {
      setIsSubmitting(false);
    }
  }, [details, kind, onSubmitted]);

  return (
    <View style={styles.feedbackContainer}>
      <Text style={styles.inputLabel}>Details</Text>
      <TextInput
        style={styles.feedbackInput}
        placeholder="Describe your issue or suggestion..."
        placeholderTextColor="rgba(255,255,255,0.5)"
        value={details}
        onChangeText={setDetails}
        multiline
        textAlignVertical="top"
      />
      <Button fullWidth onPress={handleSubmit} loading={isSubmitting}>
        Send feedback
      </Button>
    </View>
  );
};

const SubscriptionManagementScreen: React.FC<{ currentTier: SubscriptionTier }> = ({ currentTier }) => (
  <ScrollView contentContainerStyle={styles.subscriptionScreen} showsVerticalScrollIndicator={false}>
    <View style={styles.subscriptionStatusCard}>
      <Text style={styles.subscriptionStatusTitle}>Current status</Text>
      <Text style={styles.subscriptionStatusValue}>{SUBSCRIPTION_LABELS[currentTier]}</Text>
      <Text style={styles.subscriptionStatusHint}>
        {currentTier === 'free'
          ? 'Upgrade to access all characters, rooms, and events.'
          : 'You are enjoying premium perks.'}
      </Text>
    </View>
    {SUBSCRIPTION_PLANS.map(plan => (
      <View
        key={plan.id}
        style={[
          styles.planCard,
          plan.recommended && styles.planCardRecommended,
          currentTier === plan.tier && styles.planCardCurrent,
        ]}
      >
        <View style={styles.planHeader}>
          <Text style={styles.planName}>{plan.displayName}</Text>
          {plan.recommended ? <Text style={styles.planBadge}>RECOMMENDED</Text> : null}
        </View>
        <Text style={styles.planPrice}>{plan.price}</Text>
        {plan.features.map(feature => (
          <View key={feature} style={styles.planFeature}>
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.planFeatureText}>{feature}</Text>
          </View>
        ))}
        <Button
          fullWidth
          style={styles.planButton}
          variant={currentTier === plan.tier ? 'outline' : 'solid'}
          onPress={() =>
            Linking.openURL(
              `mailto:billing@vivivi.ai?subject=${encodeURIComponent(
                `Upgrade to ${plan.displayName}`
              )}`
            ).catch(() => {})
          }
        >
          {currentTier === plan.tier ? 'In use' : 'Contact to upgrade'}
        </Button>
  </View>
    ))}
  </ScrollView>
);

const normalizeTier = (tier?: string | null): SubscriptionTier => {
  const normalized = (tier ?? '').toLowerCase();
  if (normalized === 'pro' || normalized.includes('pro')) {
    return 'pro';
  }
  if (normalized === 'unlimited' || normalized.includes('unlimited')) {
    return 'unlimited';
  }
  return 'free';
};

const fetchInAppPurchases = async (): Promise<InAppPurchase[]> => {
  const { userId, clientId } = await getAuthIdentifier();
  if (!userId && !clientId) {
    throw new Error('Not signed in');
  }
  const params = new URLSearchParams();
  params.append(
    'select',
    'id,product_id,transaction_id,price_cents,currency_code,vcoin_added,ruby_added,created_at'
  );
  params.append('order', 'created_at.desc');
  if (userId) {
    params.append('user_id', `eq.${userId}`);
    params.append('client_id', 'is.null');
  } else if (clientId) {
    params.append('client_id', `eq.${clientId}`);
    params.append('user_id', 'is.null');
  }

  const headers = await getSupabaseAuthHeaders();
  if (!userId && clientId) {
    headers['X-Client-Id'] = clientId;
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/purchases?${params.toString()}`, {
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to load transactions');
  }

  const rows: any[] = await response.json();
  return rows.map(row => ({
    id: row.id,
    productId: row.product_id,
    transactionId: row.transaction_id ?? undefined,
    vcoinAdded: row.vcoin_added ?? 0,
    rubyAdded: row.ruby_added ?? 0,
    priceCents: row.price_cents ?? undefined,
    currencyCode: row.currency_code ?? undefined,
    createdAt: new Date(row.created_at),
  }));
};

const fetchItemPurchases = async (): Promise<ItemPurchase[]> => {
  const { userId, clientId } = await getAuthIdentifier();
  if (!userId && !clientId) {
    throw new Error('Not signed in');
  }
  const params = new URLSearchParams();
  params.append('select', 'id,item_id,item_type,transaction_id,created_at');
  params.append('order', 'created_at.desc');
  params.append('transaction_id', 'not.is.null');
  if (userId) {
    params.append('user_id', `eq.${userId}`);
    params.append('client_id', 'is.null');
  } else if (clientId) {
    params.append('client_id', `eq.${clientId}`);
    params.append('user_id', 'is.null');
  }

  const headers = await getSupabaseAuthHeaders();
  if (!userId && clientId) {
    headers['X-Client-Id'] = clientId;
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/user_assets?${params.toString()}`, {
    headers,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to load item history');
  }

  const rows: any[] = await response.json();
  return rows.map(row => ({
    id: row.id,
    itemId: row.item_id,
    itemType: row.item_type,
    transactionId: row.transaction_id ?? undefined,
    createdAt: new Date(row.created_at),
  }));
};

const mapProductName = (productId: string): string => {
  const mapping: Record<string, string> = {
    'pink.package.fun.vivivi': 'Pink Package',
    'brown.package.fun.vivivi': 'Brown Package',
    'silver.package.fun.vivivi': 'Silver Package',
    'gold.package.fun.vivivi': 'Gold Package',
    'titanium.package.fun.vivivi': 'Titanium Package',
    'diamond.package.fun.vivivi': 'Diamond Package',
  };
  return mapping[productId] ?? productId;
};

const formatPrice = (priceCents: number, currencyCode?: string) => {
  const value = (priceCents / 100).toFixed(2);
  return `${value} ${currencyCode ?? 'USD'}`;
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050509',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  pressedCard: {
    opacity: 0.8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarLabel: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  profileDetails: {
    flex: 1,
    marginRight: 8,
  },
  profileName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  profileEmail: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 4,
  },
  section: {
    marginBottom: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowLabel: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
    paddingRight: 12,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  linkRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  linkIcon: {
    marginRight: 10,
  },
  subscriptionCard: {
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  subscriptionLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subscriptionTier: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 4,
  },
  subscriptionStatus: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 4,
  },
  logoutButton: {
    marginTop: 16,
  },
  version: {
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
  },
  flex: {
    flex: 1,
  },
  editProfileContainer: {
    padding: 20,
    gap: 20,
  },
  editAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '600',
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  dangerZone: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,0,0,0.08)',
    gap: 12,
  },
  dangerLabel: {
    color: '#ff6b81',
    fontWeight: '600',
  },
  dangerHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  segmentedControl: {
    flexDirection: 'row',
    margin: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  segmentText: {
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  historyContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  historyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  historyStateText: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  historyErrorTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyErrorText: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  historyEmptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 12,
  },
  historyCardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyMeta: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    fontSize: 13,
  },
  historyDate: {
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    fontSize: 12,
  },
  legalContainer: {
    padding: 20,
  },
  legalText: {
    color: '#fff',
    lineHeight: 20,
  },
  feedbackContainer: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  feedbackInput: {
    minHeight: 220,
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
  },
  subscriptionScreen: {
    padding: 20,
    gap: 16,
  },
  subscriptionStatusCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  subscriptionStatusTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  subscriptionStatusValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 6,
  },
  subscriptionStatusHint: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 6,
  },
  planCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  planCardRecommended: {
    borderWidth: 1,
    borderColor: '#FF91BD',
  },
  planCardCurrent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  planBadge: {
    backgroundColor: '#FF5D9D',
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
  },
  planPrice: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
  },
  planFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planFeatureText: {
    color: 'rgba(255,255,255,0.85)',
  },
  planButton: {
    marginTop: 8,
  },
});

export default SettingsModal;

