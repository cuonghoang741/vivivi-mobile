export type ChatMessageKind =
  | { type: 'text'; text: string }
  | { type: 'media'; mediaItem: any } // Using any to avoid circular dependency
  | { type: 'system'; text: string };

export type ChatMessage = {
  id: string;
  kind: ChatMessageKind;
  isAgent: boolean;
  createdAt: string; // ISO timestamp
};

export type ChatViewState = {
  messages: ChatMessage[];
  showChatList: boolean;
  showChatHistoryFullScreen: boolean;
  isTyping: boolean;
  history: ChatMessage[];
  historyLoading: boolean;
  historyReachedEnd: boolean;
  streakDays?: number;
  hasUnclaimed?: boolean;
  showStreakConfetti?: boolean;
  canCheckIn?: boolean;
};

