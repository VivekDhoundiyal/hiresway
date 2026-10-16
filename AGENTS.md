# HiresWay — Permanent Engineering Rules & Project Guidelines

> **HiresWay — The Smarter Way to Get Hired**  
> Technical Lead & Principal Engineering Instructions

---

## 1. System Architecture & Foundation

HiresWay is a production-grade, local-first Career Operating System designed as a modular monolith:

- **Frontend Core**: React 18.3.1, TypeScript 5.7.3, Vite 5.4.21, TailwindCSS 3.4.17, Lucide React icons.
- **Routing**: `react-router-dom` using `HashRouter` with lazy route chunking (`src/router/index.tsx`) to guarantee instant sub-millisecond initial paint and seamless client-side navigation.
- **Persistence Layer (`src/core/storage/persistentStorageEngine.ts`)**:
  - Primary: Native IndexedDB (`CareerOS_DB`, version 5) for high-capacity stores (`target_companies`, `job_opportunities`, `job_feed_items`, `sources`, `metadata`, `applications`, `documents`, `outreach`, `interview_sessions`, `notifications`).
  - Secondary: Synchronous LocalStorage mirror for immediate hydration.
  - Fallback: Global in-memory storage for test/Node environments.
  - Reliability: Strict Write-Commit-Verify cycle before reporting success.
- **Modular Monolith Layout**:
  - `src/core/`: Headless business logic, data models, persistence, and pipeline engines (`jobs`, `profile`, `target-companies`, `applications`, `copilot`, `intelligence`, `storage`, `outreach`, `interviews`, `diagnostics`, `perf`).
  - `src/features/`: Presentation layer, interactive cards, filters, drawers, and modal workflows.
  - `src/layout/`: `AppShell`, `Sidebar`, `TopBar`, `MobileNav`, `RouteErrorBoundary`.
- **Deployment (`wrangler.jsonc`)**: Cloudflare Workers Static Assets with SPA fallback (`assets.directory: "./dist"`, `not_found_handling: "single-page-application"`).

---

## 2. Non-Negotiable Project Rules

1. **Existing Product Integrity**: HiresWay is an existing, running application—never treat it as a greenfield prototype or rebuild working components from scratch.
2. **Zero Unapproved Cost**: Keep the platform 100% free or open-source. Never add paid APIs, external paid services, or proprietary cloud dependencies without explicit user authorization.
3. **Local-First & Deterministic Fallbacks**: Primary data storage must remain local-first. When external or optional AI providers are unavailable, fall back deterministically without blocking user flows.
4. **Unified Engine Integration**: The core platform modules—Profile, Job Feed, Job Database, Target Companies, Applications, Resume Studio, Outreach, and Career Copilot—must remain strictly integrated through shared persistent stores and observable interfaces. Never create isolated, mock-only duplicate modules.
5. **No Synthetic or Fabricated Data**: Never invent fake job listings, simulated company profiles, fake match percentages, or false success notifications. Distinguish verified real data, cached data, and unavailable data explicitly.
6. **Zero Silent Failures**: Never suppress TypeScript, runtime, or network errors merely to make a build or test pass. Catch, log, and recover with user-visible feedback.
7. **Security & Privacy**: Never log or bundle credentials, API keys, or private user data into client builds. Treat all external feeds, imported spreadsheets, and user files as untrusted input.
8. **Minimal Reversible Changes**: Keep changes tightly scoped to the specific user request. Avoid speculative rewrites, stylistic churn, or mass refactorings.
9. **Never Claim Unverified Success**: Do not state that a build, deployment, or feature works without running the relevant verification checks.

---

## 3. Required 7-Step Protocol for All Tasks

For every non-trivial engineering task, follow this exact sequence:

1. **Inspect Before Acting**: Read the affected source files, types, and stores. Trace callers and dependencies.
2. **State Root Cause & Intent**: Formulate the explicit outcome and pinpoint why an issue occurs or what is missing.
3. **Map Dependencies**: List the exact modules, interfaces, and state stores affected.
4. **Propose Smallest Safe Diff**: Plan the minimal changes needed to satisfy the requirement safely.
5. **Implement Agreed Scope**: Execute cleanly within existing patterns, types, and architectural boundaries.
6. **Verify with Real Checks**: Run typechecks (`tsc`), linting, build (`npm run build`), or targeted test scripts.
7. **Report Transparently**: Detail files modified, checks executed, exact results, limitations, and deployment steps.

---

## 4. Reusable Engineering Skills Registry

The repository maintains 8 dedicated skills located in `.agents/skills/`:

| Skill | Directory | Responsibility |
|---|---|---|
| **Skill A** | [`.agents/skills/hiresway-architecture-safe-engineering`](./.agents/skills/hiresway-architecture-safe-engineering/SKILL.md) | Modular monolith preservation, dependency tracing, minimal reversible diffs |
| **Skill B** | [`.agents/skills/hiresway-frontend-quality`](./.agents/skills/hiresway-frontend-quality/SKILL.md) | Strict TypeScript, React 18 hooks, loading/empty/error states, responsive UI |
| **Skill C** | [`.agents/skills/hiresway-data-persistence-integrity`](./.agents/skills/hiresway-data-persistence-integrity/SKILL.md) | IndexedDB `CareerOS_DB`, Write-Commit-Verify, data provenance, real vs mock |
| **Skill D** | [`.agents/skills/hiresway-job-discovery-matching`](./.agents/skills/hiresway-job-discovery-matching/SKILL.md) | Job connectors, company career crawlers, deduplication, real match scores |
| **Skill E** | [`.agents/skills/hiresway-security-privacy-auth`](./.agents/skills/hiresway-security-privacy-auth/SKILL.md) | Secret hygiene, untrusted file parsing (PDF/XLSX), XSS prevention |
| **Skill F** | [`.agents/skills/hiresway-testing-verification`](./.agents/skills/hiresway-testing-verification/SKILL.md) | Reproduction, unit/regression testing, dry-runs, build verification |
| **Skill G** | [`.agents/skills/hiresway-ux-perf-accessibility`](./.agents/skills/hiresway-ux-perf-accessibility/SKILL.md) | HiresWay design system, keyboard/ARIA a11y, virtualized lists, bundle budget |
| **Skill H** | [`.agents/skills/hiresway-deployment-safety`](./.agents/skills/hiresway-deployment-safety/SKILL.md) | Cloudflare Workers Static Assets, `wrangler.jsonc`, Git push safety, live verification |
