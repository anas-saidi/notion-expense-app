# Monthly Planning UX/UI Design Brief

## Purpose
Create interface concepts for a guided monthly planning flow in a personal finance app. This brief defines the intended product surface, screen jobs, information hierarchy, interactions, states, and visual behavior. It does not prescribe implementation details.

## Product Context
The experience is a month-scoped planner for preparing a new month financially. It should feel guided, lightweight, and mostly automatic rather than manual and form-heavy.

The flow has six sequential screens:

1. Last month review
2. Reconcile accounts
3. Salaries and pool
4. Budget categories
5. Saving goals
6. Review and save

The experience behaves like one connected flow. A sticky money bar remains visible across the journey and updates on every meaningful change.

## Primary UX Goal
Design a calm, minimal planning experience that helps the user:

- understand the selected month instantly
- trust the starting balances before planning
- confirm the available money pool with minimal friction
- assign money across budgets and savings with fast, satisfying interactions
- notice over-allocation or unresolved issues early
- finish the month plan with confidence

## Core Product Idea
This should not feel like a manual accounting tool. It should feel like a guided monthly reset:

- review what matters from the previous month
- confirm what money is available now
- assign money quickly
- save the month plan

Every screen should have one clear job, one obvious action, and as little decorative UI as possible.

## Core Flow Structure

### Global Frame
The planner uses a multi-step mobile-first layout with:

- planning month context at the top
- sticky money bar
- one active step screen at a time
- bottom action bar with back/cancel and continue/save actions

### Step Sequence
The sequence is fixed:

1. `review`
2. `reconcile`
3. `income`
4. `budget`
5. `savings`
6. `finalize`

Users can move forward and backward, but the experience should read as one guided flow rather than tabbed navigation.

## Sticky Money Bar
The sticky bar is the main cross-step anchor. It must stay compact, readable, and alive.

### Bar Content
Display:

- `availablePool`
- `assignedBudget`
- `assignedSavings`
- `leftToAssign`

### Bar Behavior
- remains visible while step content scrolls
- updates live when income or allocations change
- keeps the current planning month visible
- animates numeric changes so the user can feel the effect of each edit
- changes state color based on planning pressure

### Bar States
- green: money still available
- amber: nearly fully assigned
- red: over-assigned

### Bar UX Emphasis
- `leftToAssign` is the primary number
- supporting values explain where the money is going
- state color should be informative, not alarming
- animations should be subtle and immediate

## Mobile Design Direction
The planner should feel native to mobile:

- single-column layout
- compact sticky bar
- self-contained step screens
- fixed bottom actions within thumb reach
- dense but readable editable rows
- no dashboard chrome, oversized cards, or decorative panels unless they improve clarity

## Screen 1: Last Month Review
This screen answers: "Is the previous month clean enough to move on?"

### Main Job
Show the selected planning month and automatically review the previous month.

### Main Sections
- previous month summary
- budget vs spent snapshot
- over / under category highlights
- missing transactions list

### Information Hierarchy
- selected planning month first
- previous month health summary next
- over / under budget categories
- missing transactions that need review

### Interaction Model
- user can review missing transactions and check them off
- the screen should feel like a lightweight review, not a ledger
- if there are no issues, the screen should feel complete immediately

### UI States
- all clear
- missing transactions present
- over / under categories present
- mixed state
- empty / nothing to review

### UX Emphasis
This is a pre-flight check. It should surface only what matters before continuing.

## Screen 2: Reconcile Accounts
This screen answers: "Do I trust the balances I am planning from?"

### Main Job
Help the user reconcile the three tracked accounts before money planning starts.

### Main Sections
- account list
- notion balance vs actual balance comparison
- unreconciled transaction checklist

### Information Hierarchy
- overall reconciliation state
- one row per account
- account details and unreconciled transaction items beneath or within expanded rows

### Interaction Model
- each account shows Notion balance and editable actual balance
- unreconciled transactions can be checked off one by one
- the user should understand discrepancies without reading long explanations

### Account Row Content
- account name
- notion balance
- actual balance input
- difference
- reconciliation state

### UI States
- all reconciled
- balance mismatch
- unreconciled transactions present
- partially reconciled

### UX Emphasis
Trust and clarity. This screen should reduce uncertainty before the pool is established.

## Screen 3: Salaries And Pool
This screen answers: "How much money is available to plan this month?"

### Main Job
Confirm or edit income entering each account and establish the planning pool.

### Main Sections
- income total
- income by account
- pool confirmation

### Information Hierarchy
- confirmed pool total near the top
- income entries grouped by account below
- confirmation action at the end

### Interaction Model
- each account can receive income entries
- amount edits update the sticky money bar immediately
- confirming the step establishes the pool for later screens

### UI States
- prefilled salary data
- one salary source
- multiple salary sources
- no income found
- edited but not confirmed yet

### UX Emphasis
This step should feel fast and lightweight. The user is verifying the pool, not performing bookkeeping.

## Screen 4: Budget Categories
This screen answers: "Where should this month's living money go?"

### Main Job
Allocate household budgets across all budget categories.

### Main Sections
- budget summary
- grouped category lists
- fast-edit controls

### Information Hierarchy
- remaining amount context first
- grouped rows by `Team`, `Anas`, and `Salma`
- direct row controls next to each category

### Interaction Model
- each row supports slider adjustment plus manual amount input
- every change updates the sticky bar in real time
- category rows can be excluded for the month using a `check` toggle

### Row Content
- category name
- grouping context
- current planned amount
- slider
- manual amount input
- exclude-for-this-month control

### UI States
- untouched row
- edited row
- excluded row
- zero allocation row
- non-zero allocation row
- long grouped list

### UX Emphasis
This is the main planning surface. It should feel rhythmic, quick, and satisfying.

## Screen 5: Saving Goals
This screen answers: "How much should go toward longer-term goals?"

### Main Job
Allocate money across the three savings targets.

### Main Sections
- savings summary
- savings goal rows
- progress context

### Information Hierarchy
- total assigned to savings first
- each goal row beneath
- goal progress and contribution impact as supporting context

### Interaction Model
- row-level interaction mirrors the budget categories step
- slider and manual amount input both work
- live changes update the sticky bar immediately

### Row Content
- goal name
- current saved amount
- target amount
- progress indicator
- this month contribution input
- projected progress after this contribution

### UI States
- no savings assigned yet
- partial progress
- target nearing completion
- fully funded goal
- no savings targets configured

### UX Emphasis
This step should feel consistent with budgets, but more future-oriented and progress-driven.

## Screen 6: Review And Save
This screen answers: "Is this month ready to commit?"

### Main Job
Summarize the full month plan and save it.

### Main Sections
- final planning state
- allocation summary
- warnings or blockers
- save action area

### Information Hierarchy
- readiness state at the top
- total pool and remaining amount next
- grouped budget summary
- grouped savings summary
- warnings directly above the save action

### Interaction Model
- the user reviews the final month totals
- over-allocation or unresolved issues are visible inline
- finishing creates the month record and fund assignments

### UI States
- ready to save
- unresolved warning present
- over-assigned
- under-assigned
- saving
- saved successfully

### UX Emphasis
This screen should feel conclusive, trustworthy, and simple. It should confirm the outcome, not restart the thinking process.

## Shared Data Language In The UI
Use a small, consistent vocabulary throughout the flow:

- available pool
- assigned to budget
- assigned to savings
- left to assign
- reviewed
- reconciled
- missing transactions
- over budget
- save month plan

## Cross-Screen Interaction Patterns

### Live Totals
- all monetary edits update visible totals immediately
- the sticky bar and local screen summaries stay in sync
- the primary number should tick or animate subtly on change

### Progression
- the user always knows where they are in the journey
- each screen has one clear job
- back navigation keeps context intact

### Validation Communication
- warnings appear close to the relevant content
- blocking issues are clearly explained
- non-blocking information stays visually quiet

## Visual Direction Constraints
The design agent can explore visual treatment freely, but these structural rules remain true:

- the layout supports a sticky money bar
- the flow reads as one connected planner
- step screens are self-contained and minimal
- numeric information is easy to compare at a glance
- budget and savings editing supports dense row-based interaction
- green / amber / red planning states are visually distinct

## Responsive Expectations

### Mobile
- this is the primary design target
- sticky money bar stays compact
- rows remain easy to edit repeatedly
- bottom actions stay thumb-friendly

### Desktop
- keep the same product logic
- use width for comfort, not extra complexity
- avoid turning the flow into a dashboard

## Deliverable Shape For The Design Agent
Produce interface explorations that include:

- planner shell
- sticky money bar
- all six step screens
- green / amber / red money bar states
- warning, resolved, and completed states
- mobile-first layouts and desktop adaptations

Keep the output focused on UX/UI behavior, hierarchy, and interaction design only.
