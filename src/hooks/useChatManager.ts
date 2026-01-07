import { useCallback, useEffect, useRef, useState } from 'react';
import { chatService } from '../services/ChatService';
import { streakService } from '../services/StreakService';
import { actionDetectionService, DetectedAction } from '../services/ActionDetectionService';
import { mediaRequestService } from '../services/MediaRequestService';
import { ChatMessage, ChatViewState } from '../types/chat';
import { QuestProgressTracker } from '../utils/QuestProgressTracker';
import { MediaItem } from '../repositories/MediaRepository';

const DEFAULT_STATE: ChatViewState = {
  messages: [],
  showChatList: true,
  showChatHistoryFullScreen: false,
  isTyping: false,
  history: [],
  historyLoading: false,
  historyReachedEnd: false,
  streakDays: 0,
  hasUnclaimed: false,
  showStreakConfetti: false,
  canCheckIn: false,
};

type UseChatOptions = {
  onAgentReply?: (text: string) => void;
  onActionDetected?: (action: DetectedAction, userMessage: string) => void;
  isPro?: boolean;
};

const OVERLAY_LIMIT = 20;
// Minimum confidence threshold to trigger an action
const ACTION_CONFIDENCE_THRESHOLD = 0.7;

export const useChatManager = (characterId?: string, options?: UseChatOptions) => {
  const [state, setState] = useState<ChatViewState>(DEFAULT_STATE);
  const messagesRef = useRef<ChatMessage[]>(state.messages);
  const agentReplyCallback = options?.onAgentReply;
  const actionCallback = options?.onActionDetected;

  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  const loadMessages = useCallback(async () => {
    if (!characterId) {
      setState(DEFAULT_STATE);
      return;
    }
    try {
      const messages = await chatService.fetchRecentConversation(characterId, OVERLAY_LIMIT + 2);
      const overlayMessages = clampMessages(messages);
      setState(prev => ({ ...prev, messages: overlayMessages }));
    } catch (error) {
      console.warn('[useChatManager] Failed to load conversation', error);
    }
  }, [characterId]);

  const refreshStreak = useCallback(
    async (newCharacterId: string, animateOnIncrease: boolean = false) => {
      if (!newCharacterId) {
        return;
      }
      try {
        const previousStreak = state.streakDays || 0;
        const status = await streakService.getStreakStatus(newCharacterId);
        const newVal = Math.max(0, status.streakDays);
        const increased = newVal > previousStreak;

        setState(prev => ({
          ...prev,
          streakDays: newVal,
          canCheckIn: status.canCheckIn,
          showStreakConfetti: animateOnIncrease && increased,
        }));

        // Hide confetti after animation
        if (animateOnIncrease && increased) {
          setTimeout(() => {
            setState(prev => ({ ...prev, showStreakConfetti: false }));
          }, 1000);
        }
      } catch (error) {
        console.warn('[useChatManager] Failed to refresh streak:', error);
      }
    },
    [state.streakDays]
  );

  const performCheckIn = useCallback(
    async (characterIdToCheck: string) => {
      if (!characterIdToCheck) return null;
      try {
        const result = await streakService.checkIn(characterIdToCheck);

        // Update local state
        setState(prev => ({
          ...prev,
          streakDays: result.streakDays,
          canCheckIn: false, // Just checked in
          showStreakConfetti: true // Determine if we want to show confetti always on checkin
        }));

        // Hide confetti after animation
        setTimeout(() => {
          setState(prev => ({ ...prev, showStreakConfetti: false }));
        }, 3000);

        return result;
      } catch (error) {
        console.warn('[useChatManager] Failed to check in:', error);
        throw error;
      }
    },
    []
  );

  // Reset messages and refresh streak when characterId changes
  useEffect(() => {
    // Reset messages immediately when characterId changes (like swift-version)
    if (characterId) {
      setState(prev => ({ ...prev, messages: [], history: [], historyReachedEnd: false }));
      loadMessages();
      refreshStreak(characterId, false);
    } else {
      // Reset everything when no character selected
      setState(prev => ({ ...prev, messages: [], streakDays: 0, history: [], historyReachedEnd: false }));
    }
  }, [characterId, loadMessages, refreshStreak]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setState(prev => ({
      ...prev,
      messages: clampMessages([...prev.messages, message]),
    }));
  }, []);

  const addUserMessage = useCallback(
    (text: string, options?: { persist?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      appendMessage(createLocalMessage(trimmed, false));
      if (options?.persist !== false && characterId) {
        chatService
          .persistConversationMessage({
            text: trimmed,
            isAgent: false,
            characterId,
          })
          .then(() => {
            // Track quest progress for sending messages (like swift-version)
            // This works for both authenticated users and guests
            QuestProgressTracker.track('send_messages').catch(err =>
              console.warn('[useChatManager] track quest failed', err)
            );
          })
          .catch(err => console.warn('[useChatManager] persist user message failed', err));
      }
    },
    [appendMessage, characterId]
  );

  const addAgentMessage = useCallback(
    (text: string, options?: { persist?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      appendMessage(createLocalMessage(trimmed, true));
      if (options?.persist !== false && characterId) {
        chatService
          .persistConversationMessage({
            text: trimmed,
            isAgent: true,
            characterId,
          })
          .catch(err => console.warn('[useChatManager] persist agent message failed', err));
      }
    },
    [appendMessage, characterId]
  );

  const addMediaMessage = useCallback(
    (mediaItem: MediaItem, options?: { persist?: boolean }) => {
      if (!mediaItem) return;
      const message: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: { type: 'media', mediaItem },
        isAgent: true,
        createdAt: new Date().toISOString(),
      };
      appendMessage(message);

      // Persist to DB
      if (options?.persist !== false && characterId) {
        chatService.persistConversationMessage({
          text: 'Sent a media', // Backwards compatibility text
          isAgent: true,
          characterId,
          mediaId: mediaItem.id
        }).catch(err => console.warn('[useChatManager] persist media message failed', err));
      }
    },
    [appendMessage, characterId]
  );

  const sendText = useCallback(
    async (text: string) => {
      if (!characterId) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      addUserMessage(trimmed);

      setState(prev => ({ ...prev, isTyping: true }));

      try {
        const history = buildHistory(messagesRef.current);

        // Run action detection and Gemini chat in PARALLEL for faster response
        const [detectedAction, responseText] = await Promise.all([
          actionDetectionService.detectAction(trimmed),
          chatService.sendMessageToGemini({
            text: trimmed,
            characterId,
            history,
          }),
        ]);

        // Handle action if detected with high confidence
        if (detectedAction.action !== 'none' && detectedAction.confidence >= ACTION_CONFIDENCE_THRESHOLD) {
          console.log('[useChatManager] Action detected:', detectedAction);
          actionCallback?.(detectedAction, trimmed);

          // Handle Media Requests
          if (detectedAction.action === 'send_photo' || detectedAction.action === 'send_video') {
            const type = detectedAction.action === 'send_photo' ? 'photo' : 'video';
            const isPro = options?.isPro ?? false;

            // Fetch accessible media
            mediaRequestService.getAccessibleMedia(characterId, type, isPro)
              .then(media => {
                if (media) {
                  // Add media message after a short natural delay
                  setTimeout(() => {
                    addMediaMessage(media);
                  }, 1500);
                }
              })
              .catch(err => console.warn('[useChatManager] Failed to fetch media request:', err));
          }
        }

        // Handle chat response - Edge function persists it, so we only add locally
        addAgentMessage(responseText, { persist: false });
        setState(prev => ({ ...prev, isTyping: false }));
        agentReplyCallback?.(responseText);
      } catch (error) {
        console.warn('[useChatManager] sendText failed', error);
        setState(prev => ({ ...prev, isTyping: false }));
        const errorMessage = createLocalMessage(
          'Sorry, I could not reach Roxie right now. Please try again in a moment.',
          true
        );
        appendMessage(errorMessage);
      }
    },
    [appendMessage, characterId, agentReplyCallback, actionCallback, addUserMessage, addAgentMessage, addMediaMessage, options?.isPro]
  );

  const toggleChatList = useCallback(() => {
    setState(prev => ({ ...prev, showChatList: !prev.showChatList }));
  }, []);

  const setShowChatList = useCallback((value: boolean) => {
    setState(prev => ({ ...prev, showChatList: value }));
  }, []);

  const loadHistory = useCallback(
    async (cursor?: string) => {
      if (!characterId) return;
      setState(prev => ({ ...prev, historyLoading: true }));
      try {
        const { messages, reachedEnd } = await chatService.fetchConversationHistory(characterId, {
          limit: 20,
          cursor,
        });
        setState(prev => {
          const nextHistory = cursor ? [...messages, ...prev.history] : messages;
          return {
            ...prev,
            history: nextHistory,
            historyLoading: false,
            historyReachedEnd: reachedEnd || messages.length === 0,
          };
        });
      } catch (error) {
        console.warn('[useChatManager] loadHistory failed', error);
        setState(prev => ({ ...prev, historyLoading: false }));
      }
    },
    [characterId]
  );

  const openHistory = useCallback(() => {
    setState(prev => ({ ...prev, showChatHistoryFullScreen: true }));
  }, []);

  const closeHistory = useCallback(() => {
    setState(prev => ({ ...prev, showChatHistoryFullScreen: false }));
  }, []);

  const loadMoreHistory = useCallback(() => {
    if (!characterId || state.historyLoading || state.historyReachedEnd || !state.history.length) {
      return;
    }
    const cursor = state.history[0]?.createdAt;
    if (!cursor) return;
    loadHistory(cursor);
  }, [
    characterId,
    state.historyLoading,
    state.historyReachedEnd,
    state.history,
    loadHistory,
  ]);

  useEffect(() => {
    if (
      !state.showChatHistoryFullScreen ||
      state.history.length > 0 ||
      state.historyLoading ||
      !characterId
    ) {
      return;
    }
    loadHistory();
  }, [
    state.showChatHistoryFullScreen,
    state.history.length,
    state.historyLoading,
    characterId,
    loadHistory,
  ]);

  return {
    state,
    sendText,
    toggleChatList,
    setShowChatList,
    openHistory,
    closeHistory,
    loadMoreHistory,
    addAgentMessage,
    addUserMessage,
    refreshStreak,
    performCheckIn,
  };
};

const createLocalMessage = (text: string, isAgent: boolean): ChatMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  kind: { type: 'text', text },
  isAgent,
  createdAt: new Date().toISOString(),
});

const clampMessages = (messages: ChatMessage[]) =>
  messages.slice(Math.max(messages.length - OVERLAY_LIMIT, 0));

const buildHistory = (messages: ChatMessage[]): ChatMessage[] =>
  messages.filter(msg => msg.kind.type === 'text').slice(-10);
