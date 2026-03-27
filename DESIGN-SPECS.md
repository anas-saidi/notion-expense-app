# Design Specs for Notion Expense Redesign

## 1. Home / Budgets Dashboard

### Layout
- **Header:**
  - App logo/name left, user/account switcher right (if needed).
- **Main Chart:**
  - Large donut or bar chart at the top.
  - Shows total "Planned vs Spent" for the current month.
  - Tappable: toggles to breakdown by category (pie or stacked bar).
- **Budgets List:**
  - Each row: category icon (emoji), name, planned, spent, remaining, horizontal progress bar.
  - Remaining amount color-coded (green = safe, yellow = low, red = over/frozen).
  - Tap row → open Budget Details modal/screen.
- **Frozen Budgets:**
  - Collapsible section at bottom of list.
  - Each frozen budget: "Revive" button (opens fund modal).
- **Ready to Assign:**
  - Section only visible if unassigned funds exist.
  - Shows available amount, "Assign" button.
- **FAB:**
  - Floating action button, bottom right, for "Add Transaction".

### Interactions
- Tap chart to toggle view.
- Tap budget row for details.
- Tap "Revive" to fund frozen budget.
- Tap FAB to add transaction.

---

## 2. Add Transaction Modal

### Layout
- **Fields:**
  - Amount (large, numeric input)
  - Description (text input)
  - Category picker (dropdown or chips, shows icon + name + remaining)
  - Account picker (dropdown, shows icon + name + balance)
  - Date picker (defaults to today)
- **Budget Impact:**
  - Shows remaining after transaction (color-coded)
  - If insufficient funds, show "Revive" prompt inline
- **Actions:**
  - Save (primary), Cancel (secondary)

### Interactions
- Autofocus on amount.
- Category/account pickers filterable.
- "Revive" prompt opens fund modal (choose source: Ready to Assign or another category).

---

## 3. Budget Details Modal/Screen

### Layout
- **Header:**
  - Category icon, name, planned vs spent chart (mini donut/bar).
- **Details:**
  - Planned, spent, remaining (numbers, color-coded)
  - List of recent transactions for this budget
  - Assignment history (Funds DB records)
- **Actions:**
  - "Fund" (from Ready to Assign or another category)
  - "Move Funds" (transfer to another budget)
  - Edit budget (planned amount)

### Interactions
- Tap transaction to view details.
- Tap fund/move to open modal.

---

## 4. Pending Tab

### Layout
- **Quick Add:**
  - Name, amount, category, due date, owner (inline or modal)
- **List:**
  - Each item: name, amount, category, due date, owner
  - Actions: mark as paid, edit, dismiss

---

## 5. History Tab

### Layout
- **Filters:**
  - Date range, category, account (dropdowns)
  - Search bar (top)
- **List:**
  - All transactions, grouped by date
  - Each: name, amount, category, account, date
  - Action: reuse (prefill add form)

---

## 6. Accounts
- **Picker:**
  - Icon, name, type, balance
  - Used in add transaction and fund assignment

---

## 7. Micro-interactions
- **Toasts:**
  - For success, error, and important actions
- **Save Bursts:**
  - Subtle animation on save
- **Loading Lines:**
  - Playful loading feedback

---

## Visual Style
- Playful, friendly, and modern
- Use Notion page icons for categories/accounts
- Responsive, touch-friendly
- Color-coded for clarity (safe, warning, danger)
- Consistent spacing, rounded corners, clear hierarchy

---

## Navigation
- **Bottom Tab Bar:**
  - Home (Budgets) | Pending | History
- **FAB:**
  - Always visible for "Add Transaction"

---

## Accessibility
- Sufficient color contrast
- Keyboard navigation for all actions
- ARIA labels for interactive elements

---

## Notes
- All data is sourced from Notion DBs as specified in SPECS.md
- "Ready to Assign" and fund flows must be visually distinct and easy to access
- Budget impact and warnings should be clear and immediate
