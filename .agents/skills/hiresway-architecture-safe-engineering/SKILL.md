---
name: hiresway-architecture-safe-engineering
description: >-
  Use this skill whenever planning, architecting, modifying, or refactoring HiresWay features, engines, or shared modules. Enforces modular-monolith boundaries, dependency tracing, reuse of existing models, and small reversible changes.
---

# Skill A — Architecture & Safe Engineering

## Purpose
Preserve HiresWay's modular monolith architecture, avoid code duplication, and ensure all changes are minimally invasive, predictable, and fully integrated with existing subsystems.

---

## Architecture Map

```text
src/
├── core/                  # Headless Domain Engines & Persistent Models
│   ├── storage/          # Unified IndexedDB ('CareerOS_DB' v5) & LocalStorage mirror
│   ├── profile/          # Candidate profile, skills, preferences, normalizer
│   ├── target-companies/ # Company catalog, career page discovery, enrichment
│   ├── jobs/             # Job connectors, ingestion pipeline, feed store, ranking
│   ├── applications/     # Application tracking, status state machine
│   ├── copilot/          # Career Copilot orchestrator & strategic advice engine
│   ├── documents/        # Resume vault, tailoring, version management
│   ├── outreach/         # Cold outreach templates, recruiter contact engine
│   └── interviews/       # Interview prep, question bank, session tracker
├── features/             # React presentation views (pages, modals, drawers, cards)
├── layout/               # AppShell, Sidebar, TopBar, MobileNav, ErrorBoundaries
├── router/               # HashRouter client routing and lazy route chunks
└── styles/ tokens/       # Design tokens (colors, typography, spacing, shadows)
```

---

## Engineering Guidelines

### 1. Inspect Before Editing
- Identify existing functions, services, and types in `src/core/` before creating new ones.
- Trace upstream data producers and downstream UI consumers across `src/features/`.
- Never create a parallel service when an existing one (e.g., `jobRepository.ts`, `targetCompanyStore.ts`, `profileRepository.ts`) can be extended.

### 2. Preserve Established Interfaces
- Keep method signatures and return types stable to prevent cascading breaking changes.
- If an interface must evolve, ensure backwards-compatible optional properties or explicit migration paths.

### 3. Small, Reversible Scopes
- Limit pull requests or commits to a single cohesive objective.
- Avoid incidental formatting or broad aesthetic changes in unrelated files.

### 4. Zero Disconnected Modules
- Every feature UI in `src/features/` must connect to a domain engine in `src/core/`.
- Never leave isolated UI components that only store state in temporary local `useState` if the data belongs in the global profile, target companies, or application store.

---

## Pre-Change Checklist
- [ ] Have I traced all imports and call sites of the modified symbol?
- [ ] Is there an existing service in `src/core/` that already implements part of this logic?
- [ ] Does this change respect the local-first persistence lifecycle?
- [ ] Can this change be easily reverted if an issue arises?
