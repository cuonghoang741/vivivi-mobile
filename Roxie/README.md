# Roxie (Swift / SwiftUI) — Phase 0

Native iOS rewrite of the Roxie app (originally React Native + Expo).
Branch: `swift`. This folder is self-contained and does not share code with the RN project at repo root — the RN app stays on `main` during the port.

## Targets

- **Deployment target:** iOS 16.0
- **Primary target:** iOS 26 (liquid glass + latest SwiftUI)
- **Language:** Swift 6
- **UI:** SwiftUI with MVVM
- **Xcode:** 26.x

## Project generation

The project uses [XcodeGen](https://github.com/yonaskolb/XcodeGen). Do **not** hand-edit `Roxie.xcodeproj` — it's regenerated from `project.yml`.

```bash
brew install xcodegen        # one-time
cd Roxie                     # this directory
xcodegen generate            # (re)generate Roxie.xcodeproj
open Roxie.xcodeproj
```

## Build from the command line

```bash
xcodebuild \
  -project Roxie.xcodeproj \
  -scheme Roxie \
  -destination 'generic/platform=iOS Simulator' \
  -sdk iphonesimulator \
  CODE_SIGNING_ALLOWED=NO \
  build
```

## Architecture (MVVM)

```
Roxie/
├── App/                  # App entry + root navigation
│   ├── RoxieApp.swift
│   └── RootView.swift
├── Models/               # Plain data structs
├── ViewModels/           # ObservableObject, one per screen
├── Views/                # SwiftUI views (dumb; observe VM)
├── Components/           # Reusable UI (VRM WebView + bridge)
├── Services/             # Auth, Analytics, Supabase
├── Utils/                # LiquidGlass modifier, helpers
└── Resources/
    └── HTML/             # Bundled VRM viewer (three.js)
```

- Views own a `@StateObject` of their ViewModel.
- `AppViewModel` (app-level coordinator) is injected via `@EnvironmentObject`.
- Services are protocol-based (`AuthServicing`, `AnalyticsServicing`) so VMs can be unit-tested with fakes.

## Liquid Glass

Use the `.liquidGlass(in:)` and `.liquidGlassInteractive(in:)` modifiers (see `Utils/LiquidGlass.swift`).
On iOS 26 they use the real `.glassEffect`; on iOS 16–25 they fall back to `.ultraThinMaterial`. Never call `glassEffect` directly — always go through the helper so the deployment target stays valid.

## Signing

`DEVELOPMENT_TEAM = 10621978177` in `project.yml`.

> ⚠️ Apple signing Team IDs are 10 characters (letters + digits). `10621978177` is 11 digits and looks like an App Store Connect provider/account ID, not a Team ID. Replace with the 10-char Team ID from [Membership](https://developer.apple.com/account#membership-details) before archiving.

## Migration phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Scaffold, splash/sign-in/onboarding/home, VRM WebView placeholder | ✅ this commit |
| 1 | Supabase + real Apple Sign In + session storage | todo |
| 2 | VRM viewer parity: JS bridge, file discovery, persistence | todo |
| 3 | Onboarding v2, character preview, new-user gift | todo |
| 4 | Chat overlay + settings + streak/quest popups | todo |
| 5 | LiveKit voice calls + ElevenLabs TTS | todo |
| 6 | RevenueCat + subscription / ruby sheets | todo |
| 7 | OneSignal + AppsFlyer + Facebook + Firebase + TikTok | todo |
| 8 | iOS 26 glass polish + haptics + localization + media | todo |
| 9 | Xcode Cloud / fastlane + App Store release | todo |

## Bundle ID and conflict with the RN app

Current: `PRODUCT_BUNDLE_IDENTIFIER = com.vivivi` (same as RN app so we can submit as an in-place upgrade eventually). Change in `project.yml` if you want a parallel SKU during beta.
