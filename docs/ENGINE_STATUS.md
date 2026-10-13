# HiresWay — Core Engine Status Matrix

| Engine | Name | Status | Evidence / Implementation Files | Verification Evidence |
| :--- | :--- | :---: | :--- | :--- |
| **Engine 1** | Identity, Access & User Context | **Working** | [`src/core/auth/userContext.ts`](file:///C:/Users/vivek/Desktop/CareerOs/src/core/auth/userContext.ts) | Verified in `scripts/verify-master-engines.ts` (Test 1). Scoped session & user isolation. |
| **Engine 2** | Career Profile & Intelligence | **Working** | [`src/core/profile/`](file:///C:/Users/vivek/Desktop/CareerOs/src/core/profile/), `resumeExtractor.ts` | Verified in `scripts/verify-master-engines.ts` (Test 2). PDF/DOCX parsing and canonical profile normalization. |
| **Engine 3** | Opportunity Acquisition & Job Discovery | **Working** | [`src/core/jobs/discoveryEngine.ts`](file:///C:/Users/vivek/Desktop/CareerOs/src/core/jobs/discoveryEngine.ts) | Verified in `scripts/verify-job-feed.ts` (Tests 1, 8, 9). Real multi-source continuous scanning, zero paid APIs. |
| **Engine 4** | Job Intelligence, Verification & Normalization | **Working** | [`src/core/jobs/jobRepository.ts`](file:///C:/Users/vivek/Desktop/CareerOs/src/core/jobs/jobRepository.ts) | Verified in `scripts/verify-master-engines.ts` (Tests 4, 5, 7). Canonical deduplication, salary normalization, URL probes. |
| **Engine 5** | Relevance, Matching & Ranking | **Working** | [`src/core/intelligence/careerIntelligenceEngine.ts`](file:///C:/Users/vivek/Desktop/CareerOs/src/core/intelligence/careerIntelligenceEngine.ts) | Verified in `scripts/verify-master-engines.ts` (Test 6). 4-factor weighted scoring, pre-feed gate (<40%), explainable fit. |
| **Engine 6** | Company Intelligence & Target Companies | **Working** | [`src/core/target-companies/targetCompanyStore.ts`](file:///C:/Users/vivek/Desktop/CareerOs/src/core/target-companies/targetCompanyStore.ts), `fastCareerPageEngine.ts` | Verified in `scripts/verify-master-engines.ts` (Test 3). 500+ bulk Excel import, ATS detection, authoritative catalogs. |
| **Engine 7** | Applications & Pipeline | **Working** | [`src/core/applications/applicationEngine.ts`](file:///C:/Users/vivek/Desktop/CareerOs/src/core/applications/applicationEngine.ts), `ApplicationsPage.tsx` | Verified in `scripts/verify-master-engines.ts` (Test 8). Bidirectional sync with `jobRepository`, live dashboard metrics. |
| **Engine 8** | Resume Studio & Documents | **Working** | [`src/core/documents/documentEngine.ts`](file:///C:/Users/vivek/Desktop/CareerOs/src/core/documents/documentEngine.ts), `ResumeStudioPage.tsx` | Verified in `scripts/verify-master-engines.ts` (Test 9). ATS tailored resumes and variant persistence. |
| **Engine 9** | Outreach & Relationship Management | **Working** | [`src/core/outreach/outreachEngine.ts`](file:///C:/Users/vivek/Desktop/CareerOs/src/core/outreach/outreachEngine.ts), `OutreachPage.tsx` | Verified in `scripts/verify-master-engines.ts` (Test 10). Context-aware outreach drafts & persistent contact log. |
| **Engine 10** | Interview Preparation & Growth | **Working** | [`src/core/interviews/interviewPrepEngine.ts`](file:///C:/Users/vivek/Desktop/CareerOs/src/core/interviews/interviewPrepEngine.ts), `InterviewsPage.tsx` | Verified in `scripts/verify-master-engines.ts` (Test 11). STAR narrative briefs and role notes persistence. |
| **Engine 11** | Career Copilot & Orchestration | **Working** | [`src/core/copilot/careerCopilotEngine.ts`](file:///C:/Users/vivek/Desktop/CareerOs/src/core/copilot/careerCopilotEngine.ts), `CopilotDrawer.tsx` | Verified in `scripts/verify-master-engines.ts` (Test 12). 7 registered tools and conversational assistant drawer. |

---

## Workflow Status

- **Workflow A (Profile $\to$ Job Feed)**: **Working** (Verified in `scripts/verify-job-feed.ts` & `scripts/verify-master-engines.ts`).
- **Workflow B (Target Company $\to$ Opportunity)**: **Working** (Verified in `scripts/verify-job-feed.ts` & `scripts/verify-master-engines.ts`).
- **Workflow C (Job $\to$ Application)**: **Working** (Verified in `scripts/verify-master-engines.ts` Test 8; bidirectional sync confirmed).
- **Workflow D (Job $\to$ Resume & Outreach)**: **Working** (Verified in `scripts/verify-master-engines.ts` Tests 9 & 10; variants & logs saved).
- **Workflow E (Application $\to$ Interview Prep)**: **Working** (Verified in `scripts/verify-master-engines.ts` Test 11; STAR notes saved).
- **Workflow F (Career Copilot Orchestration)**: **Working** (Verified in `scripts/verify-master-engines.ts` Test 12; tools & drawer integrated).

