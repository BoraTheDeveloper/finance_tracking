# Luy Khnom — Motion, Smooth Interaction, and Warm Welcome Implementation Plan

## Purpose

This plan adds warmth and polish without changing the product promise documented in `docs/ux/`:

- record every ABA / KHQR / cash expense quickly;
- know today's safe-to-spend amount;
- understand overspend, rollover, and savings without spreadsheet work;
- keep trust recoverable through clear explanations, undo, and backup safety.

Motion must explain state changes. It must not become decoration, pressure, or fake gamification.

## Current UX and Code Context

### Existing UX constraints

- `docs/ux/personal-finance-jtbd.md` defines the core job: track every expense and know daily spend, daily budget, overspend, and weekly/monthly savings.
- `docs/ux/personal-finance-jtbd.md` requires starter examples not to look like real user records; categories are acceptable, but seeded personal transactions/goals/IOUs are not.
- `docs/ux/personal-finance-flow.md` defines first setup, add expense, today check, insights, backup/restore, empty states, accessibility, and Figma checklist.
- `docs/ux/personal-finance-journey.md` highlights emotional risk: if numbers feel wrong, trust drops quickly.

### Existing implementation surfaces

- `App.tsx` owns all screen rendering and state transitions.
- `App.tsx` `renderOnboarding()` currently starts directly at monthly income and uses `model.onbStep` values `1..3`.
- `App.tsx` `renderHome()` owns the daily budget ring, month card, sweep action, goals, upcoming payments, and Today list.
- `App.tsx` `renderAdd()` owns natural-language expense entry, parsed preview, category chips, date, note, and save button.
- `App.tsx` `renderSheet()` owns edit/settings bottom sheets and already uses `Modal` plus `KeyboardAvoidingView`.
- `src/ui/components.tsx` contains reusable UI primitives: `EmptyState`, `Pill`, `Progress`, `Upcoming`, `Stat`, and `RingBudget`.
- `src/ui/navigation.tsx` contains bottom navigation and the central add FAB.
- `src/theme/theme.ts` defines the light/dark palette.
- `src/ui/styles.ts` defines the visual system.

## Product Direction

### Domain

The motion language should come from the product world:

1. ABA / KHQR transaction capture.
2. USD / KHR cash spending.
3. A paper ledger replacing spreadsheet work.
4. Daily safe-to-spend rhythm.
5. Rollover from yesterday.
6. Savings being protected, not accidentally spent.
7. Restore/backup confidence.
8. Beginner-friendly budgeting education.

### Color world

Use the current warm interface as the base, then refine through these domain colors:

- warm paper / notebook cream;
- riel-note amber;
- muted clay for caution;
- soft green for saved money;
- deep ink charcoal for trust;
- restrained blue/red hints for ABA / KHQR context only;
- quiet gold for swept leftover or savings moments.

Do not turn the product into a neon fintech app. The desired feeling is calm, local, and private.

### Signature interaction

The signature motion is **receipt-to-ring**:

```text
User types an expense
→ parser understands amount/currency/category
→ user saves
→ a small receipt/coin motion lands into Today
→ the daily ring updates
→ toast offers Undo
```

This makes the budget model visible: every entry changes today's safe-to-spend amount.

## Motion Principles

1. Motion explains cause and effect.
2. Motion should calm, not pressure.
3. No infinite loops except loading states.
4. No fake celebration for ordinary spending.
5. Stronger celebration is reserved for savings goal reached, leftover swept, backup exported, or restore completed.
6. Every motion must have a reduced-motion fallback.
7. Color alone must never carry meaning; text and icon state must also change.
8. Interaction feedback should be immediate, even when persistence or export work is asynchronous.

## Motion Timing Standards

| Motion type | Duration | Use |
|---|---:|---|
| Tap press feedback | 80-120ms | buttons, chips, rows |
| Chip/card state change | 140-180ms | category selection, toggles |
| Toast enter/exit | 160-200ms | success/error/undo |
| Number count / ring update | 220-350ms | budget ring, summaries |
| Screen transition | 240-320ms | onboarding step changes |
| Bottom sheet transition | 260-340ms | explainers, restore preview |
| Celebration moment | 500-900ms | savings sweep, goal reached only |

Use deceleration/ease-out. Avoid dramatic spring, shake, rubber-band, and repeated pulsing.

## Technical Strategy

### Dependency policy

Phase 1 should avoid new native dependencies.

Use built-in React Native primitives first:

- `Animated`
- `Easing`
- `AccessibilityInfo`
- `Pressable`
- existing `react-native-svg`

Optional later dependencies:

- `expo-haptics` for tactile feedback;
- `react-native-reanimated` only if built-in `Animated` cannot deliver acceptable ring/list/sheet motion.

Adding a native dependency means a new EAS preview build is required.

### New shared UI files

Create small reusable pieces instead of making `App.tsx` larger:

```text
src/ui/motion.ts
src/ui/useReducedMotion.ts
src/ui/AnimatedPressable.tsx
src/ui/AnimatedNumber.tsx
src/ui/AnimatedRingBudget.tsx
src/ui/WelcomeScreen.tsx
```

Keep these boring and focused. Do not introduce a broad animation framework until the simple components prove insufficient.

### Reduced motion

Add a hook around React Native accessibility APIs:

```text
useReducedMotion()
```

Rules:

- if reduced motion is enabled, skip slide/fly/count animations;
- use opacity changes or instant state changes;
- keep content order identical;
- keep all actions available.

## Implementation Phases

## Phase 1 — Motion foundation

### Goal

Create the reusable motion layer without changing product behavior.

### Work items

1. Add `src/ui/motion.ts`.
   - Export durations.
   - Export common easing.
   - Export helpers for clamping values and maybe no-op behavior when reduced motion is active.
2. Add `src/ui/useReducedMotion.ts`.
   - Wrap `AccessibilityInfo.isReduceMotionEnabled()`.
   - Subscribe to reduced-motion changes.
   - Default to `false` if unavailable.
3. Add `src/ui/AnimatedPressable.tsx`.
   - Press down scale/opacity.
   - Preserve `accessibilityRole`, `accessibilityLabel`, disabled state, and `onPress` semantics.
   - Use reduced-motion fallback.
4. Replace only low-risk pressables first:
   - category chips in `renderAdd()`;
   - onboarding Continue button;
   - central add FAB in `src/ui/navigation.tsx`.

### Acceptance criteria

- Existing user flows still work: onboarding, add expense, edit sheets, category select, bottom nav.
- Disabled buttons remain visually disabled and do not animate as active.
- Screen reader labels are not lost.
- Reduced-motion mode disables scale animations.
- `npm run typecheck` passes.
- `npm test` passes.

### Verification

- Tap category chips quickly; selected state must remain correct.
- Tap disabled Add button; it must not trigger save or active animation.
- Tap FAB repeatedly; it must navigate once per tap and not leave stuck scale state.

## Phase 2 — Warm welcome screen

### Goal

Add a first-run welcome before asking for salary.

### Product behavior

Current setup starts at income. New setup starts at welcome, then income.

Suggested step model:

```text
onbStep 0 = welcome
onbStep 1 = income
onbStep 2 = fixed costs
onbStep 3 = budget method
```

This is a state migration risk because persisted `onbStep` currently assumes `1..3`. Migration must avoid sending existing users backward unexpectedly.

### Welcome copy

```text
Welcome to Luy Khnom

Track every riel without a spreadsheet.

Record ABA, KHQR, and cash spending in seconds. See what is safe to spend today.

Your data stays on this phone.
```

Promise chips:

```text
Fast entry
Daily budget
Backup ready
```

CTA:

```text
Set up my budget
```

Secondary:

```text
Takes about 1 minute
```

### Visual direction

- Brand mark at top.
- Three small receipt chips: `៛ Coffee`, `$ Lunch`, `៛ Tuk tuk`.
- Chips must be examples, not seeded records.
- A quiet empty daily ring or ledger card sits below the chips.
- No fake salary, fake goals, fake chart, or fake transaction history.

### Animation

- Logo fades in.
- Receipt chips settle with 80ms stagger.
- CTA rises/fades last.
- Total intro motion under 700ms.
- User can tap CTA immediately; animation must not block input.

### Code touch points

- Add `src/ui/WelcomeScreen.tsx`.
- Update `App.tsx` `renderOnboarding()` to render welcome step.
- Update back button logic in `App.tsx` hardware back handler so welcome cannot decrement below 0.
- Update onboarding progress dots from 3 setup dots to either:
  - keep dots only for setup steps 1-3 and no dot on welcome, or
  - show 4 dots with welcome included.

Recommended: keep dots only for setup steps 1-3. Welcome should feel like a door, not a form step.

### Acceptance criteria

- Fresh install shows welcome first.
- Tapping `Set up my budget` moves to income.
- Existing onboarded users never see welcome again.
- Existing users mid-onboarding do not get stuck on an invalid step.
- No seeded transactions, goals, IOUs, or history are introduced.
- Reduced-motion mode shows static welcome content.
- `npm run typecheck` passes.
- `npm test` passes.

### Verification

- Fresh local state: launch app, see welcome.
- Complete setup through income/fixed costs/budget method.
- Restart app after onboarding; app opens Home.
- Simulate old persisted state with `onbStep: 1`; app still reaches income correctly.

## Phase 3 — Onboarding transitions and calculation feedback

### Goal

Make setup feel guided and make budget math easier to understand.

### Work items

1. Animate step changes in `renderOnboarding()`.
   - Forward: current content fades/slides left; next content fades/slides in from right.
   - Back: reverse direction.
   - Reduced-motion: instant switch or simple fade.
2. Animate setup dots.
   - Selected dot width/color transitions.
   - Do not overuse motion on every render.
3. Animate Step 3 budget preview.
   - Budget split bar widths transition when method/custom values change.
   - `Free to spend` result softly highlights when salary/fixed/savings changes.
4. Add calculation explainer affordance.
   - Make `Daily budget`, `Savings target`, and/or `Free to spend` tappable.
   - Open a bottom sheet explaining formula.

### Calculation explainer copy

```text
Daily budget

Salary
− fixed costs
− savings target
÷ days left this month

This is the safe amount you can spend today.
```

### Acceptance criteria

- Step transitions never drop typed values.
- Back navigation preserves current form values.
- Budget method/custom changes update preview smoothly and correctly.
- Explainer sheet closes via close button, scrim, and Android back.
- Reduced-motion mode avoids slide transitions.
- `npm run typecheck` passes.
- `npm test` passes.

### Verification

- Enter salary, move forward/back, confirm salary remains.
- Toggle no-loan/loan, move forward/back, confirm state remains.
- Change budget method; preview values match existing budget math.
- Tap explainer and verify formula text matches current model.

## Phase 4 — Add expense interaction polish

### Goal

Make the daily tracking habit feel fast, understood, and correctable.

### Work items

1. Animate parsed preview in `renderAdd()`.
   - Amount crossfades/counts when parsed amount changes.
   - Currency conversion line fades in only when amount exists.
   - Category icon scales/fades when inferred category changes.
2. Animate category chip selection.
   - Press state uses `AnimatedPressable`.
   - Selected chip fill transitions.
   - Icon/text remain readable against category color.
3. Add save success transition.
   - Save button compresses or briefly highlights.
   - New transaction appears on Home with a short slide/fade.
   - Daily ring updates after save.
4. Add Undo to add/delete/edit flows.
   - Toast copy: `Added coffee · Undo`.
   - Delete copy: `Deleted coffee · Undo`.
   - Undo must restore the exact previous model slice.

### Important data rule

Undo is a trust feature, not just animation. It must reverse the actual model change, not only hide UI.

### Acceptance criteria

- Common expense entry completes in under 15 seconds.
- Save disabled state remains correct when amount/date is invalid.
- Undo after add removes the exact added expense.
- Undo after delete restores the exact deleted expense with original date/time/category/note.
- Undo timeout is long enough to tap comfortably, recommended 4-6 seconds.
- Toast does not overlap keyboard-critical content.
- `npm run typecheck` passes.
- `npm test` passes with added undo tests where logic is extracted.

### Verification

- Add `coffee 5000៛`; parsed amount/category updates; save; Home reflects new row and ring.
- Tap Undo; expense disappears and ring returns.
- Delete an expense; tap Undo; row returns.
- Try invalid date; save remains disabled and no success animation runs.

## Phase 5 — Animated daily ring and home feedback

### Goal

Make Home answer “Am I okay today?” with smooth, calming state changes.

### Work items

1. Replace `RingBudget` with `AnimatedRingBudget` or extend existing component.
   - Animate `strokeDashoffset` from previous `pct` to next `pct`.
   - Animate color changes under/close/over if feasible; otherwise update color instantly.
   - Respect reduced motion.
2. Add number transition for main ring amount.
   - Use `AnimatedNumber` or crossfade if currency string complexity makes count-up brittle.
   - Keep tabular number behavior.
3. Add explicit state copy.
   - Under: `Left to spend today`.
   - Close: `Almost at today's limit`.
   - Over: `Over budget today` plus explanatory support copy where appropriate.
4. Add tappable pills for base daily budget and rollover explainers.
   - Bottom sheet should reuse calculation explainer infrastructure.

### Acceptance criteria

- Ring animation does not run on first render in a distracting way; it should settle once.
- Over-budget state uses text + color, not color alone.
- Ring remains readable in light and dark themes.
- Reduced-motion mode disables ring transition.
- `npm run typecheck` passes.
- `npm test` passes.

### Verification

- Add an expense under budget; ring decreases smoothly.
- Add enough expense to go over budget; text changes to over-budget state.
- Toggle dark mode; ring and text remain legible.
- Tap rollover/base daily pill; explainer opens and closes.

## Phase 6 — Savings sweep and warm reward moments

### Goal

Make positive money behavior feel tangible without turning routine spending into a game.

### Work items

1. Animate `Sweep $X leftover into savings` in `renderHome()`.
   - On tap, button enters loading/pressed state.
   - Small coin/receipt trail moves toward savings/goal area if present.
   - Success toast confirms sweep.
2. Keep existing celebration modal reserved for meaningful achievements.
   - Savings goal reached.
   - Backup exported/restored.
3. Avoid celebration after ordinary expense add.

### Acceptance criteria

- Sweep still updates model exactly once.
- Repeated taps cannot double-sweep.
- Swept state persists across app restart.
- No celebration appears for normal expense entry.
- `npm run typecheck` passes.
- `npm test` passes.

### Verification

- With positive left today, tap sweep.
- Confirm swept badge appears.
- Restart app; swept state remains.
- Confirm no double-update on rapid taps.

## Phase 7 — Empty states, insights, and low-data motion

### Goal

Make no-data and low-data states feel intentional, not broken.

### Work items

1. Extend `EmptyState` or add `AnimatedEmptyState`.
   - Soft one-time icon/row fade.
   - No looping animation.
2. Today empty state.
   - Icon appears.
   - Add/FAB hint may breathe once.
3. Insights no-data state.
   - Show simple empty heatmap placeholders.
   - Copy from UX docs: `No spending recorded yet`.
4. Insights low-data state.
   - Show day markers: e.g. `1 of 3 days recorded`.
   - Copy from UX docs: `Keep tracking`.
5. Weekly recap after enough data.
   - Show rolling 7-day savings.
   - Saved amount may count/crossfade.

### Acceptance criteria

- No-data state appears when there are zero expenses.
- Low-data state appears before enough meaningful history exists.
- Enough-data insights do not pretend patterns exist too early.
- Empty-state animations do not loop forever.
- `npm run typecheck` passes.
- `npm test` passes with domain tests for no/low/enough data classification if extracted.

### Verification

- Fresh app: Today and Insights show no-data states.
- Add one expense: low-data state appears where appropriate.
- Add enough day history in test/dev data: enough-data state appears.

## Phase 8 — Backup and restore trust polish

### Goal

Make backup/restore feel safe and understandable.

### Work items

1. Add restore preview before overwrite.
   - Parse JSON backup.
   - Show counts before applying.
   - Confirm destructive replacement.
2. Add backup export success treatment.
   - Toast or small sheet: `Backup ready`.
   - Explain: `JSON restores the whole app. CSV is only for spreadsheets.`
3. Animate preview sheet content.
   - Counts fade/count in.
   - Reduced motion uses static content.

### Restore preview copy

```text
Backup from Jul 7, 2026

10 categories
23 expenses
2 goals
0 borrowed-money items

Restore this backup?
This replaces current data on this device.
```

### Acceptance criteria

- Import does not overwrite current state until user confirms preview.
- Invalid JSON still shows existing error.
- Valid JSON with bad envelope still shows existing error.
- Restore success closes preview and persists restored state.
- `npm run typecheck` passes.
- `npm test` passes with backup parser/preview-count tests.

### Verification

- Export backup.
- Import same backup.
- Confirm preview counts.
- Cancel and verify current state unchanged.
- Import again and confirm; verify state restored.

## Optional Phase 9 — Haptics

### Goal

Add tactile feedback after core motion is stable.

### Dependency

Likely install:

```bash
npx expo install expo-haptics
```

This may require a new preview build for installed-device testing.

### Use cases

| Action | Feedback |
|---|---|
| Category selected | light impact |
| Expense saved | success notification |
| Undo | light impact |
| Delete | warning notification |
| Invalid save/error | error notification |
| Backup exported | success notification |
| Restore completed | success notification |

### Acceptance criteria

- Haptics are not triggered on every scroll/tap.
- Haptics do not fire when action is disabled.
- App still works if haptics are unavailable.
- `npm run typecheck` passes.
- `npm test` passes.
- Physical Android preview build confirms haptics are acceptable.

## Implementation Order

Recommended order:

1. Phase 1 — Motion foundation.
2. Phase 2 — Warm welcome screen.
3. Phase 3 — Onboarding transitions and calculation feedback.
4. Phase 4 — Add expense interaction polish and Undo.
5. Phase 5 — Animated daily ring and Home explainers.
6. Phase 8 — Backup/restore trust polish.
7. Phase 7 — Empty/low-data states and weekly recap.
8. Phase 6 — Savings sweep reward.
9. Phase 9 — Haptics.

Reasoning:

- Foundation first prevents one-off animation code.
- Welcome/onboarding improve first impression without touching core persistence.
- Add expense and ring animation improve the core daily habit.
- Restore preview improves trust before broader release.
- Haptics wait until motion behavior is proven.

## Testing Strategy

### Automated checks

Run after every phase:

```bash
npm run typecheck
npm test
```

Add focused tests when behavior changes:

- undo stack/action reversal;
- restore preview count derivation;
- no-data / low-data / enough-data insight classification;
- onboarding normalization if `onbStep` changes;
- default category preservation after migration.

### Manual device checks

Test on physical Android preview build for:

- keyboard with animated sheets;
- reduced-motion setting if available;
- dark mode;
- fast repeated taps;
- low-end device responsiveness;
- haptics if Phase 9 is implemented.

### Accessibility checks

- Every icon-only button needs `accessibilityLabel` and `accessibilityRole`.
- Motion must not block screen reader navigation.
- Reduced motion must disable slide/fly/count animations.
- Color changes must be paired with text state changes.
- Touch targets must remain at least 44x44px.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| App becomes flashy or childish | Hurts trust | Keep motion causal, short, and calm |
| `App.tsx` grows harder to maintain | Slower future work | Put reusable motion pieces in `src/ui/` |
| Onboarding step migration breaks existing users | Users get stuck or see wrong step | Add normalization tests for old `onbStep` states |
| Undo only hides UI, not model changes | Data trust failure | Store reversible action payloads and test reversal |
| Ring animation janks | Home feels worse | Use reduced computations, native-driver where possible, disable if needed |
| Haptics require rebuild | Testing confusion | Keep haptics optional and last |
| Reduced-motion ignored | Accessibility failure | Centralize reduced-motion hook and require every motion component to use it |
| Restore preview counts wrong | Trust failure | Derive counts from parsed backup and test with backup fixtures |

## Acceptance Criteria for the Full Motion Program

- Fresh install shows a warm welcome screen before salary input.
- Onboarding transitions are smooth and preserve entered data.
- Add expense parsing feels responsive and category selection has immediate feedback.
- Adding/deleting an expense offers Undo and correctly reverses model state.
- Home daily ring updates smoothly when budget state changes.
- Over-budget state uses text plus color and stays calm.
- Empty/low-data states do not pretend insights exist.
- Backup restore shows a preview before overwriting current data.
- All new motion respects reduced-motion settings.
- No fake personal transactions, goals, IOUs, or history are introduced.
- `npm run typecheck` passes.
- `npm test` passes.
- Physical Android preview build confirms keyboard, dark mode, and motion behavior.

## Figma / Prototype Additions

Add these to the existing Figma checklist in `docs/ux/personal-finance-flow.md`:

1. Welcome screen.
2. Welcome screen reduced-motion variant.
3. Onboarding income step transition.
4. Onboarding fixed-cost/no-loan step transition.
5. Budget method calculation preview with changed method.
6. Add expense empty input.
7. Add expense parsed KHR input.
8. Add expense saved with receipt-to-ring transition.
9. Add expense Undo toast.
10. Home under-budget ring transition.
11. Home over-budget ring transition.
12. Savings sweep transition.
13. Insights no-data animated state.
14. Insights low-data state.
15. Restore preview sheet.
16. Dark-mode versions of welcome, add expense, home ring, restore preview.

## Definition of Done

This plan is complete when the app feels warmer and smoother while still behaving like a private, trustworthy finance tool:

```text
The user opens the app, feels welcomed, records an expense quickly, sees exactly how it changed today's budget, and can undo mistakes without anxiety.
```
