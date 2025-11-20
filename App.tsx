import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View, StatusBar, Platform, Linking, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { VRMWebView } from './src/components/VRMWebView';
import { VRMUIOverlay } from './src/components/VRMUIOverlay';
import { WebSceneBridge } from './src/utils/WebSceneBridge';
import { SwiftUIDemoScreen } from './src/screens/SwiftUIDemoScreen';
import { InitialLoadingScreen } from './src/components/InitialLoadingScreen';
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
import AssetRepository from './src/repositories/AssetRepository';
import { UserPreferencesService } from './src/services/UserPreferencesService';
import { UserCharacterPreferenceService } from './src/services/UserCharacterPreferenceService';
import { VRMProvider, useVRMContext } from './src/context/VRMContext';
import { CurrencyPurchaseSheet } from './src/components/purchase/CurrencyPurchaseSheet';
import LoginRewardSheet from './src/components/sheets/LoginRewardSheet';
import { BackgroundSheet } from './src/components/sheets/BackgroundSheet';
import { CostumeSheet } from './src/components/sheets/CostumeSheet';
import { CharacterSheet } from './src/components/sheets/CharacterSheet';
import { BackgroundItem } from './src/repositories/BackgroundRepository';
import { CharacterItem } from './src/repositories/CharacterRepository';
import { CostumeItem } from './src/repositories/CostumeRepository';
import { CharacterHeaderCard, HeaderIconButton } from './src/components/header/SceneHeaderComponents';
import { PurchaseService, PurchaseError, PurchaseErrorCode } from './src/services/PurchaseService';
import { useLoginRewards } from './src/hooks/useLoginRewards';

type RootStackParamList = {
  Experience: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type ExperienceNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Experience'>;

const LEGAL_URLS = {
  terms: 'https://vivivi.ai/terms',
  privacy: 'https://vivivi.ai/privacy',
  eula: 'https://vivivi.ai/eula',
};

type PendingPurchase =
  | {
      type: 'character';
      item: CharacterItem;
      useVcoin: boolean;
      useRuby: boolean;
    }
  | {
      type: 'background';
      item: BackgroundItem;
      useVcoin: boolean;
      useRuby: boolean;
    }
  | {
      type: 'costume';
      item: CostumeItem;
      useVcoin: boolean;
      useRuby: boolean;
    };

const AppContent = () => {
  const {
    authState,
    initialData,
    initialDataLoading,
    initialDataError,
    refreshInitialData,
    ensureInitialModelApplied,
    currentCharacter,
    setCurrentCharacterState,
    isModelDataReady,
  } = useVRMContext();
  const { session, isLoading, errorMessage, hasRestoredSession } = authState;

  const navigation = useNavigation<ExperienceNavigationProp>();
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
  const [showCurrencySheet, setShowCurrencySheet] = useState(false);
  const [showBackgroundSheet, setShowBackgroundSheet] = useState(false);
  const [showCostumeSheet, setShowCostumeSheet] = useState(false);
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);
  const [showLoginRewardSheet, setShowLoginRewardSheet] = useState(false);
  const [isCheckingNewUser, setIsCheckingNewUser] = useState(false);
  const { stats: overlayStats, refresh: refreshStats } = useUserStats();
  const { balance: currencyBalance, refresh: refreshCurrency } = useCurrencyBalance();
  const loginRewards = useLoginRewards({
    onClaimSuccess: async () => {
      await Promise.all([refreshCurrency(), refreshStats()]);
    },
  });
  const loginRewardStatus = loginRewards.status;
  const purchaseServiceRef = useRef<PurchaseService | null>(null);
  const [pendingPurchase, setPendingPurchase] = useState<PendingPurchase | null>(null);

  const getPurchaseService = useCallback(() => {
    if (!purchaseServiceRef.current) {
      purchaseServiceRef.current = new PurchaseService();
    }
    return purchaseServiceRef.current;
  }, []);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isCameraModeOn, setIsCameraModeOn] = useState(false);
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
    setOverlayFlags(prev => ({
      ...prev,
      canClaimCalendar: loginRewardStatus.canClaimToday,
    }));
  }, [loginRewardStatus.canClaimToday]);

  const handleCurrencyPress = useCallback(() => {
    setShowCurrencySheet(true);
  }, []);

  const resolveItemPrices = useCallback(
    (
      item: { price_vcoin?: number | null; price_ruby?: number | null },
      preference?: { useVcoin: boolean; useRuby: boolean }
    ) => {
      const baseVcoin = Math.max(0, item.price_vcoin ?? 0);
      const baseRuby = Math.max(0, item.price_ruby ?? 0);
      return {
        vcoin: preference ? (preference.useVcoin ? baseVcoin : 0) : baseVcoin,
        ruby: preference ? (preference.useRuby ? baseRuby : 0) : baseRuby,
      };
    },
    []
  );

  const purchaseItemWithCurrency = useCallback(
    async (options: {
      itemId: string;
      itemType: string;
      priceVcoin: number;
      priceRuby: number;
      pendingPayload: PendingPurchase;
    }): Promise<boolean> => {
      const { itemId, itemType, priceVcoin, priceRuby, pendingPayload } = options;
      try {
        const service = getPurchaseService();
        await service.purchaseWithCurrency({
          itemId,
          itemType,
          priceVcoin,
          priceRuby,
        });
        setPendingPurchase(null);
        await refreshCurrency();
        return true;
      } catch (error) {
        if (
          error instanceof PurchaseError &&
          (error.code === PurchaseErrorCode.INSUFFICIENT_VCOIN ||
            error.code === PurchaseErrorCode.INSUFFICIENT_RUBY)
        ) {
          setPendingPurchase(pendingPayload);
          setShowCurrencySheet(true);
          Alert.alert('Not enough currency', 'Top up to continue this purchase.');
        } else {
          const message = error instanceof Error ? error.message : undefined;
          console.error('❌ Purchase failed:', error);
          Alert.alert('Purchase failed', message ?? 'Please try again later.');
        }
        return false;
      }
    },
    [getPurchaseService, refreshCurrency]
  );

  const applyBackground = useCallback(
    async (backgroundId: string, ownedSet?: Set<string>) => {
      if (!currentCharacter) {
        Alert.alert('No character selected', 'Please select a character first.');
        return;
      }
      const ownedBackgrounds =
        ownedSet ?? (await new AssetRepository().fetchOwnedAssets('background'));
      await UserCharacterPreferenceService.applyBackgroundById(
        backgroundId,
        webViewRef,
        ownedBackgrounds
      );
      await UserCharacterPreferenceService.saveUserCharacterPreference(currentCharacter.id, {
        current_background_id: backgroundId,
      });
    },
    [currentCharacter]
  );

  const applyCostume = useCallback(
    async (costumeId: string) => {
      if (!currentCharacter) {
        Alert.alert('No character selected', 'Please select a character first.');
        return;
      }
      await UserCharacterPreferenceService.applyCostumeById(costumeId, webViewRef);
      await UserCharacterPreferenceService.saveUserCharacterPreference(currentCharacter.id, {
        current_costume_id: costumeId,
      });
    },
    [currentCharacter]
  );

  const applyCharacter = useCallback(
    async (item: CharacterItem) => {
      try {
        setCurrentCharacterState({
          id: item.id,
          name: item.name,
          avatar: item.avatar || item.thumbnail_url,
          relationshipName: 'Stranger',
          relationshipProgress: 0,
        });

        const userPrefsService = new UserPreferencesService();
        await userPrefsService.saveCurrentCharacterId(item.id);

        if (item.base_model_url) {
          await UserCharacterPreferenceService.loadFallbackModel(
            item.name,
            item.base_model_url,
            webViewRef
          );
        }

        await refreshInitialData();
      } catch (error) {
        console.error('❌ Error applying character:', error);
      }
    },
    [refreshInitialData, setCurrentCharacterState]
  );

  const processCharacterSelection = useCallback(
    async (item: CharacterItem, preference?: { useVcoin: boolean; useRuby: boolean }) => {
      try {
        const assetRepo = new AssetRepository();
        const ownedCharacterIds = await assetRepo.fetchOwnedAssets('character');
        if (ownedCharacterIds.has(item.id)) {
          await applyCharacter(item);
          return;
        }

        const { vcoin: priceVcoin, ruby: priceRuby } = resolveItemPrices(item, preference);
        if (priceVcoin === 0 && priceRuby === 0) {
          const success = await assetRepo.createAsset(item.id, 'character');
          if (success) {
            await applyCharacter(item);
          }
          return;
        }

        const purchaseSucceeded = await purchaseItemWithCurrency({
          itemId: item.id,
          itemType: 'character',
          priceVcoin,
          priceRuby,
          pendingPayload: {
            type: 'character',
            item,
            useVcoin: priceVcoin > 0,
            useRuby: priceRuby > 0,
          },
        });

        if (purchaseSucceeded) {
          await applyCharacter(item);
          Alert.alert('Character unlocked', `${item.name} is now available.`);
        }
      } catch (error) {
        console.error('❌ Error selecting character:', error);
        Alert.alert('Error', 'Failed to select character');
      }
    },
    [applyCharacter, purchaseItemWithCurrency, resolveItemPrices]
  );

  const processBackgroundSelection = useCallback(
    async (item: BackgroundItem, preference?: { useVcoin: boolean; useRuby: boolean }) => {
      try {
        const assetRepo = new AssetRepository();
        const ownedBackgroundIds = await assetRepo.fetchOwnedAssets('background');
        if (ownedBackgroundIds.has(item.id)) {
          await applyBackground(item.id, ownedBackgroundIds);
          return;
        }

        const { vcoin: priceVcoin, ruby: priceRuby } = resolveItemPrices(item, preference);
        if (priceVcoin === 0 && priceRuby === 0) {
          const success = await assetRepo.createAsset(item.id, 'background');
          if (success) {
            const updatedOwned = await assetRepo.fetchOwnedAssets('background');
            await applyBackground(item.id, updatedOwned);
          }
          return;
        }

        const purchaseSucceeded = await purchaseItemWithCurrency({
          itemId: item.id,
          itemType: 'background',
          priceVcoin,
          priceRuby,
          pendingPayload: {
            type: 'background',
            item,
            useVcoin: priceVcoin > 0,
            useRuby: priceRuby > 0,
          },
        });

        if (purchaseSucceeded) {
          const updatedOwned = await assetRepo.fetchOwnedAssets('background');
          await applyBackground(item.id, updatedOwned);
          Alert.alert('Background applied', `${item.name} has been set.`);
        }
      } catch (error) {
        console.error('❌ Error selecting background:', error);
        Alert.alert('Error', 'Failed to select background');
      }
    },
    [applyBackground, purchaseItemWithCurrency, resolveItemPrices]
  );

  const processCostumeSelection = useCallback(
    async (item: CostumeItem, preference?: { useVcoin: boolean; useRuby: boolean }) => {
      if (!currentCharacter) {
        Alert.alert('No character selected', 'Please select a character first.');
        return;
      }
      try {
        const assetRepo = new AssetRepository();
        const ownedCostumeIds = await assetRepo.fetchOwnedAssets('character_costume');
        if (ownedCostumeIds.has(item.id)) {
          await applyCostume(item.id);
          return;
        }

        const { vcoin: priceVcoin, ruby: priceRuby } = resolveItemPrices(item, preference);
        if (priceVcoin === 0 && priceRuby === 0) {
          const success = await assetRepo.createAsset(item.id, 'character_costume');
          if (success) {
            await applyCostume(item.id);
          }
          return;
        }

        const purchaseSucceeded = await purchaseItemWithCurrency({
          itemId: item.id,
          itemType: 'character_costume',
          priceVcoin,
          priceRuby,
          pendingPayload: {
            type: 'costume',
            item,
            useVcoin: priceVcoin > 0,
            useRuby: priceRuby > 0,
          },
        });

        if (purchaseSucceeded) {
          await applyCostume(item.id);
          Alert.alert('Costume equipped', `${item.costume_name} is ready!`);
        }
      } catch (error) {
        console.error('❌ Error selecting costume:', error);
        Alert.alert('Error', 'Failed to select costume');
      }
    },
    [applyCostume, currentCharacter, purchaseItemWithCurrency, resolveItemPrices]
  );

  const resumePendingPurchase = useCallback(async () => {
    if (!pendingPurchase) {
      return;
    }
    const pending = pendingPurchase;
    setPendingPurchase(null);
    switch (pending.type) {
      case 'character':
        await processCharacterSelection(pending.item, {
          useVcoin: pending.useVcoin,
          useRuby: pending.useRuby,
        });
        break;
      case 'background':
        await processBackgroundSelection(pending.item, {
          useVcoin: pending.useVcoin,
          useRuby: pending.useRuby,
        });
        break;
      case 'costume':
        await processCostumeSelection(pending.item, {
          useVcoin: pending.useVcoin,
          useRuby: pending.useRuby,
        });
        break;
      default:
        break;
    }
  }, [pendingPurchase, processBackgroundSelection, processCharacterSelection, processCostumeSelection]);

  const handleCurrencyPurchaseComplete = useCallback(() => {
    refreshCurrency().finally(() => {
      void resumePendingPurchase();
    });
  }, [refreshCurrency, resumePendingPurchase]);

  useEffect(() => {
    if (showLoginRewardSheet) {
      void loginRewards.refresh();
    }
  }, [loginRewards.refresh, showLoginRewardSheet]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleToggleSpeaker = useCallback(() => {
    setIsAudioMuted(prev => {
      const next = !prev;
      console.log(next ? '🔇 [Audio] muted' : '🔊 [Audio] unmuted');
      return next;
    });
  }, []);

  const handleOpenCharacterMenu = useCallback(() => {
    setShowCharacterSheet(true);
  }, []);

  const handleCharacterCardPress = useCallback(() => {
    handleOpenCharacterMenu();
  }, [handleOpenCharacterMenu]);

  const handleToggleCameraMode = useCallback(() => {
    setIsCameraModeOn(prev => {
      const next = !prev;
      console.log(next ? '🎥 Camera mode bật' : '🎥 Camera mode tắt');
      return next;
    });
  }, []);

  const handleCharacterSelect = useCallback(
    (item: CharacterItem) => {
      void processCharacterSelection(item);
    },
    [processCharacterSelection]
  );

  const handleBackgroundSelect = useCallback(
    (item: BackgroundItem) => {
      void processBackgroundSelection(item);
    },
    [processBackgroundSelection]
  );

  const handleCostumeSelect = useCallback(
    (item: CostumeItem) => {
      void processCostumeSelection(item);
    },
    [processCostumeSelection]
  );

  useEffect(() => {
    setOverlayFlags(prev => ({ ...prev, showChatList: chatState.showChatList }));
  }, [chatState.showChatList]);

  useEffect(() => {
    if (!hasRestoredSession || !session) {
      return;
    }
    refreshStats();
    refreshCurrency();
  }, [hasRestoredSession, session, refreshStats, refreshCurrency]);

  useEffect(() => {
    if (!hasRestoredSession) {
      return;
    }
    if (session) {
      console.log('✅ [Auth] Logged in user', {
        userId: session.user.id,
        email: session.user.email,
      });
    }
  }, [hasRestoredSession, session]);

  const ensureWebBridge = useCallback(() => {
    if (webViewRef.current && !webBridgeRef.current) {
      webBridgeRef.current = new WebSceneBridge(webViewRef.current);
      console.log('✅ [App] WebSceneBridge initialized');
    }
  }, []);

  useEffect(() => {
    ensureWebBridge();
    ensureInitialModelApplied(webViewRef);
    
    // Initialize RevenueCat
    import('./src/services/RevenueCatManager').then(({ revenueCatManager }) => {
      revenueCatManager.configure();
    });
  }, [ensureInitialModelApplied, ensureWebBridge]);

  const handleModelReady = useCallback(async () => {
    console.log('🎉 [App] VRM Model is ready!');
    ensureWebBridge();
    await ensureInitialModelApplied(webViewRef);
  }, [ensureInitialModelApplied, ensureWebBridge]);

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

  const shouldShowOnboarding = hasRestoredSession && !session;
  const shouldWaitForInitialData =
    !!session && (!initialData || initialDataLoading || !!initialDataError || !isModelDataReady);
  const showMainExperience =
    hasRestoredSession &&
    !!session &&
    !shouldShowOnboarding &&
    !showImageOnboarding &&
    !showNewUserGift &&
    !shouldWaitForInitialData &&
    !(Platform.OS === 'ios' && showSwiftUIDemo);

  useEffect(() => {
    if (!navigation) {
      return;
    }

    if (!showMainExperience) {
      navigation.setOptions({ headerShown: false });
      return;
    }

    navigation.setOptions({
      headerShown: true,
      headerTransparent: true,
      headerShadowVisible: false,
      headerTitleAlign: 'center',
      headerStyle: {
        backgroundColor: 'transparent',
      },
      headerTitle: () => (
        <CharacterHeaderCard
          name={currentCharacter?.name}
          relationshipName={currentCharacter?.relationshipName}
          relationshipProgress={currentCharacter?.relationshipProgress ?? 0}
          avatarUri={currentCharacter?.avatar}
          onPress={handleCharacterCardPress}
        />
      ),
      headerLeft: () => (
        <View style={styles.headerActions}>
          <HeaderIconButton
            iconName="settings-outline"
            onPress={handleOpenSettings}
            accessibilityLabel="Mở cài đặt"
          />
          <HeaderIconButton
            iconName={isAudioMuted ? 'volume-mute-outline' : 'volume-high-outline'}
            onPress={handleToggleSpeaker}
            accessibilityLabel="Bật tắt loa"
            active={isAudioMuted}
          />
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerActions}>
          <HeaderIconButton
            iconName="grid-outline"
            onPress={handleOpenCharacterMenu}
            accessibilityLabel="Menu nhân vật"
          />
          <HeaderIconButton
            iconName={isCameraModeOn ? 'stop-circle-outline' : 'videocam-outline'}
            onPress={handleToggleCameraMode}
            accessibilityLabel="Chế độ camera"
            active={isCameraModeOn}
          />
        </View>
      ),
    });
  }, [
    navigation,
    showMainExperience,
    currentCharacter?.name,
    currentCharacter?.relationshipName,
    currentCharacter?.relationshipProgress,
    currentCharacter?.avatar,
    handleCharacterCardPress,
    handleOpenSettings,
    handleToggleSpeaker,
    isAudioMuted,
    handleOpenCharacterMenu,
    handleToggleCameraMode,
    isCameraModeOn,
  ]);

  const checkGiftClaimStatus = useCallback(async () => {
    try {
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
        (await AsyncStorage.getItem('persist.hasCompletedImageOnboarding')) === 'true';

      // Gift includes: 1 character, 1 costume, 3 backgrounds, 10,000 VCoin, 100 Ruby
      // If user has completed onboarding but doesn't have any of these indicators,
      // they haven't claimed the gift yet
      const hasClaimedGift = hasCharacters || hasBackgrounds || hasGiftCurrency;

      // Show gift if onboarding is completed but gift hasn't been claimed
      if (hasCompletedImageOnboarding && !hasClaimedGift) {
        setShowNewUserGift(true);
      } else {
        setShowNewUserGift(false);
      }
    } catch (error) {
      console.error('[App] Error checking gift claim status:', error);
      const hasCompletedImageOnboarding =
        (await AsyncStorage.getItem('persist.hasCompletedImageOnboarding')) === 'true';
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
        (await AsyncStorage.getItem('persist.hasCompletedImageOnboarding')) === 'true';

      if (hasCharacters) {
        // User has characters, don't show onboarding images
        // Just check if they need the gift (they might not have rooms)
        setShowImageOnboarding(false);
        // Check gift claim status directly (without guard)
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
        (await AsyncStorage.getItem('persist.hasCompletedImageOnboarding')) === 'true';
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
    await AsyncStorage.setItem('persist.hasCompletedImageOnboarding', 'true');
    await AsyncStorage.setItem('persist.hasSeenImageOnboarding', 'true');
    setShowImageOnboarding(false);
    checkIfNewUser();
  }, [checkIfNewUser]);

  const handleImageOnboardingSkip = useCallback(async () => {
    await AsyncStorage.setItem('persist.hasCompletedImageOnboarding', 'true');
    await AsyncStorage.setItem('persist.hasSeenImageOnboarding', 'true');
    setShowImageOnboarding(false);
    checkIfNewUser();
  }, [checkIfNewUser]);

  const handleNewUserGiftComplete = useCallback(
    async (characterId: string | null) => {
      setShowNewUserGift(false);
      if (characterId) {
        try {
          const userPrefsService = new UserPreferencesService();
          await userPrefsService.saveCurrentCharacterId(characterId);
        } catch (error) {
          console.error('[App] Error saving character after gift:', error);
        }
      }
      refreshInitialData();
    },
    [refreshInitialData]
  );

  useEffect(() => {
    if (hasRestoredSession && session) {
      checkIfNewUserForOnboarding();
    }
  }, [hasRestoredSession, session, checkIfNewUserForOnboarding]);

  const renderContent = () => {
    if (!hasRestoredSession) {
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
            isLoading={isLoading}
            errorMessage={errorMessage}
            onSignInWithApple={() => authManager.signInWithApple()}
            onSignInWithGoogle={() => authManager.signInWithGoogle()}
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

    if (shouldWaitForInitialData) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" />
          <InitialLoadingScreen
            loading={initialDataLoading}
            error={initialDataError?.message ?? null}
            onRetry={refreshInitialData}
          />
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
          onLevelPress={() => console.log('📈 Level sheet placeholder')}
          onEnergyPress={() => console.log('⚡ Energy sheet placeholder')}
          onCurrencyPress={handleCurrencyPress}
          onBackgroundPress={() => setShowBackgroundSheet(true)}
          onCostumePress={() => setShowCostumeSheet(true)}
          onQuestPress={() => console.log('🏁 Quest sheet placeholder')}
          onCalendarPress={() => setShowLoginRewardSheet(true)}
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
        <CurrencyPurchaseSheet
          visible={showCurrencySheet}
          onClose={() => setShowCurrencySheet(false)}
          onPurchaseComplete={handleCurrencyPurchaseComplete}
        />
        <LoginRewardSheet
          visible={showLoginRewardSheet}
          onClose={() => setShowLoginRewardSheet(false)}
          rewards={loginRewards.rewards}
          currentDay={loginRewards.status.currentDay}
          canClaimToday={loginRewards.status.canClaimToday}
          hasClaimedToday={loginRewards.status.hasClaimedToday}
          loading={loginRewards.loading}
          claiming={loginRewards.claiming}
          onRefresh={loginRewards.refresh}
          onClaim={async () => {
            await loginRewards.claimToday();
          }}
        />
        <BackgroundSheet
          isOpened={showBackgroundSheet}
          onIsOpenedChange={setShowBackgroundSheet}
          onSelect={(item) => {
            void handleBackgroundSelect(item);
          }}
        />
        <CostumeSheet
          visible={showCostumeSheet}
          onClose={() => setShowCostumeSheet(false)}
          onSelect={(item) => {
            void handleCostumeSelect(item);
          }}
          characterId={currentCharacter?.id}
        />
        <CharacterSheet
          isOpened={showCharacterSheet}
          onIsOpenedChange={setShowCharacterSheet}
          onSelect={(item) => {
            void handleCharacterSelect(item);
          }}
        />
        <SettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          email={session?.user?.email ?? null}
          displayName={
            (session?.user?.user_metadata as Record<string, any> | undefined)?.display_name ??
            session?.user?.email ??
            null
          }
        />
      </View>
    );
  };

  return renderContent();
};

export default function App() {
  return (
    <VRMProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerTransparent: true,
              headerTitleAlign: 'center',
              headerTintColor: '#fff',
              contentStyle: { backgroundColor: '#000' },
            }}
          >
            <Stack.Screen
              name="Experience"
              component={AppContent}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </VRMProvider>
  );
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
});
