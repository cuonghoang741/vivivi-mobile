import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { PersistKeys } from '../config/supabase';
import { VRMWebView } from '../components/VRMWebView';

// Default VRM model - using a model from the app's CDN
const DEFAULT_VRM_URL = 'https://n6n.top/Model/0001_01%202.vrm';
const DEFAULT_VRM_NAME = '0001_01 2.vrm';

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
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [checkingAge, setCheckingAge] = useState(true);
  const [showAgePrompt, setShowAgePrompt] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<'apple' | 'google' | null>(null);

  const webViewRef = useRef<WebView>(null);

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
        console.warn('[SignIn] Could not open legal link', error);
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
      console.error('[SignIn] Failed to persist age verification', error);
    }
  }, [onSignInWithApple, onSignInWithGoogle, pendingProvider]);

  const handleApplePress = useCallback(() => {
    triggerProvider('apple');
  }, [triggerProvider]);

  const handleGooglePress = useCallback(() => {
    triggerProvider('google');
  }, [triggerProvider]);

  // Prevent duplicate model loading
  const hasLoadedModelRef = useRef(false);

  const handleVRMMessage = useCallback((message: string) => {
    console.log('[SignInScreen] Received VRM message:', message);
    if (message === 'initialReady' && !hasLoadedModelRef.current) {
      hasLoadedModelRef.current = true;

      const escapedURL = DEFAULT_VRM_URL.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const escapedName = DEFAULT_VRM_NAME.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      // Use the updated default background
      const backgroundURL = 'https://d1j8r0kxyu9tj8.cloudfront.net/files/JAZHAJFvr2Lj8gtKb7cBPSnpPiQBPcNoG7tlEihj.jpg';

      const js = `
        // Set background image
        if (typeof window.setBackgroundImage === 'function') {
           window.setBackgroundImage("${backgroundURL}");
        } else {
           document.body.style.backgroundImage = 'url("${backgroundURL}")';
        }
        // Load VRM model
        if (typeof window.loadModelByURL === 'function') {
           window.loadModelByURL("${escapedURL}", "${escapedName}");
        }
        true;
      `;

      webViewRef.current?.injectJavaScript(js);
    }
  }, []);

  const pendingProviderLabel = pendingProvider === 'google' ? 'Google' : 'Apple';
  const showAppleSpinner = isLoading && (pendingProvider ?? 'apple') === 'apple';
  const showGoogleSpinner = isLoading && pendingProvider === 'google';
  const disableAuthButtons = isLoading || checkingAge;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* VRM WebView - 80% height */}
      <View style={styles.webViewSection}>
        <VRMWebView
          ref={webViewRef}
          onMessage={handleVRMMessage}
          enableDebug={false}
        />
      </View>

      {/* Content overlay - absolute positioned */}
      <View style={styles.contentOverlay} pointerEvents="box-none">
        {/* Gradient overlay at top of content that overlaps WebView */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)', '#000']}
          style={styles.gradientOverlay}
          pointerEvents="none"
        />

        {/* Content section */}
        <View style={styles.contentSection}>
          <View style={styles.logoStack}>
            <View style={styles.logoTextBlock}>
              <Text style={styles.title}>Welcome, Master!</Text>
              <Text style={styles.subtitle}>Just a few more taps until we can meet!</Text>
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
                    <GoogleIcon width={24} height={24} style={styles.buttonIcon} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webViewSection: {
    height: '75%',
  },
  contentOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: '50%',
  },
  gradientOverlay: {
    height: 120,
    width: '100%',
  },
  contentSection: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'flex-end',
    gap: 24,
  },
  logoStack: {
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 100,
    height: 100,
  },
  logoTextBlock: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  error: {
    color: '#FF6B81',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonArea: {
    width: '100%',
    gap: 12,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonIcon: {
    marginRight: 10,
  },
  appleLabel: {
    fontSize: 16,
    color: '#05030D',
    fontWeight: '600',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
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
