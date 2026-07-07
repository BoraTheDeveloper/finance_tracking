# Personal Finance Tracking — User Journey Map

## User Persona

- **Who**: Mobile-first personal finance tracker, initially the product owner and later Cambodian users with similar habits.
- **Context**: Mostly ABA / KHQR payments, sometimes cash. User wants to track every expense but currently relies on spreadsheet + ABA history.
- **Skill level**: Learning budgeting concepts. Comfortable keeping finance terms if the app explains them.
- **Primary device**: Mobile.
- **Goal**: Know daily spend, daily budget, overspend status, and weekly/monthly savings without manually reviewing ABA history and spreadsheet rows.
- **Success metric**: User can answer “How much did I spend today, did I overspend, and how much did I save this week/month?” from the app alone.

## Journey Summary

The journey is not only “add an expense.” The larger journey is replacing a manual spreadsheet + ABA review habit with a daily rhythm:

1. Set up budget rules.
2. Record expenses throughout the day.
3. Check daily budget status.
4. Review week/month savings.
5. Adjust behavior and trust the model.

## Journey Stages

### Stage 1: Setup budget foundation

**What user is doing**

- Enters salary.
- Enters fixed costs like rent, utilities, and loan if applicable.
- Chooses budgeting method.
- Sets reminder preferences.
- Reviews starter categories/goals.

**What user is thinking**

- “What do these budget terms mean?”
- “Do I actually have a loan? Why is the app assuming one?”
- “Is this monthly reset based on calendar month or payday?”
- “Will this match my real ABA spending?”

**What user is feeling**

- Interested, but still learning the system.
- Slightly uncertain about jargon.
- Sensitive to assumptions that do not match real life.

**Pain points**

- Finance concepts can be unfamiliar.
- App assumptions about rent/loan/due date reduce trust.
- Seed/demo data can look like real user data.
- Fixed costs may exceed income, but user may not know what that means.

**Opportunities**

- Make every obligation optional: no rent, no utilities, no loan.
- Add inline explanations for fixed costs, daily budget, rollover, and monthly reset.
- Avoid fake personal seed data.
- Add a calculation preview: salary − fixed costs − savings = safe-to-spend.

**Design notes**

- Use progressive disclosure.
- Show one concept at a time.
- Let users skip anything that does not apply.
- Label optional items clearly.

---

### Stage 2: Record expense

**What user is doing**

- Pays with ABA / KHQR or cash.
- Opens the app immediately, later that night, or after a few days.
- Types an expense amount and category.
- Sometimes adds a note.

**What user is thinking**

- “I need this to be faster than opening my spreadsheet.”
- “Was that $ or ៛?”
- “Which category should this go in?”
- “If I enter this later, will the date be correct?”

**What user is feeling**

- Rushed sometimes, focused other times.
- Willing to track every expense only if entry stays lightweight.

**Pain points**

- Too much typing can kill the habit.
- Cash and ABA entries may feel different.
- Late entry needs date correction.
- Category selection can slow down capture.

**Opportunities**

- Quick entry optimized for amount-first typing.
- Date picker or “Today / Yesterday” chips for delayed entry.
- Recent categories and merchant/category memory.
- Undo after add.
- Common KHR/USD chips for cash.

**Design notes**

- Keep primary add flow one-handed and short.
- Do not require note or complex metadata.
- Make category correction easy after save.

---

### Stage 3: Check today

**What user is doing**

- Opens home screen to see today’s budget ring.
- Checks total spent today.
- Checks whether they overspent.
- Looks at remaining safe-to-spend amount.

**What user is thinking**

- “Am I okay today?”
- “How much can I still spend?”
- “Why did this number change?”
- “What happens if I overspent?”

**What user is feeling**

- Wants fast reassurance.
- If numbers look wrong, trust drops quickly.

**Pain points**

- Rollover and daily budget can feel abstract.
- Empty Today section can look broken.
- Over-budget state needs explanation, not just red color.

**Opportunities**

- Show empty Today copy: “Start recording today.”
- Add a “How this is calculated” affordance.
- Use color + text for over/under budget.
- Show “tomorrow adjusts” only with a short explanation.

**Design notes**

- Today screen should answer the core job without scrolling:
  - daily budget
  - spent today
  - left/over today
- Supporting details can be below the fold.

---

### Stage 4: Review upcoming obligations

**What user is doing**

- Checks rent, loan, borrowed money, or upcoming payments.
- Marks a payment as paid.
- Adds borrowed money if needed.

**What user is thinking**

- “Do I have anything coming up?”
- “Why is loan showing if I have no loan?”
- “Can I trust this due date?”

**What user is feeling**

- Calm if there is nothing due.
- Irritated if irrelevant obligations appear.

**Pain points**

- Showing $0 loan repayment makes the app feel wrong.
- Fixed due dates reduce trust.
- Empty sections without copy look unfinished.

**Opportunities**

- “Hooray, no payments coming up” empty state.
- Do not show loan if loan amount is 0.
- Let due dates be configured in onboarding and settings.
- Add optional recurring payments later if users ask.

**Design notes**

- Upcoming should be truthy: only show real obligations.
- Avoid false alarms.

---

### Stage 5: Review week/month savings

**What user is doing**

- Goes to Insights.
- Looks at weekly pattern, heatmap, saved/overspent days.
- Checks monthly savings and top categories.

**What user is thinking**

- “How much did I save this week?”
- “How much did I save this month?”
- “Where did I overspend?”
- “Is there enough data to trust this?”

**What user is feeling**

- Curious and reflective.
- Can become skeptical if insights feel fake or too confident with little data.

**Pain points**

- Low-data insights can mislead.
- Weekly savings definition may be unclear.
- Month savings may depend on payday vs calendar month.

**Opportunities**

- Add no-data and low-data states.
- Define weekly savings explicitly.
- Define monthly savings explicitly.
- Add “record 3 days to see patterns” state.
- Add weekly/monthly saved totals as first-class cards.

**Design notes**

- Insights should not pretend to know patterns too early.
- Use confidence tiers:
  - no data
  - low data
  - enough data

---

### Stage 6: Correct, recover, and trust

**What user is doing**

- Edits or deletes wrong entries.
- Exports backup.
- Imports backup after reinstall/wipe.
- Checks CSV if needed.

**What user is thinking**

- “Can I fix mistakes?”
- “Can I recover if I lose my phone?”
- “Will restore overwrite anything?”
- “Is this backup the right file?”

**What user is feeling**

- Needs confidence because finance data is personal and trust-sensitive.

**Pain points**

- Destructive edits without undo hurt trust.
- Restore without preview can feel risky.
- CSV and JSON backup can be confused.

**Opportunities**

- Undo after add/edit/delete.
- Restore preview before overwrite.
- Clear separation:
  - CSV = spreadsheet export
  - JSON = full app backup
- Privacy copy: “Your data stays on this device.”

**Design notes**

- Recovery flows need more confirmation than normal tracking flows.
- Export/import should explain what happens to current data.

## Emotional Journey

| Stage | Emotion | Main risk | Design response |
|---|---|---|---|
| Setup | Curious but uncertain | App assumes wrong obligations | Optional rent/loan/utilities and inline explanations |
| Record expense | Rushed or casual | Entry feels slower than spreadsheet habit | Fast amount-first entry, recent categories, undo |
| Check today | Wants reassurance | Numbers feel unexplained | Clear time scopes and calculation explainer |
| Upcoming | Calm if accurate | False $0 loan/reminders | Only show real obligations and friendly empty state |
| Insights | Curious | Low-data false confidence | No-data/low-data states and clear definitions |
| Recovery | Cautious | Restore/delete feels risky | Backup preview, undo, privacy copy |

## UX Opportunities Backlog

### Must-have before broader release

1. Remove fake personal seed records or label them as examples.
2. Add no-data and low-data insights states.
3. Add inline explanations for key budget concepts.
4. Add undo for add/delete/edit expense.
5. Add restore preview before JSON import overwrite.
6. Add fixed-costs-exceed-income warning.
7. Add accessibility labels for icon-only buttons.

### Should-have after core trust is stable

1. Quick “Today / Yesterday / Pick date” when adding expense.
2. Recent category suggestions.
3. KHR/USD common amount chips.
4. Weekly saved amount card.
5. Monthly saved amount card.
6. Payday/budget-cycle setting.

### Later / validate first

1. ABA transaction import or reconciliation.
2. Recurring payments beyond rent/loan.
3. Shared household mode.
4. Cloud sync.
5. AI category suggestions.
