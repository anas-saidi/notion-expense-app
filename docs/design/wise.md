# Wise Design Reference (Imported)

Source: C:\Users\HP\Downloads\awesome-design-md-main\awesome-design-md-main\design-md\wise\DESIGN.md

This file is a condensed, ASCII-only reference plus app-specific adaptations for Notion Expense.

## 1. Visual Theme
- Bold, confident fintech feel with high-contrast typography.
- Calm, warm off-white surfaces and near-black text.
- Lime green accent used for primary actions only.
- Minimal shadows; rely on clean borders and spacing.

## 2. Core Colors
- Text (near black): #0e0f0c
- Background (off-white): #ffffff (or a very light warm tint)
- Brand/CTA green: #9fe870
- CTA text (dark green): #163300
- Muted text: #868685
- Subtle surface: #e8ebe6
- Success: #054d28
- Warning: #ffd11a
- Danger: #d03238

## 3. Typography
- Display: Wise Sans (fallback to Inter)
- Body/UI: Inter
- Display weight: 900 with tight line-height (0.85)
- Body weight: 400 to 600
- Enable font feature "calt" globally
- Use tabular numbers for money values (font-variant-numeric: tabular-nums)

## 4. Buttons
- Primary: green pill (#9fe870) with dark green text (#163300)
- Radius: 9999px (pill)
- Hover: scale(1.05)
- Active: scale(0.95)
- Secondary: subtle dark green tint at low opacity

## 5. Cards and Inputs
- Cards: large rounded corners (16px to 30px)
- Borders: 1px solid rgba(14,15,12,0.12)
- Inputs: light borders, strong focus ring
- Avoid heavy drop shadows

## 5b. Card Style (Stripe-Inspired, Wise-Compatible)
- Card radius: 6px to 8px for standard cards, up to 12px for featured.
- Border: soft cool border (use a light neutral; avoid heavy outlines).
- Shadow: subtle two-layer lift for key cards only (soft, not dramatic).
- Background: clean white surface with restrained contrast.

## 6. Motion
- Use slight scale and opacity transitions
- Keep motion brief and confident
- Avoid bouncy or playful animations

## 7. Adaptation Notes for Notion Expense
- Use the green pill CTA for primary actions: Add Transaction, Save, Assign.
- Keep budget rows dense and legible; use tabular numbers for all money values.
- Limit green to actions and positive status to avoid visual noise.
- Use minimal shadow; rely on spacing and border definition.
- Headings can be bold (display) on hero or monthly summary; use Inter for tables and lists.

## 8. Numbers Component (Notion-Inspired, Wise-Compatible)
- Pattern: large number + short description (metric label).
- Number style: Inter 700, tight line-height (1.0), subtle negative tracking (-0.4px to -0.8px).
- Label style: Inter 12-14px, weight 500-600, warm muted text.
- Use tabular numerals for all money values.
- Keep the container flat: no heavy borders, no strong shadows, soft surface only.
