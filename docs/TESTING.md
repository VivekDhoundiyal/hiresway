# HiresWay — Testing & Quality Assurance Guide

## Test Architecture

Testing validates all 11 core engines and 6 end-to-end workflows without dependencies on paid external APIs or mock data pollution.

### Running Test Suites
Execute the master automated verification scripts using `npx tsx`:

```bash
# Run core Job Feed, 14-day freshness, and discovery verification
npx tsx scripts/verify-job-feed.ts

# Run the Master Engine Architecture verification suite (all 11 engines & 6 workflows)
npx tsx scripts/verify-master-engines.ts

# Validate TypeScript compilation across the entire project
npx tsc --noEmit

# Validate production build bundle
npm run build
```

---

## Test Coverage by Engine

| Engine | Unit & Integration Test Checks |
| :--- | :--- |
| **Engine 1 (Auth & User Context)** | Session persistence, user ID isolation, unauthorized access blocking |
| **Engine 2 (Career Profile)** | Resume text extraction, profile JSON export/import, completeness calculations |
| **Engine 3 (Discovery)** | ATS discovery queries, duplicate prevention, cancellation handling |
| **Engine 4 (Job Intelligence)** | Multi-source deduplication, 14-day freshness expiry, user action preservation |
| **Engine 5 (Matching & Ranking)** | 40/30/20/10 weighted score evaluation, $<40\%$ gating, match score cache |
| **Engine 6 (Target Companies)** | 500+ Excel row parsing, fast ATS detection, confidence scoring |
| **Engine 7 (Applications)** | Stage progression, notes persistence, bidirectional sync with repository |
| **Engine 8 (Resume Studio)** | Tailored blueprint generation, version history, markdown export |
| **Engine 9 (Outreach)** | Personalized message templates, channel logging, follow-up dates |
| **Engine 10 (Interview Prep)** | Role question mapping, note persistence per job |
| **Engine 11 (Career Copilot)** | Tool registry validation, intent resolution, execution safety |
