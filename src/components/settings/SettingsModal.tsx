import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { authManager } from '../../services/AuthManager';
import Button from '../Button';
import { EditProfileView } from './EditProfileView';

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

const LEGAL_URLS = {
  terms: 'https://vivivi.ai/terms',
  privacy: 'https://vivivi.ai/privacy',
};

export const SettingsModal: React.FC<Props> = ({ visible, onClose, email, displayName }) => {
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>(TOGGLE_DEFAULTS);
  const [isSaving, setIsSaving] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState<'problem' | 'feature' | null>(null);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const entries = await Promise.all(
        Object.keys(TOGGLE_DEFAULTS).map(async key => {
          const stored = await AsyncStorage.getItem(key);
          return [key, stored === null ? TOGGLE_DEFAULTS[key as ToggleKey] : stored === 'true'] as const;
        })
      );
      setToggles(Object.fromEntries(entries) as Record<ToggleKey, boolean>);
    })();
  }, [visible]);

  const handleToggle = useCallback(
    async (key: ToggleKey, value: boolean) => {
      setToggles(prev => ({ ...prev, [key]: value }));
      await AsyncStorage.setItem(key, value ? 'true' : 'false');
      if (key === 'settings.hapticsEnabled' && value) {
        Haptics.selectionAsync().catch(() => {});
      }
    },
    []
  );

  const displayNameComputed = useMemo(() => {
    if (displayName && displayName.trim().length > 0) {
      return displayName;
    }
    if (email) {
      const emailPart = email.split('@')[0];
      return emailPart || 'User';
    }
    return 'User';
  }, [displayName, email]);

  const avatarLetter = useMemo(() => {
    return displayNameComputed.charAt(0).toUpperCase();
  }, [displayNameComputed]);

  const handleLogout = useCallback(async () => {
    try {
      setIsSaving(true);
      await authManager.logout();
      onClose();
    } catch (error: any) {
      Alert.alert('Sign Out Failed', error?.message ?? 'Please try again');
    } finally {
      setIsSaving(false);
    }
  }, [onClose]);

  const handleOpenURL = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('Failed to open URL:', url, error);
    }
  }, []);

  const versionLabel = `VERSION ${Constants.expoConfig?.version ?? '1.0.0'}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Button variant="ghost" isIconOnly startIconName="close" onPress={onClose} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Profile Card */}
          <TouchableOpacity
            style={styles.profileCard}
            onPress={() => setShowEditProfile(true)}
            activeOpacity={0.7}
          >
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>{avatarLetter}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayNameComputed}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>
                {email || ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          {/* Subscription Card */}
          <View style={styles.subscriptionCard}>
            <Text style={styles.subscriptionTitle}>Subscription</Text>
            <View style={styles.subscriptionContent}>
              <View style={styles.subscriptionTextGroup}>
                <Text style={styles.subscriptionTier}>Free Tier</Text>
                <Text style={styles.subscriptionStatus}>Upgrade to unlock premium content</Text>
              </View>
              <Button
                variant="solid"
                color="primary"
                size="sm"
                onPress={() => setShowSubscription(true)}
              >
                Upgrade
              </Button>
            </View>
          </View>

          {/* Preferences Section */}
          <SettingsGroup title="Preferences">
            <ToggleRow
              icon="iphone-outline"
              title="Haptics"
              value={toggles['settings.hapticsEnabled']}
              onValueChange={value => handleToggle('settings.hapticsEnabled', value)}
            />
            <ToggleRow
              icon="musical-notes-outline"
              title="Auto play music"
              value={toggles['settings.autoPlayMusic']}
              onValueChange={value => handleToggle('settings.autoPlayMusic', value)}
            />
            <ToggleRow
              icon="waveform-outline"
              title="Auto enter talking mode"
              value={toggles['settings.autoEnterTalking']}
              onValueChange={value => handleToggle('settings.autoEnterTalking', value)}
            />
          </SettingsGroup>

          {/* Parental Section */}
          <SettingsGroup title="">
            <ToggleRow
              icon="warning-outline"
              title="Enable NSFW"
              value={toggles['settings.enableNSFW']}
              onValueChange={value => handleToggle('settings.enableNSFW', value)}
            />
          </SettingsGroup>

          {/* Data & Information Section */}
          <SettingsGroup title="Data & Information">
            <NavigationRow
              icon="cart-outline"
              title="Purchase History"
              onPress={() => setShowPurchaseHistory(true)}
            />
          </SettingsGroup>

          {/* Legal Section */}
          <SettingsGroup title="">
            <NavigationRow
              icon="document-text-outline"
              title="Terms of Service"
              onPress={() => handleOpenURL(LEGAL_URLS.terms)}
            />
            <NavigationRow
              icon="lock-closed-outline"
              title="Privacy Policy"
              onPress={() => handleOpenURL(LEGAL_URLS.privacy)}
            />
          </SettingsGroup>

          {/* Support Section */}
          <SettingsGroup title="">
            <NavigationRow
              icon="bug-outline"
              title="Report a Problem"
              onPress={() => setShowFeedbackForm('problem')}
            />
            <NavigationRow
              icon="star-outline"
              title="Feature Request"
              onPress={() => setShowFeedbackForm('feature')}
            />
          </SettingsGroup>

          {/* Sign Out Button */}
          <View style={styles.signOutButtonContainer}>
            <Button
              variant="outline"
              color="error"
              fullWidth
              onPress={handleLogout}
              loading={isSaving}
              startIconName="arrowshape-turn-up-left-outline"
            >
              Sign Out
            </Button>
          </View>

          {/* Version Footer */}
          <Text style={styles.versionText}>{versionLabel}</Text>
        </ScrollView>
      </SafeAreaView>

      {/* Edit Profile Modal */}
      <EditProfileView
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        email={email}
        displayName={displayName}
      />

      {showSubscription && (
        <Modal visible={showSubscription} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Subscription</Text>
              <Button variant="ghost" isIconOnly startIconName="close" onPress={() => setShowSubscription(false)} />
            </View>
            <View style={styles.centeredContent}>
              <Text style={styles.centeredText}>Subscription Management - Coming Soon</Text>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {showPurchaseHistory && (
        <Modal visible={showPurchaseHistory} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Purchase History</Text>
              <Button variant="ghost" isIconOnly startIconName="close" onPress={() => setShowPurchaseHistory(false)} />
            </View>
            <View style={styles.centeredContent}>
              <Text style={styles.centeredText}>Purchase History - Coming Soon</Text>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {showFeedbackForm && (
        <Modal visible={!!showFeedbackForm} animationType="slide" presentationStyle="pageSheet">
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {showFeedbackForm === 'problem' ? 'Report a Problem' : 'Feature Request'}
              </Text>
              <Button variant="ghost" isIconOnly startIconName="close" onPress={() => setShowFeedbackForm(null)} />
            </View>
            <View style={styles.centeredContent}>
              <Text style={styles.centeredText}>
                {showFeedbackForm === 'problem' ? 'Report a Problem' : 'Feature Request'} - Coming Soon
              </Text>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </Modal>
  );
};

const SettingsGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.settingsGroup}>
    {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
    <View style={styles.groupContent}>{children}</View>
  </View>
);

const ToggleRow: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}> = ({ icon, title, value, onValueChange }) => (
  <View style={styles.rowContainer}>
    <View style={styles.rowContent}>
      <Ionicons name={icon} size={20} color="#fff" style={styles.rowIcon} />
      <Text style={styles.rowText}>{title}</Text>
      <View style={styles.toggleWrapper}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#FF5D9D' }}
          thumbColor="#fff"
        />
      </View>
    </View>
  </View>
);

const NavigationRow: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
}> = ({ icon, title, onPress }) => (
  <TouchableOpacity onPress={onPress} style={styles.rowContainer} activeOpacity={0.7}>
    <View style={styles.rowContent}>
      <Ionicons name={icon} size={20} color="#fff" style={styles.rowIcon} />
      <Text style={styles.rowText}>{title}</Text>
      <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '500',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileEmail: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 2,
  },
  subscriptionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  subscriptionTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subscriptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,145,189,0.8)',
    borderRadius: 12,
    padding: 12,
  },
  subscriptionTextGroup: {
    flex: 1,
    marginRight: 10,
  },
  subscriptionTier: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subscriptionStatus: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: 2,
  },
  settingsGroup: {
    marginBottom: 12,
  },
  groupTitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 18,
    fontWeight: '600',
    paddingLeft: 4,
    marginBottom: 10,
  },
  groupContent: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  rowContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowIcon: {
    width: 22,
    marginRight: 14,
  },
  rowText: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
  },
  toggleWrapper: {
    marginLeft: 'auto',
  },
  signOutButtonContainer: {
    marginTop: 12,
    marginBottom: 20,
  },
  versionText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: 20,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centeredText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
  },
});

export default SettingsModal;
