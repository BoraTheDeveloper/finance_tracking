# Luy Khnom Mobile App Plan

## Requirements Summary

Build Luy Khnom as a local-first cross-platform mobile app, Android first and iOS later. The current workspace is a design/prototype handoff only: `Luy Khnom.dc.html`, `support.js`, uploaded image assets, and `design_handoff_sabai_finance/screenshots/*`; no `package.json`, `app.json`, `android/`, `ios/`, `src/`, `pubspec.yaml`, or Gradle project exists yet.

### Source Evidence

- The prototype defines light/dark theme tokens, fonts, and icon source in `Luy Khnom.dc.html:13-19`.
- Primary screen templates are present in the prototype:
  - Home daily budget, month progress, goal, upcoming bills/IOUs, today list: `Luy Khnom.dc.html:194-213`.
  - Add expense parser and category override: `Luy Khnom.dc.html:216-228`.
  - Categories and category detail: `Luy Khnom.dc.html:230-240`.
  - Savings goals: `Luy Khnom.dc.html:243-247`.
  - Insights, weekly chart, heatmap, CSV export, notification preview: `Luy Khnom.dc.html:249-255`.
  - Settings: `Luy Khnom.dc.html:258-265`.
  - Onboarding: `Luy Khnom.dc.html:268-315`.
  - Native-notification mock/preview: `Luy Khnom.dc.html:323-329`.
  - Bottom sheet forms for settings/category/IOU/entry/goal/day view: `Luy Khnom.dc.html:332-344`.
- Seed data and domain shape exist in the prototype state: categories, salary/currency/rate, fixed costs, saved amount, IOUs, goals, history, today transactions, monthly transactions, weekly chart values: `Luy Khnom.dc.html:358-400`.
- Budget, currency, daily allowance, rollover, ring color, category, insight, notification, and settings derivations are encoded in prototype logic: `Luy Khnom.dc.html:403-588`.
- Add expense parsing is deterministic keyword/amount parsing, not a remote AI service: `Luy Khnom.dc.html:417-428`.
- The design screenshots confirm the intended visual style: rounded card surfaces, soft light palette, dark mode, bottom navigation with central add FAB, large money typography, simple charts/heatmap, bottom sheets, and Android/iOS-like mobile framing in `design_handoff_sabai_finance/screenshots/`.

## Product Scope

### Android MVP includes

1. Cross-platform app scaffold that runs on Android first and does not block later iOS.
2. Local-first persistence; no backend, account, remote parser, remote analytics, or cloud sync in MVP.
3. Onboarding:
   - Monthly income.
   - Base currency USD/KHR.
   - Exchange rate KHR per USD.
   - Fixed costs: rent, utilities, loan repayment, due days.
   - Budget method: Balanced 50/30/20 and Saver 40/30/30.
   - Daily reminder time.
4. Home:
   - Daily left-to-spend ring.
   - Base + rollover calculation explanation.
   - Tomorrow forecast.
   - Month spent/saved progress.
   - Top savings goal.
   - Upcoming rent/loan/IOU items.
   - Today transaction list.
   - Add/edit/delete/undo transaction behavior.
   - Dark mode toggle.
5. Add Expense:
   - Single natural-language input like `netflix, 10$` and `food, 1000 riels`.
   - Parsed preview.
   - Category override chips.
   - Optional note.
   - Save into local DB.
6. Categories:
   - Default categories from prototype.
   - Monthly budget per category.
   - Category progress cards.
   - Category detail transaction drilldown.
   - Add/edit/delete/archive category via bottom sheet.
7. Savings Goals:
   - Create goal.
   - Target amount, monthly contribution, currency, icon.
   - Progress, months-to-go, contribution button.
   - Daily leftover sweep into savings if safe and idempotent.
   - Celebration once when goal is reached.
8. Insights:
   - End-of-day status card.
   - Weekly budget chart.
   - 5-week heatmap.
   - Day detail bottom sheet.
   - Best/worst day stats.
   - CSV export.
9. Settings:
   - Edit all onboarding values.
   - Edit exchange rate.
   - Bill reminder toggle.
   - Appearance toggle.
   - Categories shortcut.
10. Android notifications:
   - Daily end-of-day summary.
   - Bill reminders.
   - Permission flow.
   - Reschedule/cancel on settings changes.
   - Rehydrate schedules after reboot/timezone change where platform permits.
11. Design quality:
   - Light, smooth, rounded, minimal custom UI matching screenshots.
   - Dark mode parity.
   - Offline operation.
   - Accessible labels, contrast, dynamic type resilience.

### Deferred after Android MVP

- iOS build polish, iOS notification edge cases, iOS-specific safe-area refinements.
- Accounts, cloud sync, backup sync, bank/card imports, OCR receipts.
- Online AI parser or automatic exchange-rate fetching.
- Widgets/live activities/lock-screen custom UI beyond normal notifications.
- Full Khmer localization unless requested; MVP should still bundle Khmer-capable fonts and correctly render KHR.
- Custom budget percentages beyond the two prototype methods.
- Advanced recurring transactions beyond fixed costs shown in design.

## Technical Decision

Use **Expo React Native + TypeScript** for the first implementation.

### Why this stack

- Android-first and iOS-later fit Expo’s workflow: one codebase, Android can ship first, iOS remains a build target rather than a rewrite.
- The design is mostly custom UI, not platform-native widgets; React Native maps well to custom cards, chips, bottom tabs, bottom sheets, SVG rings, bars, and heatmaps.
- Expo gives stable libraries for fonts, SQLite, notifications, filesystem/sharing, status bars, safe areas, and Android builds.
- Native performance is enough if we avoid WebViews, heavyweight UI kits, remote fonts, and unnecessary list virtualization.
- The current repo has no scaffold or conventions to preserve, so starting with Expo is lower-risk than grafting into an existing app.

### Alternatives considered

1. **Flutter**
   - Pros: strong custom drawing, smooth UI, mature Android/iOS builds.
   - Cons: introduces Dart; less aligned with the HTML/JS prototype logic; more rewrite friction for existing JS formulas/parser.
2. **Native Android first + Swift later**
   - Pros: best platform-specific quality.
   - Cons: duplicates product logic and delays iOS; high maintenance cost for a personal finance app.
3. **Kotlin Multiplatform + native UIs**
   - Pros: shared domain model with native UI.
   - Cons: heavier setup; slower path from prototype to usable app; more architectural load before product behavior is validated.
4. **Capacitor/WebView wrapper around prototype**
   - Pros: fastest superficial port.
   - Cons: weaker native feel, notification/storage friction, web-font/icon issues, worse long-term maintainability. Reject.

## Architecture

### Proposed project layout

```text
app/                              # Expo Router screens/routes
  _layout.tsx
  onboarding/
    index.tsx
  (tabs)/
    _layout.tsx
    index.tsx                     # Home
    categories.tsx
    insights.tsx
    settings.tsx
  add.tsx
  categories/[id].tsx
  goals.tsx
src/
  domain/
    money.ts                      # integer money + currency conversion
    dates.ts                      # month/day/rollover boundaries
    budget.ts                     # 50/30/20, 40/30/30, daily budget formulas
    expenseParser.ts              # local deterministic parser
    insights.ts                   # weekly/heatmap/day stats
    notifications.ts              # notification body derivation
  db/
    schema.ts
    migrations/
    client.ts
    repositories.ts
    seedDefaults.ts
  state/
    appStore.ts                   # small app state facade over DB/useQueries
    selectors.ts                  # derived screen models
  ui/
    theme.ts
    tokens.ts
    components/
      AppScreen.tsx
      Card.tsx
      Icon.tsx
      MoneyText.tsx
      ProgressBar.tsx
      RingBudget.tsx
      BottomSheet.tsx
      SegmentedControl.tsx
      CategoryChip.tsx
      Toast.tsx
      EmptyState.tsx
      ChartBars.tsx
      Heatmap.tsx
  features/
    onboarding/
    home/
    addExpense/
    categories/
    goals/
    insights/
    settings/
    notifications/
tests/
  domain/
  repositories/
  e2e/
assets/
  fonts/
```

### Core libraries

- Expo + React Native + TypeScript.
- Expo Router for navigation.
- `expo-sqlite` for local persistence.
- Drizzle ORM or a small typed SQLite repository layer for schema/migrations. Prefer Drizzle if migrations stay clear; avoid if it becomes ceremony.
- `expo-font` for Plus Jakarta Sans and Kantumruy Pro.
- Central icon adapter. Prefer bundled native icon fonts; map prototype Material Symbols names to the closest native icon set or bundle an icon font if fidelity requires it. No remote Google font/icon loading.
- `react-native-svg` for ring, weekly bars, and heatmap if plain Views are insufficient.
- Reanimated and `@gorhom/bottom-sheet` only where native motion matters; avoid a broad UI framework.
- `expo-notifications` for Android local notifications.
- `expo-file-system` + `expo-sharing` for CSV export.
- Testing: Jest/Vitest for pure domain, React Native Testing Library for components, Maestro or Detox for Android flows.

## Domain Rules

### Money and currency

- Store all money as integers:
  - USD in cents.
  - KHR in whole riel.
- Store every transaction with:
  - Original amount and original currency.
  - `exchangeRateKhrPerUsdSnapshot` at entry time.
  - Normalized base amount for current budget calculations.
- Recommended policy: **transaction totals use the stored snapshot for financial correctness; settings and future entries use the current rate.** This avoids historical totals changing when the user edits the rate. The UI can still show “current estimate” where useful.
- Budgets/settings entered in base currency recalculate immediately when those settings change.

### Calendar and rollover

- Replace prototype hardcoded values (`daysLeft = 27`, static July 2026 dates) with real local date calculations.
- Month period is local calendar month.
- Daily base budget:
  - `spendableMonth = income - fixedCosts - savingsTarget`.
  - `spentMonth = sum(expenses in month)`.
  - `baseDaily = max((spendableMonth - spentMonth) / daysRemainingIncludingToday, 0)`.
- Rollover:
  - Carry yesterday’s under/over amount into today.
  - Clamp to avoid negative daily budget display; over-budget state still shows red deficit.
  - Persist daily close snapshots only if needed for reproducible history; otherwise derive from transaction dates.

### Expense parser

- MVP parser remains local and deterministic.
- Extract first positive number.
- Infer currency from `$`, `usd`, `dollar`, `riel`, `khr`, `៛`; default high numeric values to KHR and small values to USD as prototype does.
- Infer category from keyword map.
- Always expose parsed result before save and allow manual category/currency/amount correction.

### Data model

- `settings`: onboardingComplete, baseCurrency, exchangeRateKhrPerUsd, themeMode, dailyReminderTime, billRemindersEnabled, budgetMethodId, schemaVersion.
- `budget_methods`: Balanced 50/30/20, Saver 40/30/30.
- `fixed_costs`: rent/utilities/loan, amount, currency, dueDay, active.
- `bill_payments`: fixedCostId, yearMonth, paidAt.
- `categories`: id, name, icon, color, monthlyBudget, sortOrder, archivedAt.
- `expenses`: id, occurredAt, label, categoryId, amountMinor, currency, exchangeRateSnapshot, note, parserSource, createdAt, updatedAt, deletedAt.
- `goals`: id, name, targetAmount, targetCurrency, perMonthAmount, icon, archivedAt, achievedAt.
- `goal_contributions`: goalId, amount, currency, source, occurredAt.
- `ious` if included: person, amount, currency, dueText/dueDate, status, createdAt, settledAt.
- `notification_schedules`: type, localNotificationId, scheduledFor, relatedEntityId, enabled, lastScheduledAt.

## Implementation Steps

### Phase 1 — Scaffold and tooling

1. Create Expo TypeScript app in the repo root.
2. Add Android-first scripts: `start`, `android`, `test`, `lint`, `typecheck`.
3. Add ESLint/Prettier only if generated scaffold does not already include formatting; keep tooling minimal.
4. Add font assets for Plus Jakarta Sans and Kantumruy Pro.
5. Add theme tokens copied from prototype CSS variables in `Luy Khnom.dc.html:18-19`.
6. Add Expo Router route skeletons for onboarding, tabs, add, goals, category detail.

Verification:

- Android emulator opens the blank app.
- Typecheck passes.
- Fonts load without network.

### Phase 2 — Domain engine before UI

1. Implement `money.ts` with integer minor units, formatters, and USD/KHR conversion.
2. Implement `dates.ts` for local month boundaries, days remaining, week labels, last 35 days.
3. Implement `budget.ts` with income, fixed cost, savings target, spendable, daily base, rollover, leftToday, tomorrow forecast, ring status.
4. Implement `expenseParser.ts` from prototype parser behavior in `Luy Khnom.dc.html:417-428`.
5. Implement `insights.ts` for weekly bars, heatmap cells, best/worst days, day detail.
6. Create fixture matching prototype seed data from `Luy Khnom.dc.html:358-400`.

Verification:

- Unit tests reproduce prototype fixture values where the prototype is deterministic:
  - Salary `$1200`.
  - Fixed `$535` from rent `$350`, utilities `$35`, loan `$150`.
  - Balanced savings target `$240`.
  - Spendable month `$425`.
  - Category spend about `$74.68`.
  - Parser: `netflix, 10$` -> `$10.00`, USD, Entertainment.
  - Parser: `food, 1000 riels` -> `1000៛`, KHR, Food.
- Edge tests: zero/negative/missing amount, month boundary, KHR conversion, large KHR-like numbers, exchange-rate change policy.

### Phase 3 — Persistence and seed defaults

1. Add SQLite schema and migrations.
2. Seed default categories from prototype categories in `Luy Khnom.dc.html:358-366` on first launch.
3. Persist onboarding/settings.
4. Persist expenses, categories, fixed costs, bill payments, goals, IOUs, notification schedules.
5. Add repository APIs and derived selectors.
6. Add migration tests using an in-memory/test SQLite DB if supported.

Verification:

- Onboarding state survives app restart.
- Added expense survives app restart.
- Edited/deleted category does not orphan historical transactions; archived category remains readable for old expenses.

### Phase 4 — Visual system and navigation

1. Implement app shell, safe-area handling, status bar style, bottom tabs, central add FAB, toast host.
2. Implement reusable UI primitives: card, icon bubble, chip, segmented control, progress bar, ring, bottom sheet, money input, empty state.
3. Implement light/dark themes from prototype.
4. Implement keyboard behavior for add/onboarding/settings forms.
5. Add screen-reader labels for all icon-only controls.

Verification:

- Light and dark Home match `01-home.png` and `home-dark.png` closely.
- Bottom nav/FAB remains usable with Android gesture navigation.
- Dynamic font size does not clip major money values at common accessibility sizes.

### Phase 5 — Onboarding and settings

1. Build three-step onboarding matching `onboarding.png` and `Luy Khnom.dc.html:268-315`.
2. Build settings screen matching `settings.png` and `Luy Khnom.dc.html:258-265`.
3. Build bottom sheets for income, rent/utilities, loan, budget method, currency/rate, daily reminder, bill reminder toggle, appearance.
4. Recalculate all derived values immediately after setting changes.

Verification:

- Fresh install starts onboarding.
- Completing onboarding lands on Home.
- App restart skips onboarding.
- Editing income/rate/method changes Home and Insights derived numbers immediately.

### Phase 6 — Core expense loop: Home, Add, Categories

1. Build Home screen sections from `Luy Khnom.dc.html:194-213`:
   - Header/dark toggle.
   - Budget ring.
   - Base + rollover chips.
   - Month progress.
   - Top goal.
   - Upcoming bills/IOUs.
   - Today list.
2. Build Add Expense screen from `Luy Khnom.dc.html:216-228`.
3. Build transaction edit bottom sheet from `Luy Khnom.dc.html:341`.
4. Implement delete with undo toast from prototype behavior in `Luy Khnom.dc.html:458-459`.
5. Build Categories screen and Category Detail from `Luy Khnom.dc.html:230-240`.
6. Build category add/edit/delete bottom sheet from `Luy Khnom.dc.html:339`.

Verification:

- Add `netflix, 10$`, save, return Home: Today list, Entertainment category, month spent, daily left, and insights update.
- Add `food, 1000 riels`, save: original KHR amount and USD equivalent display correctly.
- Edit an expense category and amount: old/new category totals update correctly.
- Delete expense and undo: totals return exactly.
- Category detail shows only that category’s transactions.

### Phase 7 — Goals, insights, CSV export

1. Build Goals list from `Luy Khnom.dc.html:243-247`.
2. Build goal create/contribution/delete bottom sheet from `Luy Khnom.dc.html:342`.
3. Implement daily leftover sweep into a savings/goal contribution with once-per-day guard.
4. Build Insights top card, weekly chart, heatmap, day sheet, stats, export from `Luy Khnom.dc.html:249-255` and `Luy Khnom.dc.html:504-524`.
5. Implement CSV export behavior equivalent to prototype `exportCSV` in `Luy Khnom.dc.html:468`.

Verification:

- Create goal, add contribution, progress and months-to-go update.
- Goal cannot exceed target from contribution button.
- Reaching target triggers celebration once.
- Heatmap covers exactly 35 days.
- Tapping heatmap cell opens correct day detail.
- CSV has `Date, Description, Category, Amount, Currency, Note` and escapes commas/quotes/newlines.

### Phase 8 — Android notifications

1. Implement notification permission request at a useful moment, not on first cold start unless required by flow.
2. Implement daily end-of-day summary body from domain service equivalent to prototype notification body in `Luy Khnom.dc.html:587-588`.
3. Implement bill reminder body equivalent to `Luy Khnom.dc.html:534-535`.
4. Schedule/cancel/reschedule when reminder settings, daily time, bill due day, bill paid state, or notification permission changes.
5. Add Android notification channel.
6. Add reboot/timezone rescheduling strategy where Expo/platform supports it; document any OS limitation in-app only if user-visible.

Verification:

- Permission denied: app remains usable and settings show reminders disabled/unavailable.
- Permission granted: test notification fires on Android emulator/device.
- Changing reminder time cancels old schedule and creates new one.
- Marking bill paid suppresses current month bill reminder.

### Phase 9 — Polish, QA, and Android build

1. Visual QA against all provided screenshots:
   - `01-home.png`
   - `home-dark.png`
   - `add.png`
   - `categories.png`
   - `goals.png`
   - `insights-top.png`
   - `insights-heatmap.png`
   - `day-view.png`
   - `settings.png`
   - `onboarding.png`
   - `notification-lockscreen.png` as notification-content reference, not literal custom lock screen.
2. Run accessibility pass: labels, focus order, touch target size, color contrast, dynamic type.
3. Run Android E2E smoke path with Maestro/Detox:
   - Fresh install -> onboarding -> home.
   - Add expense -> edit -> delete -> undo.
   - Change settings -> recalculation.
   - Goal contribution.
   - Insights heatmap day sheet.
   - Notification scheduling permission flow.
4. Produce Android debug/release build command path.
5. Leave iOS scaffold untouched but runnable when later configured.

Verification:

- Tests pass.
- Android build succeeds.
- Manual Android smoke test succeeds on emulator or device.
- Network disabled: core app still works.

## Acceptance Criteria

1. Fresh Android install shows onboarding and persists completed state.
2. With fixture-equivalent inputs, budget math matches prototype within explicit rounding rules.
3. All source screens from the handoff are implemented as native app screens or native equivalents.
4. No WebView wrapper is used for core screens.
5. App works offline for all MVP budgeting, expense, category, goal, insight, settings, and export flows.
6. Money is stored as integer minor units; tests cover USD/KHR conversion and rounding.
7. Expenses preserve original currency and amount.
8. Exchange-rate policy is deterministic and tested.
9. Add parser supports `$`, `USD`, `riel`, `KHR`, `៛`, large KHR-like numbers, and category keyword inference.
10. Invalid add input cannot create an expense.
11. Editing/deleting/undoing transactions updates Home, Categories, and Insights consistently.
12. Settings changes recalculate visible budgets immediately and persist after restart.
13. Dark mode persists and applies across all MVP screens.
14. Notifications can be enabled/disabled and rescheduled on Android.
15. CSV export produces a valid file with escaped fields.
16. Major flows are covered by domain tests plus at least one Android E2E smoke test.
17. Visual QA confirms the app feels close to the handoff: rounded surfaces, large readable numbers, soft cards, light motion, simple navigation.
18. The app has no remote data dependency and does not send personal finance data off-device.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Financial rounding drift | Integer money model; unit tests for every formatter/converter. |
| Historical totals changing after rate edits | Store transaction exchange-rate snapshot; test rate-change behavior. |
| Month boundary bugs | Central `dates.ts`; tests for first/last day, leap year, timezone change. |
| Scope creep from prototype hidden features | Implement handoff screens but keep remote AI, sync, widgets, imports deferred. |
| Android notification unreliability under Doze/OEM battery rules | Use Expo notification APIs, clear in-app reminder state, test on emulator/device, avoid promising exact delivery unless exact alarms are implemented. |
| Design fidelity lost through native mapping | Build custom lightweight primitives; avoid generic UI kit; visual QA each screen. |
| Icon mismatch from Material Symbols web font | Central icon adapter with explicit mapping; validate screenshots; bundle assets if required. |
| Local DB migration errors | Versioned migrations, repository tests, seed idempotence. |
| Accessibility regressions in chart/heatmap | Text alternatives, labels, contrast checks, color+text status indicators. |

## Open Product Decisions

These do not block initial scaffold/domain work, but should be confirmed before locking behavior:

1. Exchange-rate semantics: plan recommends transaction snapshot rates for historical accuracy while settings use current rate going forward.
2. IOU/borrowed-money: plan includes it because the Home screen and bottom sheet exist in the handoff.
3. CSV export: plan includes it because it is in Insights.
4. Notification exactness: plan treats Android reminders as normal local notifications unless exact-alarm behavior is explicitly required.
5. Khmer localization: plan supports KHR and Khmer-capable fonts now, but full Khmer UI copy is deferred unless requested.

## Recommended Next Move

Start with Phase 1 and Phase 2 together: scaffold the Expo app, then port the prototype’s financial formulas into tested domain modules before building screens. This avoids a beautiful UI with untrusted money math.
