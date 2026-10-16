---
name: hiresway-ux-perf-accessibility
description: >-
  Use this skill whenever refining UI components, optimizing frontend performance, conducting accessibility audits, or inspecting page load metrics in HiresWay. Enforces design system consistency, keyboard navigation, virtualized rendering, and bundle-size controls.
---

# Skill G — UX, Accessibility & Performance

## Purpose
Ensure HiresWay provides an information-dense, distraction-free, lightning-fast SaaS experience that respects accessibility guidelines and preserves brand visual identity.

---

## Performance Rules

### 1. Zero Jank & Virtualized Feeds
- Long lists (e.g. Job Feed with hundreds of postings, Target Company directories) must use windowing/virtualization (`useVirtualizer` in `src/features/job-feed/`) to keep DOM nodes minimal and scroll frames at 60fps.
- Heavy computational tasks (text parsing, keyword extraction) must not block the main UI thread during user typing or scrolling.

### 2. Route Chunking & Lazy Loading
- All top-level routes in `src/router/index.tsx` must remain lazy-loaded with `React.lazy()` to maintain small initial bundle sizes.
- Shared heavy dependencies (such as `xlsx` or `pdfjs-dist`) must only load on-demand when the user opens an import or document feature.

### 3. Direct Navigation & Refresh Safety
- Ensure all views can be directly bookmarked and refreshed (handled via `HashRouter` and Cloudflare SPA fallback).
- Modal drawers and filters should synchronize their state with URL query parameters where useful (e.g., `?diagnostics=open`).

---

## Accessibility (a11y) Standards

1. **Keyboard Navigability**:
   - All interactive controls, cards, tabs, and drawer close buttons must be focusable via `Tab` and actionable with `Enter` or `Space`.
   - Modals and drawers must trap focus while open and restore focus to the triggering element upon closing with `Esc`.
2. **Semantic Elements & ARIA**:
   - Use semantic HTML tags (`<nav>`, `<main>`, `<article>`, `<button>`).
   - Icon-only buttons (Lucide icons) must always have an `aria-label` or visually hidden text for screen readers.
3. **Contrast & Hierarchy**:
   - Adhere to WCAG AA contrast ratios using the tokenized palette in `src/tokens/colors.ts`.
   - Avoid low-contrast text on colored badges or dark backgrounds.
