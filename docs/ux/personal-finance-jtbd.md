# Personal Finance Tracking — Jobs-to-be-Done

## Source

This artifact is based on the product owner/user answers from 2026-07-06.

## Primary User

### Initial user

- **Who**: The product owner, using the app personally.
- **Market ambition**: Eventually useful for other Cambodian users with similar spending patterns.
- **Financial behavior**: Mostly ABA / KHQR payments, sometimes cash.
- **Tracking intent**: Track every expense, not only large expenses.
- **Current workaround**: Spreadsheet plus ABA transaction history.
- **Current pain**: Opening both spreadsheet and ABA, scanning every transaction, and manually recording spend is too much friction.

### Skill level

- The user is not yet deeply comfortable with budgeting concepts such as fixed costs, savings targets, rollover, categories, and monthly resets.
- The app can keep finance vocabulary, but should explain it inline.
- Design implication: Do not remove budgeting concepts; teach them at the moment they matter.

## Core Job Statement

When I spend money throughout the day using ABA / KHQR or cash, I want to record each expense quickly and see how it compares to my daily budget, so I can know whether I overspent and understand how much I saved by day, week, and month without opening a spreadsheet or manually reading ABA history.

## Supporting Job Statements

### Daily control

When I finish or pause during a day, I want to know how much I spent today, what my daily budget was, and whether I overspent, so I can adjust tomorrow before the month gets away from me.

### Savings feedback

When a week or month passes, I want to see how much I saved and where spending changed, so I can learn my money habits and improve without doing manual calculations.

### Low-friction capture

When I pay by ABA / KHQR or cash, I want to enter the amount, currency, category, and optional note with minimal effort, so tracking every expense feels sustainable.

### Budget learning

When the app uses finance concepts like rollover, fixed costs, savings targets, and monthly reset, I want short explanations in context, so I learn the system instead of feeling blocked by jargon.

### Trust and correction

When the app's logic or numbers feel wrong, I want to understand why and correct the underlying data, so I do not need to redesign the whole budget model or abandon trust in the app.

## Current Solution & Pain Points

### Current solution

- Spreadsheet for manual tracking and analysis.
- ABA transaction history for source-of-truth payment records.
- Mental or manual comparison between spending and budget.

### Pain points

- Too many places to check.
- Manual transaction review is repetitive.
- Recording every expense in a spreadsheet is high-friction.
- Daily budget, overspend, and savings answers are not instantly visible.
- ABA history is useful as a source, but not as a budgeting interface.

### Consequences

- Tracking can be delayed or skipped.
- Data becomes incomplete.
- Overspending is discovered late.
- Weekly/monthly savings are harder to understand.
- The product logic must be trustworthy; wrong numbers trigger redesign/rethinking.

## Desired Outcomes

The user should be able to answer these questions quickly:

1. How much did I spend today?
2. What was my daily budget?
3. Did I overspend today?
4. How much did I save this week?
5. How much did I save this month?
6. Which categories are causing overspending?
7. What payments are coming up?
8. What changed since yesterday or last week?

## Success Metrics

### Behavioral metrics

- User records most daily expenses without opening a spreadsheet.
- User checks daily budget status at least once per day.
- User can review week/month savings without manual calculations.
- User trusts the numbers enough to keep using the app.

### Product metrics

- Expense entry can be completed in under 15 seconds for common ABA / KHQR purchases.
- Today screen answers spend vs budget without scrolling.
- Insights screen distinguishes no-data, low-data, and meaningful-history states.
- Backup/restore keeps user trust that data is recoverable.

## Design Principles

### 1. Capture first, analysis second

Tracking every expense only works if entry is fast. The app should prioritize quick recording over detailed analysis during entry.

### 2. Teach budgeting terms in context

Keep terms like daily budget, rollover, fixed costs, and monthly reset, but explain them near the UI where they appear.

Example:

```text
Rollover: money left from yesterday that can increase today's safe-to-spend amount.
```

### 3. Make time scopes explicit

Every money number should declare its scope:

- today
- this week
- this month
- saved so far
- upcoming
- rollover from yesterday

### 4. Avoid fake personal data

Starter examples should not look like real user records. Prefer templates, empty states, or suggested setup cards over seeded personal expenses, IOUs, or goals.

### 5. Keep trust recoverable

Because wrong numbers may cause redesign/rethinking, every computed value should be inspectable or explainable.

Examples:

- Show how daily budget is calculated.
- Show what counts as fixed costs.
- Show which dates are included in week/month totals.
- Let user edit/delete/undo entries.

## Product Gaps to Prioritize

### P0 — Trust and daily tracking

1. Remove or clearly label seed/demo personal data on fresh install.
2. Add explainers for daily budget, rollover, fixed costs, monthly reset, and savings target.
3. Add undo after add/edit/delete expense.
4. Add fixed-costs-exceed-income warning.
5. Add no-data and low-data states for insights.
6. Make loan/rent/utilities optional where applicable.

### P1 — Make tracking every expense sustainable

1. Faster ABA / KHQR-style entry.
2. Recent merchant/category memory.
3. Quick amount chips for common KHR/USD cash payments.
4. End-of-day reminder to record missed expenses.
5. Weekly savings summary.
6. Monthly savings summary.

### P2 — Reduce manual ABA/spreadsheet pain further

1. CSV import or paste flow from ABA export/history, if available.
2. Transaction reconciliation: manually entered expenses vs imported ABA rows.
3. Search/filter transaction history.
4. Custom budget cycle based on payday.
5. Optional recurring payments beyond rent/loan.

## Open Research Questions

1. Is the budget cycle calendar-month or payday-to-payday?
2. How often does the user pay in cash vs ABA / KHQR?
3. Are ABA merchant names consistent enough to support import/category suggestions later?
4. Does the user want income tracking, or only expense tracking against a known salary?
5. Should weekly savings mean calendar week, rolling 7 days, or days since salary/payday?
6. What is the minimum useful insight with only 1–3 days of data?
