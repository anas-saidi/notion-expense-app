# App Core Features & Specs

## 1. Budgets & Home Dashboard
- **Planned vs Spent Chart:**
  - Visual summary (donut/bar) of total planned vs spent for the month.
  - Tappable to show breakdown by category.
- **Budgets List:**
  - Each budget (category) shows: name, icon, planned, spent, remaining, progress bar.
  - "Frozen" section for budgets with zero remaining (collapsible, with "Revive" action).
  - "Ready to Assign" section only if there is unassigned balance.
- **Budget Details:**
  - Tap a budget to see detailed view: planned vs spent chart, recent transactions, fund/move actions.
  - Fund from "Ready to Assign" or transfer from another budget.
  - Set monthly budget at start of month; funds roll over by default.

## 2. Add Transaction
- **Floating Action Button (FAB):**
  - Always visible, opens add transaction modal/sheet.
- **Add Flow:**
  - Enter amount, description, pick category & account, pick date.
  - If category has no funds, prompt to "Revive" (fund from account or another category before saving).
  - Show real-time impact on budget.

## 3. Pending Expenses/Bills
- **Pending Tab:**
  - List of pending expenses/bills (wishlist, upcoming, etc.).
  - Quick add at top; each item can be edited, marked as paid, or dismissed.
  - Assign category, amount, due date, and owner.

## 4. Transactions/History
- **History Tab:**
  - List of all transactions (filter by date, category, account).
  - Search bar for quick lookup.
  - Option to reuse a transaction (prefill add form).

## 5. Accounts
- **Accounts Data:**
  - List of accounts, each with name, icon, type, and current balance.
  - Used for funding budgets and tracking available cash.

## 6. User Modes
- **Mode Toggle:**
  - Switch between "wife" and "husband" modes (affects default account, UI accent, etc.).

## 7. Micro-interactions & Feedback
- **Toasts, Save Bursts, Loading Lines:**
  - Playful feedback for actions and state changes.

---


# Notion Database Requirements (Phase 1)

## Transactions DB
- ID: `1926a2be-8922-80be-968a-efa6e6dace95`
- Properties:
  - Name (title)
  - Amount (number)
  - Date (date)
  - Account (relation)
  - Category (relation)
  - Type (select: "Expense")

## Categories DB
- ID: `1926a2be-8922-8029-9b90-c7d8bb55fabd`
- Properties:
  - Category (title)
  - Icon (emoji)
  - Type (multi-select)
  - Default Account (relation)
  - Planned (number)
  - Available (formula/number)

## Accounts DB
- ID: `1926a2be-8922-8014-bb54-d9f5e9d1234b`
- Properties:
  - Name (title)
  - Icon (emoji)
  - Account Type (select)
  - Current Balance (formula/number/rollup)

## Pending DB
- ID: `d2db101b-faec-467d-8c57-eee6d8780311`
- Properties:
  - Name (title)
  - Amount (number)
  - Category (relation)
  - Added By (select)
  - Date (date)

## Funds DB
- ID: `1936a2be89228058990dc549172f1d45`
- Properties:
  - Account (relation)
  - Category (relation)
  - Month (date or select)
  - Amount (number)
  - Assignment Type (select: Monthly/Top-up)
  - (Other properties as needed for assignment tracking)

> Note: Months DB is not required for this setup.

---


# Compatibility Checklist
- [x] Add, edit, and delete transactions (with category/account/date/amount)
- [x] Fetch and display categories with planned/available
- [x] Fetch and display accounts with balances
- [x] Add, edit, and delete pending items
- [x] Support for budget rollovers (handled by available formula in Categories DB)
- [x] Fund/revive budgets (requires ability to update category planned/available)
- [x] Move funds between categories (modeled as a transaction with Type: Transfer, using `budget (out)` and `budget (in)` relations)
- [ ] Assign funds from "Ready to Assign" (requires tracking unassigned balance)

---

# Design Mockup Guidance
- Use this spec to sketch:
  - Home dashboard with planned vs spent chart and budgets list
  - Budget details modal/screen
  - Add transaction modal with revive/fund prompt
  - Pending tab with quick add and list
  - History tab with filters/search
  - Account picker and balances
  - Micro-interactions for feedback

---

# Notes
- Notion DBs support all core features for phase 1. Moving funds between categories is done by creating a transaction with Type: Transfer, setting `budget (out)` and `budget (in)` relations.
- Rollover is handled by the `Available` formula in Categories DB, which includes both saved (rollover) and newly assigned funds for the month.
- "Ready to Assign" logic may require additional properties or manual logic in the app.
