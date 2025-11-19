import { useCallback, useEffect, useRef, useState } from 'react';
import { chatService } from '../services/ChatService';
import { ChatMessage, ChatViewState } from '../types/chat';

const DEFAULT_STATE: ChatViewState = {
  messages: [],
  showChatList: true,
  showChatHistoryFullScreen: false,
  isTyping: false,
  history: [],
  historyLoading: false,
  historyReachedEnd: false,
  streakDays: 7,
  hasUnclaimed: false,
  showStreakConfetti: false,
  quickReplies: [
    { id: 'qr1', text: 'Tell me a secret' },
    { id: 'qr2', text: 'Send me a selfie' },
    { id: 'qr3', text: "I miss you" },
  ],
};

type UseChatOptions = {
  onAgentReply?: (text: string) => void;
};

const OVERLAY_LIMIT = 3;

export const useChatManager = (characterId?: string, options?: UseChatOptions) => {
  const [state, setState] = useState<ChatViewState>(DEFAULT_STATE);
  const messagesRef = useRef<ChatMessage[]>(state.messages);
  const agentReplyCallback = options?.onAgentReply;

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

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setState(prev => ({
      ...prev,
      messages: clampMessages([...prev.messages, message]),
    }));
  }, []);

  const sendText = useCallback(
    async (text: string) => {
      if (!characterId) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMessage = createLocalMessage(trimmed, false);
      appendMessage(userMessage);
      chatService.persistConversationMessage({
        text: trimmed,
        isAgent: false,
        characterId,
      }).catch(err => console.warn('[useChatManager] persist user message failed', err));

      setState(prev => ({ ...prev, isTyping: true }));

      try {
        const history = buildHistory(messagesRef.current);
        const responseText = await chatService.sendMessageToGemini({
          text: trimmed,
          characterId,
          history,
        });

        const agentMessage = createLocalMessage(responseText, true);
        appendMessage(agentMessage);
        setState(prev => ({ ...prev, isTyping: false }));

        chatService.persistConversationMessage({
          text: responseText,
          isAgent: true,
          characterId,
        }).catch(err => console.warn('[useChatManager] persist agent message failed', err));

        agentReplyCallback?.(responseText);
      } catch (error) {
        console.warn('[useChatManager] sendText failed', error);
        setState(prev => ({ ...prev, isTyping: false }));
        const errorMessage = createLocalMessage(
          'Sorry, I could not reach Vivivi right now. Please try again in a moment.',
          true
        );
        appendMessage(errorMessage);
      }
    },
    [appendMessage, characterId, agentReplyCallback]
  );

  const sendQuickReply = useCallback(
    (replyId: string) => {
      const reply = state.quickReplies.find(q => q.id === replyId);
      if (reply) {
        sendText(reply.text);
      }
    },
    [state.quickReplies, sendText]
  );

  const toggleChatList = useCallback(() => {
    setState(prev => ({ ...prev, showChatList: !prev.showChatList }));
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

  const handleCapture = useCallback(() => {
    console.log('[Chat] capture placeholder');
  }, []);

  const handleSendPhoto = useCallback(() => {
    console.log('[Chat] send photo placeholder');
  }, []);

  const handleDance = useCallback(() => {
    console.log('[Chat] dance placeholder');
  }, []);

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
    sendQuickReply,
    toggleChatList,
    openHistory,
    closeHistory,
    handleCapture,
    handleSendPhoto,
    handleDance,
    loadMoreHistory,
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
