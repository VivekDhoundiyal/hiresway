---
name: hiresway-frontend-quality
description: >-
  Use this skill whenever authoring or updating React components, hooks, or TypeScript types in HiresWay. Enforces strict typing, comprehensive state handling (loading/empty/error/retry), responsive layouts, accessibility, and clean React performance.
---

# Skill B — TypeScript, React & Frontend Quality

## Purpose
Maintain high code quality across HiresWay's React 18 / TypeScript frontend, ensuring type safety, resilience to edge cases, accessible UI patterns, and snappy performance.

---

## Standards & Conventions

### 1. TypeScript Strictness
- Adhere strictly to the project's TypeScript configuration (`tsconfig.json`).
- Prefer well-defined domain types over `any` or loose `Record<string, any>`.
- Never use `@ts-ignore` or `any` casts merely to suppress compiler complaints. If external data is untyped, write a runtime type guard or validation normalizer.

### 2. Comprehensive UI State Handling
Every asynchronous or data-driven component must explicitly handle:
- **Loading State**: Subtle skeletons or spinners that prevent layout shift (CLS).
- **Empty State**: Clear, actionable messaging explaining why there is no data and how the user can populate it (e.g., "No jobs saved yet. Explore the Job Feed to track roles").
- **Error State**: Informative error messaging with a user-operable **Retry** button.
- **Success/Stale State**: Seamless transitions with optimistic updates where appropriate.

### 3. Component & Hook Architecture
- Keep UI components focused on presentation; delegate heavy business logic and caching to `src/core/` engines.
- Use `useCallback` and `useMemo` deliberately on expensive computations or props passed to virtualized lists (e.g. `useVirtualizer`).
- Ensure `useEffect` dependency arrays are complete and clean up timers, subscriptions, or AbortControllers on unmount to prevent memory leaks.

### 4. Responsiveness & Design System
- Utilize HiresWay's established design tokens from `src/tokens/` and Tailwind utilities (`src/styles/tokens.css`).
- Validate layouts on mobile (`< 768px`), tablet, and desktop viewports.
- Support collapsible sidebars and overlay drawers via `SidebarContext`.

---

## Verification Commands
Before concluding frontend work, always run:
```bash
# Typecheck entire codebase without emitting assets
npx tsc --noEmit

# Run ESLint rules
npm run lint
```
