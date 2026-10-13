# HiresWay — Canonical Data Model & Entities

## 1. Entities & Identifiers

### User & Session (`UserProfile`)
- **Key**: `id` (e.g. `user-primary-1`)
- **Storage**: `careeros_canonical_profile_v2`
- **Fields**:
  - `personalInfo`: fullName, email, headline, city, country, phone, linkedinUrl
  - `rolePreferences`: targetPrimaryTitle, targetJobTitles, currentTitle, targetSeniority, salaryExpectationMin
  - `workPreferences`: targetLocations, workplaceTypes, openToRelocate
  - `skills`: hardSkills, softSkills, domainExperience
  - `workExperience`: title, company, startDate, endDate, isCurrent, achievements
  - `education`, `certifications`, `languages`

### Canonical Opportunity (`JobOpportunity`)
- **Key**: `id` (stable hash / UUID)
- **Composite Dedup Keys**:
  - `makeCompanyTitleKey`: `normCompany::normTitle`
  - `makeCompanyTitleLocKey`: `normCompany::normTitle::normLoc`
- **Storage**: `careeros_job_opportunities_v8`
- **Fields**:
  - `title`, `company`, `companyDomain`, `location`, `remoteStatus`, `salary`
  - `jobUrl`, `applyUrl`, `verificationStatus`, `match_score`, `isTargetCompany`
  - `lifecycleState`: `DISCOVERED` | `IN_FEED` | `SAVED` | `APPLIED` | `INTERVIEW` | `OFFER` | `REJECTED` | `EXPIRED`
  - `feed_status`: `ACTIVE` | `EXPIRED` | `DISMISSED`
  - `dateDiscovered`, `postedDate`, `expiresAt`

### Canonical Target Company (`TargetCompany`)
- **Key**: `id` (e.g. `tc-stripe`)
- **Storage**: `careeros_canonical_target_companies_v6`
- **Fields**:
  - `name`, `domain`, `careersUrl`, `atsType`, `verificationStatus`, `confidence`
  - `tag`: `Dream` | `Priority` | `Target` | `Watchlist`
  - `logoUrl`, `notes`, `dateAdded`, `lastChecked`

### Application Record (`ApplicationRecord`)
- **Key**: `id` (e.g. `app-1718000000`)
- **Storage**: `careeros_applications_v2`
- **Relationships**:
  - `userId` $\to$ `UserProfile.id`
  - `jobId` $\to$ `JobOpportunity.id`
- **Fields**:
  - `stage`: `saved` | `applied` | `screening` | `interviewing` | `offer` | `rejected`
  - `appliedDate`, `lastUpdated`, `nextStep`, `notes`, `contacts`, `followUpDate`

### Document Variant (`DocumentVariant`)
- **Key**: `id` (e.g. `doc-tailored-stripe-lead-eng`)
- **Storage**: `careeros_documents_v1`
- **Relationships**:
  - `jobId` $\to$ `JobOpportunity.id`
  - `applicationId` $\to$ `ApplicationRecord.id`
- **Fields**:
  - `title`, `documentType`: `tailored_resume` | `master_resume` | `cover_letter`
  - `content`, `format`: `markdown` | `json`, `createdAt`, `updatedAt`

### Outreach Contact & Log (`OutreachLogRecord`)
- **Key**: `id` (e.g. `outreach-1`)
- **Storage**: `careeros_outreach_v1`
- **Relationships**:
  - `jobId` $\to$ `JobOpportunity.id`
  - `company` $\to$ `TargetCompany.name`
- **Fields**:
  - `recipientName`, `recipientRole`, `channel`: `LinkedIn InMail` | `Email` | `Referral`
  - `messageText`, `status`: `drafted` | `sent` | `replied` | `declined`
  - `sentDate`, `followUpDue`

### Interview Brief & Practice (`InterviewSessionRecord`)
- **Key**: `id` (e.g. `interview-prep-stripe-1`)
- **Storage**: `careeros_interview_prep_v1`
- **Relationships**:
  - `jobId` $\to$ `JobOpportunity.id`
  - `applicationId` $\to$ `ApplicationRecord.id`
- **Fields**:
  - `roleTitle`, `company`, `briefData`: `InterviewBrief`
  - `userNotes`, `practiceAnswers`, `completedAt`

---

## 2. Ownership & User Isolation Rules
- Every record created in client storage or persistent engine holds `userId`.
- Operations verify `record.userId === currentUser.id` before returning or mutating entities.
- Backward compatibility: If older records have no `userId`, they migrate gracefully to `user-primary-1`.
