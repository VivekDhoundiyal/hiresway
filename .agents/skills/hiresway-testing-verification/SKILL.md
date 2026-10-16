---
name: hiresway-testing-verification
description: >-
  Use this skill whenever diagnosing bugs, writing automated regression tests, executing verification suites, or validating build integrity in HiresWay. Enforces defect reproduction, edge-case testing, and honest reporting of test outcomes.
---

# Skill F — Testing, Debugging & Verification

## Purpose
Guarantee that bugs are reliably reproduced, fixes are provably correct, and all features pass rigorous automated and manual checks before code is considered complete.

---

## The Verification Protocol

```text
[Observe Issue / Requirement]
           ↓
[Step 1: Reproduce Failure with Minimal Repro Script or Test]
           ↓
[Step 2: Trace Failing Mechanism & Locate Bug]
           ↓
[Step 3: Implement Targeted Fix]
           ↓
[Step 4: Re-run Repro Test (Verify Failure Path Resolved)]
           ↓
[Step 5: Run Suite of Positive & Negative Regression Checks]
           ↓
[Step 6: Execute Full Build & Typecheck ('tsc --noEmit && vite build')]
```

---

## Tooling & Scripts

The repository includes several specialized verification harnesses:

| Command / Script | Purpose |
|---|---|
| `npx tsc --noEmit` | Full TypeScript type check across all files |
| `npm run lint` | ESLint verification of React hooks, unused variables, and code style |
| `npm run build` | Full production bundling check via Vite |
| `npx tsx scripts/verify-master-engines.ts` | End-to-end headless test of all 9 master domain engines |
| `npx tsx scripts/verify-job-feed.ts` | Verification of job feed indexing, filtering, and scoring |
| `npx tsx test_job_pipeline_overhaul.ts` | Deep unit test of candidate matching, pipeline, and deduplication |

---

## Reporting Rules
1. **Never Assume Compilation Equals Correctness**: Just because `tsc` passes does not mean runtime data flows, storage commits, or UI states operate correctly.
2. **Distinguish What Ran vs. What Could Not Run**: In task summaries, explicitly declare which tests were executed and passed, and clearly state if any environment limitations prevented running browser-based visual tests.
3. **Test Both Paths**: Always test the happy path (valid input, successful save) and the unhappy path (corrupted payload, network offline, storage quota exceeded).
