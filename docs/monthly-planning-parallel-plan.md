# Monthly Planning Implementation Plan

## Goal
Implement a seamless monthly planning flow that matches the current product direction exactly:

1. Last month review
2. Reconcile accounts
3. Salaries and pool
4. Budget categories
5. Saving goals
6. Review and save

The experience should feel mobile-first, guided, minimal, and highly reactive. The sticky money bar is the shared anchor across the full journey.

## Product Contract

### Planning Month
- The user selects a planning month such as `2026-04`.
- Step 1 automatically reviews the previous month relative to that planning month.

### Sticky Money Bar
The sticky bar is shared across all steps and displays:

- `availablePool`
- `assignedBudget`
- `assignedSavings`
- `leftToAssign`

### Sticky Bar States
- green when money remains
- amber when close to fully assigned
- red when over-assigned

### Save Contract
Finishing the flow should:

- create or update the month entry
- create or update fund assignments
- persist the final plan shape needed for later month views

## Current Build Review
Reviewed against the current codebase on 2026-04-01.

### What Exists Today
- A full-screen monthly planner shell exists in [MonthlyPlanningFlow.tsx](/c:/Users/HP/Downloads/notion-expense_1/notion-expense/app/components/MonthlyPlanningFlow.tsx)
- A compact shared header exists in [MonthlyPlanningHeader.tsx](/c:/Users/HP/Downloads/notion-expense_1/notion-expense/app/components/MonthlyPlanningHeader.tsx)
- Basic step components exist for:
  - close month
  - income
  - household
  - savings
  - review
- The planner can open from the budget health header action
- A scaffold save endpoint exists

### What Does Not Match The New Flow Yet
- The flow is still modeled as 5 steps, not 6
- `Reconcile accounts` is not its own dedicated screen
- `Salaries and pool` is still treated as a lighter income step
- `Budget categories` is not grouped by `Team / Anas / Salma`
- Slider-based budget interaction is not implemented
- Exclude-for-this-month category toggles are not implemented
- `Saving goals` does not show target progress and impact clearly
- Final save does not yet create real month and fund records through Notion MCP
- Sticky bar color-state behavior is not fully implemented to the new contract

## Delivery Phases

### Phase 1: Reframe The Flow
Goal:
- Move the app from the old 5-step planner model to the new 6-step product model.

Deliverables:
- new step IDs and labels
- updated flow copy and progression logic
- updated docs and shared language

### Phase 2: Build Trust Inputs
Goal:
- Make the first three screens establish confidence before allocation starts.

Deliverables:
- previous month review
- dedicated account reconciliation screen
- salary and pool confirmation screen

### Phase 3: Build Fast Allocation
Goal:
- Make budgeting and savings feel quick, responsive, and satisfying.

Deliverables:
- grouped budget editing
- slider plus direct input controls
- savings goal progress views
- live sticky bar updates

### Phase 4: Save The Plan
Goal:
- Commit the month cleanly to Notion-backed persistence.

Deliverables:
- final review
- allocation validation
- real save wiring

## Workstreams

### Task A: Flow Contract Refactor
Status: `Next`

Goal:
- Refactor the planner shell from the current 5-step structure to the new 6-step structure.

Scope:
- rename and reorder steps
- insert dedicated `reconcile` step
- split `income` into a clearer `salaries and pool` experience
- update progress copy and screen framing

Likely files:
- `app/components/MonthlyPlanningFlow.tsx`
- `app/components/MonthlyPlanningHeader.tsx`
- `app/page.tsx`

Definition of done:
- the flow renders 6 screens in the right order
- bottom actions and progression logic follow the new contract
- the sticky bar remains stable across the full sequence

### Task B: Last Month Review Screen
Status: `Partial`

Goal:
- Rework the current close-month screen into a cleaner previous-month review.

Scope:
- selected planning month drives previous-month summary
- show budget vs spent
- show over / under categories
- show missing transactions with lightweight review controls

Likely files:
- `app/components/planning/CloseMonthStep.tsx`
- `app/api/month-close/route.ts`

Definition of done:
- step 1 reads as review, not reconciliation
- issues from the previous month are visible without extra chrome
- the screen is minimal and ready to continue when reviewed

### Task C: Reconcile Accounts Screen
Status: `Not started`

Goal:
- Create a dedicated trust-building screen for account reconciliation.

Scope:
- show all 3 tracked accounts
- show Notion balance
- allow actual balance edit
- display unreconciled transactions for each account
- allow per-transaction checkoff

Likely files:
- `app/components/planning/ReconcileAccountsStep.tsx`
- new `app/api/...` reconciliation read model endpoint if needed

Definition of done:
- account reconciliation is separated from month review
- each account can be verified or adjusted
- unreconciled items can be reviewed one by one

### Task D: Salaries And Pool Screen
Status: `Partial`

Goal:
- Turn the current income step into a clearer pool-establishment step.

Scope:
- income grouped by account
- editable salary amounts
- explicit pool confirmation
- sticky bar updates immediately

Likely files:
- `app/components/planning/IncomeStep.tsx`
- `app/api/monthly-income/route.ts`

Definition of done:
- the step clearly answers "how much can I plan?"
- confirming the step establishes the pool state used by later screens

### Task E: Budget Categories Screen
Status: `Partial`

Goal:
- Turn the current household step into the main budgeting surface.

Scope:
- all 24 budget categories
- grouped by `Team`, `Anas`, and `Salma`
- slider plus manual amount input
- exclude-for-this-month toggle
- pulse or animate sticky bar values on change

Likely files:
- `app/components/planning/HouseholdPlanningStep.tsx`
- optional shared planner row components

Definition of done:
- grouped categories are easy to scan
- row editing is fast on mobile
- the sticky bar reacts live to every allocation

### Task F: Saving Goals Screen
Status: `Partial`

Goal:
- Turn the current savings step into a goal-based contribution screen.

Scope:
- 3 savings targets
- current saved amount
- target amount
- this-month contribution
- progress after contribution

Likely files:
- `app/components/planning/SavingsStep.tsx`

Definition of done:
- savings feels like goal progress, not just another list of categories
- the sticky bar updates live from contribution changes

### Task G: Sticky Bar State System
Status: `Not started`

Goal:
- Fully implement the sticky bar behavior the product now depends on.

Scope:
- green / amber / red state logic
- numeric tick animation on change
- immediate response to salary, budget, and savings edits

Likely files:
- `app/components/MonthlyPlanningHeader.tsx`
- planner state helpers used by `MonthlyPlanningFlow.tsx`

Definition of done:
- the bar communicates planning pressure at a glance
- number changes feel immediate and readable

### Task H: Review And Save
Status: `Partial`

Goal:
- Finish the journey with a trustworthy summary and real persistence.

Scope:
- full month summary
- over-allocation warnings
- unresolved issue display
- create month entry and fund assignments

Likely files:
- `app/components/planning/ReviewStep.tsx`
- `app/api/monthly-planning/save/route.ts`

Definition of done:
- the review screen summarizes the plan without clutter
- saving persists real data instead of scaffold success

## Recommended Build Order

### First
- Task A: Flow Contract Refactor
- Task B: Last Month Review Screen
- Task C: Reconcile Accounts Screen

Why:
- these define the new product skeleton and remove the biggest mismatch with the current build

### Second
- Task D: Salaries And Pool Screen
- Task G: Sticky Bar State System

Why:
- the pool and sticky bar are the foundation for all later planning interactions

### Third
- Task E: Budget Categories Screen
- Task F: Saving Goals Screen

Why:
- these are the main allocation screens and depend on a stable pool model

### Fourth
- Task H: Review And Save

Why:
- final persistence should be wired after the data contract and step outputs are stable

## Immediate Next Task
Start with `Task A: Flow Contract Refactor`.

Concrete scope:
- change the planner from 5 steps to 6
- add `reconcile` as a distinct step
- rename steps to match the new product language
- update screen sequencing, step labels, and progression rules

Why this is next:
- every other screen depends on the new flow shape
- it prevents more work from landing against the outdated step model

## MVP Complete When
- the user selects a planning month
- the previous month review is visible automatically
- accounts can be reconciled in a dedicated screen
- salary inputs establish the planning pool
- budget categories can be assigned by group
- saving goals can be funded with visible progress
- the sticky bar updates live and reflects state color correctly
- review and save commits real month and fund data
