import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View, StatusBar, Platform, Alert, Keyboard, Text, TouchableOpacity, Pressable, Linking, PanResponder, Animated } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { NavigationContainer, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ElevenLabsProvider } from '@elevenlabs/react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { mediaDevices, MediaStream, RTCView } from '@livekit/react-native-webrtc';
import { VRMWebView } from './src/components/VRMWebView';
import { VRMUIOverlay } from './src/components/VRMUIOverlay';
import { WebSceneBridge } from './src/utils/WebSceneBridge';
import { SwiftUIDemoScreen } from './src/screens/SwiftUIDemoScreen';
import { InitialLoadingScreen } from './src/components/InitialLoadingScreen';
import { useUserStats } from './src/hooks/useUserStats';
import { SignInScreen } from './src/screens/SignInScreen';
import { ImageOnboardingScreen } from './src/screens/ImageOnboardingScreen';
import { NewUserGiftScreen } from './src/screens/NewUserGiftScreen';
import { OnboardingV2Screen } from './src/screens/OnboardingV2Screen';
import { CharacterPreviewScreen } from './src/screens/CharacterPreviewScreen';
import { authManager } from './src/services/AuthManager';
import { ChatBottomOverlay } from './src/components/chat/ChatBottomOverlay';
import { SettingsModal } from './src/components/settings/SettingsModal';
import { SubscriptionSheet } from './src/components/sheets/SubscriptionSheet';
import { StreakRewardPopup } from './src/components/StreakRewardPopup';
import { useChatManager } from './src/hooks/useChatManager';
import { useAppVoiceCall } from './src/hooks/useAppVoiceCall';
import { useVoiceCall } from './src/hooks/useVoiceCall';
import { DetectedAction } from './src/services/ActionDetectionService';
import { VoiceLoadingOverlay } from './src/components/VoiceLoadingOverlay';
import { CallEndedModal } from './src/components/CallEndedModal';
import { CallQuotaService } from './src/services/CallQuotaService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AssetRepository from './src/repositories/AssetRepository';
import { UserPreferencesService } from './src/services/UserPreferencesService';
import { UserCharacterPreferenceService } from './src/services/UserCharacterPreferenceService';
import { VRMProvider, useVRMContext } from './src/context/VRMContext';
import { AppSheets } from './src/components/AppSheets';
import { StreakSheet, type StreakSheetRef } from './src/components/sheets/StreakSheet';
import { CharacterQuickSwitcher } from './src/components/CharacterQuickSwitcher';
import { BackgroundItem, BackgroundRepository } from './src/repositories/BackgroundRepository';
import { CharacterItem, CharacterRepository } from './src/repositories/CharacterRepository';
import { type CostumeItem, CostumeRepository } from './src/repositories/CostumeRepository';
import { SceneHeader } from './src/components/header/SceneHeaderComponents';
import { useLoginRewards } from './src/hooks/useLoginRewards';
import { useQuests } from './src/hooks/useQuests';
import { SceneActionsProvider } from './src/context/SceneActionsContext';
import { PurchaseProvider, usePurchaseContext } from './src/context/PurchaseContext';
import { SubscriptionProvider, useSubscription } from './src/context/SubscriptionContext';
import { backgroundMusicManager } from './src/services/BackgroundMusicManager';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { QuestProgressTracker } from './src/utils/QuestProgressTracker';
import { ToastStackView } from './src/components/toast/ToastStackView';
import { RewardClaimOverlay, type RewardItem } from './src/components/toast/RewardClaimOverlay';
import { Persistence } from './src/utils/persistence';
import { oneSignalService } from './src/services/OneSignalService';
import { analyticsService } from './src/services/AnalyticsService';
import { OTAAutoUpdate } from './src/services/OTA-update/OTAAutoUpdate';
import { AppsFlyerService } from './src/services/AppsFlyerService';
import { FacebookService } from './src/services/FacebookService';
import { TikTokService } from './src/services/TikTokService';

type RootStackParamList = {
  Experience: { purchaseCharacterId?: string; selectedCharacterId?: string } | undefined;
  CharacterPreview: { characters: CharacterItem[]; initialIndex?: number; ownedCharacterIds?: string[] };
  OnboardingV2: { selectedCharacterId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type ExperienceNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Experience'>;

import { LEGAL_URLS } from './src/constants/appConstants';

const AppContent = () => {
  // Debug: track re-renders
  const renderCountRef = React.useRef(0);
  renderCountRef.current += 1;
  console.log('[AppContent] Render #', renderCountRef.current);

  const {
    authState,
    initialData,
    refreshInitialData,
    ensureInitialModelApplied,
    currentCharacter,
    setCurrentCharacterState,
    setCurrentCostume,
  } = useVRMContext();
  const { session, isLoading, errorMessage, hasRestoredSession } = authState;

  const navigation = useNavigation<ExperienceNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'Experience'>>();
  const webViewRef = useRef<any>(null);
  const snapshotViewRef = useRef<View | null>(null);
  const webBridgeRef = useRef<WebSceneBridge | null>(null);
  const lastBgmBeforeVoiceRef = useRef(false);
  const [showSwiftUIDemo, setShowSwiftUIDemo] = useState(false);
  const [showCallEndedModal, setShowCallEndedModal] = useState(false);
  const [overlayFlags, setOverlayFlags] = useState({
    hasIncompleteQuests: true,
    canClaimCalendar: true,
    hasMessages: true,
    showChatList: false,
    unclaimedQuestCount: 0,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showImageOnboarding, setShowImageOnboarding] = useState(false);
  const [showNewUserGift, setShowNewUserGift] = useState(false);


  // Initialize from AuthManager flag if available to avoid flash
  const [showOnboardingV2, setShowOnboardingV2] = useState(() => {
    if (authManager.isNewUser !== null) {
      console.log('[App] Initializing OnboardingV2 state from AuthManager:', authManager.isNewUser);
      return authManager.isNewUser;
    }
    return false;
  });

  const [showQuestSheet, setShowQuestSheet] = useState(false);
  const [questSheetTabRequest, setQuestSheetTabRequest] = useState<{ tab: 'daily' | 'level'; token: number } | null>(null);
  const [showEnergySheet, setShowEnergySheet] = useState(false);
  const [streakRewardCostume, setStreakRewardCostume] = useState<CostumeItem | null>(null);
  const [streakRewardIsClaimed, setStreakRewardIsClaimed] = useState(false);
  const [showLevelSheet, setShowLevelSheet] = useState(false);
  const streakSheetRef = useRef<StreakSheetRef>(null);
  const [showCharacterDetailSheet, setShowCharacterDetailSheet] = useState(false);
  const [isCheckingNewUser, setIsCheckingNewUser] = useState(false);
  const { stats: overlayStats, refresh: refreshStats, consumeEnergy, refillEnergy } = useUserStats();
  const [showMediaSheet, setShowMediaSheet] = useState(false);
  const [showSubscriptionSheet, setShowSubscriptionSheet] = useState(false);
  const { isPro } = useSubscription();
  const [allCharacters, setAllCharacters] = useState<CharacterItem[]>([]);
  const [ownedCharacterIds, setOwnedCharacterIds] = useState<Set<string>>(new Set());
  const [allBackgrounds, setAllBackgrounds] = useState<BackgroundItem[]>([]);
  const [ownedBackgroundIds, setOwnedBackgroundIds] = useState<Set<string>>(new Set());
  const [currentBackgroundId, setCurrentBackgroundId] = useState<string | null>(null);
  const [isChatScrolling, setIsChatScrolling] = useState(false);
  const [isChatFullScreen, setIsChatFullScreen] = useState(false);
  const [isDancing, setIsDancing] = useState(false);
  const [showRewardOverlay, setShowRewardOverlay] = useState(false);
  const [rewardOverlayData, setRewardOverlayData] = useState<{
    title: string;
    subtitle?: string;
    rewards: RewardItem[];
  } | null>(null);
  const {
    balance,
    refresh: refreshCurrency,
    updateVcoin,
    setPurchaseCompleteCallback,
    confirmCostumePurchase,
    confirmCharacterPurchase,
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
    setShowPurchaseSheet,
  } = usePurchaseContext();

  // Handle character selection from CharacterPreviewScreen
  useEffect(() => {
    if (route.params?.selectedCharacterId) {
      const selectedId = route.params.selectedCharacterId;
      console.log('🔄 [App] Selected character from preview:', selectedId);

      const updateCharacter = async () => {
        try {
          // 1. Try to find in loaded owned characters
          let character = allCharacters.find(c => c.id === selectedId);

          // 2. If not found (e.g. PRO character not owned), fetch it
          if (!character) {
            const characterRepo = new CharacterRepository();
            const fetched = await characterRepo.fetchCharacter(selectedId);
            if (fetched) {
              character = fetched;
            }
          }

          if (character) {
            // Update state
            setCurrentCharacterState(character);

            // Save preference
            await UserCharacterPreferenceService.saveUserCharacterPreference(character.id, {});

            // Clear params to avoid re-triggering
            navigation.setParams({ selectedCharacterId: undefined });

            console.log('✅ [App] Updated current character to:', character.name);
          }
        } catch (error) {
          console.error('❌ [App] Failed to update character from preview:', error);
        }
      };

      updateCharacter();
    }
  }, [route.params?.selectedCharacterId, allCharacters, setCurrentCharacterState, navigation]);
  const [isBgmOn, setIsBgmOn] = useState(false);
  const isBgmOnRef = useRef(false);
  const [autoPlayMusic, setAutoPlayMusic] = useState(false);
  const { state: loginRewardState, load: loadLoginRewards, claimToday } = useLoginRewards();
  const quests = useQuests(hasRestoredSession && !!session);

  // Helper to generate unique ID
  const generateId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  // Wrapper functions to show RewardClaimOverlay after claiming quest rewards
  const handleClaimDailyQuest = useCallback(
    async (questId: string) => {
      try {
        const result = await quests.claimDailyQuest(questId);
        // Reward overlay removed as per request
        return result;
      } catch (error) {
        console.error('❌ Failed to claim daily quest:', error);
        throw error;
      }
    },
    [quests]
  );

  const handleClaimLevelQuest = useCallback(
    async (questId: string) => {
      try {
        const result = await quests.claimLevelQuest(questId);
        // Reward overlay removed as per request
        return result;
      } catch (error) {
        console.error('❌ Failed to claim level quest:', error);
        throw error;
      }
    },
    [quests]
  );

  const handleRefreshDailyQuests = useCallback(async () => {
    const refreshEnergyCost = 50;
    const hasEnergy = await consumeEnergy(refreshEnergyCost);
    if (!hasEnergy) {
      Alert.alert('Insufficient Energy', `You need ${refreshEnergyCost} energy to refresh daily quests.`);
      return;
    }
    await quests.refreshDaily();
    await refreshStats();
  }, [consumeEnergy, quests, refreshStats]);

  const activeCharacterId = currentCharacter?.id ?? initialData?.character.id ?? null;
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


  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardVisible(true);
      if (Platform.OS === 'ios') {
        setKeyboardHeight(e.endCoordinates.height);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      if (Platform.OS === 'ios') {
        setKeyboardHeight(0);
      }
    });

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

  // State to store pending voice action (since handleActionDetected is called before voice functions are available)
  const [pendingVoiceAction, setPendingVoiceAction] = useState<'voice' | 'video' | null>(null);

  // Initial action handler that stores action for later execution
  const handleActionDetected = useCallback((action: DetectedAction, userMessage: string) => {
    console.log('[App] Action detected:', action.action, 'from message:', userMessage);

    // Non-voice actions can be handled immediately
    switch (action.action) {
      case 'change_background':
        setShowBackgroundSheet(true);
        break;

      case 'change_costume':
        setShowCostumeSheet(true);
        break;

      case 'change_character':
        setShowCharacterSheet(true);
        break;

      case 'play_animation':
        // Play specific animation if name is provided, otherwise random
        if (action.parameters?.animationName) {
          console.log('[App] Playing animation:', action.parameters.animationName);
          webBridgeRef.current?.loadAnimationByName(action.parameters.animationName);
        } else {
          webBridgeRef.current?.triggerDance();
        }
        break;

      case 'open_subscription':
        setShowSubscriptionSheet(true);
        break;

      case 'start_voice_call':
        // Store for later execution after useAppVoiceCall is initialized
        setPendingVoiceAction('voice');
        break;

      case 'start_video_call':
        setPendingVoiceAction('video');
        break;

      default:
        break;
    }
  }, [setShowBackgroundSheet, setShowCostumeSheet, setShowCharacterSheet, navigation]);

  const {
    state: chatState,
    toggleChatList: toggleChatListInternal,
    setShowChatList,
    openHistory,
    closeHistory,
    sendText: sendGeminiText,
    loadMoreHistory,
    addAgentMessage,
    addUserMessage,
    refreshStreak,
    performCheckIn,
    addSystemMessage,
  } = useChatManager(activeCharacterId ?? undefined, {
    onAgentReply: handleAgentReply,
    onActionDetected: handleActionDetected,
    isPro: isPro,
    characterName: currentCharacter?.name || initialData?.character?.name,
  });

  // Memoize voice conversation callbacks to prevent recreation (like swift-version)
  const voiceCallbacks = useMemo(
    () => ({
      onAgentResponse: (text: string) => {
        if (!text?.trim()) {
          return;
        }
        addAgentMessage(text);
      },
      onUserTranscription: (text: string) => {
        if (!text?.trim()) {
          return;
        }
        addUserMessage(text);
      },
      onAgentVolume: (volume: number) => {
        // Debug log for lipsync
        if (volume > 0.1) {
          console.log('[Lipsync] Agent volume:', volume.toFixed(2));
        }
        if (webBridgeRef.current) {
          webBridgeRef.current.setMouthOpen(volume);
        }
      },
      onConnectionChange: (connected: boolean) => {
        if (!connected && webBridgeRef.current) {
          webBridgeRef.current.setMouthOpen(0);
        }
      },
      onError: (message: string) => Alert.alert('Voice call', message),
    }),
    [addAgentMessage, addUserMessage]
  );

  const {
    voiceState,
    isVoiceMode,
    isCameraMode,
    showCameraPreview,
    cameraStream,
    handleToggleCameraMode,
    handleToggleMic,
    handleCameraOverlayClose,
    sendVoiceText,
    endCall,
    agentIdCacheRef,
    ensureCameraPermission,
    ensureMicrophonePermission,
    stopCameraPreview,
    isProcessing: isVoiceProcessing,
    remainingQuotaSeconds,
    refreshQuota,
  } = useAppVoiceCall({
    activeCharacterId: activeCharacterId ?? undefined,
    userId: session?.user?.id ?? null,
    voiceCallbacks,
    webBridgeRef,
    isPro,
    onQuotaExhausted: useCallback(() => {
      setShowCallEndedModal(true);
    }, []),
  });

  // Process pending voice/video call actions
  useEffect(() => {
    if (pendingVoiceAction) {
      if (pendingVoiceAction === 'voice') {
        console.log('[App] Executing pending voice call action');
        handleToggleMic();
      } else if (pendingVoiceAction === 'video') {
        console.log('[App] Executing pending video call action');
        handleToggleCameraMode();
      }
      setPendingVoiceAction(null);
    }
  }, [pendingVoiceAction, handleToggleMic, handleToggleCameraMode]);

  // Refresh call quota when subscription status changes
  useEffect(() => {
    if (isPro) {
      console.log('[App] isPro changed to true, refreshing call quota...');
      // Small delay to ensure isProRef is updated in useAppVoiceCall before fetching
      const timer = setTimeout(() => {
        refreshQuota();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isPro, refreshQuota]);

  // Voice call metering (like swift-version)
  const currentAgentIdRef = useRef<string | null>(null);
  const {
    startCallMetering,
    stopCallMetering,
    reset: resetVoiceCall,
  } = useVoiceCall({
    characterId: activeCharacterId,
    agentId: currentAgentIdRef.current,
    getVcoinBalance: () => balance.vcoin, // Use callback to get latest balance
    onVcoinChange: updateVcoin,
    onOutOfFunds: async () => {
      Alert.alert(
        'Out of Funds',
        'You don\'t have enough VCoin to continue the call. The call will end.',
        [{
          text: 'OK', onPress: async () => {
            await endCall();
            setShowPurchaseSheet(true);
          }
        }]
      );
    },
    onQuestUpdate: async (questType: string, _seconds: number, minutes: number) => {
      await QuestProgressTracker.track(questType as import('./src/utils/QuestProgressTracker').QuestAction, minutes);
    },
    questTypeResolver: () => (isCameraMode ? 'video_call' : 'voice_call'),
  });

  useEffect(() => {
    const character = initialData?.character;
    if (character?.id && character.agent_elevenlabs_id) {
      agentIdCacheRef.current.set(character.id, character.agent_elevenlabs_id);
    }
  }, [initialData?.character]);

  // Sync currentBackgroundId with initialData preference
  useEffect(() => {
    if (initialData?.preference?.backgroundId) {
      setCurrentBackgroundId(initialData.preference.backgroundId);
    } else if (initialData?.ownedBackgroundIds && initialData.ownedBackgroundIds.length > 0) {
      // Fallback: if no cached preference, select first owned background as default
      const firstOwnedBgId = initialData.ownedBackgroundIds[0];
      setCurrentBackgroundId(firstOwnedBgId);
      console.log('[App] No background preference, using first owned:', firstOwnedBgId);
    }
  }, [initialData?.preference?.backgroundId, initialData?.ownedBackgroundIds]);

  // Sync ownedBackgroundIds from initialData
  useEffect(() => {
    if (initialData?.ownedBackgroundIds) {
      setOwnedBackgroundIds(new Set(initialData.ownedBackgroundIds));
    }
  }, [initialData?.ownedBackgroundIds]);
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
            await UserCharacterPreferenceService.applyCostumeById(
              costume.id,
              webViewRef,
              currentCharacter.id
            );
            await UserCharacterPreferenceService.saveUserCharacterPreference(currentCharacter.id, {
              current_costume_id: costume.id,
            });

            setCurrentCostume(costume);
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
    if (!session) {
      Alert.alert('Sign in required', 'Please sign in to view your streak.');
      return;
    }
    streakSheetRef.current?.present();
    analyticsService.logSheetOpen('streak');
  }, [session]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
    analyticsService.logSettingsOpen();
  }, []);



  const handleCharacterCardPress = useCallback(() => {
    // Giống swift-version: nhấn vào card thông tin nhân vật sẽ mở Character Detail sheet
    setShowCharacterDetailSheet(true);
    analyticsService.logCharacterDetailView(activeCharacterId || '');
  }, [setShowCharacterDetailSheet]);



  const handleQuestPress = useCallback(() => {
    if (!session) {
      Alert.alert('Sign in required', 'Please sign in to view quests.');
      return;
    }
    setQuestSheetTabRequest(null);
    setShowQuestSheet(true);
    analyticsService.logQuestView('daily');
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

    // If can't ask again, prompt to go to settings
    if (!current.canAskAgain) {
      Alert.alert(
        'Photo Library Permission Required',
        'Please enable photo library access in Settings to save photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    const requested = await MediaLibrary.requestPermissionsAsync(true);

    if (!requested.granted && !requested.canAskAgain) {
      Alert.alert(
        'Photo Library Permission Required',
        'Please enable photo library access in Settings to save photos.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }

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
    if (!snapshotViewRef.current || isSavingSnapshot) {
      return;
    }
    setIsSavingSnapshot(true);
    try {
      const hasPermission = await ensureMediaPermission();
      if (!hasPermission) {
        // Alert already shown in ensureMediaPermission if can't ask again
        return;
      }

      const snapshotUri = await captureRef(snapshotViewRef.current, {
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
      // Track capture photo analytics
      analyticsService.logCapturePhoto(activeCharacterId || '', currentBackgroundId || undefined);
    } catch (error: any) {
      console.error('[App] Failed to capture snapshot:', error);
      Alert.alert('Unable to save image', `Please try again. ${error.message || ''}`);
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
    analyticsService.logSheetOpen('media');
  }, [activeCharacterId]);

  const handleDance = useCallback(() => {
    ensureWebBridge();
    if (!webBridgeRef.current) {
      console.warn('[App] Dance requested before WebView ready');
      return;
    }
    try {
      if (isDancing) {
        // Stop dancing
        webBridgeRef.current.stopAction();
        setIsDancing(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      } else {
        // Start dancing
        webBridgeRef.current.triggerDance();
        setIsDancing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        QuestProgressTracker.track('dance_character').catch(error =>
          console.warn('[App] Failed to track dance quest progress:', error)
        );
        // Track dance analytics
        analyticsService.logDanceTrigger(activeCharacterId || '');
      }
    } catch (error) {
      console.error('[App] Failed to trigger dance:', error);
    }
  }, [ensureWebBridge, isDancing, activeCharacterId]);

  const characterTitle = useMemo(() => {
    if (currentCharacter?.name?.trim()) {
      return currentCharacter.name.trim();
    }
    const fallback = initialData?.character?.name?.trim();
    return fallback ?? '';
  }, [currentCharacter?.name, initialData?.character?.name]);



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
            const choice = await confirmCharacterPurchase(item);
            if (!choice) {
              return;
            }
            const finalPriceVcoin = choice.useVcoin ? priceVcoin : 0;
            const finalPriceRuby = choice.useRuby ? priceRuby : 0;
            try {
              await performPurchase({
                itemId: item.id,
                itemType: 'character',
                priceVcoin: finalPriceVcoin,
                priceRuby: finalPriceRuby,
              });
            } catch (error) {
              handlePurchaseError(error);
              return;
            }
            clearConfirmPurchaseRequest();
          }

          ownedCharacterIds = await assetRepo.fetchOwnedAssets('character');
          isOwned = ownedCharacterIds.has(item.id);

          const totalOwnedCharacters = ownedCharacterIds.size;
          const unlockedNow = !wasOwned && isOwned;

          if (unlockedNow) {
            await QuestProgressTracker.track('unlock_character');
            await QuestProgressTracker.track('obtain_characters');
            analyticsService.logCharacterUnlock(item.id, isFree ? 'free' : 'purchase');
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

        // Load cached preferences for this character
        const cachedCostume = await Persistence.getCharacterCostumeSelection(item.id);
        const cachedBackground = await Persistence.getCharacterBackgroundSelection(item.id);

        // Apply cached or fallback costume and update currentCostume state
        let appliedCostumeId: string | null = null;
        if (cachedCostume?.costumeId && cachedCostume.modelURL) {
          // Use cached costume
          await UserCharacterPreferenceService.applyCostumeById(
            cachedCostume.costumeId,
            webViewRef,
            item.id
          );
          appliedCostumeId = cachedCostume.costumeId;
          console.log('[App] Applied cached costume:', cachedCostume.modelName);
        } else if (item.default_costume_id) {
          // Use default costume
          appliedCostumeId = item.default_costume_id;
        } else if (item.base_model_url) {
          // No cached costume, use fallback
          await UserCharacterPreferenceService.loadFallbackModel(
            item.name,
            item.base_model_url,
            webViewRef,
            item.id
          );
        }

        // Update currentCostume in VRMContext for SubscriptionSheet video
        if (appliedCostumeId) {
          try {
            const costumeRepo = new CostumeRepository();
            const costumeDetails = await costumeRepo.fetchCostumeById(appliedCostumeId);
            if (costumeDetails) {
              setCurrentCostume(costumeDetails);
              console.log('[App] Updated currentCostume:', costumeDetails.costume_name);
            }
          } catch (e) {
            console.warn('[App] Failed to fetch costume details:', e);
          }
        } else {
          setCurrentCostume(null);
        }

        // Apply cached or default background
        if (cachedBackground?.backgroundId && cachedBackground.backgroundURL) {
          // Use cached background - apply immediately
          const ownedBgs = await assetRepo.fetchOwnedAssets('background');
          if (ownedBgs.has(cachedBackground.backgroundId)) {
            await UserCharacterPreferenceService.applyBackgroundById(
              cachedBackground.backgroundId,
              webViewRef,
              ownedBgs
            );
            setCurrentBackgroundId(cachedBackground.backgroundId);
            console.log('[App] Applied cached background:', cachedBackground.backgroundName);
          }
        } else if (item.background_default_id) {
          // No cached background, handle default
          try {
            let ownedBgs = await assetRepo.fetchOwnedAssets('background');
            if (!ownedBgs.has(item.background_default_id)) {
              await assetRepo.createAsset(item.background_default_id, 'background');
              ownedBgs.add(item.background_default_id);
              console.log('[App] Granted ownership of default background during switch:', item.background_default_id);
            }

            // Apply default background
            await UserCharacterPreferenceService.applyBackgroundById(
              item.background_default_id,
              webViewRef,
              ownedBgs
            );
            setCurrentBackgroundId(item.background_default_id);

            // Save as preference and cache
            await UserCharacterPreferenceService.saveUserCharacterPreference(item.id, {
              current_background_id: item.background_default_id,
            });
            const bgRepo = new BackgroundRepository();
            const bg = await bgRepo.fetchBackground(item.background_default_id);
            if (bg) {
              await Persistence.setCharacterBackgroundSelection(item.id, {
                backgroundId: item.background_default_id,
                backgroundURL: bg.image || '',
                backgroundName: bg.name || '',
              });
            }
          } catch (e) {
            console.warn('Error handling default background:', e);
          }
        }

        // Handle default costume ownership (but don't override cached selection)
        if (item.default_costume_id && !cachedCostume?.costumeId) {
          try {
            let ownedCostumes = await assetRepo.fetchOwnedAssets('character_costume');
            if (!ownedCostumes.has(item.default_costume_id)) {
              await assetRepo.createAsset(item.default_costume_id, 'character_costume');
              console.log('[App] Granted ownership of default costume during switch:', item.default_costume_id);

              // Set as preference and apply
              await UserCharacterPreferenceService.saveUserCharacterPreference(item.id, {
                current_costume_id: item.default_costume_id
              });
              await UserCharacterPreferenceService.applyCostumeById(
                item.default_costume_id,
                webViewRef,
                item.id
              );
            }
          } catch (e) {
            console.warn('Error handling default costume:', e);
          }
        }

        await refreshInitialData(true);

        // Refresh streak for the new character (like swift-version)
        if (refreshStreak) {
          await refreshStreak(item.id, false);
        }

        setShowCharacterSheet(false);
        // Track character selection
        analyticsService.logCharacterSelect(item.id, item.name);
      } catch (error) {
        console.error('❌ Error selecting character:', error);
        Alert.alert('Error', 'Failed to select character');
      }
    },
    [
      clearConfirmPurchaseRequest,
      confirmCharacterPurchase,
      handlePurchaseError,
      performPurchase,
      refreshInitialData,
      setCurrentCharacterState,
      refreshStreak,
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

  // Load backgrounds on mount
  useEffect(() => {
    const loadBackgrounds = async () => {
      try {
        const backgroundRepo = new BackgroundRepository();
        const backgrounds = await backgroundRepo.fetchAllBackgrounds();
        setAllBackgrounds(backgrounds);
        console.log(`✅ Loaded ${backgrounds.length} backgrounds`);

        // Also load owned backgrounds
        const assetRepo = new AssetRepository();
        const owned = await assetRepo.fetchOwnedAssets('background');
        setOwnedBackgroundIds(owned);
      } catch (error) {
        console.error('❌ Failed to load backgrounds:', error);
      }
    };
    if (hasRestoredSession) {
      loadBackgrounds();
    }
  }, [hasRestoredSession]);

  // Advance background by offset (for swipe navigation) - like swift-version
  const advanceBackground = useCallback(
    async (offset: number) => {
      if (allBackgrounds.length === 0) {
        console.warn('⚠️ Cannot swipe backgrounds: allBackgrounds is empty');
        // Fallback: try to use webView functions if available
        if (webViewRef.current) {
          const js = offset > 0
            ? 'window.nextBackground&&window.nextBackground();'
            : 'window.prevBackground&&window.prevBackground();';
          webViewRef.current.injectJavaScript(js);
        }
        return;
      }

      // Filter to only owned backgrounds (like swift-version)
      const ownedBackgrounds = allBackgrounds.filter(bg => ownedBackgroundIds.has(bg.id));

      if (ownedBackgrounds.length === 0) {
        console.warn('⚠️ Cannot swipe backgrounds: no owned backgrounds');
        return;
      }

      const count = ownedBackgrounds.length;

      // Find current index in owned backgrounds only
      const currentIndex = currentBackgroundId
        ? ownedBackgrounds.findIndex(bg => bg.id === currentBackgroundId)
        : 0;

      // If current background is not owned, start from first owned
      const startIndex = currentIndex >= 0 ? currentIndex : 0;

      // Calculate new index with modulo (like swift-version)
      let newIndex = (startIndex + offset + count) % count;
      if (newIndex < 0) newIndex += count;

      const background = ownedBackgrounds[newIndex];

      if (background && currentCharacter) {
        // Apply background (already owned, so no need to check)
        await UserCharacterPreferenceService.applyBackgroundById(
          background.id,
          webViewRef,
          ownedBackgroundIds
        );
        await UserCharacterPreferenceService.saveUserCharacterPreference(currentCharacter.id, {
          current_background_id: background.id,
        });
        setCurrentBackgroundId(background.id);
        await Persistence.setCharacterBackgroundSelection(currentCharacter.id, {
          backgroundId: background.id,
          backgroundURL: background.image || '',
          backgroundName: background.name || '',
        });

        // Track swipe background quest (like swift-version)
        await QuestProgressTracker.track('swipe_background');
      }
    },
    [allBackgrounds, ownedBackgroundIds, currentBackgroundId, currentCharacter, webViewRef]
  );

  // Change character by offset (for swipe navigation) - like swift-version
  const changeCharacter = useCallback(
    async (offset: number) => {
      if (allCharacters.length <= 1) {
        return; // Only change if user has more than one character
      }

      const newIndex = (currentCharacterIndex + offset + allCharacters.length) % allCharacters.length;
      const character = allCharacters[newIndex];

      if (character) {
        await handleCharacterSelect(character);
        // Track swipe character quest
        await QuestProgressTracker.track('swipe_character');
      }
    },
    [allCharacters, currentCharacterIndex, handleCharacterSelect]
  );


  const handleBackgroundSelect = useCallback(
    async (item: BackgroundItem) => {
      try {
        const assetRepo = new AssetRepository();
        let ownedBackgroundIds = await assetRepo.fetchOwnedAssets('background');
        setOwnedBackgroundIds(ownedBackgroundIds);
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
          setCurrentBackgroundId(item.id); // Update current background ID
          setShowBackgroundSheet(false);
          await Persistence.setCharacterBackgroundSelection(currentCharacter.id, {
            backgroundId: item.id,
            backgroundURL: item.image || '',
            backgroundName: item.name || '',
          });
        };

        if (alreadyOwned) {
          await applyBackground(ownedBackgroundIds);
          clearConfirmPurchaseRequest();
          analyticsService.logBackgroundChange(item.id);
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
        setOwnedBackgroundIds(ownedBackgroundIds);
        const nowOwned = ownedBackgroundIds.has(item.id);
        await applyBackground(ownedBackgroundIds);

        if (!alreadyOwned && nowOwned) {
          await QuestProgressTracker.track('unlock_background');
          await QuestProgressTracker.track('obtain_backgrounds');
          analyticsService.logBackgroundUnlock(item.id, isFree ? 'free' : 'purchase');
        }
        analyticsService.logBackgroundChange(item.id);

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
          await UserCharacterPreferenceService.applyCostumeById(
            item.id,
            webViewRef,
            currentCharacter.id
          );
          await UserCharacterPreferenceService.saveUserCharacterPreference(currentCharacter.id, {
            current_costume_id: item.id,
          });
          setCurrentCostume(item);
          setShowCostumeSheet(false);
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

  // Ref to ensure we only auto-open chat once per call session
  const hasAutoOpenedChatForCall = useRef(false);

  useEffect(() => {
    // Show chat messages when call connects (voice or video)
    if (voiceState.isConnected) {
      if (!hasAutoOpenedChatForCall.current) {
        setShowChatList(true);
        hasAutoOpenedChatForCall.current = true;
      }
    } else {
      // Reset flag when call ends
      hasAutoOpenedChatForCall.current = false;
    }
  }, [voiceState.isConnected, setShowChatList]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  useEffect(() => {
    isBgmOnRef.current = isBgmOn;
  }, [isBgmOn]);

  const previousCallConnectedRef = useRef(false);

  // Voice call metering integration (like swift-version)
  useEffect(() => {
    let cancelled = false;
    const applyVoiceState = async () => {
      if (voiceState.isConnected) {
        if (!previousCallConnectedRef.current) {
          // Call just started - start metering and set call mode (like swift-version)
          if (activeCharacterId && currentAgentIdRef.current) {
            await startCallMetering();
          }
          // Only zoom in and stop animation once when call first connects
          webBridgeRef.current?.setCallMode(true);
          webBridgeRef.current?.stopAction();

          // Store BGM state before pausing
          lastBgmBeforeVoiceRef.current = isBgmOnRef.current;
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
        }
      } else {
        // Call ended - stop metering and finalize (like swift-version)
        if (previousCallConnectedRef.current) {
          await stopCallMetering(true);

          // Log call duration message
          if (voiceState.lastCallDurationSeconds > 0 && currentCharacter?.name) {
            const mins = Math.floor(voiceState.lastCallDurationSeconds / 60);
            const secs = voiceState.lastCallDurationSeconds % 60;
            const durationStr = `${mins}m${secs}s`;
            // Call format: Call CharacterName 1m12s
            addSystemMessage(`Call ${currentCharacter.name} ${durationStr}`, { isAgent: false });
          }
        }
        // stopCameraPreview({ preserveVideoFlag: true });
        // isCameraMode is reset by useAppVoiceCall.endCall()

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
  }, [voiceState.isConnected, activeCharacterId, startCallMetering, stopCallMetering, isBgmOn, currentCharacter, addSystemMessage, voiceState.lastCallDurationSeconds]);

  useEffect(() => {
    // Calculate unclaimed quest count (completed but not claimed)
    const unclaimedCount = quests.daily.visibleQuests.filter(
      (quest) => quest.completed && !quest.claimed
    ).length;

    setOverlayFlags(prev => ({
      ...prev,
      hasIncompleteQuests: quests.hasIncompleteDaily,
      unclaimedQuestCount: unclaimedCount,
    }));
  }, [quests.hasIncompleteDaily, quests.daily.visibleQuests]);


  // Ref to track connection state for cleanup (avoiding effect re-runs)
  const isVoiceConnectedRef = useRef(voiceState.isConnected);
  useEffect(() => {
    isVoiceConnectedRef.current = voiceState.isConnected;
  }, [voiceState.isConnected]);

  const endCallRef = useRef(endCall);
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  // Cleanup: end call on unmount (like swift-version)
  useEffect(() => {
    return () => {
      // Only end call if actually connected
      if (isVoiceConnectedRef.current) {
        endCallRef.current();
      }
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
      openSubscription: () => setShowSubscriptionSheet(true),
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
      // Link user to OneSignal for targeted notifications
      oneSignalService.setExternalUserId(session.user.id);
      // Set user for analytics
      analyticsService.setUserId(session.user.id);
    } else {
      // Remove user from OneSignal on logout
      oneSignalService.removeExternalUserId();
      // Clear analytics user
      analyticsService.setUserId(null);
      analyticsService.logSignOut();
      // Note: PRO status is now handled by SubscriptionProvider
    }
  }, [hasRestoredSession, session]);

  const handleOpenStreak = useCallback(() => {
    setShowCostumeSheet(false);
    streakSheetRef.current?.present();
  }, []);

  useEffect(() => {
    ensureWebBridge();
    ensureInitialModelApplied(webViewRef);

    // Initialize OneSignal
    oneSignalService.initialize();

    // Log app open event
    analyticsService.logAppOpen();

    // Note: RevenueCat is now initialized and managed by SubscriptionProvider
  }, [ensureInitialModelApplied, ensureWebBridge]);


  const shouldShowSignIn = hasRestoredSession && !session;

  // Preload random VRM files if waiting at SignIn screen
  useEffect(() => {
    if (shouldShowSignIn) {
      const timer = setTimeout(() => {
        webViewRef.current?.injectJavaScript(`
          if(window.loadRandomFiles) {
             console.log('Native forcing loadRandomFiles for caching...');
             window.loadRandomFiles();
          }
          true;
        `);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [shouldShowSignIn]);

  useEffect(() => {
    setOverlayFlags(prev => ({
      ...prev,
      canClaimCalendar: loginRewardState.canClaimToday,
    }));
  }, [loginRewardState.canClaimToday]);

  // Compute isDarkBackground based on current background
  const isDarkBackground = useMemo(() => {
    if (!currentBackgroundId) return true; // Default to dark
    const currentBg = allBackgrounds.find(bg => bg.id === currentBackgroundId);
    return currentBg?.is_dark ?? true; // Default to dark if not set
  }, [currentBackgroundId, allBackgrounds]);

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
      await WebBrowser.openBrowserAsync(target);
    } catch (error) {
      console.warn('❗ Unable to open legal document', doc, error);
    }
  };

  // Hide navigation header - we use custom SceneHeader
  useEffect(() => {
    if (navigation) {
      navigation.setOptions({ headerShown: false });
    }
  }, [navigation]);

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

  const [isNewUserCheckComplete, setIsNewUserCheckComplete] = useState(false);

  // Reset check status when session is cleared
  useEffect(() => {
    if (!session) {
      setIsNewUserCheckComplete(false);
    }
  }, [session]);

  const checkIfNewUserForOnboarding = useCallback(async () => {
    if (isCheckingNewUser) return;

    // Optimization: If AuthManager already determined status (fresh login), use it.
    if (authManager.isNewUser !== null) {
      console.log('[Onboarding] Using AuthManager status:', authManager.isNewUser);
      if (authManager.isNewUser === true) {
        setShowOnboardingV2(true);
        setShowImageOnboarding(false);
        setShowNewUserGift(false);
      } else {
        setShowOnboardingV2(false);
        // Still might want to check gift status for existing users, but delay it to avoid blocking UI?
        // For now, let's just proceed to main app.
        checkGiftClaimStatus();
      }
      return;
    }

    setIsCheckingNewUser(true);

    try {
      // Check forced "isNewUser" flag first as requested for immediate redirect
      const isNewUserFlag = await AsyncStorage.getItem('isNewUser');
      if (isNewUserFlag === 'true') {
        console.log('[Onboarding] Found isNewUser flag, forcing onboarding...');
        setShowOnboardingV2(true);
        setShowImageOnboarding(false);
        setShowNewUserGift(false);
        return;
      }

      const assetRepo = new AssetRepository();
      const ownedCharacterIds = await assetRepo.fetchOwnedAssets('character');
      const hasCharacters = ownedCharacterIds.size > 0;

      const hasCompletedOnboardingV2 =
        (await AsyncStorage.getItem('persist.hasCompletedOnboardingV2')) === 'true';

      // Priority: OnboardingV2 > ImageOnboarding > NewUserGift
      if (hasCharacters) {
        // If local flag is missing but user has characters, auto-fix it
        if (!hasCompletedOnboardingV2) {
          await AsyncStorage.setItem('persist.hasCompletedOnboardingV2', 'true');
        }

        // Ensure isNewUser is false for existing users
        await AsyncStorage.setItem('isNewUser', 'false');

        setShowOnboardingV2(false);
        setShowImageOnboarding(false);
        // Check gift claim status directly
        await checkGiftClaimStatus();
      } else if (!hasCompletedOnboardingV2) {
        // New user who hasn't completed OnboardingV2 - show it
        console.log('[Onboarding Debug] -> Showing OnboardingV2');

        // Set isNewUser flag
        await AsyncStorage.setItem('isNewUser', 'true');

        setShowOnboardingV2(true);
        setShowImageOnboarding(false);
        setShowNewUserGift(false);
      } else {
        // OnboardingV2 flag is set but no characters - something went wrong
        // Reset V2 flag and show V2 again
        console.log('[Onboarding Debug] -> V2 completed but no characters, resetting V2 flag');
        await AsyncStorage.removeItem('persist.hasCompletedOnboardingV2');
        await AsyncStorage.setItem('isNewUser', 'true');

        setShowOnboardingV2(true);
        setShowImageOnboarding(false);
        setShowNewUserGift(false);
      }
    } catch (error) {
      console.error('[App] Error checking new user for onboarding:', error);
      // Fallback logic
      const hasCompletedOnboardingV2 =
        (await AsyncStorage.getItem('persist.hasCompletedOnboardingV2')) === 'true';

      if (!hasCompletedOnboardingV2) {
        setShowOnboardingV2(true);
        setShowImageOnboarding(false);
      } else {
        setShowOnboardingV2(false);
        setShowImageOnboarding(false);
        setShowNewUserGift(false);
      }
    } finally {
      setIsCheckingNewUser(false);
      setIsNewUserCheckComplete(true);
    }
  }, [isCheckingNewUser, checkGiftClaimStatus]);

  const handleCharacterSelectionComplete = useCallback(
    async (character: CharacterItem) => {
      console.log('[App] Character selection complete:', character.name);

      // 1. Save character preference
      try {
        const userPrefsService = new UserPreferencesService();
        await userPrefsService.saveCurrentCharacterId(character.id);

        // Also ensure asset is created/owned (if free)
        const assetRepo = new AssetRepository();
        const owned = await assetRepo.fetchOwnedAssets('character');
        if (!owned.has(character.id)) {
          await assetRepo.createAsset(character.id, 'character');
        }

        // Save default background preference for this character
        if (character.background_default_id) {
          // Grant ownership of the default background
          const ownedBg = await assetRepo.fetchOwnedAssets('background');
          if (!ownedBg.has(character.background_default_id)) {
            await assetRepo.createAsset(character.background_default_id, 'background');
            console.log('[App] Granted ownership of default background:', character.background_default_id);
          }

          // Save as user preference
          await UserCharacterPreferenceService.saveUserCharacterPreference(character.id, {
            current_background_id: character.background_default_id,
          });

          // Also persist to local storage for immediate use
          const bgRepo = new BackgroundRepository();
          const bg = await bgRepo.fetchBackground(character.background_default_id);
          if (bg) {
            await Persistence.setBackgroundURL(bg.image || '');
            await Persistence.setBackgroundName(bg.name || '');
            await Persistence.setCharacterBackgroundSelection(character.id, {
              backgroundId: character.background_default_id,
              backgroundURL: bg.image || '',
              backgroundName: bg.name || '',
            });
          }
        }

        // Save default costume preference for this character
        if (character.default_costume_id) {
          // Grant ownership of the default costume
          const ownedCostumes = await assetRepo.fetchOwnedAssets('character_costume');
          if (!ownedCostumes.has(character.default_costume_id)) {
            await assetRepo.createAsset(character.default_costume_id, 'character_costume');
            console.log('[App] Granted ownership of default costume:', character.default_costume_id);
          }

          // Save as user preference
          await UserCharacterPreferenceService.saveUserCharacterPreference(character.id, {
            current_costume_id: character.default_costume_id,
          });

          // Also persist to local storage for immediate use
          const costumeMeta = await UserCharacterPreferenceService.loadCostumeMetadata(character.default_costume_id);
          if (costumeMeta) {
            await Persistence.setModelName(costumeMeta.costumeName || costumeMeta.urlName || '');
            await Persistence.setModelURL(costumeMeta.modelURL || '');
            await Persistence.setCharacterCostumeSelection(character.id, {
              costumeId: character.default_costume_id,
              modelName: costumeMeta.costumeName || costumeMeta.urlName,
              modelURL: costumeMeta.modelURL,
            });
            console.log('✅ [App] Persisted default costume selection:', character.default_costume_id);
          }
        }

      } catch (error) {
        console.error('[App] Error saving character logic:', error);
      }

      // 2. Ask for Notification Permission
      try {
        await oneSignalService.requestPermission();
      } catch (error) {
        console.warn('[App] Failed to request notification permission', error);
      }

      // 3. Mark OnboardingV2 as done and hide it
      await AsyncStorage.setItem('persist.hasCompletedOnboardingV2', 'true');
      await AsyncStorage.setItem('isNewUser', 'false');
      authManager.setIsNewUser(false);
      setShowOnboardingV2(false);

      // 4. Refresh data
      await Promise.all([refreshInitialData(), refreshCurrency()]);
    },
    [refreshInitialData, refreshCurrency]
  );

  useEffect(() => {
    if (hasRestoredSession && session) {
      checkIfNewUserForOnboarding();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRestoredSession, session]);

  const renderContent = () => {
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

    console.log("CharacterSelectionScreen", !!session, authManager.isNewUser)

    // PRIORITIZE: If AuthManager detected a new user during sign-in, go STRAIGHT to Preview.
    // This avoids the "Checking profile..." flash.
    if (session && authManager.isNewUser === true) {
      return <CharacterSelectionScreen onComplete={handleCharacterSelectionComplete} />;
    }

    if (showOnboardingV2) {
      return <CharacterSelectionScreen onComplete={handleCharacterSelectionComplete} />;
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
      <View style={[styles.container, { backgroundColor: 'transparent' }]} pointerEvents="box-none">
        <StatusBar barStyle="light-content" />
        {!isChatFullScreen && (
          <View style={{ zIndex: 100 }}>
            <SceneHeader
              characterName={characterTitle}
              relationshipName={currentCharacter?.relationshipName}
              relationshipProgress={currentCharacter?.relationshipProgress ?? 0}
              avatarUri={currentCharacter?.avatar}
              onCharacterCardPress={handleCharacterCardPress}
              onSettingsPress={handleOpenSettings}
              onCharacterMenuPress={() => setShowCharacterSheet(true)}
              isDarkBackground={isDarkBackground}
            />
          </View>
        )}
        {/* Persistent VRMWebView lifted out to root render */}
        <VoiceLoadingOverlay
          visible={voiceState.isBooting || voiceState.status === 'connecting'}
          characterName={characterTitle}
          characterAvatar={currentCharacter?.avatar || initialData?.character.avatar || initialData?.character.thumbnail_url}
          backgroundImage={allBackgrounds.find((bg) => bg.id === currentBackgroundId)?.image}
        />
        {/* Hide VRMUIOverlay when in call mode */}
        <VRMUIOverlay
          canClaimCalendar={overlayFlags.canClaimCalendar}
          hasMessages={overlayFlags.hasMessages}
          showChatList={overlayFlags.showChatList}
          loginStreak={chatState.streakDays ?? 0}
          isDarkBackground={isDarkBackground}
          isBgmOn={isBgmOn}
          remainingQuotaSeconds={remainingQuotaSeconds}
          isInCall={isCameraMode || voiceState.isConnected}
          isHidden={isChatFullScreen}
          onBackgroundPress={() => setShowBackgroundSheet(true)}
          onCostumePress={() => setShowCostumeSheet(true)}
          onCalendarPress={handleCalendarPress}
          onSettingsPress={handleOpenSettings}
          onSpeakerPress={handleToggleBgm}
          onToggleChatList={toggleChatListInternal}
          onSwipeBackground={advanceBackground}
          onSwipeCharacter={changeCharacter}
          isChatScrolling={isChatScrolling}
          canSwipeCharacter={allCharacters.length > 1}
          isPro={isPro}
        />
        <CameraPreviewOverlay
          visible={showCameraPreview && !!cameraStream}
          stream={cameraStream}
          onClose={handleCameraOverlayClose}
        />
        {showSavedToast ? (
          <View pointerEvents="none" style={styles.savedToastContainer}>
            <Text style={styles.savedToastText}>Saved to Photos</Text>
          </View>
        ) : null}
        <View
          style={[
            styles.chatOverlay,
            { bottom: keyboardHeight },
            isChatFullScreen && { top: 0, paddingBottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }
          ]}
          pointerEvents="box-none"
        >
          <ChatBottomOverlay
            messages={chatState.messages}
            showChatList={chatState.showChatList}
            onSendText={handleSendChatText}
            onCapture={handleCapture}
            onSendPhoto={handleSendPhoto}
            onDance={handleDance}
            isDancing={isDancing}
            isTyping={chatState.isTyping}
            onToggleMic={handleToggleMic}
            onVideoCall={handleToggleCameraMode}
            isVoiceCallActive={voiceState.isConnected}
            isVideoCallActive={isCameraMode}
            isUserSpeaking={voiceState.isUserSpeaking}
            inputPlaceholder={
              voiceState.isBooting
                ? 'Preparing voice call...'
                : voiceState.isConnected
                  ? 'Voice call active — type to send instantly'
                  : undefined
            }
            inputDisabled={voiceState.isBooting || voiceState.status === 'connecting' || isVoiceProcessing}
            voiceLoading={voiceState.isBooting || voiceState.status === 'connecting' || isVoiceProcessing}
            streakDays={chatState.streakDays}
            hasUnclaimed={chatState.hasUnclaimed}
            showStreakConfetti={chatState.showStreakConfetti}
            onStreakTap={handleCalendarPress}
            onOpenHistory={openHistory}
            onChatScrollStateChange={setIsChatScrolling}
            onToggleChatList={toggleChatListInternal}
            isInCall={isCameraMode || voiceState.isConnected}
            isDarkBackground={isDarkBackground}
            isFullScreen={isChatFullScreen}
            onToggleFullscreen={setIsChatFullScreen}
          />
        </View>
        {/* Hide CharacterQuickSwitcher when in call mode */}
        {/* Hide CharacterQuickSwitcher when in call mode or fullscreen chat */}
        {!(isCameraMode || voiceState.isConnected || isChatFullScreen) && (
          <CharacterQuickSwitcher
            characters={allCharacters}
            currentIndex={currentCharacterIndex}
            onCharacterTap={handleCharacterSelectByIndex}
            onAddCharacter={() => setShowCharacterSheet(true)}
            isInputActive={isKeyboardVisible || chatState.showChatList}
            keyboardHeight={0}
            isModelLoading={false}
          />
        )}
        <AppSheets
          showQuestSheet={showQuestSheet}
          setShowQuestSheet={setShowQuestSheet}
          quests={{
            ...quests,
            claimDailyQuest: handleClaimDailyQuest,
            claimLevelQuest: handleClaimLevelQuest,
            refreshDaily: handleRefreshDailyQuests,
          }}
          showBackgroundSheet={showBackgroundSheet}
          setShowBackgroundSheet={setShowBackgroundSheet}
          showCharacterSheet={showCharacterSheet}
          setShowCharacterSheet={setShowCharacterSheet}
          showCostumeSheet={showCostumeSheet}
          setShowCostumeSheet={setShowCostumeSheet}
          activeCharacterId={activeCharacterId ?? undefined}
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
          questSheetTabRequest={questSheetTabRequest}
          onRefreshLoginRewards={loadLoginRewards}
          onOpenSubscription={() => {
            console.log('[App] Opening subscription sheet');
            setShowSubscriptionSheet(true);
          }}
          streakDays={loginRewardState.currentDay}
          onOpenStreak={handleOpenStreak}
          isDarkBackground={isDarkBackground}
          isPro={isPro}
          currentBackgroundId={currentBackgroundId}
        />
        <StreakSheet
          ref={streakSheetRef}
          characterName={currentCharacter?.name ?? initialData?.character.name}
          characterId={activeCharacterId ?? undefined}
          streakDays={chatState.streakDays ?? 0}
          connectionLevel={overlayStats.level}
          connectionProgress={overlayStats.nextLevelXp > 0
            ? Math.min(1, overlayStats.xp / overlayStats.nextLevelXp)
            : 0
          }
          friendshipDays={loginRewardState.currentDay}
          canCheckin={chatState.canCheckIn ?? false}
          isDarkBackground={isDarkBackground}
          onCheckin={async () => {
            if (!activeCharacterId) return;
            try {
              const result = await performCheckIn(activeCharacterId);
              if (result && result.reward) {
                const reward = result.reward;
                setRewardOverlayData({
                  title: 'Daily Streak Reward!',
                  subtitle: `You earned a new costume: ${reward.costume_name}`,
                  rewards: [{
                    id: generateId(),
                    type: 'costume',
                    amount: 1,
                    icon: 'shirt',
                    color: 'purple',
                  }]
                });
                setShowRewardOverlay(true);

                // Refresh owned assets/costumes
                // Note: CostumeSheet and CharacterSheet automatically refetch owned items when opened,
                // so no global context refresh is strictly required here.
              }
            } catch (error) {
              console.error('Failed to check in:', error);
              Alert.alert('Check-in failed', 'Please try again.');
            }
          }}
          onRefreshLoginRewards={loadLoginRewards}
          onClaimMilestone={(costume, isClaimed) => {
            setStreakRewardCostume(costume);
            setStreakRewardIsClaimed(isClaimed);
          }}
        />

        <ToastStackView />
        <SettingsModal
          visible={showSettings}
          onClose={() => setShowSettings(false)}
          email={session?.user?.email ?? null}
          displayName={
            (session?.user?.user_metadata as Record<string, any> | undefined)?.display_name ??
            session?.user?.email ??
            null
          }
          onOpenSubscription={() => {
            console.log('[App] Opening subscription sheet from settings');
            setShowSubscriptionSheet(true);
          }}
          isPro={isPro}
        />
        {rewardOverlayData && (
          <RewardClaimOverlay
            isPresented={showRewardOverlay}
            rewards={rewardOverlayData.rewards}
            title={rewardOverlayData.title}
            subtitle={rewardOverlayData.subtitle}
            onClaim={() => {
              setShowRewardOverlay(false);
              setRewardOverlayData(null);
            }}
          />
        )}

        <StreakRewardPopup
          visible={!!streakRewardCostume}
          costume={streakRewardCostume}
          isClaimed={streakRewardIsClaimed}
          onClaim={async () => {
            if (!streakRewardCostume || !currentCharacter) return;

            const assetRepo = new AssetRepository();

            // Check if user already owns this costume
            const ownedCostumeIds = await assetRepo.fetchOwnedAssets('character_costume');
            const alreadyOwned = ownedCostumeIds.has(streakRewardCostume.id);

            // Only grant costume if not already owned
            if (!alreadyOwned) {
              const success = await assetRepo.createAsset(streakRewardCostume.id, 'character_costume');
              if (!success) {
                throw new Error('Failed to grant costume');
              }
            }

            // Apply the costume
            await UserCharacterPreferenceService.applyCostumeById(
              streakRewardCostume.id,
              webViewRef,
              currentCharacter.id
            );

            // Save preference
            await UserCharacterPreferenceService.saveUserCharacterPreference(currentCharacter.id, {
              current_costume_id: streakRewardCostume.id,
            });
            setCurrentCostume(streakRewardCostume);

            // Update state to mark as claimed
            setStreakRewardIsClaimed(true);
          }}
          onClose={() => {
            setStreakRewardCostume(null);
            setStreakRewardIsClaimed(false);
          }}
        />

        <SubscriptionSheet
          isOpened={showSubscriptionSheet}
          onClose={() => setShowSubscriptionSheet(false)}
          onPurchaseSuccess={() => {
            console.log('[App] Purchase success callback, refreshing quota...');
            refreshQuota();
          }}
        />
        <CallEndedModal
          visible={showCallEndedModal}
          characterName={characterTitle}
          characterAvatar={currentCharacter?.avatar || initialData?.character.avatar}
          callDuration={CallQuotaService.formatRemainingTime(voiceState.lastCallDurationSeconds || 0)}
          isPro={isPro}
          onClose={() => setShowCallEndedModal(false)}
          onUpgrade={() => {
            setShowSubscriptionSheet(true);
          }}
        />
      </View>
    );
  };

  const content = renderContent();
  return (
    <SceneActionsProvider value={sceneActions}>
      <View style={{ flex: 1, backgroundColor: 'pink' }}>
        {/* Persistently Mounted VRMWebView */}
        {!(Platform.OS === 'ios' && showSwiftUIDemo) && (
          <View style={StyleSheet.absoluteFill}>
            <Pressable
              style={styles.webViewWrapper}
              ref={snapshotViewRef as any}
              collapsable={false}
              onPress={() => Keyboard.dismiss()}
            >
              <VRMWebView
                ref={webViewRef}
                onModelReady={handleModelReady}
                onMessage={handleMessage}
                enableDebug={false}
              />
            </Pressable>
          </View>
        )}

        {/* Application Content Overlays */}
        {content}
      </View>
    </SceneActionsProvider>
  );
};

// Wrapper for OnboardingV2Screen to use in navigation
const OnboardingV2ScreenWrapper: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'OnboardingV2'>>();
  const { selectedCharacterId } = route.params;

  const handleComplete = useCallback(async (data: {
    userName: string;
    userAge: number;
    selectedCharacterId: string;
    characterNickname: string;
  }) => {
    // Navigate to Experience (main app)
    navigation.reset({
      index: 0,
      routes: [{ name: 'Experience' }],
    });
  }, [navigation]);

  return (
    <OnboardingV2Screen
      onComplete={handleComplete}
      selectedCharacterId={selectedCharacterId}
    />
  );
};

interface CharacterSelectionScreenProps {
  onComplete: (character: CharacterItem) => void;
}

const CharacterSelectionScreen: React.FC<CharacterSelectionScreenProps> = ({ onComplete }) => {
  const [characters, setCharacters] = useState<CharacterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFreeCharacters = async () => {
      try {
        const characterRepo = new CharacterRepository();
        const allCharacters = await characterRepo.fetchAllCharacters();
        const freeChars = allCharacters
          .filter((c) => c.tier === 'free' && c.available)
          .slice(0, 5);
        setCharacters(freeChars);
      } catch (err: any) {
        console.error('[CharacterSelection] Failed to load characters:', err);
        setError(err.message || 'Failed to load characters');
      } finally {
        setIsLoading(false);
      }
    };
    loadFreeCharacters();
  }, []);

  if (error || characters.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingState}>
        </View>
      </View>
    );
  }

  return <CharacterPreviewScreen characters={characters} initialIndex={0} onSelect={onComplete} />;
};

export default function App() {
  useEffect(() => {
    AppsFlyerService.init();
    FacebookService.init();
    TikTokService.init();
  }, []);

  return (
    <ElevenLabsProvider>
      <VRMProvider>
        <SubscriptionProvider>
          <PurchaseProvider>
            <NavigationContainer>
              <Stack.Navigator
                screenOptions={{
                  headerTransparent: true,
                  headerTitleAlign: 'center',
                  headerTintColor: '#fff',
                  contentStyle: { backgroundColor: 'pink' },
                }}
              >
                <Stack.Screen
                  name="Experience"
                  component={AppContent}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="CharacterPreview"
                  component={CharacterPreviewScreen}
                  options={{
                    headerShown: false,
                    presentation: 'fullScreenModal',
                    animation: 'slide_from_bottom',
                  }}
                />
                <Stack.Screen
                  name="OnboardingV2"
                  component={OnboardingV2ScreenWrapper}
                  options={{
                    headerShown: false,
                    presentation: 'fullScreenModal',
                    animation: 'slide_from_right',
                  }}
                />
              </Stack.Navigator>
            </NavigationContainer>
            <OTAAutoUpdate />
          </PurchaseProvider>
        </SubscriptionProvider>
      </VRMProvider>
    </ElevenLabsProvider>
  );
}

type CameraPreviewOverlayProps = {
  visible: boolean;
  stream: MediaStream | null;
  onClose: () => void;
};

const CameraPreviewOverlay: React.FC<CameraPreviewOverlayProps> = ({ visible, stream, onClose }) => {
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only start drag if moved more than a small threshold to avoid conflicts with taps
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [
          null,
          { dx: pan.x, dy: pan.y }
        ],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      }
    })
  ).current;

  // Reset position when visibility changes (optional, but good for resetting if it gets lost)
  // useEffect(() => {
  //   if (visible) {
  //     pan.setValue({ x: 0, y: 0 });
  //     pan.setOffset({ x: 0, y: 0 });
  //   }
  // }, [visible]);

  if (!visible || !stream) {
    return null;
  }
  return (
    <View pointerEvents="box-none" style={styles.cameraOverlay}>
      <Animated.View
        style={[
          styles.cameraPreviewContainer,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }]
          }
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => {
            // Optional: If we want tap to do something else (like expand), handle here.
            // For now, we removed the 'close on tap anywhere' behavior as it interferes with dragging.
            // If user wants to just tap to close, they should use the close button.
          }}
        >
          <RTCView
            streamURL={(stream as any).toURL()}
            style={styles.cameraPreview}
            objectFit="cover"
            mirror
          />
        </TouchableOpacity>


      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'pink',
  },
  webViewWrapper: {
    flex: 1,
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
    zIndex: 100,
  },
  savedToastContainer: {
    position: 'absolute',
    top: 130,
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
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
    zIndex: 50,
  },
  cameraPreviewContainer: {
    position: 'absolute',
    top: 120, // Below header
    right: 16,
    width: 120,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowRadius: 12,
    elevation: 12,
  },
  cameraPreview: {
    flex: 1,
  },
  cameraCloseButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
  },
  cameraBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
