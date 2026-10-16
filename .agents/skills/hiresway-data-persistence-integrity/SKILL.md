---
name: hiresway-data-persistence-integrity
description: >-
  Use this skill whenever working on data flow, IndexedDB/LocalStorage persistence, state synchronization, or external integrations in HiresWay. Guarantees end-to-end data integrity, Write-Commit-Verify cycles, real data provenance, and deterministic fallbacks.
---

# Skill C — Data, Persistence & Integration Integrity

## Purpose
Ensure that all data handled by HiresWay is accurately validated, durably committed to local storage, and faithfully presented in the UI without data loss, phantom records, or simulated success states.

---

## The HiresWay Persistence Lifecycle

HiresWay uses `persistentStorageEngine.ts` to manage all application entities across IndexedDB (`CareerOS_DB` v5) with a synchronous LocalStorage mirror:

```text
[User Action / API Response]
           ↓
[Input Validation & Normalization]
           ↓
[Domain Engine / Repository in src/core/]
           ↓
[Write-Commit-Verify Cycle in persistentStorageEngine]
   ├── 1. IDB Transaction Open & Put
   ├── 2. Commit Transaction
   └── 3. Verification Read-back
           ↓
[State Notification / React Context Update]
           ↓
[UI Render with Updated State]
```

---

## Core Rules & Invariants

### 1. Zero Synthetic or Fabricated Data
- **Never** inject fake jobs, fake company profiles, or fake analytics to give the illusion of activity.
- Clearly label data status:
  - **Verified Live**: Fetched directly from verified external source/API.
  - **Cached / Stored**: Loaded from persistent local IndexedDB cache with timestamp.
  - **Unavailable / Failed**: Explicitly reported with reason and retry action.

### 2. Write-Commit-Verify
- UI must not confirm an action (e.g., "Company added", "Application saved") until the underlying store confirms that the entity was written and successfully read back from IndexedDB.
- In case of write failure or quota exceeded, display an explicit error alert, do not fail silently.

### 3. Graceful AI & Service Degradation
- If an optional AI service (e.g. Gemini, external LLM) is unconfigured or rate-limited:
  - Do NOT fail the core operation.
  - Switch to deterministic rule-based algorithms (e.g., keyword scoring, regex-based skill extraction, heuristic resume analysis).
  - Explicitly indicate to the user that deterministic analysis was performed.

### 4. Deduplication & Idempotency
- Use canonical entity keys (e.g. canonical job URLs, normalized company domains) to prevent duplicate entries upon re-imports or multiple feed refreshes.
- Support safe upserts (`updateIfNewer`) rather than blind overwrites.
