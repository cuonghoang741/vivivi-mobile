# Environment Variables Setup

## Supabase Configuration

Dự án sử dụng environment variables để cấu hình Supabase connection.

### Tạo file .env

Tạo file `.env` trong thư mục root của dự án:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://nechphdcnvhzcshytszt.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55c2ZydW5ham1tYW9xdHBwb3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwOTM5MTYsImV4cCI6MjA4NTY2OTkxNn0.a5M-CRe9f-XCN-ZVisAEeK3_zjGeThQdNwU5iKIX5Jc
```

### Lưu ý

1. **EXPO_PUBLIC_*** prefix: Expo tự động expose các biến môi trường có prefix này
2. **File .env**: Đã được thêm vào `.gitignore` để bảo mật
3. **Fallback values**: Code có fallback values trong `src/config/supabase.ts` nếu env vars không được set
4. **Restart required**: Cần restart dev server sau khi thay đổi `.env` file

### Sử dụng trong code

```typescript
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config/supabase';

// Values sẽ tự động lấy từ process.env.EXPO_PUBLIC_* hoặc fallback
console.log(SUPABASE_URL); // https://nechphdcnvhzcshytszt.supabase.co
```

### EAS Build

Khi build với EAS, cần set environment variables trong EAS dashboard hoặc `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://nechphdcnvhzcshytszt.supabase.co",
        "EXPO_PUBLIC_SUPABASE_KEY": "your-key-here"
      }
    }
  }
}
```

Hoặc sử dụng EAS Secrets:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://nechphdcnvhzcshytszt.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_KEY --value "your-key-here"
```

## Sign in with Apple

Native build yêu cầu bạn tự tạo credential trong Apple Developer portal và cấu hình trong Supabase:

1. **Apple Developer**
   - Tạo **App ID** (hoặc dùng bundle `com.nbtrong.native-version`) và bật capability *Sign in with Apple*.
   - Tạo **Services ID** (dùng định dạng `com.nbtrong.native-version.login`) rồi bật *Sign in with Apple*.
   - Trong mục *Keys*, tạo key mới, tick *Sign in with Apple* và tải file `.p8` về. Ghi lại `Key ID`.
   - Lưu lại `Team ID` của bạn (hiển thị ở góc phải trang developer.apple.com/account).

2. **Supabase Dashboard**
   - Vào `Authentication > Providers > Apple`.
   - Điền các trường:
     - **Client ID**: Services ID ở bước trên (ví dụ `com.nbtrong.native-version.login`).
     - **Key ID** và **Team ID**: lấy từ Apple Developer.
     - **Private Key**: mở file `.p8` và dán nội dung vào ô tương ứng.
   - Lưu cấu hình và đảm bảo provider đang ở trạng thái `Enabled`.

3. **Expo / EAS**
   - Đã bật `ios.usesAppleSignIn` trong `app.json`. Nếu bạn đổi bundle identifier, cập nhật lại giá trị này.
   - Khi chạy `expo prebuild` hoặc `eas build`, bảo đảm bạn đăng nhập bằng tài khoản Apple Developer có quyền với App ID ở trên. EAS sẽ tự động thêm entitlement Sign in with Apple.

4. **Biến môi trường bổ sung (tuỳ chọn)**
   - Nếu bạn sử dụng Supabase Project riêng cho từng môi trường, lặp lại các bước trên và lưu trữ thông tin bằng `eas secret:create`.
   - Không cần thêm biến mới trong client — Supabase giữ khóa Apple giúp bạn. Chỉ cần chắc chắn file `.p8` và thông tin ID được nhập đúng trong dashboard.

5. **Kiểm thử**
   - Chạy `expo run:ios` hoặc build EAS development để thử trực tiếp trên thiết bị/simulator iOS (Sign in with Apple không hoạt động trên Expo Go).
   - Đăng nhập bằng Apple ID thật hoặc TestFlight sandbox.
   - Huỷ đăng nhập phải không hiển thị lỗi đỏ; trạng thái loading sẽ tự tắt như Swift version.

