# EAS (Expo Application Services) Setup Guide

## Cài đặt EAS CLI

EAS CLI đã được cài đặt globally. Nếu cần cài lại:

```bash
npm install -g eas-cli
```

## Đăng nhập EAS

```bash
eas login
```

Hoặc tạo tài khoản mới:

```bash
eas register
```

## Khởi tạo EAS Project

```bash
eas init
```

Lệnh này sẽ:
- Tạo project trên Expo servers
- Thêm `projectId` vào `app.json`
- Kết nối dự án với Expo account của bạn

## Cấu hình Build Profiles

File `eas.json` đã được tạo với 3 profiles:

### 1. Development
- Development client build
- Có thể chạy trên simulator (iOS)
- Distribution: internal
- Channel: development

```bash
yarn build:development
```

### 2. Preview
- Internal testing build
- Không có simulator support
- Distribution: internal
- Channel: preview

```bash
yarn build:preview
```

### 3. Production
- Production build cho App Store/Play Store
- Auto increment build number
- Channel: production

```bash
yarn build:production
```

## Build Commands

### iOS

```bash
# Development build
yarn build:development

# Preview build
yarn build:preview

# Production build
yarn build:production

# Local build (cần macOS và Xcode)
yarn build:ios:local
```

### Android

```bash
# Development build
eas build --profile development --platform android

# Preview build
eas build --profile preview --platform android

# Production build
eas build --profile production --platform android

# Local build
yarn build:android:local
```

## EAS Update (OTA Updates)

EAS Update cho phép cập nhật app mà không cần rebuild:

```bash
# Development update
yarn update:development

# Preview update
yarn update:preview

# Production update
yarn update:production

# Platform-specific updates
yarn update:production:ios
yarn update:production:android
```

## Submit to App Stores

### iOS (App Store Connect)

1. Cấu hình Apple credentials trong `eas.json`:
   - `appleId`: Email Apple ID
   - `ascAppId`: App Store Connect App ID
   - `appleTeamId`: Apple Team ID

2. Submit:
```bash
yarn submit:ios
```

Hoặc tự động submit sau build:
```bash
yarn build:ios  # Tự động submit sau khi build xong
```

### Android (Google Play Store)

1. Tạo Service Account Key:
   - Vào Google Play Console
   - Settings → API access
   - Tạo Service Account và download JSON key
   - Đặt file vào `./path/to/api-key.json`

2. Cấu hình trong `eas.json`:
   - `serviceAccountKeyPath`: Đường dẫn đến file JSON key
   - `track`: "internal", "alpha", "beta", hoặc "production"

3. Submit:
```bash
yarn submit:android
```

## Cấu hình iOS

### Bundle Identifier

Đã được cấu hình trong `app.json`:
```json
"bundleIdentifier": "com.nbtrong.native-version"
```

### Apple Developer Account

Cần có:
- Apple Developer Program membership ($99/năm)
- Certificates và Provisioning Profiles sẽ được EAS tự động quản lý

## Cấu hình Android

### Package Name

Đã được cấu hình trong `app.json`:
```json
"package": "com.nbtrong.nativeversion"
```

### Google Play Console

Cần có:
- Google Play Developer account ($25 một lần)
- Service Account key để submit tự động

## Workflow đề xuất

### Development
1. Develop locally với `yarn start` hoặc `yarn ios`
2. Test với development build: `yarn build:development`
3. Deploy OTA updates: `yarn update:development`

### Preview/Staging
1. Build preview: `yarn build:preview`
2. Test với TestFlight (iOS) hoặc Internal Testing (Android)
3. Deploy OTA updates: `yarn update:preview`

### Production
1. Build production: `yarn build:production`
2. Submit to stores: `yarn submit:ios` / `yarn submit:android`
3. Deploy OTA updates: `yarn update:production`

## Lưu ý quan trọng

1. **Project ID**: Sau khi chạy `eas init`, cập nhật `projectId` trong `app.json`
2. **Credentials**: EAS tự động quản lý certificates và keys
3. **Build Time**: Build trên cloud mất 10-20 phút
4. **Local Build**: Cần macOS với Xcode cho iOS, Android Studio cho Android
5. **SwiftUI**: Development builds hỗ trợ SwiftUI, production builds cũng vậy

## Troubleshooting

### Build fails
```bash
# Xem build logs
eas build:list
eas build:view [build-id]
```

### Credentials issues
```bash
# Xem credentials
eas credentials

# Reset credentials
eas credentials --platform ios
eas credentials --platform android
```

### Update không hoạt động
- Kiểm tra channel trong `eas.json` và `app.json`
- Đảm bảo app đã được build với đúng channel
- Kiểm tra `expo-updates` đã được cài đặt

## Tài liệu tham khảo

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)

