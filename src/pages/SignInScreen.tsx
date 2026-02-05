import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { PersistKeys } from '../config/supabase';
import { PreviewVRM } from '../components/commons/PreviewVRM';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Icons (imported as React components via react-native-svg-transformer)
import AppleIcon from '../assets/icons/apple.svg';
import GoogleIcon from '../assets/icons/google.svg';

type LegalDocument = 'terms' | 'privacy' | 'eula';

type Props = {
  isLoading: boolean;
  errorMessage?: string | null;
  onSignInWithApple: () => void;
  onSignInWithGoogle?: () => void;
  onOpenLegal?: (doc: LegalDocument) => void;
};

const LEGAL_LINKS: Record<LegalDocument, string> = {
  terms: 'https://example.com/terms',
  privacy: 'https://example.com/privacy',
  eula: 'https://example.com/eula',
};

export const SignInScreen: React.FC<Props> = ({
  isLoading,
  errorMessage,
  onSignInWithApple,
  onSignInWithGoogle,
  onOpenLegal,
}) => {
  const insets = useSafeAreaInsets();
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [checkingAge, setCheckingAge] = useState(true);
  const [showAgePrompt, setShowAgePrompt] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<'apple' | 'google' | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadAgeFlag = async () => {
      try {
        const value = await AsyncStorage.getItem(PersistKeys.ageVerified18);
        if (isMounted) {
          setIsAgeVerified(value === 'true');
        }
      } finally {
        if (isMounted) {
          setCheckingAge(false);
        }
      }
    };
    loadAgeFlag();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !showAgePrompt) {
      setPendingProvider(null);
    }
  }, [isLoading, showAgePrompt]);

  const triggerProvider = useCallback(
    (provider: 'apple' | 'google') => {
      if (provider === 'google' && !onSignInWithGoogle) {
        return;
      }

      if (checkingAge) {
        return;
      }

      setPendingProvider(provider);

      if (isAgeVerified) {
        if (provider === 'apple') {
          onSignInWithApple();
        } else {
          onSignInWithGoogle?.();
        }
      } else {
        setShowAgePrompt(true);
      }
    },
    [checkingAge, isAgeVerified, onSignInWithApple, onSignInWithGoogle]
  );

  const handleAgeConfirmation = useCallback(async () => {
    try {
      await AsyncStorage.setItem(PersistKeys.ageVerified18, 'true');
      setIsAgeVerified(true);
      setShowAgePrompt(false);
      const provider = pendingProvider ?? 'apple';
      if (provider === 'apple') {
        onSignInWithApple();
      } else {
        onSignInWithGoogle?.() ?? onSignInWithApple();
      }
    } catch (error) {
      console.error('[SignIn] Failed to persist age verification', error);
    }
  }, [onSignInWithApple, onSignInWithGoogle, pendingProvider]);

  const handleLegalPress = useCallback(
    async (doc: LegalDocument) => {
      if (onOpenLegal) {
        onOpenLegal(doc);
        return;
      }
      const link = LEGAL_LINKS[doc];
      if (!link) {
        return;
      }
      try {
        await WebBrowser.openBrowserAsync(link);
      } catch (error) {
        console.warn('[SignIn] Could not open legal link', error);
        try {
          await Linking.openURL(link);
        } catch (linkingError) {
          console.warn('[SignIn] Linking fallback failed', linkingError);
        }
      }
    },
    [onOpenLegal]
  );

  const handleApplePress = useCallback(() => {
    triggerProvider('apple');
  }, [triggerProvider]);

  const handleGooglePress = useCallback(() => {
    triggerProvider('google');
  }, [triggerProvider]);

  const pendingProviderLabel = pendingProvider === 'google' ? 'Google' : 'Apple';
  const showAppleSpinner = isLoading && (pendingProvider ?? 'apple') === 'apple';
  const showGoogleSpinner = isLoading && pendingProvider === 'google';
  const disableAuthButtons = isLoading || checkingAge;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* VRM Preview with character switching and action buttons */}
      <PreviewVRM
        showActionButtons={true}
        showNavigation={true}
      />

      {/* Bottom content overlay */}
      <View style={styles.contentOverlay} pointerEvents="box-none">
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={
            <LinearGradient
              colors={['transparent', '#000']}
              locations={[0, 0.3]}
              style={StyleSheet.absoluteFill}
            />
          }
        >
          <BlurView
            intensity={80}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        </MaskedView>

        <View
          style={[styles.contentSection, { paddingBottom: insets.bottom }]}
        >
          <View style={styles.logoStack}>
            <View style={styles.logoTextBlock}>
              <Text style={styles.title}>Welcome</Text>
              {/* <Text style={styles.subtitle}>Your exclusive experience awaits</Text> */}
            </View>
          </View>

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.buttonArea}>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={disableAuthButtons}
                style={[styles.appleButton, disableAuthButtons && styles.buttonDisabled]}
                onPress={handleApplePress}
              >
                {showAppleSpinner ? (
                  <ActivityIndicator color="#05030D" />
                ) : (
                  <>
                    <AppleIcon width={24} height={24} style={styles.buttonIcon} />
                    <Text style={styles.appleLabel}>Sign in with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {onSignInWithGoogle && (Platform.OS !== 'ios' || __DEV__) ? (
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={disableAuthButtons}
                style={[styles.googleButton, disableAuthButtons && styles.buttonDisabled]}
                onPress={handleGooglePress}
              >
                {showGoogleSpinner ? (
                  <ActivityIndicator color="#05030D" />
                ) : (
                  <>
                    <GoogleIcon width={24} height={24} style={styles.buttonIcon} />
                    <Text style={styles.googleLabel}>Sign in with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Legal text moved to age verification modal */}
        </View>
      </View>

      {/* Age verification modal */}
      <Modal animationType="fade" transparent visible={showAgePrompt}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Age Verification Required</Text>
            <Text style={[styles.modalBody, { marginBottom: 16 }]}>
              Access is restricted to adults only. Please confirm your eligibility to proceed with {pendingProviderLabel} sign-in.
            </Text>

            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20, textAlign: 'left' }}>
                By continuing, you agree to our{' '}
                <Text onPress={() => handleLegalPress('terms')} style={{ color: '#fff', textDecorationLine: 'underline', fontWeight: '600' }}>Terms of Service</Text>,{' '}
                <Text onPress={() => handleLegalPress('privacy')} style={{ color: '#fff', textDecorationLine: 'underline', fontWeight: '600' }}>Privacy Policy</Text>, and{' '}
                <Text onPress={() => handleLegalPress('eula')} style={{ color: '#fff', textDecorationLine: 'underline', fontWeight: '600' }}>EULA</Text>.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setShowAgePrompt(false);
                  setPendingProvider(null);
                }}
                style={styles.modalSecondary}
              >
                <Text style={styles.modalSecondaryLabel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleAgeConfirmation} style={styles.modalPrimary}>
                <Text style={styles.modalPrimaryLabel}>Confirm I'm 18+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0014',
  },
  contentOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientOverlay: {
    position: 'absolute',
    top: -100, // Move it up to fade in before the blur starts
    left: 0,
    right: 0,
    height: 100, // Height of the fade area above the blur
    zIndex: 0,
  },
  contentSection: {
    // backgroundColor: '#000', // Replaced with BlurView
    paddingHorizontal: 28,
    paddingTop: 32, // Add some top padding inside the blur
    justifyContent: 'flex-end',
    gap: 24,
  },
  logoStack: {
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  logoTextBlock: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  error: {
    color: '#FF6B81',
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonArea: {
    width: '100%',
    gap: 14,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: 12,
  },
  appleLabel: {
    fontSize: 17,
    color: '#05030D',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  googleLabel: {
    fontSize: 17,
    color: '#05030D',
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    padding: 28,
    backgroundColor: 'rgba(15,11,31,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  modalBody: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalActionsSpacer: {
    width: 12,
  },
  modalSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalSecondaryLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modalPrimaryLabel: {
    color: '#FF416C',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
