# Design System — Gigs for Work

## Product Context
- **What this is:** B2B SaaS workspace for managing mobile phone plans and SIM cards for distributed workforces
- **Who it's for:** Operations teams, HR managers, and IT administrators at companies with distributed employees
- **Space/industry:** Telecom management, workforce operations (peers: Rippling, Deel, Remote.com)
- **Project type:** Web app (dashboard/workspace)

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian — function-first, data-dense, minimal chrome
- **Decoration level:** Intentional — subtle animations (staggered table rows, floating ghost), WebGL gradient on auth pages. No decorative elements in the workspace.
- **Mood:** Professional, calm, trustworthy. The product should feel like a well-organized control room — everything in its place, easy to scan, zero visual noise. The auth flow adds a moment of warmth before the utilitarian workspace takes over.
- **Anti-patterns:** No decorative blobs, no emoji as design elements, no centered-everything layouts, no purple/violet gradients, no 3-column feature grids with icons in circles.

## Typography
- **Font family:** Inter (Google Fonts)
- **Loading:** `next/font/google` with `latin` subset, CSS variable `--font-inter`
- **Tailwind config:** `--font-sans: var(--font-inter)`

### Type Scale
| Role | Size | Weight | Letter-spacing | Line-height | Usage |
|------|------|--------|---------------|-------------|-------|
| Display | 28px (text-2xl) | 700 (bold) | -0.05rem | 40px | Page titles: "Mobile Plans", "Billing" |
| Heading | 20px (text-xl) | 600 (semibold) | -0.02rem | 28px | Section headings, dialog titles |
| Body | 14px (text-sm) | 400 (normal) | default | 1.5 | Paragraphs, descriptions, form hints |
| Label/UI | 14px (text-sm) | 600 (semibold) | default | 1.5 | Button text, form labels, nav items |
| Table header | 10px (text-3xs) | 600 (semibold) | 0.08em (uppercase) | 14px | Column headers in data tables |
| Small/Meta | 12px (text-xs) | 400-500 | default | 1.5 | Timestamps, secondary info, hints |
| Data | 14px (text-sm) | 500 (medium) | default | 1.5 | Phone numbers, dates, amounts — always use `tabular-nums` |

### Custom Text Sizes
Defined in `globals.css` `@theme`:
- `--text-2xl`: 1.75rem / line-height 2.5rem / letter-spacing -0.05rem
- `--text-3xs`: 0.625rem / line-height 0.9rem

## Color

### Approach: Restrained
One accent (central green) + sage neutrals. Color is rare and meaningful — used for actions, status, and errors. The workspace is predominantly sage tones with white surfaces.

### Color System (OKLCH)
All colors defined in `globals.css` using OKLCH color space for perceptual consistency.

#### Sage — Neutral palette
The backbone of the UI. Used for backgrounds, borders, text, and all non-action elements.

| Token | OKLCH Value | Approximate Hex | Usage |
|-------|-------------|-----------------|-------|
| sage-25 | oklch(0.992 0.0021 197.12) | #fcfdfc | Lightest background |
| sage-50 | oklch(0.984 0.0044 179.74) | #f8faf9 | Page background (`body`) |
| sage-75 | oklch(0.97 0.0069 174.38) | #f3f6f5 | Table row hover, subtle bg |
| sage-100 | oklch(0.967 0.0075 164.94) | #f1f4f2 | Active nav item bg, sidebar active |
| sage-150 | oklch(0.948 0.0094 171.79) | #e8edeb | Hover states on white surfaces |
| sage-200 | oklch(0.928 0.0114 176.3) | #dee4e2 | Borders, dividers |
| sage-300 | oklch(0.872 0.0132 185.05) | #c8d1ce | Input borders, secondary borders |
| sage-400 | oklch(0.715 0.0169 216.72) | #97a5a1 | Placeholder text, muted text |
| sage-500 | oklch(0.552 0.0185 221.27) | #6a7b76 | Secondary text, table headers |
| sage-600 | oklch(0.447 0.022 213.59) | #4f6660 | White button text, tertiary actions |
| sage-700 | oklch(0.378 0.0239 221.47) | #3e5651 | Body text (secondary) |
| sage-800 | oklch(0.28 0.0236 214.04) | #2a3c38 | SolidButtonBlack hover |
| sage-900 | oklch(0.213 0.0218 228.78) | #1a2b28 | Primary text, SolidButtonBlack bg |
| sage-950 | oklch(0.154 0.0132 236.53) | #0f1c1a | Darkest text |

#### Central — Primary accent
The action color. Used for primary buttons, links, and interactive elements. **Customizable per workspace** via ThemeOverrides.

| Token | OKLCH Value | Approximate Hex | Usage |
|-------|-------------|-----------------|-------|
| central-25 | oklch(0.994 0.0041 157.18) | #f5fdf8 | — |
| central-50 | oklch(0.986 0.0066 160.08) | #edfbf2 | — |
| central-100 | oklch(0.98 0.0074 151.89) | #e7faea | Disabled primary button text |
| central-200 | oklch(0.946 0.0216 154.12) | #bdf0cb | Avatar backgrounds |
| central-300 | oklch(0.886 0.0462 152.09) | #82dfa0 | — |
| central-400 | oklch(0.787 0.0693 151.9) | #47c472 | — |
| central-500 | oklch(0.724 0.0849 153.13) | #2aae5a | Primary button hover, disabled bg |
| central-600 | oklch(0.659 0.095 152.94) | #1b9a4a | **Primary action color** — buttons, links |
| central-700 | oklch(0.577 0.069 156.91) | #1d7a42 | — |
| central-800 | oklch(0.434 0.0391 166.15) | #1a5434 | — |
| central-900 | oklch(0.254 0.0202 223.75) | #0f2e22 | — |
| central-950 | oklch(0.18 0.0114 217.17) | #091e16 | — |

#### Brand — Focus states
Used exclusively for focus rings and alternative branding. Blue hue at 240°.

| Token | Usage |
|-------|-------|
| brand-300 | Focus ring outer glow (`ring-brand-300 ring-4`) |
| brand-600 | Focus ring outline (`outline-brand-600 outline-2`) |

#### Semantic
| Purpose | Color | Usage |
|---------|-------|-------|
| Success | Emerald/green tones | Status badges ("Active"), SCIM sync complete |
| Warning | Amber tones | Status badges ("Pending", "Syncing"), scheduled actions |
| Error | red-600 (#dc2626) | Form validation, destructive buttons, deactivation badges |
| Info | Blue tones | Informational alerts (currently minimal use) |

### Theme Customization
Workspaces can override primary and secondary colors via `ThemeOverrides.tsx`:
- `primaryColor` → overrides `central-600`, `central-500` (via `color-mix +15% white`), `central-100` (via `color-mix +70% white`)
- `secondaryColor` → overrides `sage-100`, `sage-75` (via `color-mix +25% white`), `sage-50` (via `color-mix +50% white`)

**Components that respect theme overrides:** All components using `central-600`/`central-500` (primary buttons, links) and `sage-100`/`sage-75`/`sage-50` (nav active states, hover backgrounds, table row hovers).

### Body & Background
- `body { color: gray-900; background: #f9fafb; }`
- Most content surfaces: `bg-white` with `border-sage-200` or subtle shadows

## Spacing
- **Base unit:** 4px (Tailwind default)
- **Density:** Comfortable — not cramped, but not spacious. Tables are the primary interaction surface and need good information density.

### Scale
| Token | Value | Usage |
|-------|-------|-------|
| 0.5 | 2px | Micro gaps (icon-to-text in buttons: `gap-1.5` = 6px) |
| 1 | 4px | Tight gaps between related items |
| 2 | 8px | Default component internal padding, small gaps |
| 3 | 12px | Toast padding, medium gaps |
| 4 | 16px | Section padding, card internal padding |
| 5 | 20px | Table cell horizontal padding |
| 6 | 24px | Page content padding, section vertical padding |
| 8 | 32px | Large section padding |
| 12 | 48px | Page-level vertical spacing |
| 16 | 64px | Header height (fixed at 64px) |

### Layout Constants
- **Header height:** 64px (sticky)
- **Sidebar width:** 260px (hidden below `lg:` breakpoint)
- **Max content width:** 1200px (centered, not applied for admin routes)
- **Page padding:** 24px horizontal

## Layout
- **Approach:** Grid-disciplined — strict column alignment, predictable patterns
- **Grid:** Single sidebar + main content area (not CSS grid columns). Sidebar: 260px fixed. Main: flex-1.
- **Max content width:** 1200px
- **Page structure:**
  ```
  ┌─ header (64px, sticky, white, subtle shadow) ──────────────┐
  │  [Menu] [Logo] [Search (Cmd+K)] [Add Line] [Avatar Menu]  │
  ├──────────────────────────────────────────────────────────────┤
  │ [Sidebar 260px] │ <main (flex-1, overflow-y-auto)>         │
  │  Navigation      │  <max-w-1200 centered>                  │
  │  links           │    Page content                          │
  └──────────────────┴──────────────────────────────────────────┘
  ```

### Border Radius Scale
| Token | Value | Usage |
|-------|-------|-------|
| rounded-md | 6px | Small components (inputs, select dropdowns) |
| rounded-lg | 8px | **Default** — buttons, nav items, inputs, table sections |
| rounded-xl | 12px | Dialogs, modals, command palette |
| rounded-2xl | 16px | Large containers (login form area, billing cards) |
| rounded-full | 9999px | Badges, avatars, pills |

## Components

### Buttons (`src/app/_ui/SolidButton.tsx`)
All buttons share: `rounded-lg`, `font-semibold`, `gap-1.5`, `active:translate-y-px`, `transition`, `*:[svg]:size-4`.

| Variant | Background | Text | Border | Size | Usage |
|---------|-----------|------|--------|------|-------|
| SolidButton | central-600 | white | — | px-2.5 py-2, text-sm | Primary actions ("Add Line", "Save") |
| SolidButtonLarge | central-600 | white | — | p-3 w-full, text-base | Full-width primary (auth flow) |
| SolidButtonBlack | sage-900 | white | — | px-2.5 py-2, text-sm | Secondary emphasis ("Save Changes") |
| SolidButtonBlackLarge | sage-900 | white | — | p-3 w-full, text-base | Full-width secondary |
| SolidButtonWhite | white | sage-600 | sage-300 | px-2.5 py-[7px], text-sm | Tertiary ("Cancel", "Back") |
| SolidButtonWhiteLarge | white | sage-600 | sage-300 | p-3 w-full, text-base | Full-width tertiary |
| SolidButtonRed | red-600 | white | — | px-2.5 py-2, text-sm | Destructive ("Deactivate") |
| SolidButtonOutlineRed | white | red-600 | red-300 | px-2.5 py-[7px], text-sm | Soft destructive ("Remove") |
| SolidButtonTransparentRed | transparent | red-600 | — | px-2.5 py-2, text-sm | Ghost destructive ("Delete") |
| SolidButtonTransparent | transparent | sage-900 | — | px-2.5 py-2, text-sm | Ghost action ("View Plans") |
| SolidButtonTransparentLarge | transparent | sage-900 | — | p-3 w-full, text-base | Full-width ghost |

**Disabled states:** `in-disabled:opacity-80`, lighter bg, muted text color.

### Inputs (`src/app/_ui/Input.tsx`)
| Variant | Height | Padding | Usage |
|---------|--------|---------|-------|
| Input | h-9 (36px) | px-3, text-sm | Standard form fields |
| InputLarge | h-12 (48px) | px-5, text-base | Auth flow, prominent fields |

Shared styles: `rounded-lg`, `border-sage-300`, `placeholder:text-sage-400`, `font-medium`, `bg-white`.
Error: `aria-invalid:border-red-600`, `aria-[invalid=true]:focus-visible:!ring-red-100`.
Disabled: `disabled:bg-sage-50 disabled:text-sage-500`.

### Table (`src/app/_ui/Table.tsx`)
Compound component pattern with semantic table display.

- **Section:** Rounded white container with subtle overflow handling
- **Header row:** Uppercase, `text-3xs`, `sage-500`, thin bottom border
- **Body rows:** `hover:bg-sage-75`, staggered entrance animation via `--stagger-index` CSS variable
- **Linked rows:** Clickable, animated `translate-y` + `opacity` on enter
- **Cell alignment:** First cell left, last cell right (`text-right`)
- **Data formatting:** Always use `tabular-nums` for numbers, dates, currency

### Data attributes
- `data-component="solid-button"` — used for parent styling rules in base layer
- `data-slot="accordion-content"` — Radix accordion animation trigger

## Illustrations & Decorative Elements

### Ghost (`src/app/_ui/Ghost.tsx`)
SVG illustration used for empty states. Two animated groups:
- Ghost character: `animate-ghost-float` (6s ease-in-out infinite, ±3px Y)
- Phone with signal: `animate-phone-float` (6s ease-in-out infinite, 1s delay, 0-5px Y)
- Colors: stroke `#CCD8D6` (muted sage), fill `#FCFDFD` (near-white)

### Sparkles (`src/app/_ui/Sparkles.tsx`)
Randomly generated sparkle particles with:
- `animate-sparkle-grow`: scale 0→1→0 (1s ease-in-out)
- `animate-sparkle-spin`: 0→180deg (1s linear)
- Color: `#FFC700` (yellow)

### WebGL Gradient
Used on auth pages (sign-in, verify). Canvas-based animated gradient for visual warmth without DOM overhead.

### Login Illustration
Hero image (775x1065px) loaded from CDN (`https://a.gigscdn.net/assets/central/`), fade-in animation on auth pages.

## Motion
- **Approach:** Intentional — animations enhance comprehension and add craft without being distracting

### Duration Tokens
| Token | Duration | Usage |
|-------|----------|-------|
| Micro | 50-100ms | Button press (`active:translate-y-px`) |
| Short | 150-250ms | Hover states, focus transitions, accordion open/close (200ms) |
| Medium | 250-400ms | Page transitions, table row entrance (350ms), dialog open/close, command palette |
| Long/Ambient | 400ms-6s | Ghost float (6s), phone float (6s), sparkle animations (1s), ripple (6s) |

### Easing
- **Enter:** ease-out (elements arriving)
- **Exit:** ease-in (elements leaving)
- **Move:** ease-in-out (ambient animations, looping)

### Motion Safety
All non-essential animations wrapped in `motion-safe:` to respect `prefers-reduced-motion`.

## Accessibility

### Focus Management
Global focus ring applied in root layout:
```
focus-visible:outline-brand-600
focus-visible:ring-brand-300
focus-visible:ring-4
focus-visible:outline-2
```

### Component Library
Radix UI provides ARIA semantics for: Avatar, Dropdown Menu, Accordion, Tooltip, Dialog, Select.
Ariakit used for select components (alternative a11y primitive).

### Patterns
- `aria-current` on active navigation links
- `aria-invalid` + `aria-describedby` on form inputs
- `role="status"` + `aria-busy` on loading states
- Semantic HTML: `<nav>`, `<main>`, proper table roles

### Known Gaps (see TODOS.md)
- No skip-to-content link
- Table headers at 10px may be below WCAG readable minimum
- Button touch targets (~32px) below 44px mobile recommendation

## Responsive Breakpoints

Using Tailwind defaults:
| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| < sm (640px) | Mobile | Sidebar hidden, hamburger menu, full-width content |
| sm-lg | Tablet | Sidebar hidden, content adapts |
| lg (1024px)+ | Desktop | Sidebar visible (260px), full layout |

### Mobile Patterns
- Sidebar collapses → mobile hamburger menu in header
- Logo: absolute-centered on mobile, static-left on desktop
- Tables: horizontal scroll (no card view alternative)
- Auth page: form stacks above illustration
- Billing cards: reflow to single column

## Dependencies
- **Tailwind CSS v4** with `@tailwindcss/forms` and `@tailwindcss/typography` plugins
- **Radix UI** primitives for accessible components
- **Ariakit** for select components
- **cmdk** for command palette (Cmd+K search)
- **motion (Framer Motion)** for page transitions and entrance animations
- **Sonner** for toast notifications (custom styled)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-25 | Initial DESIGN.md created | Codified existing visual language from codebase via /design-consultation |
| 2026-03-25 | Kept Inter as primary font | User decision — functional for B2B, familiar to users |
| 2026-03-25 | OKLCH color space documented | Already in use; provides perceptual consistency across sage/central/brand scales |
| 2026-03-25 | Theme override system documented | Per-workspace color customization via CSS variables (central-600/500/100, sage-100/75/50) |

## Roadmap — Recommended Improvements

### High Priority
1. **First-run onboarding flow** — Replace empty-state Ghost with guided checklist for new workspaces (tracked in TODOS.md)
2. **Milestone celebration toasts** — Upgrade Sonner toasts for key actions with warmer copy and distinct success styling
3. **Branded error boundaries** — Replace Next.js default error page with branded error.tsx in workspace/admin route groups (tracked in TODOS.md)

### Medium Priority
4. **Skip-to-content link** — WCAG 2.1 Level A requirement, one `<a>` tag in root layout
5. **Loading skeletons** — Replicate Lines page skeleton pattern to Users, Billing, Admin tables
6. **Touch target minimum** — Bump button padding to meet 44px mobile recommendation

### Low Priority / Future
7. **Dark mode** — Color tokens already use OKLCH which makes dark mode palette generation straightforward. Strategy: invert surface hierarchy, reduce saturation 10-20%.
8. **Display typeface** — Consider adding a second font for page titles/headings (e.g., Instrument Sans, DM Sans, or Geist) to add typographic hierarchy while keeping Inter for body/UI.
9. **Design tokens as CSS custom properties** — Extract spacing, radius, and shadow tokens from Tailwind classes into referenceable CSS variables for theme override expansion.
