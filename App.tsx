import React, { useRef, useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import { ActivityIndicator, StyleSheet, View, StatusBar, Platform, Linking, Alert, Keyboard, Text, ScrollView } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ElevenLabsProvider } from '@elevenlabs/react-native';
import { VRMWebView } from './src/components/VRMWebView';
import { VRMUIOverlay } from './src/components/VRMUIOverlay';
import { WebSceneBridge } from './src/utils/WebSceneBridge';
import { SwiftUIDemoScreen } from './src/screens/SwiftUIDemoScreen';
import { InitialLoadingScreen } from './src/components/InitialLoadingScreen';
import { useUserStats } from './src/hooks/useUserStats';
import { SignInScreen } from './src/screens/SignInScreen';
import { ImageOnboardingScreen } from './src/screens/ImageOnboardingScreen';
import { NewUserGiftScreen } from './src/screens/NewUserGiftScreen';
import { authManager } from './src/services/AuthManager';
import { ChatBottomOverlay } from './src/components/chat/ChatBottomOverlay';
import { SettingsModal } from './src/components/settings/SettingsModal';
import { useChatManager } from './src/hooks/useChatManager';
import { useVoiceConversation } from './src/hooks/useVoiceConversation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AssetRepository from './src/repositories/AssetRepository';
import { UserPreferencesService } from './src/services/UserPreferencesService';
import { UserCharacterPreferenceService } from './src/services/UserCharacterPreferenceService';
import { VRMProvider, useVRMContext } from './src/context/VRMContext';
import { AppSheets } from './src/components/AppSheets';
import { CharacterQuickSwitcher } from './src/components/CharacterQuickSwitcher';
import { BackgroundItem } from './src/repositories/BackgroundRepository';
import { CharacterItem, CharacterRepository } from './src/repositories/CharacterRepository';
import { type CostumeItem, CostumeRepository } from './src/repositories/CostumeRepository';
import { CharacterHeaderCard, HeaderIconButton } from './src/components/header/SceneHeaderComponents';
import { LoginRewardCalendarModal } from './src/components/sheets/LoginRewardCalendarModal';
import { useLoginRewards } from './src/hooks/useLoginRewards';
import { useQuests } from './src/hooks/useQuests';
import { SceneActionsProvider } from './src/context/SceneActionsContext';
import { PurchaseProvider, usePurchaseContext } from './src/context/PurchaseContext';
import { backgroundMusicManager } from './src/services/BackgroundMusicManager';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { QuestProgressTracker } from './src/utils/QuestProgressTracker';

type RootStackParamList = {
  Experience: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type ExperienceNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Experience'>;

import { LEGAL_URLS } from './src/constants/appConstants';

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
  } = useVRMContext();
  const { session, isLoading, errorMessage, hasRestoredSession } = authState;

  const navigation = useNavigation<ExperienceNavigationProp>();
  const webViewRef = useRef<any>(null);
  const webBridgeRef = useRef<WebSceneBridge | null>(null);
  const agentIdCacheRef = useRef<Map<string, string>>(new Map());
  const characterRepoRef = useRef<CharacterRepository | null>(null);
  const lastBgmBeforeVoiceRef = useRef(false);
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
  const [showQuestSheet, setShowQuestSheet] = useState(false);
  const [showLoginRewardsSheet, setShowLoginRewardsSheet] = useState(false);
  const [showEnergySheet, setShowEnergySheet] = useState(false);
  const [showLevelSheet, setShowLevelSheet] = useState(false);
  const [showCharacterDetailSheet, setShowCharacterDetailSheet] = useState(false);
  const [isCheckingNewUser, setIsCheckingNewUser] = useState(false);
  const { stats: overlayStats, refresh: refreshStats } = useUserStats();
  const [showMediaSheet, setShowMediaSheet] = useState(false);
  const [allCharacters, setAllCharacters] = useState<CharacterItem[]>([]);
  const [ownedCharacterIds, setOwnedCharacterIds] = useState<Set<string>>(new Set());
  const {
    refresh: refreshCurrency,
    setPurchaseCompleteCallback,
    confirmPurchase,
    confirmCostumePurchase,
    confirmBackgroundPurchase,
    clearConfirmPurchaseRequest,
    performPurchase,
    handlePurchaseError,
    resumePendingPurchase,
    showBackgroundSheet,
    setShowBackgroundSheet,
    showCharacterSheet,
    setShowCharacterSheet,
    showCostumeSheet,
    setShowCostumeSheet,
  } = usePurchaseContext();
  const [isBgmOn, setIsBgmOn] = useState(false);
  const isBgmOnRef = useRef(false);
  const [isCameraModeOn, setIsCameraModeOn] = useState(false);
  const [autoPlayMusic, setAutoPlayMusic] = useState(false);
  const {
    state: loginRewardState,
    load: loadLoginRewards,
    claimToday: claimLoginReward,
    isClaiming: isClaimingLoginReward,
  } = useLoginRewards();
  const quests = useQuests(hasRestoredSession && !!session);
  const activeCharacterId = currentCharacter?.id ?? initialData?.character.id;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ensureWebBridge = useCallback(() => {
    if (webViewRef.current && !webBridgeRef.current) {
      webBridgeRef.current = new WebSceneBridge(webViewRef);
      console.log('✅ [App] WebSceneBridge initialized');
    }
  }, []);


  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    QuestProgressTracker.setDelegate(quests.trackProgress);
    return () => {
      QuestProgressTracker.setDelegate(null);
    };
  }, [quests.trackProgress]);

  // Load all characters and owned characters
  useEffect(() => {
    if (!session) return;
    
    const loadCharacters = async () => {
      try {
        const characterRepo = new CharacterRepository();
        const assetRepo = new AssetRepository();
        
        const [characters, owned] = await Promise.all([
          characterRepo.fetchAllCharacters(),
          assetRepo.fetchOwnedAssets('character'),
        ]);
        
        // Filter to only owned characters
        const ownedCharacters = characters.filter(c => owned.has(c.id));
        setAllCharacters(ownedCharacters);
        setOwnedCharacterIds(owned);
      } catch (error) {
        console.warn('[App] Failed to load characters for quick switcher:', error);
      }
    };
    
    loadCharacters();
  }, [session, activeCharacterId]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);
  
  // Mute BGM if needed (when agent speaks) - must be defined before handleAgentReply
  const muteBgmIfNeeded = useCallback(async () => {
    if (autoPlayMusic) {
      return; // Don't mute if autoPlayMusic is enabled
    }
    try {
      const webView = webViewRef.current;
      if (webView) {
        await webView.injectJavaScript(`
          (function() {
            try {
              if (window.setBgm) {
                window.setBgm(false);
              }
            } catch(e) {
              console.warn('Failed to mute BGM:', e);
            }
          })();
        `);
      }
    } catch (error) {
      console.warn('[App] Failed to mute BGM:', error);
    }
  }, [autoPlayMusic]);

  const handleAgentReply = useCallback(async (text: string) => {
    await muteBgmIfNeeded();
    webBridgeRef.current?.playSpeech(text);
  }, [muteBgmIfNeeded]);
  const {
    state: chatState,
    toggleChatList: toggleChatListInternal,
    openHistory,
    closeHistory,
    sendText: sendGeminiText,
    loadMoreHistory,
    addAgentMessage,
    addUserMessage,
  } = useChatManager(activeCharacterId, { onAgentReply: handleAgentReply });

  const {
    state: voiceState,
    startCall,
    endCall,
    sendText: sendVoiceText,
  } = useVoiceConversation({
    onAgentResponse: text => {
      if (!text?.trim()) {
        return;
      }
      addAgentMessage(text);
    },
    onUserTranscription: text => {
      if (!text?.trim()) {
        return;
      }
      addUserMessage(text);
    },
    onAgentVolume: volume => {
      if (webBridgeRef.current) {
        webBridgeRef.current.setMouthOpen(volume);
      }
    },
    onConnectionChange: connected => {
      if (!connected && webBridgeRef.current) {
        webBridgeRef.current.setMouthOpen(0);
      }
    },
    onError: message => Alert.alert('Voice call', message),
  });

  useEffect(() => {
    const character = initialData?.character;
    if (character?.id && character.agent_elevenlabs_id) {
      agentIdCacheRef.current.set(character.id, character.agent_elevenlabs_id);
    }
  }, [initialData?.character]);
  const handleOverlayChatToggle = () => {
    toggleChatListInternal();
  };

  const handleCurrencyPurchaseComplete = useCallback(async (payload: { vcoinAdded: number; rubyAdded: number }) => {
    await refreshCurrency();
    
    // Track quest progress for payment
    await QuestProgressTracker.track('make_payment');
    
    // Resume pending purchase after currency refresh (like Swift version with 0.2s delay)
    setTimeout(async () => {
      const result = await resumePendingPurchase();
      if (result?.type === 'costume') {
        // Apply costume after successful purchase (like Swift version)
        try {
          const assetRepo = new AssetRepository();
          const costumeRepo = new CostumeRepository();
          const costume = await costumeRepo.fetchCostumeById(result.itemId);
          
          if (costume && currentCharacter) {
            await UserCharacterPreferenceService.applyCostumeById(costume.id, webViewRef);
            await UserCharacterPreferenceService.saveUserCharacterPreference(currentCharacter.id, {
              current_costume_id: costume.id,
            });
            setShowCostumeSheet(false);
            console.log('✅ [App] Costume applied after resume purchase');
          }
        } catch (error) {
          console.error('❌ [App] Failed to apply costume after resume purchase:', error);
        }
      }
    }, 200);
  }, [refreshCurrency, resumePendingPurchase, currentCharacter, webViewRef]);

  const handleCalendarPress = useCallback(() => {
    setShowLoginRewardsSheet(true);
    if (!loginRewardState.loaded && !loginRewardState.isLoading) {
      loadLoginRewards();
    }
  }, [loginRewardState.loaded, loginRewardState.isLoading, loadLoginRewards]);

  const handleClaimLoginReward = useCallback(async () => {
    const result = await claimLoginReward();
    if (result.success) {
      await Promise.all([refreshCurrency(), refreshStats()]);
      const rewardParts: string[] = [];
      if (result.reward.reward_vcoin > 0) {
        rewardParts.push(`${result.reward.reward_vcoin} VCoin`);
      }
      if (result.reward.reward_ruby > 0) {
        rewardParts.push(`${result.reward.reward_ruby} Ruby`);
      }
      if (result.reward.reward_energy > 0) {
        rewardParts.push(`${result.reward.reward_energy} Energy`);
      }
      Alert.alert(
        '🎁 Reward claimed',
        rewardParts.length ? rewardParts.join(' + ') : 'You have claimed the reward successfully!'
      );
    } else if (result.error) {
      Alert.alert('Unable to claim reward', result.error);
    }
  }, [claimLoginReward, refreshCurrency, refreshStats]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);



  const handleCharacterCardPress = useCallback(() => {
    setShowCharacterSheet(true);
  }, [setShowCharacterSheet]);

  const resolveAgentId = useCallback(async (): Promise<string | null> => {
    if (!activeCharacterId) {
      return null;
    }
    const cached = agentIdCacheRef.current.get(activeCharacterId);
    if (cached) {
      return cached;
    }
    try {
      if (!characterRepoRef.current) {
        characterRepoRef.current = new CharacterRepository();
      }
      const character = await characterRepoRef.current.fetchCharacter(activeCharacterId);
      const agentId = character?.agent_elevenlabs_id ?? null;
      if (agentId) {
        agentIdCacheRef.current.set(activeCharacterId, agentId);
      }
      return agentId;
    } catch (error) {
      console.warn('[App] Failed to resolve ElevenLabs agent id:', error);
      return null;
    }
  }, [activeCharacterId]);

  const handleToggleMic = useCallback(async () => {
    if (voiceState.isBooting || voiceState.status === 'connecting') {
      return;
    }
    if (!activeCharacterId) {
      Alert.alert('Voice unavailable', 'Please select a character before starting a call.');
      return;
    }
    if (voiceState.isConnected) {
      await endCall();
      return;
    }
    const agentId = await resolveAgentId();
    if (!agentId) {
      Alert.alert('Voice unavailable', 'This character does not have a voice agent available yet.');
      return;
    }
    try {
      await startCall({
        agentId,
        userId: session?.user?.id,
      });
    } catch {
      // Error is handled inside useVoiceConversation
    }
  }, [voiceState.isBooting, voiceState.status, voiceState.isConnected, activeCharacterId, endCall, resolveAgentId, startCall, session?.user?.id]);

  const handleQuestPress = useCallback(() => {
    if (!session) {
      Alert.alert('Sign in required', 'Please sign in to view quests.');
      return;
    }
    setShowQuestSheet(true);
  }, [session]);

  const handleSendChatText = useCallback(
    (text: string) => {
      if (voiceState.isConnected) {
        addUserMessage(text);
        sendVoiceText(text);
        return;
      }
      sendGeminiText(text);
    },
    [voiceState.isConnected, addUserMessage, sendVoiceText, sendGeminiText]
  );

  const ensureMediaPermission = useCallback(async () => {
    const current = await MediaLibrary.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    const requested = await MediaLibrary.requestPermissionsAsync(true);
    return requested.granted;
  }, []);

  const presentSavedToast = useCallback(() => {
    setShowSavedToast(true);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setShowSavedToast(false);
      toastTimeoutRef.current = null;
    }, 2000);
  }, []);

  const handleCapture = useCallback(async () => {
    if (!webViewRef.current || isSavingSnapshot) {
      return;
    }
    setIsSavingSnapshot(true);
    try {
      const hasPermission = await ensureMediaPermission();
      if (!hasPermission) {
        Alert.alert(
          'Photo access required',
          'Please allow the app to save shots to your photo library.'
        );
        return;
      }

      const snapshotUri = await captureRef(webViewRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      await MediaLibrary.saveToLibraryAsync(snapshotUri);
      await FileSystem.deleteAsync(snapshotUri, { idempotent: true }).catch(() => undefined);

      presentSavedToast();
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Ignore haptic errors
      }

      await QuestProgressTracker.trackMany(['capture_characters', 'capture_backgrounds']);
    } catch (error) {
      console.error('[App] Failed to capture snapshot:', error);
      Alert.alert('Unable to save image', 'Please try again in a moment.');
    } finally {
      setIsSavingSnapshot(false);
    }
  }, [ensureMediaPermission, isSavingSnapshot, presentSavedToast]);

  const handleSendPhoto = useCallback(() => {
    if (!activeCharacterId) {
      Alert.alert(
        'Unable to open gallery',
        'Please select a character before viewing media.'
      );
      return;
    }
    setShowMediaSheet(true);
  }, [activeCharacterId]);

  const handleDance = useCallback(() => {
    ensureWebBridge();
    if (!webBridgeRef.current) {
      console.warn('[App] Dance requested before WebView ready');
      return;
    }
    try {
      webBridgeRef.current.triggerDance();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      QuestProgressTracker.track('dance_character').catch(error =>
        console.warn('[App] Failed to track dance quest progress:', error)
      );
    } catch (error) {
      console.error('[App] Failed to trigger dance:', error);
    }
  }, [ensureWebBridge]);

  const characterTitle = useMemo(() => {
    if (currentCharacter?.name?.trim()) {
      return currentCharacter.name.trim();
    }
    const fallback = initialData?.character?.name?.trim();
    return fallback ?? '';
  }, [currentCharacter?.name, initialData?.character?.name]);

  const handleToggleCameraMode = useCallback(() => {
    setIsCameraModeOn(prev => {
      const next = !prev;
      console.log(next ? '🎥 Camera mode on' : '🎥 Camera mode off');
      return next;
    });
  }, []);

  const handleCharacterSelect = useCallback(
    async (item: CharacterItem) => {
      try {
        const assetRepo = new AssetRepository();
        let ownedCharacterIds = await assetRepo.fetchOwnedAssets('character');
        let isOwned = ownedCharacterIds.has(item.id);
        const wasOwned = isOwned;

        if (!isOwned) {
          const priceVcoin = item.price_vcoin ?? 0;
          const priceRuby = item.price_ruby ?? 0;
          const isFree = priceVcoin === 0 && priceRuby === 0;

          if (isFree) {
            const success = await assetRepo.createAsset(item.id, 'character');
            if (!success) {
              Alert.alert('Unable to add character', 'Please try again later.');
              return;
            }
          } else {
            const confirmed = await confirmPurchase('Purchase Character', priceVcoin, priceRuby);
            if (!confirmed) {
              return;
            }
            try {
              await performPurchase({
                itemId: item.id,
                itemType: 'character',
                priceVcoin,
                priceRuby,
              });
            } catch (error) {
              handlePurchaseError(error);
              return;
            }
          }

          ownedCharacterIds = await assetRepo.fetchOwnedAssets('character');
          isOwned = ownedCharacterIds.has(item.id);
          
          const totalOwnedCharacters = ownedCharacterIds.size;
          const unlockedNow = !wasOwned && isOwned;
          
          if (unlockedNow) {
            await QuestProgressTracker.track('unlock_character');
            if (QuestProgressTracker.shouldTrackCollectionMilestone(totalOwnedCharacters)) {
              await QuestProgressTracker.track('obtain_characters');
            }
          }
        }

        if (!isOwned) {
          Alert.alert('Unable to purchase character', 'Please try again later.');
          return;
        }

        if (item.agent_elevenlabs_id) {
          agentIdCacheRef.current.set(item.id, item.agent_elevenlabs_id);
        }

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
        setShowCharacterSheet(false);
      } catch (error) {
        console.error('❌ Error selecting character:', error);
        Alert.alert('Error', 'Failed to select character');
      }
    },
    [
      confirmPurchase,
      handlePurchaseError,
      performPurchase,
      refreshInitialData,
      setCurrentCharacterState,
    ]
  );

  const handleCharacterSelectByIndex = useCallback(
    async (index: number) => {
      if (index < 0 || index >= allCharacters.length) return;
      const character = allCharacters[index];
      if (character) {
        await handleCharacterSelect(character);
      }
    },
    [allCharacters, handleCharacterSelect]
  );

  const currentCharacterIndex = useMemo(() => {
    if (!activeCharacterId || allCharacters.length === 0) return 0;
    const index = allCharacters.findIndex(c => c.id === activeCharacterId);
    return index >= 0 ? index : 0;
  }, [activeCharacterId, allCharacters]);

  const handleBackgroundSelect = useCallback(
    async (item: BackgroundItem) => {
      try {
        const assetRepo = new AssetRepository();
        let ownedBackgroundIds = await assetRepo.fetchOwnedAssets('background');
        const alreadyOwned = ownedBackgroundIds.has(item.id);

        const applyBackground = async (ownedSet: Set<string>) => {
          if (!currentCharacter) {
            return;
          }
          await UserCharacterPreferenceService.applyBackgroundById(
            item.id,
            webViewRef,
            ownedSet
          );
          await UserCharacterPreferenceService.saveUserCharacterPreference(currentCharacter.id, {
            current_background_id: item.id,
          });
          setShowBackgroundSheet(false);
        };

        if (alreadyOwned) {
          await applyBackground(ownedBackgroundIds);
          clearConfirmPurchaseRequest();
          return;
        }

        const priceVcoin = item.price_vcoin ?? 0;
        const priceRuby = item.price_ruby ?? 0;
        const isFree = priceVcoin === 0 && priceRuby === 0;

        if (isFree) {
          const success = await assetRepo.createAsset(item.id, 'background');
          if (!success) {
            Alert.alert('Unable to add background', 'Please try again later.');
            return;
          }
        } else {
          const choice = await confirmBackgroundPurchase(item);
          console.log('🎯 [BackgroundSelect] Purchase choice:', choice);
          if (!choice) {
            console.log('⚠️ [BackgroundSelect] No purchase choice, returning');
            return;
          }

          const finalPriceVcoin = choice.useVcoin ? priceVcoin : 0;
          const finalPriceRuby = choice.useRuby ? priceRuby : 0;

          console.log('💳 [BackgroundSelect] Final prices:', { finalPriceVcoin, finalPriceRuby });

          try {
            await performPurchase({
              itemId: item.id,
              itemType: 'background',
              priceVcoin: finalPriceVcoin,
              priceRuby: finalPriceRuby,
            });
          } catch (error) {
            handlePurchaseError(error);
            clearConfirmPurchaseRequest();
            return;
          }
        }

        ownedBackgroundIds = await assetRepo.fetchOwnedAssets('background');
        const nowOwned = ownedBackgroundIds.has(item.id);
        await applyBackground(ownedBackgroundIds);

        if (!alreadyOwned && nowOwned) {
          await QuestProgressTracker.track('unlock_background');
          if (QuestProgressTracker.shouldTrackCollectionMilestone(ownedBackgroundIds.size)) {
            await QuestProgressTracker.track('obtain_backgrounds');
          }
        }

        clearConfirmPurchaseRequest();
      } catch (error) {
        console.error('❌ Error selecting background:', error);
        Alert.alert('Error', 'Failed to select background');
        clearConfirmPurchaseRequest();
      }
    },
    [
      clearConfirmPurchaseRequest,
      confirmBackgroundPurchase,
      currentCharacter,
      handlePurchaseError,
      performPurchase,
      webViewRef,
    ]
  );

  const handleCostumeSelect = useCallback(
    async (item: CostumeItem) => {
      if (!currentCharacter) {
        Alert.alert('Select Character', 'Please select a character before changing costumes.');
        return;
      }

      try {
        const assetRepo = new AssetRepository();
        let ownedCostumeIds = await assetRepo.fetchOwnedAssets('character_costume');
        const alreadyOwned = ownedCostumeIds.has(item.id);

        const applyCostume = async () => {
          await UserCharacterPreferenceService.applyCostumeById(item.id, webViewRef);
          await UserCharacterPreferenceService.saveUserCharacterPreference(currentCharacter.id, {
            current_costume_id: item.id,
          });
        };

        if (alreadyOwned) {
          await applyCostume();
          clearConfirmPurchaseRequest();
          return;
        }

        const priceVcoin = item.price_vcoin ?? 0;
        const priceRuby = item.price_ruby ?? 0;
        const isFree = priceVcoin === 0 && priceRuby === 0;

        if (isFree) {
          const success = await assetRepo.createAsset(item.id, 'character_costume');
          if (!success) {
            Alert.alert('Unable to add costume', 'Please try again in a moment.');
            return;
          }
          ownedCostumeIds = await assetRepo.fetchOwnedAssets('character_costume');
        } else {
          const choice = await confirmCostumePurchase(item);
          console.log('🎯 [CostumeSelect] Purchase choice:', choice);
          if (!choice) {
            console.log('⚠️ [CostumeSelect] No purchase choice, returning');
            return;
          }

          const finalPriceVcoin = choice.useVcoin ? priceVcoin : 0;
          const finalPriceRuby = choice.useRuby ? priceRuby : 0;

          console.log('💳 [CostumeSelect] Final prices:', { finalPriceVcoin, finalPriceRuby });

          try {
            await performPurchase({
              itemId: item.id,
              itemType: 'character_costume',
              priceVcoin: finalPriceVcoin,
              priceRuby: finalPriceRuby,
            });
            ownedCostumeIds = await assetRepo.fetchOwnedAssets('character_costume');
          } catch (error) {
            console.error('❌ [CostumeSelect] Purchase error:', error);
            handlePurchaseError(error);
            clearConfirmPurchaseRequest();
            return;
          }
        }

        if (!alreadyOwned && ownedCostumeIds.has(item.id)) {
          await QuestProgressTracker.track('unlock_costume');
        }

        await applyCostume();
        setShowCostumeSheet(false);
        clearConfirmPurchaseRequest();
      } catch (error) {
        console.error('❌ Error selecting costume:', error);
        Alert.alert('Error', 'Failed to select costume');
        clearConfirmPurchaseRequest();
      }
    },
    [
      clearConfirmPurchaseRequest,
      confirmCostumePurchase,
      currentCharacter,
      handlePurchaseError,
      performPurchase,
      webViewRef,
    ]
  );

  useEffect(() => {
    setOverlayFlags(prev => ({ ...prev, showChatList: chatState.showChatList }));
  }, [chatState.showChatList]);

  useEffect(() => {
    isBgmOnRef.current = isBgmOn;
  }, [isBgmOn]);

  const previousCallConnectedRef = useRef(false);
  const callStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const applyVoiceState = async () => {
      if (voiceState.isConnected) {
        if (!previousCallConnectedRef.current) {
          // Call just started
          callStartTimeRef.current = Date.now();
        }
        lastBgmBeforeVoiceRef.current = isBgmOnRef.current;
        webBridgeRef.current?.setCallMode(true);
        if (isBgmOnRef.current) {
          try {
            await backgroundMusicManager.pause();
            if (!cancelled) {
              setIsBgmOn(false);
            }
          } catch (error) {
            console.warn('[App] Failed to pause BGM for voice call:', error);
          }
        }
      } else {
        // Call ended - track quest progress
        if (previousCallConnectedRef.current && callStartTimeRef.current) {
          const callDurationSeconds = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
          if (callDurationSeconds > 0) {
            const minutes = Math.max(1, Math.floor(callDurationSeconds / 60));
            const questType = isCameraModeOn ? 'video_call' : 'voice_call';
            try {
              await QuestProgressTracker.track(questType, minutes);
            } catch (error) {
              console.warn('[App] Failed to track call quest progress:', error);
            }
          }
          callStartTimeRef.current = null;
        }
        
        webBridgeRef.current?.setCallMode(false);
        if (lastBgmBeforeVoiceRef.current) {
          try {
            await backgroundMusicManager.play();
            if (!cancelled) {
              setIsBgmOn(true);
            }
          } catch (error) {
            console.warn('[App] Failed to resume BGM after voice call:', error);
          }
        }
        lastBgmBeforeVoiceRef.current = false;
      }
      previousCallConnectedRef.current = voiceState.isConnected;
    };
    applyVoiceState();
    return () => {
      cancelled = true;
    };
  }, [voiceState.isConnected, isCameraModeOn]);

  useEffect(() => {
    setOverlayFlags(prev => ({ ...prev, hasIncompleteQuests: quests.hasIncompleteDaily }));
  }, [quests.hasIncompleteDaily]);


  const endCallRef = useRef(endCall);
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  useEffect(() => {
    return () => {
      endCallRef.current();
    };
  }, []);

  useEffect(() => {
    if (!session && voiceState.isConnected) {
      endCallRef.current();
    }
  }, [session, voiceState.isConnected]);

  const sceneActions = useMemo(
    () => ({
      selectCharacter: handleCharacterSelect,
      selectBackground: handleBackgroundSelect,
      selectCostume: handleCostumeSelect,
    }),
    [handleBackgroundSelect, handleCharacterSelect, handleCostumeSelect]
  );

  useEffect(() => {
    if (!hasRestoredSession || !session) {
      return;
    }
    refreshStats();
    refreshCurrency();
    loadLoginRewards();
  }, [hasRestoredSession, session, refreshStats, refreshCurrency, loadLoginRewards]);

  // Load autoPlayMusic setting
  useEffect(() => {
    const loadAutoPlayMusic = async () => {
      if (!hasRestoredSession || !session) {
        return;
      }
      const stored = await AsyncStorage.getItem('settings.autoPlayMusic');
      const value = stored === 'true';
      setAutoPlayMusic(value);
      if (value) {
        await backgroundMusicManager.play();
        setIsBgmOn(true);
      } else {
        await backgroundMusicManager.pause();
        setIsBgmOn(false);
      }
    };
    loadAutoPlayMusic();
  }, [hasRestoredSession, session]);

  // Handle BGM toggle
  const handleToggleBgm = useCallback(async () => {
    const playing = await backgroundMusicManager.toggle();
    setIsBgmOn(playing);
    console.log(playing ? '🔊 [App] BGM on' : '🔇 [App] BGM off');
  }, []);

  useEffect(() => {
    setPurchaseCompleteCallback(handleCurrencyPurchaseComplete);
    return () => {
      setPurchaseCompleteCallback(undefined);
    };
  }, [handleCurrencyPurchaseComplete, setPurchaseCompleteCallback]);

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

  useEffect(() => {
    ensureWebBridge();
    ensureInitialModelApplied(webViewRef);
    
    // Initialize RevenueCat
    import('./src/services/RevenueCatManager').then(({ revenueCatManager }) => {
      revenueCatManager.configure();
    });
  }, [ensureInitialModelApplied, ensureWebBridge]);

  useEffect(() => {
    setOverlayFlags(prev => ({
      ...prev,
      canClaimCalendar: loginRewardState.canClaimToday,
    }));
  }, [loginRewardState.canClaimToday]);

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

  const shouldShowSignIn = hasRestoredSession && !session;
  const shouldWaitForInitialData =
    !!session && (!initialData || initialDataLoading || !!initialDataError);
  const showMainExperience =
    hasRestoredSession &&
    !!session &&
    !shouldShowSignIn &&
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
          name={characterTitle}
          relationshipName={currentCharacter?.relationshipName}
          relationshipProgress={currentCharacter?.relationshipProgress ?? 0}
          avatarUri={currentCharacter?.avatar}
          relationshipIconUri={currentCharacter?.relationshipIconUri}
          onPress={handleCharacterCardPress}
        />
      ),
      headerLeft: () => (
        <View style={styles.headerActions}>
          <HeaderIconButton
            iconName="settings"
            onPress={handleOpenSettings}
            accessibilityLabel="Open settings"
          />
          <HeaderIconButton
            iconName={isBgmOn ? 'volume-high' : 'volume-mute'}
            onPress={handleToggleBgm}
            accessibilityLabel="Toggle background music"
            active={isBgmOn}
          />
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerActions}>
          <HeaderIconButton
            iconName="grid"
            onPress={() => setShowCharacterSheet(true)}
            accessibilityLabel="Character menu"
          />
          <HeaderIconButton
            iconName={isCameraModeOn ? 'stop-circle' : 'videocam'}
            onPress={handleToggleCameraMode}
            accessibilityLabel="Camera mode"
            active={isCameraModeOn}
          />
        </View>
      ),
    });
  }, [
    navigation,
    showMainExperience,
    characterTitle,
    currentCharacter?.relationshipName,
    currentCharacter?.relationshipProgress,
    currentCharacter?.avatar,
    currentCharacter?.relationshipIconUri,
    handleCharacterCardPress,
    handleOpenSettings,
    handleToggleBgm,
    isBgmOn,
    setShowCharacterSheet,
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
      await Promise.all([refreshInitialData(), refreshCurrency()]);
    },
    [refreshInitialData, refreshCurrency]
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

    if (shouldShowSignIn) {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" />
          <SignInScreen
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
          hasIncompleteQuests={overlayFlags.hasIncompleteQuests}
          canClaimCalendar={overlayFlags.canClaimCalendar}
          hasMessages={overlayFlags.hasMessages}
          showChatList={overlayFlags.showChatList}
          onLevelPress={() => setShowLevelSheet(true)}
          onEnergyPress={() => setShowEnergySheet(true)}
          onBackgroundPress={() => setShowBackgroundSheet(true)}
          onCostumePress={() => setShowCostumeSheet(true)}
          onQuestPress={handleQuestPress}
          onCalendarPress={handleCalendarPress}
          onToggleChatList={handleOverlayChatToggle}
        />
        {showSavedToast ? (
          <View pointerEvents="none" style={styles.savedToastContainer}>
            <Text style={styles.savedToastText}>Saved to Photos</Text>
          </View>
        ) : null}
        <View pointerEvents="box-none" style={styles.chatOverlay}>
          <ChatBottomOverlay
            messages={chatState.messages}
            showChatList={chatState.showChatList}
            onSendText={handleSendChatText}
            onCapture={handleCapture}
            onSendPhoto={handleSendPhoto}
            onDance={handleDance}
            isTyping={chatState.isTyping}
            onToggleMic={handleToggleMic}
            inputPlaceholder={
              voiceState.isBooting
                ? 'Preparing voice call...'
                : voiceState.isConnected
                  ? 'Voice call active — type to send instantly'
                  : undefined
            }
            inputDisabled={voiceState.isBooting || voiceState.status === 'connecting'}
            streakDays={chatState.streakDays}
            hasUnclaimed={chatState.hasUnclaimed}
            showStreakConfetti={chatState.showStreakConfetti}
            onStreakTap={() => setShowLoginRewardsSheet(true)}
            onOpenHistory={openHistory}
          />
        </View>
        <CharacterQuickSwitcher
          characters={allCharacters}
          currentIndex={currentCharacterIndex}
          onCharacterTap={handleCharacterSelectByIndex}
          onAddCharacter={() => setShowCharacterSheet(true)}
          isInputActive={isKeyboardVisible || chatState.showChatList}
          keyboardHeight={0}
          isModelLoading={false}
        />
        <AppSheets
          showQuestSheet={showQuestSheet}
          setShowQuestSheet={setShowQuestSheet}
          quests={quests}
          showBackgroundSheet={showBackgroundSheet}
          setShowBackgroundSheet={setShowBackgroundSheet}
          showCharacterSheet={showCharacterSheet}
          setShowCharacterSheet={setShowCharacterSheet}
          showCostumeSheet={showCostumeSheet}
          setShowCostumeSheet={setShowCostumeSheet}
          activeCharacterId={activeCharacterId}
          showMediaSheet={showMediaSheet}
          setShowMediaSheet={setShowMediaSheet}
          characterName={currentCharacter?.name ?? initialData?.character.name}
          showCharacterDetailSheet={showCharacterDetailSheet}
          setShowCharacterDetailSheet={setShowCharacterDetailSheet}
          characterAvatarURL={currentCharacter?.avatar || initialData?.character.avatar || initialData?.character.thumbnail_url}
          characterDescription={initialData?.character.description}
          showLevelSheet={showLevelSheet}
          setShowLevelSheet={setShowLevelSheet}
          level={overlayStats.level}
          xp={overlayStats.xp}
          nextLevelXp={overlayStats.nextLevelXp}
          showEnergySheet={showEnergySheet}
          setShowEnergySheet={setShowEnergySheet}
          energy={overlayStats.energy}
          energyMax={overlayStats.energyMax}
          showLoginRewardsSheet={showLoginRewardsSheet}
          setShowLoginRewardsSheet={setShowLoginRewardsSheet}
          loginRewardState={loginRewardState}
          loadLoginRewards={loadLoginRewards}
          claimLoginReward={claimLoginReward}
          isClaimingLoginReward={isClaimingLoginReward}
          onClaimLoginReward={handleClaimLoginReward}
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

  const content = renderContent();
  return <SceneActionsProvider value={sceneActions}>{content}</SceneActionsProvider>;
};


export default function App() {
  return (
    <ElevenLabsProvider>
      <VRMProvider>
        <PurchaseProvider>
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
        </PurchaseProvider>
      </VRMProvider>
    </ElevenLabsProvider>
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
  savedToastContainer: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  savedToastText: {
    color: '#0F0F0F',
    fontSize: 13,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
  },
});
