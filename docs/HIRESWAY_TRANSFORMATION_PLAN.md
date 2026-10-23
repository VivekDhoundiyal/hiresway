# HiresWay — Complete Product Transformation Plan & Audit

> **HiresWay — The Smarter Way to Get Hired**  
> Principal Engineering, Personalized Career OS, Job Discovery, Performance, UX and Reliability Baseline  
> Date: October 23, 2026 | Version: 1.0.0

---

## 1. Executive Summary

This transformation plan establishes the comprehensive engineering baseline and implementation roadmap for turning HiresWay into a world-class, reliable, and deeply personalized Career Operating System.

The platform is designed as a **zero-cost, privacy-first, modular monolith**. It runs entirely without mandatory paid APIs, paid AI subscriptions, or proprietary cloud infrastructure, deploying to Cloudflare Workers Static Assets (`wrangler.jsonc`).

---

## 2. Confirmed Defects & Concrete Evidence

| # | Component / File | Issue Description | Code Evidence & Impact | Severity |
|---|---|---|---|---|
| **D1** | `src/core/auth/userContext.ts:41-49` | **Hardcoded Authenticated Session** | `loadSession()` returns `isAuthenticated: true` with hardcoded ID `user-primary-1` and email `user@hiresway.local`. Any visitor is automatically logged in as a single hardcoded user. No registration, login, logout, password hashing, or session expiration exists. | **CRITICAL** |
| **D2** | `src/core/profile/defaultProfile.ts:10-304` | **Hardcoded Personal Information in Default Profile** | Default profile contains personal data of Vivek Dhoundiyal (full name, phone `(+91) 750-301-6766`, email `VivekDhoundiyal2901@gmail.com`, B2B sales history, specific target companies). When a new user arrives, this data is universally loaded. | **CRITICAL** |
| **D3** | `src/core/profile/profileRepository.ts:5-78` | **Single Global Storage Key Without User Scoping** | Profiles are written to `careeros_canonical_profile_v2` in LocalStorage and `id: 'canonical_profile'` in IndexedDB `metadata` store. There is zero `userId` scoping, which prevents multi-user isolation on the same device/browser. | **HIGH** |
| **D4** | `src/core/intelligence/mockJobCatalog.ts:1-241` | **Fictional Mock Jobs Used in Production Workflows** | 5 fabricated job postings (CloudScale Technologies, Nexus AI Intelligence, etc.) are imported and used as fallbacks in `ApplicationsPage.tsx:16`, `InterviewsPage.tsx:23`, `OutreachPage.tsx:21`, and `ResumeStudioPage.tsx:18`, violating Rule 5 (No Synthetic Data). | **HIGH** |
| **D5** | `src/core/jobs/engines/continuousSchedulerEngine.ts` | **Disconnected Continuous Discovery Scheduler** | The scheduler engine exists but is never imported or initialized anywhere in `src/`. Automated periodic scanning never executes in the background. | **HIGH** |
| **D6** | `src/pages/PlaceholderPage.tsx` | **Incomplete Placeholder Routes** | 3 primary navigation routes (`/follow-ups`, `/document-vault`, `/settings`) render a static "Coming Soon" `PlaceholderPage` despite existing backend engines (`applicationEngine`, `outreachEngine`, `documentEngine`) having the underlying data models. | **MEDIUM** |
| **D7** | `src/features/dashboard/DashboardPage.tsx:37-43` | **Hardcoded Dashboard Metrics & Broken Follow-up Navigation** | `outreachSentCount: 0` is hardcoded to 0 despite `outreachEngine.getOutreachSync()` existing. "Schedule Follow-up" button navigates to `/follow-ups` which renders the placeholder page. | **MEDIUM** |
| **D8** | `src/features/target-companies/components/ManualSourceModal.tsx:23-28` | **React Rules of Hooks Violations** | 6 `useState` hooks are called after an early return (`if (!isOpen) return null;`), causing runtime warnings and lint failures. | **MEDIUM** |
| **D9** | Repository-wide Linter | **106 ESLint Errors & 355 Warnings** | `npm run lint` fails with empty blocks, conditional hooks, and unused variables. | **MEDIUM** |

---

## 3. Suspected Risks Requiring Runtime Verification

1. **Cloudflare Deployment Architecture**:
   - `wrangler.jsonc` specifies `assets.directory: "./dist"` with `not_found_handling: "single-page-application"`.
   - The deployment serves static assets only with zero server-side Worker script or database bindings (D1 / KV).
   - *Risk*: A multi-user account system in a zero-cost static deployment must be strictly local-first with cryptographic derivation (PBKDF2/SHA-256 with salts) or provide an optional Cloudflare Worker D1 schema. It must never claim server-side security when running locally.
2. **Browser Storage Quota & Eviction**:
   - LocalStorage is capped at ~5MB across all origins. Large job feeds (1,000+ opportunities) or target companies (500+ records) will throw `QuotaExceededError` if mirrored naively.
   - *Mitigation*: IndexedDB (`CareerOS_DB` v5) is the primary store; LocalStorage is strictly a compact cache (up to 500 records).
3. **Hydration Timing & Asynchronous Race Conditions**:
   - IndexedDB is asynchronous. If a component renders before `hydrate()` finishes, it may read empty state.
   - *Mitigation*: Repositories must use memory caches hydrated synchronously from LocalStorage on frame 1, followed by background async verification from IndexedDB.

---

## 4. Current Architecture & Dependency Map

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                            │
│  src/features/{dashboard, job-feed, target-companies, applications,   │
│               resume-studio, outreach, interviews, growth, profile}   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                          ROUTING & APP SHELL                           │
│  src/router/index.tsx (HashRouter + React.lazy chunks)                 │
│  src/layout/{AppShell, Sidebar, TopBar, MobileNav, ErrorBoundaries}    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                       HEADLESS DOMAIN ENGINES                          │
│  Engine 1: Auth & User Context (src/core/auth/userContext.ts)          │
│  Engine 2: Career Profile & Normalization (src/core/profile/)          │
│  Engine 3: Opportunity Discovery (src/core/jobs/discoveryEngine.ts)    │
│  Engine 4: Job Intelligence & Dedup (src/core/jobs/jobRepository.ts)   │
│  Engine 5: Relevance & Matching (src/core/intelligence/)              │
│  Engine 6: Target Companies (src/core/target-companies/)               │
│  Engine 7: Applications & Pipeline (src/core/applications/)            │
│  Engine 8: Document Studio (src/core/documents/documentEngine.ts)      │
│  Engine 9: Outreach & CRM (src/core/outreach/outreachEngine.ts)        │
│  Engine 10: Interview Preparation (src/core/interviews/)               │
│  Engine 11: Career Copilot (src/core/copilot/careerCopilotEngine.ts)   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                      PERSISTENCE & STORAGE LAYER                       │
│  Primary: IndexedDB ('CareerOS_DB' v5) via persistentStorageEngine.ts │
│  Secondary: Synchronous LocalStorage mirror                            │
│  Fallback: Global in-memory storage for test/SSR                      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Baseline Performance & Quality Metrics

| Metric / Check | Command | Baseline Result | Status |
|---|---|---|:---:|
| **TypeScript Compilation** | `npx tsc --noEmit` | 0 errors | **PASS** |
| **Master Engines Test** | `npx tsx scripts/verify-master-engines.ts` | 27/27 tests passed | **PASS** |
| **Job Feed Verification** | `npx tsx scripts/verify-job-feed.ts` | 9/9 tests passed | **PASS** |
| **Production Build** | `npm run build` | Built in 7.89s (26 assets, 562KB main chunk) | **PASS** |
| **Cloudflare Deployment** | `npx wrangler deploy --dry-run` | 26 files read, valid SPA configuration | **PASS** |
| **ESLint Check** | `npm run lint` | 106 errors, 355 warnings | **FAIL** |

---

## 6. Feature Completion Matrix

| Module | Route | Status | Notes / Deficiencies |
|---|---|:---:|---|
| **Dashboard** | `/dashboard` | **Partial** | Displays summary applications; hardcodes outreach count to 0; follow-ups button points to placeholder. |
| **Profile** | `/profile` | **Working** | Full profile editor with resume import; needs clean empty state for new users and migration for existing data. |
| **Job Feed** | `/job-feed` | **Working** | 4-row compact layout; live scanning status; 3-column virtualization; zero LinkedIn dependencies. |
| **Job Database** | `/job-database` | **Working** | Searchable table of all discovered opportunities with bulk operations. |
| **Target Companies** | `/target-companies` | **Working** | 500+ Excel import; fast ATS detection; domain resolution. |
| **Applications** | `/applications` | **Partial** | Stages work; falls back to `mockJobCatalog` when 0 applications exist. |
| **Resume Studio** | `/resume-studio` | **Partial** | Tailored blueprints generate; falls back to `mockJobCatalog[0]` if no job is selected. |
| **Outreach** | `/outreach` | **Partial** | Outreach drafts work; falls back to `mockJobCatalog` if no jobs in database. |
| **Follow-ups** | `/follow-ups` | **Placeholder** | Renders static `PlaceholderPage` ("Coming Soon"); needs full integration with `applicationEngine` & `outreachEngine`. |
| **Interviews** | `/interviews` | **Partial** | STAR briefs work; falls back to `mockJobCatalog` if no job selected. |
| **Document Vault** | `/document-vault` | **Placeholder** | Renders static `PlaceholderPage`; needs integration with `documentEngine` for master resumes, cover letters, and transcripts. |
| **Growth** | `/growth` | **Working** | Gap analysis benchmarks profile against target roles. |
| **Settings** | `/settings` | **Placeholder** | Renders static `PlaceholderPage`; needs personal preferences, search config, data export, and privacy controls. |
| **Career Copilot** | Drawer / `⌘K` | **Working** | 7 registered tools executing real actions across all engines. |
| **Authentication** | Modal / Overlay | **Missing** | No login / registration / account switching interface. |
| **Onboarding** | `/onboarding` | **Missing** | New users jump directly to Dashboard with pre-filled default data. |

---

## 7. Implementation Sequence

### Phase A — Repository Audit, Baseline & Transformation Plan (Completed)
- Document confirmed defects, evidence, baseline performance, and feature matrix.

### Phase B — Real Account Creation, Security & User Isolation
- Implement `authEngine.ts` with genuine registration, login, logout, account switching, password hashing via Web Crypto API (PBKDF2/SHA-256), and session token validation.
- Remove default authenticated state in `userContext.ts`. Unauthenticated users see Sign In / Sign Up.
- Scope `profileRepository` and all engines by `userId`.
- Provide safe backwards-compatible migration for existing local data.

### Phase C — Personalized Onboarding & Canonical Profile
- Create a multi-step progressive onboarding wizard (`/onboarding`):
  1. Welcome & Account verification
  2. Resume upload or manual input
  3. Structured extraction & review
  4. Target roles, seniority, and skills
  5. Locations, remote preferences, and work authorization
  6. Salary expectations and currency
  7. Exclusions & working style
  8. Personalized search configuration generation
- Replace hardcoded `defaultProfile` with `createEmptyProfile()` for new accounts while migrating existing data.
- Bind canonical profile updates to automatic search configuration regeneration and match cache invalidation.

### Phase D — Job Discovery Coverage & Source Reliability
- Audit and enhance `jobConnectors.ts` across public ATS feeds (Greenhouse, Lever, Ashby, Workable) and permitted remote feeds.
- Wire up `continuousSchedulerEngine` to execute adaptive background checks.
- Maintain transparent match explanations without artificial inflation.

### Phase E — Salary Truth, Job Lifecycle & Persistence Correctness
- Enforce `salaryTruthEngine` across all card and detail displays.
- Eliminate `mockJobCatalog` from `ApplicationsPage`, `InterviewsPage`, `OutreachPage`, and `ResumeStudioPage`; replace with genuine empty states.
- Verify 14-day freshness window and ensure user-acted jobs survive indefinitely.

### Phase F — Performance Engineering & Large-Inventory Scalability
- Profile and optimize render cycles for 1,000+ jobs.
- Validate virtualizer performance and memoize derived calculations.
- Clean up ESLint violations (conditional hooks in `ManualSourceModal`, unused variables, empty blocks).

### Phase G — Unified Design System & UX Polish
- Standardize typography, card borders, badge tokens, and empty states.
- Ensure consistent spacing and mobile responsiveness across all pages.

### Phase H — Complete Placeholder Modules & End-to-End Integration
- Implement `/follow-ups` using scheduled dates from `applicationEngine` and `outreachEngine`.
- Implement `/document-vault` using `documentEngine`.
- Implement `/settings` for personalization, search preferences, data export/import, and account deletion.
- Verify connected workflows: Profile $\to$ Discovery $\to$ Feed $\to$ Application $\to$ Resume $\to$ Outreach $\to$ Interview $\to$ Follow-up.

### Phase I — Production Testing & Cloudflare Deployment Verification
- Execute full test suite: `verify-master-engines.ts`, `verify-job-feed.ts`, `tsc --noEmit`, `npm run lint`, `npm run build`, and `npx wrangler deploy --dry-run`.
- Commit and push to `origin/main`.
- Verify Cloudflare live deployment.

---

## 8. Data Migration & Compatibility Safeguards

1. **Existing User Data Migration**:
   - Existing records without `userId` or assigned to `user-primary-1` are automatically assigned to the first registered account upon migration.
   - Profile data stored in `careeros_canonical_profile_v2` is safely preserved and migrated to `{userId}_profile`.
2. **Zero Destructive Resets**:
   - `CareerOS_DB` version remains at 5 or increments cleanly with migration functions in `onupgradeneeded`.
   - Never clear IndexedDB stores or delete user-saved opportunities.
