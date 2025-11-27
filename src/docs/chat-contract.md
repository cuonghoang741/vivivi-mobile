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
- Actions required:
  - `sendMessage(text | media)`
  - `toggleChatList()`
  - `openHistory() / closeHistory()`
  - `triggerCapture()`, `triggerSendPhoto()`, `triggerDance()`
  - `loadHistory()` (pagination)

