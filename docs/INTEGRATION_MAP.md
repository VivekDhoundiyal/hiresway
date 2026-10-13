# HiresWay — Engine Integration Map & Workflows

## End-to-End Workflow Architecture

### Workflow A: Profile to Job Feed
1. **User imports/edits resume** $\to$ `resumeExtractor` parses sections into structured data $\to$ `profileRepository.saveProfile`.
2. **Profile change event** $\to$ `matchScoreCache.invalidate()` $\to$ recalculates relevance.
3. **Search Configuration** derives `searchConfig` from target titles, seniority, location, and workplace.
4. **Opportunity Acquisition** queries configured ATS platforms and feeds.
5. **Job Intelligence & Normalization** deduplicates against existing records and verifies apply URLs.
6. **Relevance Engine** computes multi-factor score (40/30/20/10 weighting). Jobs with score $<40\%$ are dropped.
7. **Job Feed** displays ranked opportunities with match badges, freshness, and quick action controls.

### Workflow B: Target Company to Opportunity
1. **Excel/CSV Import** $\to$ `targetCompanyStore.importFromExcel()` parses company names from header row or first column.
2. **Company Resolution** checks verified enterprise catalog (`companyIdentityService`) or probes ATS (`fastCareerPageEngine`).
3. **ATS Monitoring** registers discovery source into `sourceRegistry`.
4. **Opportunity Discovery** extracts live vacancies.
5. **Job Intelligence** links opportunities to `targetCompany` with `isTargetCompany: true`.
6. **Feed & Target Companies views** show synchronized listings.

### Workflow C: Job to Application
1. **User saves job** $\to$ `jobRepository.saveOpportunity()` $\to$ `applicationEngine.recordSaved(job)`.
2. **User clicks apply or marks applied** $\to$ `jobRepository.markApplied(jobId)` $\to$ `applicationEngine.recordApplied(job)`.
3. **Application Stage update** (e.g. from `applied` to `interviewing`) $\to$ `applicationEngine.updateStage(appId, stage)` $\to$ updates `jobRepository.setLifecycleState()`.
4. **Dashboard metrics** (`CareerProgressOverview` & `ApplicationsSection`) query `applicationEngine.getPipelineMetrics()` and display live statistics.

### Workflow D: Job to Resume & Outreach
1. **User selects job** in Job Feed or Applications $\to$ navigates to `/resume-studio?jobId={job.id}`.
2. **Resume Studio** retrieves canonical job and current profile $\to$ `generateTailoredResume(profile, job)`.
3. **Document Studio** saves tailored resume version in `documentEngine` associated with `jobId`.
4. **Outreach Page** retrieves the same job and company context $\to$ `generateOutreachDraft(profile, job, recruiterName)`.
5. **Outreach Engine** logs sent messages, channel, and follow-up reminders.

### Workflow E: Application to Interview Preparation
1. **User selects job from pipeline** $\to$ navigates to `/interviews?jobId={job.id}`.
2. **Interview Engine** retrieves role requirements and profile milestones $\to$ `generateInterviewBrief(profile, job)`.
3. **User records notes & practice answers** $\to$ `interviewPrepEngine.saveSession(jobId, notes)`.
4. **Session persists** independently from profile and reloads upon return.

### Workflow F: Career Copilot Orchestration
1. **User issues natural-language command** in Copilot interface or Command Palette (`⌘K`).
2. **Copilot Engine** parses intent and arguments against registered tool schemas.
3. **Controlled Tool Execution**:
   - `search_jobs` $\to$ `jobRepository.query(filters)`
   - `get_job_match` $\to$ `analyzeJobMatch(profile, job)`
   - `tailor_resume` $\to$ `documentEngine.generate(jobId)`
   - `draft_outreach` $\to$ `outreachEngine.createDraft(jobId)`
   - `prepare_interview` $\to$ `interviewPrepEngine.getBrief(jobId)`
   - `get_pipeline_summary` $\to$ `applicationEngine.getSummary()`
   - `get_target_companies` $\to$ `targetCompanyStore.getCompanies()`
4. **Copilot returns structured response** with deep-links and action confirmations.
