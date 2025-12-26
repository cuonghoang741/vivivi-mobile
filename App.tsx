import React, { useRef, useState, useEffect, useCallback, useMemo, useTransition } from 'react';
import { ActivityIndicator, StyleSheet, View, StatusBar, Platform, Linking, Alert, Keyboard, Text, ScrollView, TouchableOpacity, PermissionsAndroid } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
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
import { authManager } from './src/services/AuthManager';
import { ChatBottomOverlay } from './src/components/chat/ChatBottomOverlay';
import { SettingsModal } from './src/components/settings/SettingsModal';
import { useChatManager } from './src/hooks/useChatManager';
import { useVoiceConversation } from './src/hooks/useVoiceConversation';
import { useVoiceCall } from './src/hooks/useVoiceCall';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AssetRepository from './src/repositories/AssetRepository';
import { UserPreferencesService } from './src/services/UserPreferencesService';
import { UserCharacterPreferenceService } from './src/services/UserCharacterPreferenceService';
import { VRMProvider, useVRMContext } from './src/context/VRMContext';
import { AppSheets } from './src/components/AppSheets';
import { CharacterQuickSwitcher } from './src/components/CharacterQuickSwitcher';
import { BackgroundItem, BackgroundRepository } from './src/repositories/BackgroundRepository';
import { CharacterItem, CharacterRepository } from './src/repositories/CharacterRepository';
import { type CostumeItem, CostumeRepository } from './src/repositories/CostumeRepository';
import { CharacterHeaderCard, HeaderIconButton } from './src/components/header/SceneHeaderComponents';
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
import { ToastStackView } from './src/components/toast/ToastStackView';
import { RewardClaimOverlay, RewardClaimOverlayHelpers, type RewardItem } from './src/components/toast/RewardClaimOverlay';
import { Persistence } from './src/utils/persistence';

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
  const userId = session?.user?.id ?? null;

  const navigation = useNavigation<ExperienceNavigationProp>();
  const webViewRef = useRef<any>(null);
  const snapshotViewRef = useRef<View | null>(null);
  const webBridgeRef = useRef<WebSceneBridge | null>(null);
  const agentIdCacheRef = useRef<Map<string, string>>(new Map());
  const characterRepoRef = useRef<CharacterRepository | null>(null);
  const lastBgmBeforeVoiceRef = useRef(false);
  const chatListWasVisibleBeforeCameraRef = useRef(false);
  const lastCallWasVideoRef = useRef(false);
  const [showSwiftUIDemo, setShowSwiftUIDemo] = useState(false);
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
  const [showQuestSheet, setShowQuestSheet] = useState(false);
  const [questSheetTabRequest, setQuestSheetTabRequest] = useState<{ tab: 'daily' | 'level'; token: number } | null>(null);
  const [showEnergySheet, setShowEnergySheet] = useState(false);
  const [showLevelSheet, setShowLevelSheet] = useState(false);
  const [showCameraPreview, setShowCameraPreview] = useState(false);
  const [showCharacterDetailSheet, setShowCharacterDetailSheet] = useState(false);
  const [isCheckingNewUser, setIsCheckingNewUser] = useState(false);
  const { stats: overlayStats, refresh: refreshStats, consumeEnergy, refillEnergy } = useUserStats();
  const [showMediaSheet, setShowMediaSheet] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [allCharacters, setAllCharacters] = useState<CharacterItem[]>([]);
  const [ownedCharacterIds, setOwnedCharacterIds] = useState<Set<string>>(new Set());
  const [allBackgrounds, setAllBackgrounds] = useState<BackgroundItem[]>([]);
  const [ownedBackgroundIds, setOwnedBackgroundIds] = useState<Set<string>>(new Set());
  const [currentBackgroundId, setCurrentBackgroundId] = useState<string | null>(null);
  const [isChatScrolling, setIsChatScrolling] = useState(false);
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
  } = usePurchaseContext();
  const [isBgmOn, setIsBgmOn] = useState(false);
  const isBgmOnRef = useRef(false);
  const [isCameraModeOn, setIsCameraModeOn] = useState(false);
  const [autoPlayMusic, setAutoPlayMusic] = useState(false);
  const { state: loginRewardState, load: loadLoginRewards } = useLoginRewards();
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
        // Show reward overlay (like swift-version)
        const rewardItems: RewardItem[] = [];
        if (result.reward.vcoin > 0) {
          rewardItems.push({
            id: generateId(),
            type: 'vcoin',
            amount: result.reward.vcoin,
            icon: 'cash',
            color: 'green',
          });
        }
        if (result.reward.ruby > 0) {
          rewardItems.push({
            id: generateId(),
            type: 'ruby',
            amount: result.reward.ruby,
            icon: 'diamond',
            color: 'pink',
          });
        }
        if (result.reward.xp > 0) {
          rewardItems.push({
            id: generateId(),
            type: 'xp',
            amount: result.reward.xp,
            icon: 'star',
            color: 'yellow',
          });
        }
        if (rewardItems.length > 0) {
          setRewardOverlayData({
            title: 'Daily Quest Completed!',
            subtitle: result.quest.quest?.description,
            rewards: rewardItems,
          });
          setShowRewardOverlay(true);
        }
        return result;
      } catch (error) {
        console.error('❌ Failed to claim daily quest:', error);
        throw error;
      }
    },
    [quests, generateId]
  );

  const handleClaimLevelQuest = useCallback(
    async (questId: string) => {
      try {
        const result = await quests.claimLevelQuest(questId);
        // Show reward overlay (like swift-version)
        const rewardItems: RewardItem[] = [];
        if (result.reward.vcoin > 0) {
          rewardItems.push({
            id: generateId(),
            type: 'vcoin',
            amount: result.reward.vcoin,
            icon: 'cash',
            color: 'green',
          });
        }
        if (result.reward.ruby > 0) {
          rewardItems.push({
            id: generateId(),
            type: 'ruby',
            amount: result.reward.ruby,
            icon: 'diamond',
            color: 'pink',
          });
        }
        if (result.reward.xp > 0) {
          rewardItems.push({
            id: generateId(),
            type: 'xp',
            amount: result.reward.xp,
            icon: 'star',
            color: 'yellow',
          });
        }
        if (rewardItems.length > 0) {
          setRewardOverlayData({
            title: 'Level Quest Completed!',
            subtitle: result.quest.quest?.description,
            rewards: rewardItems,
          });
          setShowRewardOverlay(true);
        }
        return result;
      } catch (error) {
        console.error('❌ Failed to claim level quest:', error);
        throw error;
      }
    },
    [quests, generateId]
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
    setShowChatList,
    openHistory,
    closeHistory,
    sendText: sendGeminiText,
    loadMoreHistory,
    addAgentMessage,
    addUserMessage,
    refreshStreak,
  } = useChatManager(activeCharacterId, { onAgentReply: handleAgentReply });

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
    state: voiceState,
    startCall,
    endCall,
    sendText: sendVoiceText,
  } = useVoiceConversation(voiceCallbacks);

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
        [{ text: 'OK', onPress: async () => {
          await endCall();
          setShowPurchaseSheet(true);
        }}]
      );
    },
    onQuestUpdate: async (questType: string, seconds: number, minutes: number) => {
      await QuestProgressTracker.track(questType, minutes);
    },
    questTypeResolver: () => (lastCallWasVideoRef.current ? 'video_call' : 'voice_call'),
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
    }
  }, [initialData?.preference?.backgroundId]);

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
      Alert.alert('Sign in required', 'Please sign in to view check-ins.');
      return;
    }
    setQuestSheetTabRequest({
      tab: 'daily',
      token: Date.now(),
    });
    setShowQuestSheet(true);
    if (!loginRewardState.loaded && !loginRewardState.isLoading) {
      loadLoginRewards();
    }
  }, [session, loginRewardState.loaded, loginRewardState.isLoading, loadLoginRewards]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);



  const handleCharacterCardPress = useCallback(() => {
    // Giống swift-version: nhấn vào card thông tin nhân vật sẽ mở Character Detail sheet
    setShowCharacterDetailSheet(true);
  }, [setShowCharacterDetailSheet]);

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
    // Prevent multiple simultaneous calls (like swift-version)
    if (voiceState.isBooting || voiceState.status === 'connecting') {
      return;
    }
    
    if (voiceState.isConnected) {
      // End call if already connected (like swift-version)
      await endCall();
      return;
    }
    
    // Start call (like swift-version)
    if (!activeCharacterId) {
      Alert.alert('Voice unavailable', 'Please select a character before starting a call.');
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
    setQuestSheetTabRequest(null);
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
    if (!snapshotViewRef.current || isSavingSnapshot) {
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

  const ensureCameraPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera permission',
            message: 'Camera access is required to start a video call.',
            buttonPositive: 'OK',
          }
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      } catch (error) {
        console.warn('[App] Camera permission request failed:', error);
        return false;
      }
    }
    // iOS will present the system prompt automatically when accessing the camera
    return true;
  }, []);

  const startCameraPreviewStream = useCallback(async () => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      const stream = await mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          frameRate: 30,
          width: 720,
          height: 1280,
        },
        audio: false,
      });
      setCameraStream(stream);
      return true;
    } catch (error) {
      console.warn('[App] Failed to start camera preview:', error);
      Alert.alert('Camera unavailable', 'Please allow camera access to start a video call.');
      return false;
    }
  }, [cameraStream]);

  const stopCameraPreview = useCallback(
    (options?: { preserveVideoFlag?: boolean }) => {
      setShowCameraPreview(false);
      setIsCameraModeOn(false);
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      setCameraStream(null);
      if (!options?.preserveVideoFlag) {
        lastCallWasVideoRef.current = false;
      }
    },
    [cameraStream]
  );

  const handleToggleCameraMode = useCallback(async () => {
    if (showCameraPreview) {
      stopCameraPreview({ preserveVideoFlag: voiceState.isConnected });
      if (voiceState.isConnected) {
        try {
          await endCall();
        } catch (error) {
          console.warn('[App] Failed to end call for camera mode:', error);
        }
      }
      return;
    }

    if (!activeCharacterId) {
      Alert.alert('Voice unavailable', 'Please select a character before starting a video call.');
      return;
    }

    const hasPermission = await ensureCameraPermission();
    if (!hasPermission) {
      Alert.alert('Camera permission required', 'Please allow camera access to start a video call.');
      return;
    }

    const startedPreview = await startCameraPreviewStream();
    if (!startedPreview) {
      return;
    }

    setShowCameraPreview(true);
    setIsCameraModeOn(true);

    if (!voiceState.isConnected) {
      const agentId = await resolveAgentId();
      if (!agentId) {
        Alert.alert('Voice unavailable', 'This character does not have a voice agent available yet.');
        stopCameraPreview();
        return;
      }
      try {
        await startCall({
          agentId,
          userId,
        });
      } catch (error) {
        console.warn('[App] Failed to start call for camera mode:', error);
        stopCameraPreview();
        Alert.alert('Voice call', 'Unable to start a call right now. Please try again in a moment.');
      }
    }
  }, [
    showCameraPreview,
    voiceState.isConnected,
    endCall,
    activeCharacterId,
    ensureCameraPermission,
    startCameraPreviewStream,
    resolveAgentId,
    startCall,
    stopCameraPreview,
    userId,
  ]);

  const handleCameraOverlayClose = useCallback(() => {
    if (showCameraPreview) {
      void handleToggleCameraMode();
    }
  }, [showCameraPreview, handleToggleCameraMode]);

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
            webViewRef,
            item.id
          );
        }

        await refreshInitialData();
        
        // Refresh streak for the new character (like swift-version)
        if (refreshStreak) {
          await refreshStreak(item.id, false);
        }
        
        setShowCharacterSheet(false);
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
          await UserCharacterPreferenceService.applyCostumeById(
            item.id,
            webViewRef,
            currentCharacter.id
          );
          await UserCharacterPreferenceService.saveUserCharacterPreference(currentCharacter.id, {
            current_costume_id: item.id,
          });
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

  useEffect(() => {
    if (showCameraPreview) {
      lastCallWasVideoRef.current = true;
      chatListWasVisibleBeforeCameraRef.current = chatState.showChatList;
      if (!voiceState.isConnected && chatState.showChatList) {
        setShowChatList(false);
      }
    } else {
      if (chatListWasVisibleBeforeCameraRef.current) {
        setShowChatList(true);
        chatListWasVisibleBeforeCameraRef.current = false;
      }
    }
  }, [showCameraPreview, chatState.showChatList, setShowChatList, voiceState.isConnected]);

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
          // Call just started - start metering (like swift-version)
          if (activeCharacterId && currentAgentIdRef.current) {
            await startCallMetering();
          }
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
        // Call ended - stop metering and finalize (like swift-version)
        if (previousCallConnectedRef.current) {
          await stopCallMetering(true);
        }
        stopCameraPreview({ preserveVideoFlag: true });
        lastCallWasVideoRef.current = false;
        
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
  }, [voiceState.isConnected, activeCharacterId, startCallMetering, stopCallMetering, isBgmOn, stopCameraPreview]);

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


  const endCallRef = useRef(endCall);
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  // Cleanup: end call on unmount (like swift-version)
  useEffect(() => {
    return () => {
      // Only end call if actually connected
      if (voiceState.isConnected) {
        endCallRef.current();
      }
    };
  }, [voiceState.isConnected]);

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
        <View style={styles.webViewWrapper} ref={snapshotViewRef}>
          <VRMWebView
            ref={webViewRef}
            onModelReady={handleModelReady}
            onMessage={handleMessage}
            enableDebug={false}
          />
        </View>
        <VRMUIOverlay
          level={overlayStats.level}
          xp={overlayStats.xp}
          nextLevelXp={overlayStats.nextLevelXp}
          energy={overlayStats.energy}
          energyMax={overlayStats.energyMax}
          hasIncompleteQuests={overlayFlags.hasIncompleteQuests}
          canClaimCalendar={overlayFlags.canClaimCalendar}
          unclaimedQuestCount={overlayFlags.unclaimedQuestCount}
          hasMessages={overlayFlags.hasMessages}
          showChatList={overlayFlags.showChatList}
          onLevelPress={() => setShowLevelSheet(true)}
          onEnergyPress={() => setShowEnergySheet(true)}
          onBackgroundPress={() => setShowBackgroundSheet(true)}
          onCostumePress={() => setShowCostumeSheet(true)}
          onQuestPress={handleQuestPress}
          onCalendarPress={handleCalendarPress}
          onToggleChatList={handleOverlayChatToggle}
          onSwipeBackground={advanceBackground}
          onSwipeCharacter={changeCharacter}
          isChatScrolling={isChatScrolling}
          canSwipeCharacter={allCharacters.length > 1}
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
            onStreakTap={handleCalendarPress}
            onOpenHistory={openHistory}
            onChatScrollStateChange={setIsChatScrolling}
            onToggleChatList={toggleChatListInternal}
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
        questSheetTabRequest={questSheetTabRequest}
        onRefreshLoginRewards={loadLoginRewards}
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

type CameraPreviewOverlayProps = {
  visible: boolean;
  stream: MediaStream | null;
  onClose: () => void;
};

const CameraPreviewOverlay: React.FC<CameraPreviewOverlayProps> = ({ visible, stream, onClose }) => {
  if (!visible || !stream) {
    return null;
  }
  return (
    <View pointerEvents="box-none" style={styles.cameraOverlay}>
      <View style={styles.cameraPreviewContainer}>
        <RTCView
          streamURL={stream.toURL()}
          style={styles.cameraPreview}
          objectFit="cover"
          mirror
        />
        <TouchableOpacity style={styles.cameraCloseButton} onPress={onClose}>
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
        <View style={styles.cameraBadge}>
          <Ionicons name="videocam" size={14} color="#fff" />
          <Text style={styles.cameraBadgeText}>Video call mode</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
    width: '90%',
    aspectRatio: 3 / 4,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 12,
  },
  cameraPreview: {
    flex: 1,
  },
  cameraCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
