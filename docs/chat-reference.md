## Swift Chat Stack Reference

### Key Swift Files
- `Views/Chat/ChatViews.swift` → `ChatMessagesOverlay`, `ChatMessageBubble`, typing indicator, streak badge.
- `Views/Components/ChatBottomOverlayView.swift` → compact overlay with last messages + quick reply chips.
- `Views/Chat/ChatHistoryFullScreenView.swift` → full-screen scrollable conversation with lazy loading, streak UI, context menus.
- `ViewModels/ChatViewModel.swift` (and related) → message list, history fetch, toggles (`showChatList`, `showChatHistoryFullScreen`), Gemini typing state, quick response chips.
- `Views/Components/CameraOverlayView.swift`, `ChatBottomOverlayView` actions (capture, send photo, dance).

### Data & State From Swift
- `ChatMessage` model (id, kind: text/media/system, isAgent flag, timestamp).
- UI state flags:
  - `showChatList`
  - `showChatHistoryFullScreen`
  - `chatMediaLightboxURL/Thumbnail`
  - `isGeminiTyping` (typing indicator)
  - `streakDays`, `hasUnclaimed`, `showStreakConfetti`
  - `quick message chips` visibility.
- Actions:
  - Swipe to hide overlay.
  - Tap overlay to open history.
  - Tap message to show media / toggle timestamp / share / copy / report.
  - Capture photo, send photo, dance (trigger camera/media flows).

### Visual Structure
1. **Compact overlay (bottom)**  
   - Up to last 3 messages displayed, sliding panel animation when `showChatList` toggles.  
   - Quick message chips row.
2. **Full-screen chat**  
   - ScrollView with lazy rows, context menu operations, typing indicator, sentinel for infinite scroll.
3. **Bottom actions**  
   - Buttons: Capture, Send photo, Dance.

### Notes for Native Clone
- Need flexible data source until chat backend defined; start with local mock service replicating ChatViewModel behavior.
- Ensure overlay respects keyboard state and safe-area (Swift uses `.safeAreaInset`).
- Plan for context menu equivalents (long press) later; initial clone can log placeholders.

