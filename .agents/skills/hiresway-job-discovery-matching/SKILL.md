---
name: hiresway-job-discovery-matching
description: >-
  Use this skill whenever working on job discovery connectors, feed ingestion, company career scrapers, candidate-job matching algorithms, or ranking logic in HiresWay. Enforces honest match scoring, deduplication, source freshness, and rate-limit compliance.
---

# Skill D — Job Discovery & Matching

## Purpose
Ensure all job opportunities discovered, ingested, and presented in HiresWay are genuine, fresh, properly attributed to their source, and scored against candidate profiles with mathematically sound, explainable algorithms.

---

## Job Pipeline Architecture

```text
[Source Adapters / Excel Imports / Career Pages]
                      ↓
           [jobConnectors.ts]
                      ↓
         [jobDescriptionNormalizer.ts]
  (Clean text, extract requirements, title, location, salary)
                      ↓
           [discoveryEngine.ts]
  (Canonical URL normalization, SHA256 ID, deduplication)
                      ↓
          [behavioralLearning.ts / Matching]
  (Cosine similarity, skill overlap, seniority & domain alignment)
                      ↓
             [jobFeedStore.ts]
  (Durable persistence in IDB 'job_feed_items')
```

---

## Operational Guidelines

### 1. Source Attribution & Direct Apply Links
- Every job listing must retain its original source name (e.g. "Greenhouse", "Lever", "Company Careers", "User Import").
- The primary apply button must navigate to the verified canonical application URL, not an intermediary redirect or dead link.

### 2. Honest Match Scoring
- **No Hardcoded or Inflated Scores**: Match scores must reflect actual overlap between the candidate's active profile (`ProfileContext`) and the job description:
  - Required Skills match weight (e.g., 40%)
  - Experience level & title similarity weight (e.g., 30%)
  - Location / Remote preference weight (e.g., 20%)
  - Preferred industry / role alignment weight (e.g., 10%)
- When the user clicks "Why This Matches", display the concrete criteria that contributed to the score (e.g., "Matched skills: TypeScript, React, Vite; Missing: GraphQL").

### 3. Expiry & Stale Job Pruning
- Jobs older than standard active windows (e.g. 30–45 days) must be flagged as potentially expired or moved to an archived status.
- Allow users to manually flag closed positions to remove them from active feeds.

### 4. Rate Limiting & Courtesy
- Honor source rate limits, backoffs, and CORS constraints.
- When querying external endpoints from the client, use exponential backoff on HTTP 429/503 responses.
