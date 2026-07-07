# Luy Khnom — Next Phases Roadmap

## Context

The UI/UX work is complete and the app is usable on-device via Expo Go. The
honest state now: **the UI is ahead of the data.** Several numbers on screen are
demo values, not derived from real usage — and the data model has no concept of
*time*, so nothing ages, resets, or accumulates. Before adding more features or
shipping, the data layer needs to catch up to the interface.

This roadmap orders the remaining work so the highest-leverage, hardest-to-
retrofit change (real dates) comes first — doing it now is far cheaper than after
real usage data piles up in the current date-less shape.

All app code lives in `App.tsx` (~1,300 lines). Persistence is
`saveAppState`/`loadAppState` in `src/db/appStorage.ts` (expo-sqlite). Budget math
is `summarizeBudget` in `src/domain/budget.ts`; insights in
`src/domain/insights.ts`.

---

## Phase 1 — Real dates & rollover (the big one)

**Why first:** adding a `date` to expenses and a daily/monthly rollover routine
unlocks month view, insights, CSV export, and all the resets *at once*, and it's
the one change that gets more painful the longer it waits.

### Work items
- **Add `date` (ISO day string) to the `Expense` type** (`App.tsx` ~line 58).
  Stamp it in `addExpense` alongside the existing `time` field. Migrate persisted
  expenses on load (default missing dates to today) in the load-merge at
  `App.tsx` ~line 445.
- **"This month" becomes real.** Filter `model.expenses` by current month instead
  of treating the whole list as today. Affects the home This-month card, the
  `month` sheet, and `renderDetail` transaction lists.
- **Daily rollover.** On app open, if the last-seen day differs from today: push
  yesterday's spent total into `history`, trim `history` to 35 entries, and reset
  the per-day view. Replaces the seeded fake `history` array (`App.tsx` ~line 172)
  so the heatmap and week chart reflect real spending.
- **Monthly reset.** On month change: reset each category's `spentUsd`, clear the
  `swept` flag, and clear `paidBills`. Persist a `lastActiveDay`/`lastActiveMonth`
  marker in the model to detect the boundary.
- **Replace hardcoded values with computed ones:**
  - "27 days left" → actual days remaining in the month (there's already a
    `daysUntilDue` helper to model date math on).
  - Saved-so-far `$232` (home, `App.tsx` ~line 850) and `savedSoFar: money(23200)`
    input to `summarizeBudget` → derive from goal contributions / month savings.
  - `$7.00` rolled over and `rolloverYesterday: money(700)` → from actual prior-day
    leftover.
  - "Good evening" greeting → time-of-day aware.
  - Insights tip ("Food is your top spend…") → compute the real top category.
- **CSV export respects the month dropdown.** `exportCsv` (`App.tsx` ~line 710)
  currently ignores `exportMonth` and writes "Today" as every row's date. With
  real dates, filter by the selected month and emit the real date.

### Verify
- `npx tsc --noEmit` clean, `npm test` green (add tests for rollover/month-boundary
  logic in `src/domain/`).
- On device: add an expense, confirm it lands in This month and the day view;
  simulate a day change (temporary date override) and confirm it moves into
  history and the day resets; confirm month rollover clears category spend, the
  swept badge, and paid bills.
- Export CSV for a chosen month and confirm only that month's rows appear with
  correct dates.

---

## Phase 2 — Ship-readiness

- App icon, splash screen, app name & bundle ID in `app.json`; then an EAS build
  to install without Expo Go.
- Dark-mode pass on device (implemented but not screenshot-verified like light).
- Data safety: backup/restore via export–import JSON (everything is one local
  SQLite store today — no recovery if it's lost).

### Verify
- Standalone build installs and launches on a physical device.
- Toggle dark mode across every screen and sheet; check contrast and the ring,
  heatmap, and celebration modal.
- Export a backup, wipe, re-import, confirm state is identical.

---

## Phase 3 — Structural (do before the file hurts)

- Split `App.tsx` (~1,300 lines: all screens + state + styles) into per-screen
  files plus a small state store. Keeps the next feature cheap to add.
- Grow test coverage beyond the current 5 domain tests — the Phase 1 date/rollover
  logic is exactly what deserves unit tests.

### Verify
- `npx tsc --noEmit` and `npm test` green after each extraction step; app behaves
  identically on device (refactor, no behavior change).

---

## Recommended order

**Phase 1 → 2 → 3.** Phase 1 is the unlock and the retrofit risk; do it before
real data accumulates. Phase 2 makes it shippable. Phase 3 is maintenance
insurance best done before the single-file size compounds.
