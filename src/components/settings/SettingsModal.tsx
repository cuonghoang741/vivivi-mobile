import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { authManager } from '../../services/AuthManager';
import Button from '../Button';
import { getSupabaseClient } from '../../services/supabase';
import { getAuthIdentifier } from '../../services/authIdentifier';
import { BottomSheet, BottomSheetRef } from '../BottomSheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  email?: string | null;
  displayName?: string | null;
  onOpenSubscription?: () => void;
  isPro?: boolean;
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

type SubscriptionTier = 'free' | 'pro';
const SUBSCRIPTION_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  pro: 'Premium',
};



type FeedbackKind = 'problem' | 'feature';

type SettingsScreen =
  | { key: 'root' }
  | { key: 'editProfile' }
  | { key: 'purchaseHistory' }
  | { key: 'feedback'; kind: FeedbackKind };

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

type SubscriptionInfo = {
  tier: SubscriptionTier;
  current_period_end?: string | null;
  plan?: string | null;
};

// --- New UI Components ---

const ProfileCard: React.FC<{
  displayName: string;
  email: string;
  avatarLetter: string;
  tier: SubscriptionTier;
  onPress: () => void;
}> = ({ displayName, email, avatarLetter, tier, onPress }) => (
  <Pressable
    style={({ pressed }) => [styles.profileCard, pressed && styles.pressedCard]}
    onPress={onPress}
  >
    <View style={styles.avatarContainer}>
      <Text style={styles.avatarText}>{avatarLetter}</Text>
    </View>
    <View style={styles.profileInfo}>
      <View style={styles.nameRow}>
        <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
        <View style={[styles.tierBadge, tier === 'pro' && styles.tierBadgePro]}>
          <Text style={[styles.tierBadgeText, tier === 'pro' && styles.tierBadgeTextPro]}>{SUBSCRIPTION_LABELS[tier]}</Text>
        </View>
      </View>
      <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
  </Pressable>
);

const PremiumBanner: React.FC<{
  onPress: () => void;
  tier: SubscriptionTier;
  subscriptionInfo?: SubscriptionInfo | null;
}> = ({ onPress, tier, subscriptionInfo }) => {
  if (tier === 'pro') {
    const formatDate = (dateString?: string | null) => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return '';
      }
    };

    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.8 }}>
        <LinearGradient
          colors={['#FF4081', '#F50057']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.premiumBanner}
        >
          <View style={styles.premiumContent}>
            <View style={styles.premiumHeader}>
              <Text style={styles.premiumTitle}>Roxie</Text>
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            </View>

            <View style={styles.subscriptionDetails}>
              <Text style={styles.subscriptionPrice}>
                {(subscriptionInfo?.plan?.toLowerCase().includes('year') || subscriptionInfo?.plan === 'annual')
                  ? '1,599,000đ/year'
                  : '149,000đ/month'}
              </Text>
              {subscriptionInfo?.current_period_end && (
                <Text style={styles.subscriptionDate}>
                  Next billing {formatDate(subscriptionInfo.current_period_end)}
                </Text>
              )}
              {!subscriptionInfo?.current_period_end && (
                <Text style={styles.subscriptionDate}>
                  Subscription Active
                </Text>
              )}
            </View>
          </View>
          <View style={styles.premiumIconContainer}>
            <Ionicons name="diamond" size={80} color="rgba(255,255,255,0.4)" />
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.8 }}>
      <LinearGradient
        colors={['#FF5D9D', '#FF2D79']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.premiumBanner}
      >
        <View style={styles.premiumContent}>
          <View style={styles.premiumHeader}>
            <Text style={styles.premiumTitle}>Roxie</Text>
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>Premium</Text>
            </View>
          </View>
          <Text style={styles.premiumDescription}>
            Unlock unlimited content and premium features.
          </Text>
          <View style={styles.premiumButton}>
            <Text style={styles.premiumButtonText}>Unlock Premium</Text>
          </View>
        </View>
        <View style={styles.premiumIconContainer}>
          <Ionicons name="diamond" size={64} color="rgba(255,255,255,0.3)" />
        </View>
      </LinearGradient>
    </Pressable>
  );
};

const SettingsGroup: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.groupContainer}>
    {title && <Text style={styles.groupTitle}>{title}</Text>}
    <View style={styles.groupContent}>
      {children}
    </View>
  </View>
);

const SettingsRow: React.FC<{
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
  destructive?: boolean;
}> = ({ icon, label, rightElement, onPress, isLast, destructive }) => (
  <Pressable
    style={({ pressed }) => [styles.rowContainer, pressed && onPress && styles.pressedRow]}
    onPress={onPress}
    disabled={!onPress}
  >
    {icon && (
      <View style={styles.rowIconContainer}>
        <Ionicons name={icon} size={20} color={destructive ? '#FF453A' : '#fff'} />
      </View>
    )}
    <View style={[styles.rowContent, isLast && styles.rowContentNoBorder]}>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      {rightElement ?? (onPress && <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />)}
    </View>
  </Pressable>
);

// --- Main Component ---

export const SettingsModal: React.FC<Props> = ({ visible, onClose, email, displayName, onOpenSubscription, isPro = false }) => {
  const { height } = useWindowDimensions();
  const bottomSheetRef = useRef<BottomSheetRef>(null);
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(TOGGLE_DEFAULTS);
  const [authState, setAuthState] = useState<AuthState>(() => ({
    user: authManager.user
      ? { id: authManager.user.id, email: authManager.user.email ?? null, user_metadata: authManager.user.user_metadata }
      : null,
    isDeletingAccount: authManager.isDeletingAccount,
  }));
  // If isPro prop is passed as true, default to 'pro', otherwise 'free'
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>(isPro ? 'pro' : 'free');
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [screenStack, setScreenStack] = useState<SettingsScreen[]>([{ key: 'root' }]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const currentScreen = screenStack[screenStack.length - 1];
  const isRootScreen = currentScreen?.key === 'root';

  useEffect(() => {
    const unsubscribe = authManager.subscribe(() => {
      setAuthState({
        user: authManager.user
          ? { id: authManager.user.id, email: authManager.user.email ?? null, user_metadata: authManager.user.user_metadata }
          : null,
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

  const normalizeTier = (tier?: string | null): SubscriptionTier => {
    const t = tier?.toLowerCase().trim();
    if (t === 'pro' || t === 'premium') return 'pro';
    return 'free';
  };

  const loadSubscriptionTier = useCallback(async () => {
    try {
      // If props say isPro is true, we trust it for UI status, but we might still want details
      if (isPro) {
        setSubscriptionTier('pro');
      }

      const cached = await AsyncStorage.getItem('subscription.tier');

      const userId = authManager.user?.id?.toLowerCase();
      if (!userId) {
        if (!isPro) setSubscriptionTier('free');
        setSubscriptionInfo(null);
        return;
      }

      const { data, error } = await getSupabaseClient()
        .from('subscriptions')
        .select('tier, current_period_end, plan')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ tier?: string | null; current_period_end?: string | null; plan?: string | null }>();

      if (!error && data?.tier) {
        // Normalized tier from DB
        const dbTier = normalizeTier(data.tier);
        // If DB says pro, or prop says pro, we are pro
        const finalTier = (isPro || dbTier === 'pro') ? 'pro' : 'free';
        setSubscriptionTier(finalTier);
        setSubscriptionInfo({
          tier: finalTier,
          current_period_end: data.current_period_end,
          plan: data.plan
        });
      } else {
        // failed to fetch or no sub in DB
        // fallback to props
        setSubscriptionTier(isPro ? 'pro' : 'free');
        setSubscriptionInfo(null);
      }
    } catch {
      setSubscriptionTier(isPro ? 'pro' : 'free');
      setSubscriptionInfo(null);
    }
  }, [isPro]);

  useEffect(() => {
    if (visible) {
      loadToggles();
      loadSubscriptionTier();
    } else {
      // Sync props when hidden just in case
      setSubscriptionTier(isPro ? 'pro' : 'free');
      // Reset stack when hidden (with slight delay to avoid flicker during closing animation)
      const t = setTimeout(() => setScreenStack([{ key: 'root' }]), 500);
      return () => clearTimeout(t);
    }
  }, [visible, loadToggles, loadSubscriptionTier, isPro]);

  const handleToggle = useCallback(async (key: ToggleKey, value: boolean) => {
    setToggles(prev => ({ ...prev, [key]: value }));
    await AsyncStorage.setItem(key, value ? 'true' : 'false');
    if (key === 'settings.hapticsEnabled' && value) {
      Haptics.selectionAsync().catch(() => { });
    }
    if (key === 'settings.autoPlayMusic') {
      const { backgroundMusicManager } = await import('../../services/BackgroundMusicManager');
      value ? await backgroundMusicManager.play() : await backgroundMusicManager.pause();
    }
  }, []);

  const pushScreen = useCallback((screen: SettingsScreen) => setScreenStack(prev => [...prev, screen]), []);
  const popScreen = useCallback(() => setScreenStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev)), []);
  const resetToRoot = useCallback(() => setScreenStack([{ key: 'root' }]), []);

  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true);
      await authManager.logout();
      onClose();
    } catch (error: any) {
      Alert.alert('Sign out failed', error?.message);
    } finally {
      setIsLoggingOut(false);
    }
  }, [onClose]);

  // Derived Values
  const resolvedDisplayName = useMemo(() => {
    const metaName = (authState.user?.user_metadata?.display_name as string) ?? displayName ?? '';
    if (metaName.trim()) return metaName;
    const fallback = authState.user?.email ?? email ?? '';
    return fallback.includes('@') ? fallback.split('@')[0] : 'User';
  }, [authState.user, displayName, email]);

  const avatarLetter = resolvedDisplayName.charAt(0).toUpperCase() || '?';
  const resolvedEmail = authState.user?.email ?? email ?? 'No email';
  const versionLabel = `Version ${Constants.expoConfig?.version ?? '1.0.0'} `;

  const renderContent = () => {
    switch (currentScreen.key) {
      case 'root':
        return (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.sectionSpacing}>
              <ProfileCard
                displayName={resolvedDisplayName}
                email={resolvedEmail}
                avatarLetter={avatarLetter}
                tier={subscriptionTier}
                onPress={() => pushScreen({ key: 'editProfile' })}
              />
            </View>

            <View style={styles.sectionSpacing}>
              <PremiumBanner
                tier={subscriptionTier}
                subscriptionInfo={subscriptionInfo}
                onPress={() => {
                  onClose();
                  setTimeout(() => onOpenSubscription?.(), 300);
                }}
              />
            </View>

            <SettingsGroup title="Your Account">
              <SettingsRow
                icon="card-outline"
                label="My Subscription"
                onPress={() => {
                  if (subscriptionTier === 'free') {
                    onClose();
                    setTimeout(() => onOpenSubscription?.(), 300);
                  } else {
                    pushScreen({ key: 'purchaseHistory' });
                  }
                }}
              />
              <SettingsRow
                icon="notifications-outline"
                label="Notifications"
                isLast
                rightElement={<Switch value={true} disabled />} // Placeholder as requested
              />
            </SettingsGroup>

            <SettingsGroup title="Preferences">
              <SettingsRow
                icon="musical-notes-outline"
                label="Auto-play Music"
                rightElement={
                  <Switch
                    value={toggles['settings.autoPlayMusic']}
                    onValueChange={(v) => handleToggle('settings.autoPlayMusic', v)}
                  />
                }
              />
              <SettingsRow
                icon="finger-print-outline"
                label="Haptics"
                rightElement={
                  <Switch
                    value={toggles['settings.hapticsEnabled']}
                    onValueChange={(v) => handleToggle('settings.hapticsEnabled', v)}
                  />
                }
              />
              <SettingsRow
                icon="alert-circle-outline"
                label="NSFW Content"
                isLast
                rightElement={
                  <Switch
                    value={toggles['settings.enableNSFW']}
                    onValueChange={(v) => handleToggle('settings.enableNSFW', v)}
                  />
                }
              />
            </SettingsGroup>

            <SettingsGroup title="Legal & Support">
              <SettingsRow
                icon="document-text-outline"
                label="Terms of Service"
                onPress={() => WebBrowser.openBrowserAsync('https://roxie-terms-privacy-hub.lovable.app/terms')}
              />
              <SettingsRow
                icon="shield-checkmark-outline"
                label="Privacy Policy"
                onPress={() => WebBrowser.openBrowserAsync('https://roxie-terms-privacy-hub.lovable.app/privacy')}
              />
              <SettingsRow
                icon="bug-outline"
                label="Report a problem"
                onPress={() => pushScreen({ key: 'feedback', kind: 'problem' })}
                isLast
              />
            </SettingsGroup>

            <SettingsGroup>
              <SettingsRow
                icon="log-out-outline"
                label={isLoggingOut ? "Signing out..." : "Sign Out"}
                onPress={handleLogout}
                destructive
                isLast
              />
            </SettingsGroup>

            <Text style={styles.versionText}>{versionLabel}</Text>
          </ScrollView>
        );

      case 'editProfile':
        return (
          <EditProfileScreen
            user={authState.user}
            isDeleting={authState.isDeletingAccount}
            onDone={popScreen}
            onAccountDeleted={onClose}
          />
        );
      case 'purchaseHistory':
        return <SubscriptionHistoryScreen />;
      case 'feedback':
        return <FeedbackFormScreen kind={currentScreen.kind} onSubmitted={popScreen} />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (currentScreen.key) {
      case 'root': return 'Settings'; // No title in root to save space
      case 'editProfile': return 'Personal Information';
      case 'purchaseHistory': return 'History';
      case 'feedback': return currentScreen.kind === 'problem' ? 'Report Bug' : 'Feature Request';
      default: return 'Settings';
    }
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      isOpened={visible}
      onIsOpenedChange={(opened) => !opened && onClose()}
      isDarkBackground={true}
      backgroundColor={"black"}
      detents={['large']}
      title={getTitle()}
      backgroundBlur='system-thick-material-dark'
      headerLeft={!isRootScreen ? (
        <Pressable onPress={popScreen} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
      ) : undefined}
    >
      <View style={[styles.container, { maxHeight: height }]}>
        {renderContent()}
      </View>
    </BottomSheet>
  );
};

// --- Sub-Screens (Simplified for length) ---

const EditProfileScreen: React.FC<{
  user: UserMetadata | null;
  isDeleting: boolean;
  onDone: () => void;
  onAccountDeleted: () => void;
}> = ({ user, isDeleting, onDone, onAccountDeleted }) => {
  const [name, setName] = useState((user?.user_metadata?.display_name as string) ?? '');
  const [isSaving, setIsSaving] = useState(false);

  // Autosave name changes
  useEffect(() => {
    const currentName = (user?.user_metadata?.display_name as string) ?? '';
    // Only save if name has changed and is not empty
    if (name === currentName || !name.trim()) return;

    const timer = setTimeout(async () => {
      setIsSaving(true);
      try {
        await authManager.updateDisplayName(name.trim());
      } catch (e) {
        console.error('Autosave failed:', e);
      } finally {
        setIsSaving(false);
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(timer);
  }, [name, user]);

  const getAvatarLetter = () => {
    return (name || user?.email || '?').charAt(0).toUpperCase();
  };

  return (
    <ScrollView contentContainerStyle={styles.subScreenContent} showsVerticalScrollIndicator={false}>
      <View style={styles.editProfileHeader}>
        <View style={styles.largeAvatarContainer}>
          <Text style={styles.largeAvatarText}>{getAvatarLetter()}</Text>
          {/* <View style={styles.cameraIconBadge}>
            <Ionicons name="camera" size={14} color="#000" />
          </View> */}
        </View>
      </View>

      <View style={styles.formGroup}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.formLabel}>Name</Text>
          {isSaving && <ActivityIndicator size="small" color="#666" />}
        </View>
        <TextInput
          style={styles.formInput}
          value={name}
          onChangeText={setName}
          placeholder="Your Name"
          placeholderTextColor="#666"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Email</Text>
        <TextInput
          style={[styles.formInput, styles.disabledInput]}
          value={user?.email || ''}
          editable={false}
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.deleteAccountButton, pressed && { opacity: 0.7 }]}
        onPress={() => {
          Alert.alert('Delete Account?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  // Pass onAccountDeleted as callback - it will run after deletion but before logout
                  await authManager.deleteAccountLocally(onAccountDeleted);
                } catch (e: any) {
                  console.error('Delete account error:', e);
                  Alert.alert('Error', e?.message || 'Failed to delete account');
                }
              }
            }
          ]);
        }}
        disabled={isDeleting}
      >
        <Text style={styles.deleteAccountText}>{isDeleting ? "Deleting..." : "Delete account"}</Text>
      </Pressable>
    </ScrollView>
  );
};


import { SubscriptionRepository, type Subscription } from '../../repositories/SubscriptionRepository';

const SubscriptionHistoryScreen: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const { userId } = await getAuthIdentifier();
        if (!userId) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        const repo = new SubscriptionRepository();
        const data = await repo.fetchSubscriptionHistory(userId);
        setSubscriptions(data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load subscriptions');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, []);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const getStatusColor = (status?: string | null) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'trialing':
        return '#4CAF50';
      case 'canceled':
      case 'cancelled':
        return '#FFC107'; // Amber
      case 'expired':
      case 'past_due':
      case 'unpaid':
        return '#FF453A';
      default:
        return '#999';
    }
  };

  if (loading) {
    return (
      <View style={styles.placeholderContainer}>
        <ActivityIndicator color="#fff" />
        <Text style={[styles.placeholderText, { marginTop: 12 }]}>Loading subscriptions...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.placeholderContainer}>
        <Text style={[styles.placeholderText, { color: '#FF453A' }]}>{error}</Text>
      </View>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>No subscription history</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.subScreenContent} showsVerticalScrollIndicator={false}>
      {subscriptions.map((sub) => {
        const statusColor = getStatusColor(sub.status);
        const planName = sub.plan ? sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1) : 'Unknown Plan';

        return (
          <View key={sub.id} style={styles.transactionRow}>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionType}>{planName}</Text>
              <Text style={styles.transactionDate}>
                {sub.current_period_end
                  ? `Expires: ${formatDate(sub.current_period_end)}`
                  : `Created: ${formatDate(sub.created_at)}`}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.transactionAmount, { color: statusColor, fontSize: 13 }]}>
                {sub.status?.toUpperCase() ?? 'UNKNOWN'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                {sub.tier === 'pro' ? 'Premium' : 'Free'}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};


const FeedbackFormScreen: React.FC<{ kind: FeedbackKind; onSubmitted: () => void }> = ({ kind, onSubmitted }) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  return (
    <View style={styles.subScreenContent}>
      <SettingsGroup title={kind === 'problem' ? "Describe the issue" : "Describe your idea"}>
        <TextInput
          multiline
          style={styles.textArea}
          value={text}
          onChangeText={setText}
          placeholder="Type here..."
          placeholderTextColor="#666"
        />
      </SettingsGroup>
      <View style={styles.actionButtonContainer}>
        <Button size="lg" fullWidth loading={submitting} onPress={async () => {
          if (!text.trim()) return;
          setSubmitting(true);
          // Simulate submission
          setTimeout(() => {
            setSubmitting(false);
            Alert.alert('Sent', 'Thank you for your feedback!');
            onSubmitted();
          }, 1000);
        }}>Send Feedback</Button>
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 50
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  subScreenContent: {
    padding: 16,
  },
  sectionSpacing: {
    marginBottom: 20,
  },
  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 16,
  },
  pressedCard: {
    opacity: 0.8,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00C8FF', // Cyan color from design
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginRight: 8,
    flexShrink: 1,
  },
  tierBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  tierBadgePro: {
    backgroundColor: '#fff',
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  tierBadgeTextPro: {
    color: '#000',
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  // Premium Banner
  premiumBanner: {
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
  },
  premiumContent: {
    flex: 1,
    zIndex: 1,
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  premiumTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginRight: 10,
  },
  premiumBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF2D79',
  },
  premiumDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 16,
    lineHeight: 20,
    maxWidth: '85%',
  },
  premiumButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignSelf: 'flex-start',
    width: '100%'
  },
  premiumButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center'
  },
  premiumIconContainer: {
    position: 'absolute',
    right: -10,
    bottom: -10,
    transform: [{ rotate: '-15deg' }],
  },
  activeBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginLeft: 'auto',
  },
  activeBadgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  subscriptionDetails: {
    marginTop: 24,
  },
  subscriptionPrice: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  subscriptionDate: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  // Settings Groups
  groupContainer: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
    marginLeft: 16,
    textTransform: 'uppercase',
  },
  groupContent: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    minHeight: 52,
  },
  pressedRow: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    opacity: 0.7,
  },
  rowIconContainer: {
    marginRight: 12,
    width: 24,
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    height: '100%',
    paddingVertical: 14,
  },
  rowContentNoBorder: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  rowLabelDestructive: {
    color: '#FF453A',
  },
  versionText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    marginTop: 8,
  },
  // Sub-screens
  editProfileHeader: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  largeAvatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3A3A3C', // Darker circle background
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 8,
  },
  largeAvatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
  },
  disabledInput: {
    opacity: 0.7,
    color: 'rgba(255,255,255,0.6)',
  },
  actionButtonContainer: {
    marginTop: 24,
  },
  deleteAccountButton: {
    marginTop: 10,
    alignItems: 'center',
    padding: 16,
  },
  deleteAccountText: {
    color: '#FF453A',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderContainer: {
    padding: 40,
    alignItems: 'center',
  },
  placeholderText: {
    color: '#666',
  },
  legalText: {
    color: '#ccc',
    lineHeight: 22,
  },
  textArea: {
    borderRadius: 12,
    color: '#fff',
    fontSize: 16,
    minHeight: 120,
    padding: 16,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionType: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  transactionAmount: {
    color: '#FF6EA1',
    fontSize: 16,
    fontWeight: '600',
  },
});
