# Couple Finance App — Design Brief

## Concept

A finance app built around the shared life of two people. The core idea is that a household budget is not a spreadsheet — it is a living, shared thing that belongs to both people equally. Every design decision should reflect that.

---

## The Orb

The central element of the app is a circle split vertically down the middle — one half per person. It is the first thing you see and the primary way the app communicates budget health at a glance.

The orb is not a chart. It is a character. It has a personality and reacts to what is happening with the budget. It should feel alive.

**What the orb communicates**
- The fill level of each half reflects how much of the budget has been allocated
- The center displays a single number — the most relevant metric at that moment
- The label above the number names what you are looking at

**How the orb behaves**
- It breathes slowly while there is unallocated money — a gentle, rhythmic scale pulse that signals it is waiting
- It holds its breath and settles the moment every dollar is spoken for
- It startles with a quick shiver when a slider is dragged aggressively
- At the start of a fresh month when nothing has been assigned yet, it yawns — the divider line droops briefly like a sleepy mouth, then returns to rest
- These behaviors should feel organic and subtle, never distracting

**The divider**
The vertical line splitting the two halves is not just a separator. It is part of the orb's expressiveness. It can flex, droop, and return to straight depending on the orb's state.

---

## The Budget Screen

Below the orb is a list of budget categories. Each row has a slider that the couple uses to assign money to that category. The sum of all assigned amounts drains the pool shown in the orb.

**The mental model**
There is one pool of money — the household income. Every dollar in every slider comes from that pool. When you slide a category up, the orb drains. When you slide it down, the orb fills back up. The pool is always balanced — nothing is created or destroyed.

**The slider as a living assignment**
- At the start of the month, all sliders sit at zero and the full pool lives in the orb
- As the month progresses and spending happens, a spent indicator fills from the left inside each row
- The slider thumb can never be dragged below what has already been spent — you cannot un-assign money that is gone
- At any point during the month, the couple can move money between categories by sliding one down and another up

**Slider behaviour**
- When a category has nothing assigned, it should feel dormant — muted label, a dash instead of a number
- As soon as money is assigned, the row wakes up — the number appears, the track fills with the category color
- If dragged very fast, the orb reacts (see startle above)
- If a slider is dragged to its ceiling because the pool is empty, it should gently resist — a small physical nudge communicating that there is nothing left to give

---

## Information Hierarchy

The app shows one number at a time in the orb center. The number changes based on context:

- **Unallocated** — how much of the pool has not yet been assigned to any category. This is the default view during budget setup at the start of the month
- **Remaining to spend** — how much is left across all categories after subtracting what has been spent. This is the primary view mid-month
- **Spent** — total household spending so far

The user can cycle between these views by tapping the orb. A subtle dot trail below the orb indicates which view is active.

The principle: **one number owns the screen at any moment**. Supporting detail lives below it, not beside it.

---

## The Two People

Each half of the orb belongs to one person. Their presence in the app should feel equal and personal without being cluttered.

Below the orb, each person is represented simply — a name, their contribution, and a small status. This is not a leaderboard. It is a reflection of partnership.

The two halves of the orb can subtly diverge in behavior if one person's situation differs from the other's — for example if one has contributed significantly more or less. These are moments for gentle, non-judgmental visual expression.

---

## Emotional Design Principles

**The app should feel like a shared object, not a tool.**
It belongs to both people. The split orb is a constant reminder that this is a joint effort.

**Budget health is felt before it is read.**
The orb communicates anxiety, calm, and satisfaction through its behaviour — breathing, stillness, shivering — before the user has even read the number.

**Friction is information.**
When a slider cannot go further, when the orb resists, when a number turns a different color — these are not errors. They are the app communicating something true about the financial situation.

**Empty states are the beginning of something, not the absence of something.**
A fresh month with nothing assigned is an opportunity. The orb yawning is playful and inviting, not a blank screen asking for input.

**Never overwhelm.**
One number. One action at a time. The couple is making decisions together — the app should create space for that, not compete with it.

---

## Key Interactions Summary

| Moment | What happens |
|---|---|
| Fresh month opens | Orb yawns, full pool shows in center, all sliders at zero |
| Slider dragged | Pool drains in real time, orb fill rises |
| Slider dragged fast | Orb startles with a shiver |
| Pool reaches zero | Orb stops breathing, label changes to reflect completion |
| Pool nearly empty | Center number shifts in tone to signal caution |
| Mid-month slider adjustment | Spent floor prevents over-correction, thumb resists |
| Tapping the orb | Cycles through the three key metrics |

---

## What This App Is Not

- It is not a transaction log — there are other places for that
- It is not a budgeting spreadsheet dressed up as an app
- It is not one person's tool that the other person also has access to
- It is not anxiety-inducing — every design choice should default toward calm and clarity