import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View, StatusBar, Platform, Linking } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { VRMWebView } from './src/components/VRMWebView';
import { VRMUIOverlay } from './src/components/VRMUIOverlay';
import { WebSceneBridge } from './src/utils/WebSceneBridge';
import { SwiftUIDemoScreen } from './src/screens/SwiftUIDemoScreen';
import { CharacterRepository } from './src/repositories/CharacterRepository';
import { BackgroundRepository } from './src/repositories/BackgroundRepository';
import { useUserStats } from './src/hooks/useUserStats';
import { useCurrencyBalance } from './src/hooks/useCurrencyBalance';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ImageOnboardingScreen } from './src/screens/ImageOnboardingScreen';
import { NewUserGiftScreen } from './src/screens/NewUserGiftScreen';
import { authManager } from './src/services/AuthManager';
import { ChatBottomOverlay } from './src/components/chat/ChatBottomOverlay';
import { ChatHistoryModal } from './src/components/chat/ChatHistoryModal';
import { SettingsModal } from './src/components/settings/SettingsModal';
import { useChatManager } from './src/hooks/useChatManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistKeys } from './src/config/supabase';
import { AssetRepository } from './src/repositories/AssetRepository';

type AuthSnapshot = {
  session: Session | null;
  isGuest: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  hasRestoredSession: boolean;
};

const LEGAL_URLS = {
  terms: 'https://vivivi.ai/terms',
  privacy: 'https://vivivi.ai/privacy',
  eula: 'https://vivivi.ai/eula',
};

export default function App() {
  const webViewRef = useRef<any>(null);
  const webBridgeRef = useRef<WebSceneBridge | null>(null);
  const [showSwiftUIDemo, setShowSwiftUIDemo] = useState(false);
  const [overlayFlags, setOverlayFlags] = useState({
    hasIncompleteQuests: true,
    canClaimCalendar: true,
    hasMessages: true,
    showChatList: false,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showImageOnboarding, setShowImageOnboarding] = useState(false);
  const [showNewUserGift, setShowNewUserGift] = useState(false);
  const [isCheckingNewUser, setIsCheckingNewUser] = useState(false);
  const { stats: overlayStats, refresh: refreshStats } = useUserStats();
  const { balance: currencyBalance, refresh: refreshCurrency } = useCurrencyBalance();
  const [currentCharacter, setCurrentCharacter] = useState<{
    id: string;
    name: string;
    avatar?: string;
    relationshipName?: string;
    relationshipProgress?: number;
  } | null>(null);
  const handleAgentReply = useCallback((text: string) => {
    webBridgeRef.current?.playSpeech(text);
  }, []);
  const {
    state: chatState,
    sendQuickReply,
    toggleChatList: toggleChatListInternal,
    openHistory,
    closeHistory,
    sendText,
    handleCapture,
    handleSendPhoto,
    handleDance,
    loadMoreHistory,
  } = useChatManager(currentCharacter?.id, { onAgentReply: handleAgentReply });
  const handleOverlayChatToggle = () => {
    toggleChatListInternal();
  };

  useEffect(() => {
    setOverlayFlags(prev => ({ ...prev, showChatList: chatState.showChatList }));
  }, [chatState.showChatList]);

  const [authSnapshot, setAuthSnapshot] = useState<AuthSnapshot>({
    session: authManager.session,
    isGuest: authManager.isGuest,
    isLoading: authManager.isLoading,
    errorMessage: authManager.errorMessage,
    hasRestoredSession: authManager.hasRestoredSession,
  });

  useEffect(() => {
    const unsubscribe = authManager.subscribe(() => {
      setAuthSnapshot({
        session: authManager.session,
        isGuest: authManager.isGuest,
        isLoading: authManager.isLoading,
        errorMessage: authManager.errorMessage,
        hasRestoredSession: authManager.hasRestoredSession,
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authSnapshot.hasRestoredSession) {
      return;
    }
    if (!authSnapshot.session && !authSnapshot.isGuest) {
      return;
    }

    const testSupabaseData = async () => {
      try {
        console.log('🔍 [App] Testing Supabase data loading...');
        console.log('👤 [App] Auth state:', {
          hasSession: !!authSnapshot.session,
          isGuest: authSnapshot.isGuest,
          userId: authManager.getUserId(),
          clientId: await authManager.getClientId(),
        });

        const characterRepo = new CharacterRepository();
        const characters = await characterRepo.fetchAllCharacters();
        console.log(`✅ [App] Loaded ${characters.length} characters from Supabase`);
        if (characters.length > 0) {
          console.log('📋 [App] First character:', {
            id: characters[0].id,
            name: characters[0].name,
            base_model_url: characters[0].base_model_url,
            available: characters[0].available,
          });
        }

        const backgroundRepo = new BackgroundRepository();
        const backgrounds = await backgroundRepo.fetchAllBackgrounds();
        console.log(`✅ [App] Loaded ${backgrounds.length} backgrounds from Supabase`);
        if (backgrounds.length > 0) {
          console.log('📋 [App] First background:', {
            id: backgrounds[0].id,
            name: backgrounds[0].name,
            image: backgrounds[0].image,
            available: backgrounds[0].available,
          });
        }

        refreshStats();
        refreshCurrency();
      } catch (error: any) {
        console.error('❌ [App] Error loading Supabase data:', error);
        console.error('❌ [App] Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
      }
    };

    const timeoutId = setTimeout(() => {
      testSupabaseData();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    authSnapshot.hasRestoredSession,
    authSnapshot.session,
    authSnapshot.isGuest,
    refreshStats,
    refreshCurrency,
  ]);

  useEffect(() => {
    if (!authSnapshot.hasRestoredSession) {
      return;
    }
    if (authSnapshot.session) {
      console.log('✅ [Auth] Logged in user', {
        userId: authSnapshot.session.user.id,
        email: authSnapshot.session.user.email,
      });
    } else if (authSnapshot.isGuest) {
      (async () => {
        console.log('👤 [Auth] Guest session active', {
          clientId: await authManager.getClientId(),
        });
      })();
    }
  }, [authSnapshot.hasRestoredSession, authSnapshot.session, authSnapshot.isGuest]);

  const handleModelReady = async () => {
    console.log('🎉 [App] VRM Model is ready!');

    if (webViewRef.current && !webBridgeRef.current) {
      webBridgeRef.current = new WebSceneBridge(webViewRef.current);
      console.log('✅ [App] WebSceneBridge initialized');
    }

    try {
      console.log('🔍 [App] Loading user character preferences...');

      const characterRepo = new CharacterRepository();
      const characters = await characterRepo.fetchAllCharacters();
      console.log(`✅ [App] Loaded ${characters.length} characters`);

      if (characters.length > 0) {
        const { UserPreferencesService } = await import('./src/services/UserPreferencesService');
        const userPrefsService = new UserPreferencesService();
        let currentCharacterId = await userPrefsService.loadCurrentCharacterId();

        if (!currentCharacterId || !characters.find(c => c.id === currentCharacterId)) {
          currentCharacterId = characters[0].id;
          await userPrefsService.saveCurrentCharacterId(currentCharacterId);
        }

        const currentCharacter = characters.find(c => c.id === currentCharacterId) || characters[0];
        console.log('👤 [App] Current character:', currentCharacter.name, `(${currentCharacter.id})`);

        const { AssetRepository } = await import('./src/repositories/AssetRepository');
        const assetRepo = new AssetRepository();
        const ownedCharacterIds = await assetRepo.fetchOwnedAssets('character');
        const ownedBackgroundIds = await assetRepo.fetchOwnedAssets('background');
        console.log(`✅ [App] Owned items: ${ownedCharacterIds.size} characters, ${ownedBackgroundIds.size} backgrounds`);

        const { UserCharacterPreferenceService } = await import('./src/services/UserCharacterPreferenceService');
        const preferences = await UserCharacterPreferenceService.loadUserCharacterPreference(currentCharacter.id);
        console.log('📋 [App] User preferences:', preferences);

        if (preferences.backgroundId) {
          await UserCharacterPreferenceService.applyBackgroundById(
            preferences.backgroundId,
            webViewRef,
            ownedBackgroundIds
          );
        }

        if (preferences.costumeId) {
          await UserCharacterPreferenceService.applyCostumeById(
            preferences.costumeId,
            webViewRef
          );
        } else {
          UserCharacterPreferenceService.loadFallbackModel(
            currentCharacter.name,
            currentCharacter.base_model_url || null,
            webViewRef
          );
        }

        setCurrentCharacter({
          id: currentCharacter.id,
          name: currentCharacter.name,
          avatar: currentCharacter.avatar || currentCharacter.thumbnail_url,
          relationshipName: 'Stranger',
          relationshipProgress: 0,
        });
      }
    } catch (error: any) {
      console.error('❌ [App] Error loading user preferences:', error);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          (async()=>{
            try {
              await window.loadRandomFiles();
            } catch(e) {
              console.error('Failed to load random model:', e);
            }
          })();
        `);
      }
    }
  };

  const handleMessage = (message: string) => {
    console.log('📨 [App] Message from WebView:', message);
  };

  const handleOpenLegal = async (doc: 'terms' | 'privacy' | 'eula') => {
    const target = LEGAL_URLS[doc];
    if (!target) {
      return;
    }
    try {
      await Linking.openURL(target);
    } catch (error) {
      console.warn('❗ Unable to open legal document', doc, error);
    }
  };

  const shouldShowOnboarding =
    authSnapshot.hasRestoredSession && !authSnapshot.session && !authSnapshot.isGuest;

  const checkGiftClaimStatus = useCallback(async () => {
    try {
      // Check if user has already claimed the gift (from AsyncStorage)
      const hasClaimedWelcomeGift =
        (await AsyncStorage.getItem(PersistKeys.hasClaimedWelcomeGift)) === 'true';
      
      if (hasClaimedWelcomeGift) {
        // User has already claimed gift, don't show it again
        setShowNewUserGift(false);
        return;
      }

      // Check from database to see if gift was actually claimed
      const assetRepo = new AssetRepository();
      const ownedCharacterIds = await assetRepo.fetchOwnedAssets('character');
      const ownedBackgroundIds = await assetRepo.fetchOwnedAssets('background');
      const { CurrencyRepository } = await import('./src/repositories/CurrencyRepository');
      const currencyRepo = new CurrencyRepository();
      const currency = await currencyRepo.fetchCurrency();

      const hasCharacters = ownedCharacterIds.size > 0;
      const hasBackgrounds = ownedBackgroundIds.size > 0;
      // Gift includes 10,000 VCoin and 100 Ruby
      const hasGiftCurrency = currency.vcoin >= 10000 || currency.ruby >= 100;

      const hasCompletedImageOnboarding =
        (await AsyncStorage.getItem(PersistKeys.hasCompletedImageOnboarding)) === 'true';

      // Gift includes: 1 character, 1 costume, 3 backgrounds, 10,000 VCoin, 100 Ruby
      // If user has completed onboarding but doesn't have any of these indicators,
      // they haven't claimed the gift yet
      const hasClaimedGift = hasCharacters || hasBackgrounds || hasGiftCurrency;

      // If gift was claimed in database but not saved in AsyncStorage, save it now
      if (hasClaimedGift) {
        await AsyncStorage.setItem(PersistKeys.hasClaimedWelcomeGift, 'true');
        setShowNewUserGift(false);
        return;
      }

      // Show gift if onboarding is completed but gift hasn't been claimed
      if (hasCompletedImageOnboarding && !hasClaimedGift) {
        setShowNewUserGift(true);
      } else {
        setShowNewUserGift(false);
      }
    } catch (error) {
      console.error('[App] Error checking gift claim status:', error);
      // On error, check if already claimed from AsyncStorage
      const hasClaimedWelcomeGift =
        (await AsyncStorage.getItem(PersistKeys.hasClaimedWelcomeGift)) === 'true';
      if (hasClaimedWelcomeGift) {
        setShowNewUserGift(false);
        return;
      }
      const hasCompletedImageOnboarding =
        (await AsyncStorage.getItem(PersistKeys.hasCompletedImageOnboarding)) === 'true';
      if (hasCompletedImageOnboarding) {
        setShowNewUserGift(true);
      }
    }
  }, []);

  const checkIfNewUser = useCallback(async () => {
    if (isCheckingNewUser) return;
    setIsCheckingNewUser(true);
    try {
      await checkGiftClaimStatus();
    } finally {
      setIsCheckingNewUser(false);
    }
  }, [isCheckingNewUser, checkGiftClaimStatus]);

  const checkIfNewUserForOnboarding = useCallback(async () => {
    if (isCheckingNewUser) return;
    setIsCheckingNewUser(true);

    try {
      const assetRepo = new AssetRepository();
      const ownedCharacterIds = await assetRepo.fetchOwnedAssets('character');
      const hasCharacters = ownedCharacterIds.size > 0;

      const hasCompletedImageOnboarding =
        (await AsyncStorage.getItem(PersistKeys.hasCompletedImageOnboarding)) === 'true';

      if (hasCharacters) {
        // User has characters, don't show onboarding images
        // Just check if they need the gift (they might not have rooms)
        setShowImageOnboarding(false);
        // Check gift claim status directly
        await checkGiftClaimStatus();
      } else {
        // No characters - show onboarding images if not completed
        if (!hasCompletedImageOnboarding) {
          setShowImageOnboarding(true);
          setShowNewUserGift(false);
        } else {
          // Onboarding completed but no characters - show gift
          setShowImageOnboarding(false);
          setShowNewUserGift(true);
        }
      }
    } catch (error) {
      console.error('[App] Error checking new user for onboarding:', error);
      const hasCompletedImageOnboarding =
        (await AsyncStorage.getItem(PersistKeys.hasCompletedImageOnboarding)) === 'true';
      if (!hasCompletedImageOnboarding) {
        setShowImageOnboarding(true);
        setShowNewUserGift(false);
      } else {
        setShowImageOnboarding(false);
        setShowNewUserGift(true);
      }
    } finally {
      setIsCheckingNewUser(false);
    }
  }, [isCheckingNewUser, checkGiftClaimStatus]);

  const handleImageOnboardingComplete = useCallback(async () => {
    await AsyncStorage.setItem(PersistKeys.hasCompletedImageOnboarding, 'true');
    await AsyncStorage.setItem(PersistKeys.hasSeenImageOnboarding, 'true');
    setShowImageOnboarding(false);
    checkIfNewUser();
  }, [checkIfNewUser]);

  const handleImageOnboardingSkip = useCallback(async () => {
    await AsyncStorage.setItem(PersistKeys.hasCompletedImageOnboarding, 'true');
    await AsyncStorage.setItem(PersistKeys.hasSeenImageOnboarding, 'true');
    setShowImageOnboarding(false);
    checkIfNewUser();
  }, [checkIfNewUser]);

  const handleNewUserGiftComplete = useCallback(
    async (characterId: string | null) => {
      console.log('🎉 [App] handleNewUserGiftComplete called with characterId:', characterId);
      
      // Mark gift as claimed in AsyncStorage (like Swift version)
      await AsyncStorage.setItem(PersistKeys.hasClaimedWelcomeGift, 'true');
      
      // Hide gift screen immediately (like Swift version)
      setShowNewUserGift(false);
      setShowImageOnboarding(false);
      
      if (characterId) {
        try {
          console.log('🎉 [App] Loading character after gift...');
          const characterRepo = new CharacterRepository();
          const characters = await characterRepo.fetchAllCharacters();
          const character = characters.find((c) => c.id === characterId);
          if (character) {
            const { UserPreferencesService } = await import('./src/services/UserPreferencesService');
            const userPrefsService = new UserPreferencesService();
            await userPrefsService.saveCurrentCharacterId(characterId);
            setCurrentCharacter({
              id: character.id,
              name: character.name,
              avatar: character.avatar || character.thumbnail_url,
              relationshipName: 'Stranger',
              relationshipProgress: 0,
            });
            console.log('🎉 [App] Character loaded and set:', character.name);
          }
          // TODO: Generate daily quests and unlock level 1 quests for new user
          // await gamificationViewModel.generateDailyQuests();
          // await gamificationViewModel.loadTodayQuests();
          // await gamificationViewModel.unlockLevelQuests(for: 1);
        } catch (error) {
          console.error('[App] Error loading character after gift:', error);
        }
      } else {
        // User skipped gift, still generate quests
        // TODO: Generate daily quests and unlock level 1 quests for new user
        // await gamificationViewModel.generateDailyQuests();
        // await gamificationViewModel.loadTodayQuests();
        // await gamificationViewModel.unlockLevelQuests(for: 1);
      }
      
      // Proceed with app (like Swift version)
      handleModelReady();
    },
    [handleModelReady]
  );

  // Track if we've already checked onboarding to prevent re-checking after gift claim
  const hasCheckedOnboardingRef = useRef(false);
  const lastAuthStateRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset ref if auth state changed (e.g., logout/login, guest to logged in)
    const currentAuthState = authSnapshot.session?.user?.id || (authSnapshot.isGuest ? 'guest' : null);
    if (lastAuthStateRef.current !== null && lastAuthStateRef.current !== currentAuthState) {
      hasCheckedOnboardingRef.current = false;
    }
    lastAuthStateRef.current = currentAuthState;

    // Only check onboarding once when auth is restored
    if (authSnapshot.hasRestoredSession && (authSnapshot.session || authSnapshot.isGuest) && !hasCheckedOnboardingRef.current) {
      hasCheckedOnboardingRef.current = true;
      checkIfNewUserForOnboarding();
    }
  }, [authSnapshot.hasRestoredSession, authSnapshot.session, authSnapshot.isGuest, checkIfNewUserForOnboarding]);

  const renderContent = () => {
    if (!authSnapshot.hasRestoredSession) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" />
          <View style={styles.loadingState}>
            <ActivityIndicator color="#fff" />
          </View>
        </View>
      );
    }

    if (shouldShowOnboarding) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" />
          <OnboardingScreen
            isLoading={authSnapshot.isLoading}
            errorMessage={authSnapshot.errorMessage}
            onSignInWithApple={() => authManager.signInWithApple()}
            onContinueAsGuest={() => authManager.continueAsGuest()}
            onOpenLegal={handleOpenLegal}
          />
        </View>
      );
    }

    if (showImageOnboarding) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" />
          <ImageOnboardingScreen
            onComplete={handleImageOnboardingComplete}
            onSkip={handleImageOnboardingSkip}
          />
        </View>
      );
    }

    if (showNewUserGift) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" />
          <NewUserGiftScreen onComplete={handleNewUserGiftComplete} />
        </View>
      );
    }

    if (Platform.OS === 'ios' && showSwiftUIDemo) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="dark-content" />
          <SwiftUIDemoScreen />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <VRMWebView
          ref={webViewRef}
          onModelReady={handleModelReady}
          onMessage={handleMessage}
          enableDebug={false}
        />
        <VRMUIOverlay
          level={overlayStats.level}
          xp={overlayStats.xp}
          nextLevelXp={overlayStats.nextLevelXp}
          energy={overlayStats.energy}
          energyMax={overlayStats.energyMax}
          vcoin={currencyBalance.vcoin}
          ruby={currencyBalance.ruby}
          hasIncompleteQuests={overlayFlags.hasIncompleteQuests}
          canClaimCalendar={overlayFlags.canClaimCalendar}
          hasMessages={overlayFlags.hasMessages}
          showChatList={overlayFlags.showChatList}
          onSettingsPress={() => setShowSettings(true)}
          onLevelPress={() => console.log('📈 Level sheet placeholder')}
          onEnergyPress={() => console.log('⚡ Energy sheet placeholder')}
          onCurrencyPress={() => console.log('💰 Currency sheet placeholder')}
          onBackgroundPress={() => console.log('🖼️ Background sheet placeholder')}
          onCostumePress={() => console.log('👗 Costume sheet placeholder')}
          onQuestPress={() => console.log('🏁 Quest sheet placeholder')}
          onCalendarPress={() => console.log('📅 Calendar sheet placeholder')}
          onToggleChatList={handleOverlayChatToggle}
        />
        <View pointerEvents="box-none" style={styles.chatOverlay}>
          <ChatBottomOverlay
            messages={chatState.messages}
            quickReplies={chatState.quickReplies}
            showChatList={chatState.showChatList}
            onToggleHistory={openHistory}
            onMessagePress={message => console.log('💬 message pressed', message.id)}
            onQuickReply={sendQuickReply}
            onSendText={sendText}
            onCapture={handleCapture}
            onSendPhoto={handleSendPhoto}
            onDance={handleDance}
            isTyping={chatState.isTyping}
            onToggleMic={() => console.log('🎙️ Mic toggled')}
          />
        </View>
        <ChatHistoryModal
          visible={chatState.showChatHistoryFullScreen}
          messages={chatState.history}
          loading={chatState.historyLoading}
          reachedEnd={chatState.historyReachedEnd}
          onClose={closeHistory}
          onLoadMore={loadMoreHistory}
        />
        <SettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          email={authSnapshot.session?.user?.email ?? null}
          displayName={
            (authSnapshot.session?.user?.user_metadata as Record<string, any> | undefined)?.display_name ??
            authSnapshot.session?.user?.email ??
            null
          }
        />
      </View>
    );
  };

  return <SafeAreaProvider>{renderContent()}</SafeAreaProvider>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 24,
  },
});
