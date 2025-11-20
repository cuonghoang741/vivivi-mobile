import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { PersistKeys } from '../config/supabase';

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

export const OnboardingScreen: React.FC<Props> = ({
  isLoading,
  errorMessage,
  onSignInWithApple,
  onSignInWithGoogle,
  onOpenLegal,
}) => {
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
        await Linking.openURL(link);
      } catch (error) {
        console.warn('[Onboarding] Could not open legal link', error);
      }
    },
    [onOpenLegal]
  );

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
      console.error('[Onboarding] Failed to persist age verification', error);
    }
  }, [onSignInWithApple, onSignInWithGoogle, pendingProvider]);

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

  const heroSource = useMemo(() => {
    try {
      return require('../../assets/icon.png');
    } catch {
      return undefined;
    }
  }, []);

  return (
    <LinearGradient colors={['#09021C', '#1F1144']} style={styles.container}>
      <View style={styles.blurLayer} />
      <View style={styles.content}>
        <View style={styles.logoBlock}>
          {heroSource ? (
            <Image source={heroSource} style={styles.logo} resizeMode="contain" />
          ) : (
            <Text style={styles.logoFallback}>V</Text>
          )}
          <Text style={styles.title}>VIVIVI</Text>
          <Text style={styles.subtitle}>AI Digital Girlfriend</Text>
        </View>

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <View style={styles.buttonArea}>
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={disableAuthButtons}
            style={[styles.appleButton, disableAuthButtons && styles.buttonDisabled]}
            onPress={handleApplePress}
          >
            {showAppleSpinner ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.appleIcon}></Text>
                <Text style={styles.appleLabel}>Sign in with Apple</Text>
              </>
            )}
          </TouchableOpacity>
          {onSignInWithGoogle ? (
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
                  <View style={styles.googleIconBadge}>
                    <Text style={styles.googleIcon}>G</Text>
                  </View>
                  <Text style={styles.googleLabel}>Sign in with Google</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.legalBlock}>
          <Text style={styles.legalHint}>By signing in, you agree to our</Text>
          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => handleLegalPress('terms')}>
              <Text style={styles.legalLink}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>,</Text>
            <TouchableOpacity onPress={() => handleLegalPress('privacy')}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>, and</Text>
            <TouchableOpacity onPress={() => handleLegalPress('eula')}>
              <Text style={styles.legalLink}>EULA</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal animationType="fade" transparent visible={showAgePrompt}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adults only</Text>
            <Text style={styles.modalBody}>
              You must be at least 18 years old to use this experience. Please confirm your age to continue with Sign in
              with {pendingProviderLabel}.
            </Text>
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
              <View style={styles.modalActionsSpacer} />
              <Pressable onPress={handleAgeConfirmation} style={styles.modalPrimary}>
                <Text style={styles.modalPrimaryLabel}>I am 18+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05030D',
    justifyContent: 'center',
  },
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  logoFallback: {
    fontSize: 72,
    color: '#fff',
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  error: {
    color: '#FF6B81',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonArea: {
    width: '100%',
    marginBottom: 32,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  appleIcon: {
    fontSize: Platform.OS === 'ios' ? 24 : 20,
    color: '#fff',
    marginRight: 8,
  },
  appleLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginTop: 12,
  },
  googleIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    fontWeight: '700',
    color: '#4285F4',
  },
  googleLabel: {
    fontSize: 16,
    color: '#05030D',
    fontWeight: '600',
  },
  legalBlock: {
    alignItems: 'center',
  },
  legalHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  legalLink: {
    color: '#fff',
    fontSize: 12,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  legalSeparator: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginHorizontal: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    backgroundColor: '#0F0B1F',
  },
  modalTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 12,
  },
  modalBody: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalActionsSpacer: {
    width: 12,
  },
  modalSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalSecondaryLabel: {
    color: '#fff',
    fontSize: 14,
  },
  modalPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  modalPrimaryLabel: {
    color: '#05030D',
    fontWeight: '600',
    fontSize: 14,
  },
});


