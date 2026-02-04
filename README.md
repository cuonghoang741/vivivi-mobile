# VRM React Native App

Dự án React Native Expo để hiển thị VRM models sử dụng WebView và Three.js.

## Cấu trúc dự án

```
native-version/
├── src/
│   ├── components/      # React components
│   │   └── VRMWebView.tsx
│   ├── screens/         # Screen components
│   ├── utils/           # Utility functions
│   │   ├── WebSceneBridge.ts
│   │   └── loadHTML.ts
│   └── assets/          # Assets (HTML, images, etc.)
│       └── html/
│           └── index.html
├── App.tsx              # Main app component
└── package.json
```

## Cài đặt

```bash
npm install
```

## Environment Variables

Tạo file `.env` trong thư mục root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://nechphdcnvhzcshytszt.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your-supabase-anon-key-here
```

File `.env` đã được thêm vào `.gitignore` để bảo mật.

## Chạy dự án

### Development Server (Expo Go)
```bash
# Khởi động Expo dev server
yarn start

# Sau đó mở Expo Go app và scan QR code
# Hoặc nhấn 'i' để mở iOS simulator với Expo Go
# Hoặc nhấn 'a' để mở Android emulator với Expo Go
```

### Development Build (Native Build)
```bash
# iOS - Chạy development build (cần SwiftUI, không dùng Expo Go)
yarn ios

# Android - Chạy development build
yarn android

# Web
yarn web
```

**Lưu ý quan trọng:**
- `yarn start` → Chạy Expo dev server (dùng với Expo Go)
- `yarn ios` → Build và chạy native iOS app (development build, hỗ trợ SwiftUI)
- SwiftUI components chỉ hoạt động với development build, không hoạt động trong Expo Go

## Tính năng hiện tại

- ✅ WebView component để hiển thị Three.js VRM
- ✅ WebSceneBridge để điều khiển WebView từ React Native
- ✅ Message passing giữa WebView và React Native
- ✅ Cấu trúc folder chuẩn trong src/
- ✅ **Supabase integration** - Tích hợp Supabase để kéo dữ liệu
  - ✅ Supabase client singleton
  - ✅ Base Repository pattern
  - ✅ CharacterRepository - Fetch characters
  - ✅ BackgroundRepository - Fetch backgrounds
  - ✅ CurrencyRepository - Fetch/Update currency
  - ✅ AuthService - Authentication management
  - ✅ React Hooks (useAuth, useCharacters, useBackgrounds, useCurrency)
  - ✅ Environment variables support (EXPO_PUBLIC_*)
  - ✅ X-Client-Id header support cho guest users (giống Swift version)
- ✅ **SwiftUI Components** - Tích hợp @expo/ui/swift-ui
  - ✅ Native iOS SwiftUI components với liquid glass effects (iOS 26+)
  - ✅ Button, Switch, TextField, BottomSheet components
  - ✅ Wrapper components cho dễ sử dụng
  - ✅ Demo screen với các components

## Cấu trúc Supabase

```
src/
├── config/
│   └── supabase.ts          # Supabase URL và keys (từ env vars)
├── services/
│   ├── supabase.ts          # Supabase client singleton
│   └── AuthService.ts       # Authentication service
├── repositories/
│   ├── BaseRepository.ts    # Base repository class
│   ├── CharacterRepository.ts
│   ├── BackgroundRepository.ts
│   └── CurrencyRepository.ts
├── utils/
│   └── supabaseHelpers.ts   # Helper functions (giống Swift version)
└── hooks/
    └── useSupabase.ts       # React hooks cho Supabase
```

## Sử dụng Supabase

### Ví dụ sử dụng hooks:

```typescript
import { useCharacters, useBackgrounds, useCurrency, useAuth } from './hooks/useSupabase';

function MyComponent() {
  const { characters, loading, error } = useCharacters();
  const { backgrounds } = useBackgrounds();
  const { balance } = useCurrency();
  const { user } = useAuth();
  
  // ...
}
```

### Ví dụ sử dụng repositories trực tiếp:

```typescript
import { characterRepository } from './repositories';

const characters = await characterRepository.fetchAllCharacters();
const character = await characterRepository.fetchCharacter('character-id');
const ownedIds = await characterRepository.fetchOwnedCharacterIds();
```

### Ví dụ sử dụng helper functions (giống Swift version):

```typescript
import { executeSupabaseRequest, getSupabaseAuthHeaders } from './utils/supabaseHelpers';

// Direct REST API call
const data = await executeSupabaseRequest('/rest/v1/characters', {
  'select': 'id,name',
  'available': 'is.true'
});

// Get auth headers for custom requests
const headers = await getSupabaseAuthHeaders();
```

## SwiftUI Components

Dự án đã tích hợp `@expo/ui/swift-ui` để sử dụng native SwiftUI components trên iOS. Các components này có hiệu ứng liquid glass trên iOS 26+.

### Các components đã tạo:

- `SwiftUIButton` - Native iOS button với các variants
- `SwiftUISwitch` - Switch/Toggle component
- `SwiftUITextField` - Text input field
- `SwiftUIBottomSheet` - Bottom sheet modal
- `SwiftUIDemoScreen` - Demo screen với tất cả components

### Sử dụng:

```typescript
import { SwiftUIButton } from './components/SwiftUIButton';

<SwiftUIButton
  title="Click me"
  onPress={() => console.log('Pressed')}
  variant="default"
  systemImage="heart.fill"
/>
```

**Lưu ý**: SwiftUI components chỉ hoạt động trên iOS và cần development build (không hoạt động trong Expo Go).

Xem thêm: [Expo UI SwiftUI Documentation](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/)

## EAS Build & Deploy

Dự án đã được cấu hình với EAS (Expo Application Services) để build và deploy.

### Setup EAS

```bash
# Đăng nhập
eas login

# Khởi tạo project (lần đầu)
eas init
```

### Build Commands

```bash
# Development build
yarn build:development

# Preview build
yarn build:preview

# Production build
yarn build:production

# Local build (iOS - cần macOS)
yarn build:ios:local
```

### OTA Updates

```bash
# Development update
yarn update:development

# Preview update
yarn update:preview

# Production update
yarn update:production
```

Xem chi tiết trong [EAS_SETUP.md](./EAS_SETUP.md)

## TODO

- [ ] Copy toàn bộ HTML content từ swift-version vào loadHTML.ts
- [x] Tích hợp @expo/ui/swift-ui
- [ ] Thêm các tính năng điều khiển VRM (dance, parallax, call mode)
- [ ] Thêm UI overlay tương tự Swift version
- [ ] Thêm các repositories khác (Costume, Media, Quest, etc.)

## Lưu ý

- File HTML hiện tại là placeholder. Cần thay thế bằng nội dung đầy đủ từ `swift-version/VRM/Resources/index.html`
- WebView sử dụng `react-native-webview` để render Three.js VRM
- WebSceneBridge tương tự như Swift version để điều khiển WebView
- EAS CLI đã được cài đặt globally, chạy `eas login` để bắt đầu
- Supabase credentials được lưu trong `.env` file (đã ignore trong git)
- X-Client-Id header được tự động thêm cho guest users (giống Swift version)
