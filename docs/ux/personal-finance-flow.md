# Personal Finance Tracking — Figma-Ready Flow Specification

## Product Direction

This app replaces the product owner’s spreadsheet + ABA history review loop with a mobile-first daily tracking habit.

The design should help the user answer:

1. How much did I spend today?
2. What was my daily budget?
3. Did I overspend?
4. How much did I save this week?
5. How much did I save this month?

## Design Principles

### 1. Daily clarity first

The home screen should answer the daily budget job immediately. Avoid making the user interpret multiple cards before knowing whether they are safe, close, or over.

### 2. Keep the jargon, teach it inline

The user is willing to learn budgeting concepts. Keep terms such as fixed costs, rollover, savings target, daily budget, and monthly reset, but provide short explanations where they appear.

### 3. Never show fake certainty

If there is no data or very little data, show an explicit empty/low-data state instead of pretending insights exist.

### 4. Every money number needs a time scope

Examples:

- Spent today
- Daily budget
- Left today
- Saved this week
- Saved this month
- Spent this month
- Rollover from yesterday

### 5. No irrelevant obligations

If the user has no loan, the app must not show a loan repayment. If no payments are coming up, show a positive empty state.

### 6. Trust must be recoverable

Expense mistakes, delete actions, and backup restores need undo, preview, or confirmation.

---

# User Flow 1: First Setup

## Entry Point

User opens the app for the first time.

## Goal

Create a usable monthly/daily budget model without forcing the user to understand every finance concept upfront.

## Flow Steps

### Step 1: Income

**Screen content**

- Title: `What's your monthly income?`
- Field: Monthly salary
- Currency selector: USD / KHR
- Exchange-rate explanation

**Microcopy**

```text
This is the money your budget starts from. Nothing leaves your phone.
```

**Actions**

- Continue

**Validation**

- Salary can be zero while exploring, but show warning before final setup if zero.

---

### Step 2: Fixed costs

**Screen content**

- Title: `Your fixed monthly costs`
- Explainer: `Fixed costs are payments you need to reserve before daily spending.`
- Rent amount field
- Rent due date selector
- Utilities amount field
- Loan toggle:
  - `No loan`
  - `I have a loan`
- If loan exists:
  - Loan amount field
  - Loan due date selector

**Important behavior**

- Default should not imply the user has a loan.
- Loan payment should only appear in Upcoming if loan amount is greater than 0.
- Rent due date must be selectable during setup.

**Possible due-date selector**

```text
1st / 5th / 15th / 25th / Custom later
```

**Validation**

- If fixed costs exceed salary, show warning:

```text
Your fixed costs are higher than your income. Your daily budget may be zero or negative.
```

---

### Step 3: Budget method

**Screen content**

- Title: `Pick a budgeting method`
- Methods:
  - Balanced
  - Saver
  - Custom later
- Calculation preview:
  - Salary
  - minus fixed costs
  - minus savings target
  - safe to spend this month
  - daily budget

**Microcopy**

```text
Daily budget: the safe amount you can spend each day after fixed costs and savings.
```

```text
Savings target: money you plan not to spend this month.
```

**Actions**

- Start budgeting

**Exit state**

- User lands on Home.
- No fake personal expenses/goals/IOUs should appear unless clearly marked as examples.

---

# User Flow 2: Record Expense

## Entry Point

User taps the central `+` button.

## Goal

Record every expense quickly enough that the habit survives daily use.

## Flow Steps

### Step 1: Amount-first entry

**Screen content**

- Input placeholder:

```text
Try: coffee 2.5$ or lunch 12000៛
```

- Parsed preview:
  - amount
  - converted amount
  - detected category

**Behavior**

- User can type natural text.
- App parses amount, currency, and likely category.
- User can tap category chips to correct.

**Future enhancement**

- Add quick chips:
  - Today
  - Yesterday
  - Pick date
  - common amounts
  - recent category

---

### Step 2: Confirm

**Screen content**

- Button: `Add $X`
- Optional note

**After save**

- Toast:

```text
Added coffee · Undo
```

**Why undo matters**

The user wants to track every expense. Fast entry will create occasional mistakes. Undo protects trust without slowing the main flow.

---

# User Flow 3: Check Today

## Entry Point

User opens app or lands on Home after adding expense.

## Goal

Answer: did I overspend today?

## Screen Structure

### Top

- Greeting
- `Today's budget`
- Dark-mode toggle
- No extra logo competing with title

### Main ring

Show:

- left to spend today / over budget today
- primary currency
- secondary currency

### Supporting pills

- base daily budget
- rollover from yesterday
- tomorrow projection

Each term should be tappable or explainable later.

### This month card

Show:

- spent this month
- saved so far
- days left
- sweep leftover, if applicable

### Goals section

If goals exist:

- show top goal(s)

If no goals:

```text
Start a savings goal
Add a trip, emergency fund, or anything you want future money to protect.
```

### Coming up section

If obligations exist:

- rent/utilities
- loan only if loan > 0
- borrowed money

If none:

```text
Hooray, no payments coming up
Rent, loan, and borrowed-money reminders will appear here when they apply.
```

### Today section

If expenses exist:

- transaction list

If none:

```text
Start recording today
Tap + when you spend. Today's list stays quiet until there is something to track.
```

---

# User Flow 4: Review Insights

## Entry Point

User taps Insights.

## Goal

Understand daily/weekly/monthly behavior without spreadsheet math.

## Screen States

### No data

```text
No spending recorded yet
Record your first expense to see daily insights.
```

### Low data

```text
Keep tracking
Record a few more days to see weekly patterns.
```

### Enough data

Show:

- spent today
- saved today
- week chart
- heatmap
- best saving day
- highest spending day
- top category
- weekly saved amount
- monthly saved amount

## Definitions Needed

### Saved this week

Needs a product decision:

- calendar week
- rolling 7 days
- since last Monday
- since payday

Recommended default for now:

```text
Rolling 7 days
```

because it works before a full calendar week exists.

### Saved this month

Current model uses calendar month. If payday matters later, add budget-cycle setting.

---

# User Flow 5: Backup and Restore

## Entry Point

Settings.

## Goal

Make user confident that data can be recovered.

## Export flow

1. User taps `Export JSON backup`.
2. App writes backup file.
3. System share sheet opens.
4. Toast confirms export.

**Microcopy**

```text
JSON backup restores the whole app. CSV is only for spreadsheets.
```

## Restore flow

Current behavior selects a JSON file and restores it.

Recommended next UX improvement: restore preview before overwrite.

### Restore preview screen/modal

Show:

```text
Backup from Jul 6, 2026
7 categories
0 expenses
1 goal
1 borrowed-money item

Restore this backup?
This replaces current data on this device.
```

Actions:

- Cancel
- Restore backup

## Error states

- Invalid JSON
- Valid JSON but not Luy Khnom backup
- File read failed
- Restore succeeded

---

# Empty State Copy Library

Use these as reusable copy tokens.

| Surface | Title | Body |
|---|---|---|
| Today | Start recording today | Tap + when you spend. Today's list stays quiet until there is something to track. |
| Coming up | Hooray, no payments coming up | Rent, loan, and borrowed-money reminders will appear here when they apply. |
| Goals | Start a savings goal | Add a trip, emergency fund, or anything you want future money to protect. |
| Categories | Start with a category | Add a spending bucket before recording expenses. |
| Category transactions | No transactions yet | Expenses in this category will show up here after you record them. |
| Month sheet | No transactions this month | Start recording expenses and this month will fill itself in. |
| Insights no data | No spending recorded yet | Record your first expense to see daily insights. |
| Insights low data | Keep tracking | Record a few more days to see weekly patterns. |

---

# Accessibility Requirements

## Keyboard / switch navigation

- All interactive elements must be reachable.
- Logical order: top to bottom, left to right.
- Modal/sheet close must be reachable.
- Escape/back should close modal/sheet where platform supports it.

## Screen reader support

Add labels for icon-only controls:

- dark-mode toggle
- back button
- add button
- delete expense
- mark bill paid
- close sheet
- edit category

Examples:

```tsx
accessibilityRole="button"
accessibilityLabel="Toggle dark mode"
```

```tsx
accessibilityRole="button"
accessibilityLabel="Mark rent and utilities as paid"
```

## Visual accessibility

- Text contrast minimum 4.5:1.
- Touch targets minimum 44x44px.
- Do not rely on color alone for over/under budget.
- Use icon + text for error/warning states.
- Dynamic type should not break main cards.

## Forms

- Inputs need visible labels, not placeholder-only labels.
- Error messages should be text, not only border color.
- Currency toggle must announce selected state.
- Due-date buttons must announce selected state.

---

# Figma Screen Checklist

## Screens to design/prototype

1. First-run setup: income
2. First-run setup: fixed costs with no-loan path
3. First-run setup: budget method with calculation preview
4. Home: no data / first day
5. Home: active day with expenses
6. Home: over-budget state
7. Add expense: empty input
8. Add expense: parsed ABA / KHQR-style input
9. Add expense: cash KHR input
10. Categories: default categories
11. Categories: no categories
12. Category detail: no transactions
13. Category detail: transaction list
14. Insights: no data
15. Insights: low data
16. Insights: enough data
17. Settings: backup/export/import
18. Restore backup preview
19. Dark mode versions of Home, Add, Insights, Settings

## Prototype success criteria

A tester should be able to complete these without explanation:

1. Set up salary, rent, no loan, and budget method.
2. Add one ABA / KHQR expense.
3. Add one cash KHR expense.
4. See whether today is over/under budget.
5. Find how much was saved this week/month.
6. Export a backup.
7. Understand the difference between CSV export and JSON backup.
8. Understand why no payments appear when no loan/rent/borrowed money is due.

---

# Product Decisions Still Needed

1. Calendar month vs payday-to-payday budget cycle.
2. Rolling 7-day vs calendar-week savings.
3. Whether to remove all seed data or keep starter categories as suggestions.
4. Whether ABA / KHQR import is feasible from available export/history formats.
5. Whether broader users need Khmer language support.
6. Whether cloud sync is intentionally out-of-scope for privacy.

---

# Handoff to Figma Design

Research artifacts:

- JTBD: `docs/ux/personal-finance-jtbd.md`
- Journey map: `docs/ux/personal-finance-journey.md`
- Flow specification: `docs/ux/personal-finance-flow.md`

Recommended design order:

1. Home no-data and active-day states.
2. Add expense fast-entry flow.
3. Onboarding fixed-cost/no-loan setup.
4. Insights no-data/low-data/enough-data states.
5. Backup restore preview.
6. Accessibility pass on icon buttons and form controls.

Key success metric:

```text
User can answer “How much did I spend today, did I overspend, and how much did I save this week/month?” without opening spreadsheet or ABA history.
```
