## Native Chat Contract

- `ChatMessage`
  - `id: string`
  - `kind: { type: 'text' | 'media' | 'system'; ... }`
  - `isAgent: boolean`
  - `createdAt: ISO string`
- `ChatViewState`
  - `messages: ChatMessage[]`
  - `showChatList: boolean`
  - `showChatHistoryFullScreen: boolean`
  - `isTyping: boolean`
  - `streakDays`, `hasUnclaimed`, `showStreakConfetti`
  - `quickReplies: { id: string; text: string }[]`
- Actions required:
  - `sendMessage(text | media)`
  - `toggleChatList()`
  - `openHistory() / closeHistory()`
  - `selectQuickReply(id)`
  - `triggerCapture()`, `triggerSendPhoto()`, `triggerDance()`
  - `loadHistory()` (pagination)

