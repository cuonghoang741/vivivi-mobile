## Stats & Currency Overlay Reference

Source Swift files:
- `swift-version/VRM/Views/Features/StatsHeaderView.swift`
- `swift-version/VRM/Views/Components/CurrencyDisplayView.swift`

### Data requirements
- **Level badge**
  - Inputs: `level`, `xp`, `nextLevelXP`.
  - Progress = `(xp - prevLevelXP) / (nextLevelXP - prevLevelXP)`.
  - Tapping opens level info sheet.
- **Energy badge**
  - Inputs: `energy`, threshold colors (red <20, orange <50, yellow otherwise).
  - Tapping opens energy info sheet.
- **Currency rows**
  - Inputs: `vcoin`, `ruby`.
  - Shows animated counts when balances increase.
  - Tapping opens currency purchase sheet.

### Interaction mapping
- `onLevelTap` → `showLevelInfoSheet`.
- `onEnergyTap` → `showEnergyInfoSheet`.
- `onCurrencyTap` → `showCurrencyPurchaseSheet`.

### Visual tokens
- Glass button style with rounded rectangles/capsules.
- VCoin & Ruby use `VCoin.png` / `Ruby.png` assets (already present under `src/assets/images`).
- Level progress uses pink → purple gradient capsule, matching Swift `.buttonStyle(.glass)`.

### Implementation notes
- Stats data currently unavailable in Supabase; use mock service mirroring `UserStatsManager` until API exists.
- Currency data can reuse `CurrencyRepository.fetchCurrency()`.
- Overlay should accept props for stats/currency + pass tap handlers up to screen for future sheet integration.

