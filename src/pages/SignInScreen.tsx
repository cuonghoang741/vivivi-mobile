import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { PersistKeys } from '../config/supabase';
import { PreviewVRM } from '../components/commons/PreviewVRM';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  IconBrandApple,
  IconBrandGoogle,
  IconSquare,
  IconSquareCheckFilled,
  IconShieldCheck
} from '@tabler/icons-react-native';

type LegalDocument = 'terms' | 'privacy' | 'eula';

type Props = {
  isLoading: boolean;
  errorMessage?: string | null;
  onSignInWithApple: () => void;
  onSignInWithGoogle?: () => void;
  onOpenLegal?: (doc: LegalDocument) => void;
};

const LEGAL_LINKS: Record<LegalDocument, string> = {
  terms: 'https://lusty-legal-pages.lovable.app/terms',
  privacy: 'https://lusty-legal-pages.lovable.app/privacy',
  eula: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
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
  const [pendingProvider, setPendingProvider] = useState<'apple' | 'google' | null>(null);

  // Load persisted age verification state
  useEffect(() => {
    let isMounted = true;
    const loadAgeFlag = async () => {
      try {
        const value = await AsyncStorage.getItem(PersistKeys.ageVerified18);
        if (isMounted && value === 'true') {
          setIsAgeVerified(true);
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

  // Handle toggling age verification
  const toggleAgeVerification = useCallback(async () => {
    const newValue = !isAgeVerified;
    setIsAgeVerified(newValue);
    if (newValue) {
      await AsyncStorage.setItem(PersistKeys.ageVerified18, 'true');
    } else {
      await AsyncStorage.removeItem(PersistKeys.ageVerified18);
    }
  }, [isAgeVerified]);

  const handleLegalPress = useCallback(
    async (doc: LegalDocument) => {
      if (onOpenLegal) {
        onOpenLegal(doc);
        return;
      }
      const link = LEGAL_LINKS[doc];
      if (!link) return;

      try {
        await WebBrowser.openBrowserAsync(link);
      } catch (error) {
        try {
          await Linking.openURL(link);
        } catch (e) {
          console.warn('Failed to open link', e);
        }
      }
    },
    [onOpenLegal]
  );

  const handleSignIn = useCallback(
    (provider: 'apple' | 'google') => {
      if (!isAgeVerified) {
        Alert.alert(
          "Age Verification Required",
          "You must be 18+ to access this application. Please confirm your age to continue."
        );
        return;
      }

      setPendingProvider(provider);
      if (provider === 'apple') {
        onSignInWithApple();
      } else {
        onSignInWithGoogle?.();
      }
    },
    [isAgeVerified, onSignInWithApple, onSignInWithGoogle]
  );

  const showAppleSpinner = isLoading && pendingProvider === 'apple';
  const showGoogleSpinner = isLoading && pendingProvider === 'google';

  const isButtonsDisabled = isLoading || checkingAge;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background VRM Preview */}
      <PreviewVRM
        showActionButtons={false}
        showNavigation={false}
      />

      {/* Main Content Overlay */}
      <View style={styles.contentOverlay} pointerEvents="box-none">

        {/* Gradient Mask for smooth fade */}
        <MaskedView
          style={StyleSheet.absoluteFill}
          maskElement={
            <LinearGradient
              colors={['transparent', 'transparent', '#000']}
              locations={[0, 0.4, 0.8]}
              style={StyleSheet.absoluteFill}
            />
          }
        >
          <BlurView
            intensity={90}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        </MaskedView>

        <View style={[styles.contentSection, { paddingBottom: Math.max(insets.bottom, 24) }]}>

          {/* Header / Titles */}
          <View style={styles.headerBlock}>
            <View style={styles.iconBadge}>
              <IconShieldCheck size={32} color="#8b5cf6" />
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Log in to continue your intimate experience.
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Age Verification Checkbox (Inline) */}
          <Pressable
            onPress={toggleAgeVerification}
            style={styles.checkboxContainer}
            activeOpacity={0.8}
            hitSlop={8}
          >
            {isAgeVerified ? (
              <IconSquareCheckFilled size={24} color="#8b5cf6" />
            ) : (
              <IconSquare size={24} color="rgba(255,255,255,0.4)" />
            )}
            <View style={styles.checkboxTextContainer}>
              <Text style={[styles.checkboxLabel, isAgeVerified && styles.checkboxLabelActive]}>
                I confirm that I am <Text style={styles.highlight}>18 years or older</Text>
              </Text>
            </View>
          </Pressable>

          {/* Buttons */}
          <View style={styles.buttonStack}>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isButtonsDisabled}
                style={[styles.authButton, styles.appleButton, isButtonsDisabled && styles.disabledButton]}
                onPress={() => handleSignIn('apple')}
              >
                {showAppleSpinner ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <IconBrandApple size={24} color="#000" style={styles.btnIcon} />
                    <Text style={styles.appleBtnText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {onSignInWithGoogle && (Platform.OS !== 'ios' || __DEV__) ? (
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={isButtonsDisabled}
                style={[styles.authButton, styles.googleButton, isButtonsDisabled && styles.disabledButton]}
                onPress={() => handleSignIn('google')}
              >
                {showGoogleSpinner ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <IconBrandGoogle size={24} color="#000" style={styles.btnIcon} />
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Legal Links */}
          <View style={styles.legalLinks}>
            <Text style={styles.legalText}>
              By continuing, you agree to our{' '}
              <Text onPress={() => handleLegalPress('terms')} style={styles.linkText}>Terms</Text>
              {', '}
              <Text onPress={() => handleLegalPress('privacy')} style={styles.linkText}>Privacy</Text>
              {' & '}
              <Text onPress={() => handleLegalPress('eula')} style={styles.linkText}>EULA</Text>
            </Text>
          </View>

        </View>
      </View>
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
    top: 0,
    justifyContent: 'flex-end',
  },
  contentSection: {
    paddingHorizontal: 24,
    paddingTop: 40,
    gap: 24,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: '80%',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 107, 129, 0.1)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 129, 0.2)',
  },
  errorText: {
    color: '#FF6B81',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  checkboxTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  checkboxLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '500',
  },
  checkboxLabelActive: {
    color: '#fff',
  },
  highlight: {
    color: '#a78bfa',
    fontWeight: '700',
  },
  buttonStack: {
    gap: 12,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  appleButton: {
    backgroundColor: '#fff',
  },
  googleButton: {
    backgroundColor: '#fff',
  },
  disabledButton: {
    opacity: 0.7,
  },
  btnIcon: {
    marginRight: 10,
  },
  appleBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.3,
  },
  googleBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.3,
  },
  legalLinks: {
    marginTop: 8,
    alignItems: 'center',
  },
  legalText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    color: 'rgba(255,255,255,0.7)',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
