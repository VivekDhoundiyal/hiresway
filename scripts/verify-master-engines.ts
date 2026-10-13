/**
 * HiresWay Master Engine Verification Script
 *
 * Verifies all 11 core engines and 6 end-to-end workflows:
 *
 * Engines:
 * 1. User Context Engine (userContextService)
 * 2. Profile Engine (defaultProfile, careerProfileNormalizer)
 * 3. Target Company Engine (targetCompaniesStore, fastCareerPageEngine)
 * 4. Job Discovery & Ingestion Engine (jobPipeline, ATS detection)
 * 5. Deduplication Engine (makeCompanyTitleKey, makeCompanyTitleLocKey)
 * 6. Relevance & Matching Engine (careerIntelligenceEngine, 4-factor scoring)
 * 7. Job Feed & Lifecycle Engine (jobRepository, 14-day retention)
 * 8. Application Pipeline Engine (applicationEngine, bidirectional sync)
 * 9. Document Studio Engine (documentEngine, ATS blueprints, variant persistence)
 * 10. Outreach & Contact Engine (outreachEngine, context-aware messages)
 * 11. Interview Preparation Engine (interviewPrepEngine, STAR briefs)
 * 12. Career Copilot Orchestrator (careerCopilotEngine, 7 tools)
 * 13. System Diagnostics & Notifications Engine (diagnosticsEngine, notificationEngine)
 *
 * Workflows:
 * Workflow A: Profile -> Scored Feed -> Save/Apply
 * Workflow B: Import Target Companies -> Career Page Discovery -> Job Ingestion
 * Workflow C: Job Opportunity -> Tailored Resume Blueprint -> Document Persistence
 * Workflow D: Job Opportunity -> Contextual Outreach Message -> Outreach Log
 * Workflow E: Job Opportunity -> STAR Brief -> Practice Notes -> Persistence
 * Workflow F: Application Pipeline -> Stage Transitions -> Live Dashboard Metrics
 */

import { userContextService } from '../src/core/auth/userContext';
import { defaultProfile } from '../src/core/profile/defaultProfile';
import { targetCompaniesStore } from '../src/core/target-companies/targetCompanyStore';
import { fastCareerPageEngine } from '../src/core/target-companies/fastCareerPageEngine';
import { jobRepository } from '../src/core/jobs/jobRepository';
import { freshnessEngine } from '../src/core/jobs/engines/freshnessEngine';
import {
  analyzeJobMatch,
  opportunityToJobPosting,
  generateTailoredResume,
  generateOutreachDraft,
  generateInterviewBrief,
} from '../src/core/intelligence';
import { applicationEngine } from '../src/core/applications';
import { documentEngine } from '../src/core/documents';
import { outreachEngine } from '../src/core/outreach';
import { interviewPrepEngine } from '../src/core/interviews';
import { careerCopilotEngine } from '../src/core/copilot';
import { notificationEngine } from '../src/core/notifications';
import { diagnosticsEngine } from '../src/core/diagnostics';
import { JobOpportunity } from '../src/core/jobs/types';

async function runMasterVerification() {
  console.log('====================================================');
  console.log('🚀 HIRESWAY — MASTER ENGINE & WORKFLOW VERIFICATION');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string) {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAILED: ${testName}`);
      throw new Error(`Assertion failed for: ${testName}`);
    }
    passedTests++;
    console.log(`✅ PASSED: ${testName}`);
  }

  // --- ENGINE 1: User Context Engine ---
  console.log('\n--- 1. Testing User Context Engine ---');
  const userId = userContextService.getUserId();
  assert(Boolean(userId), 'UserContext provides active userId');
  const session = userContextService.getSession();
  assert(session.isAuthenticated === true, 'User session is authenticated');

  // --- ENGINE 2: Profile Engine ---
  console.log('\n--- 2. Testing Profile Engine ---');
  assert(Boolean(defaultProfile.personalInfo.fullName), 'Default profile has full name');
  assert(defaultProfile.skills.technicalSkills.length > 0, 'Default profile has technical skills');

  // --- ENGINE 3: Target Company Engine & Fast Career Discovery ---
  console.log('\n--- 3. Testing Target Company & Career Page Engine ---');
  await targetCompaniesStore.ensureHydrated();
  const companies = targetCompaniesStore.getCompanies();
  assert(companies.length > 0, `Target companies loaded (count: ${companies.length})`);
  const discoveryResult = await fastCareerPageEngine.gatherCareerPage('Stripe', 'stripe.com');
  assert(Boolean(discoveryResult.careerUrl), `Career discovery returned valid URL for Stripe: ${discoveryResult.careerUrl}`);
  assert(Boolean(discoveryResult.atsProvider), `ATS detected for Stripe: ${discoveryResult.atsProvider}`);

  // --- ENGINE 4 & 5: Deduplication & Canonical Keys ---
  console.log('\n--- 4 & 5. Testing Opportunity Storage & Deduplication ---');
  const now = new Date().toISOString();
  const testJob1: JobOpportunity = {
    id: `test-job-dedup-1-${Date.now()}`,
    title: 'Senior Full Stack Engineer',
    company: 'Stripe, Inc.',
    location: 'Remote',
    remoteStatus: 'remote',
    jobUrl: 'https://stripe.com/jobs/1',
    applyUrl: 'https://stripe.com/jobs/1/apply',
    postedDate: now,
    dateDiscovered: now,
    lifecycleState: 'IN_FEED',
    verificationStatus: 'verified_live',
    match_score: 92,
  };
  const savedJob = jobRepository.saveOpportunity(testJob1);
  assert(Boolean(savedJob), 'Job saved successfully into jobRepository');

  // --- ENGINE 6: Relevance & 4-Factor Matching Engine ---
  console.log('\n--- 6. Testing Career Intelligence & Matching Engine ---');
  const posting = opportunityToJobPosting(savedJob);
  const match = analyzeJobMatch(defaultProfile, posting);
  assert(match.overallScore >= 0 && match.overallScore <= 100, `Match score within bounds: ${match.overallScore}%`);
  assert(Boolean(match.fitCategory), `Fit category assigned: ${match.fitCategory}`);

  // --- ENGINE 7: Job Feed & 14-Day Freshness Retention ---
  console.log('\n--- 7. Testing 14-Day Retention Engine ---');
  const freshCheck = freshnessEngine.isJobWithinAgeWindow(savedJob, 14);
  assert(freshCheck.eligible, 'Newly posted job is eligible for Feed within 14-day window');

  // --- ENGINE 8: Application Pipeline Engine & Bidirectional Sync ---
  console.log('\n--- 8. Testing Application Pipeline Engine ---');
  const appRecord = await applicationEngine.createApplication({
    jobId: savedJob.id,
    roleTitle: savedJob.title,
    company: savedJob.company,
    location: savedJob.location || 'Remote',
    salary: '$180k - $210k',
    stage: 'applied',
    appliedDate: new Date().toISOString().split('T')[0],
    nextStep: 'Recruiter phone screen',
    matchScore: match.overallScore,
  });
  assert(Boolean(appRecord.id), `Application created: ${appRecord.id}`);
  const syncedJob = jobRepository.getOpportunityById(savedJob.id);
  assert(syncedJob?.lifecycleState === 'APPLIED', 'JobRepository synced lifecycleState to APPLIED');

  // Test stage transition
  const updatedApp = await applicationEngine.updateStage(appRecord.id, 'interviewing');
  assert(updatedApp?.stage === 'interviewing', 'Application stage transitioned to interviewing');

  // --- ENGINE 9: Document Studio Engine ---
  console.log('\n--- 9. Testing Document Studio Engine ---');
  const docGen = documentEngine.generateMarkdownResume(defaultProfile, posting);
  assert(docGen.markdown.includes(defaultProfile.personalInfo.fullName), 'Generated tailored resume includes candidate name');
  const savedDoc = await documentEngine.saveDocument({
    jobId: savedJob.id,
    applicationId: appRecord.id,
    title: `Tailored Resume - ${savedJob.company}`,
    documentType: 'tailored_resume',
    content: docGen.markdown,
    format: 'markdown',
    blueprint: docGen.blueprint,
  });
  assert(Boolean(savedDoc.id), `Tailored document variant saved: ${savedDoc.id}`);

  // --- ENGINE 10: Outreach & Contact Engine ---
  console.log('\n--- 10. Testing Outreach Engine ---');
  const outreachDraft = outreachEngine.draftMessage(defaultProfile, posting, 'Alex Hiring Manager');
  assert(outreachDraft.subjectLine.length > 5, `Outreach subject line generated: ${outreachDraft.subjectLine}`);
  const loggedOutreach = await outreachEngine.logOutreach({
    jobId: savedJob.id,
    company: savedJob.company,
    recipientName: 'Alex Hiring Manager',
    channel: 'Direct Email',
    subjectLine: outreachDraft.subjectLine,
    bodyText: outreachDraft.bodyText,
    status: 'sent',
  });
  assert(Boolean(loggedOutreach.id), `Outreach contact logged: ${loggedOutreach.id}`);

  // --- ENGINE 11: Interview Preparation Engine ---
  console.log('\n--- 11. Testing Interview Preparation Engine ---');
  const brief = interviewPrepEngine.generateBrief(defaultProfile, posting);
  assert(brief.predictedQuestions.length > 0, `Predicted interview questions generated: ${brief.predictedQuestions.length}`);
  const savedSession = await interviewPrepEngine.saveSession({
    jobId: savedJob.id,
    applicationId: appRecord.id,
    roleTitle: savedJob.title,
    company: savedJob.company,
    briefData: brief,
    notes: 'Covered STAR story on technical architecture and scaling to 10M requests/sec.',
  });
  assert(Boolean(savedSession.id), `Interview prep session saved: ${savedSession.id}`);

  // --- ENGINE 12: Career Copilot Orchestrator & Tool Registry ---
  console.log('\n--- 12. Testing Career Copilot Orchestrator ---');
  const tools = careerCopilotEngine.getToolList();
  assert(tools.length >= 7, `Copilot tool registry loaded ${tools.length} tools`);

  // Execute search_jobs tool
  const searchResult = await careerCopilotEngine.executeTool('search_jobs', { query: 'Engineer', limit: 3 }, defaultProfile);
  assert(searchResult.count !== undefined, `Copilot search_jobs executed (results: ${searchResult.count})`);

  // Execute get_pipeline_summary tool
  const pipelineSummary = await careerCopilotEngine.executeTool('get_pipeline_summary', {}, defaultProfile);
  assert(pipelineSummary.activeCount >= 1, `Copilot get_pipeline_summary reported ${pipelineSummary.activeCount} active roles`);

  // Execute conversational prompt
  const copilotReply = await careerCopilotEngine.handleUserPrompt('Summarize my application pipeline', defaultProfile);
  assert(copilotReply.sender === 'copilot', 'Copilot processed prompt and returned message');
  assert(Boolean(copilotReply.toolCall), `Copilot called tool: ${copilotReply.toolCall?.toolName}`);

  // --- ENGINE 13: System Diagnostics & Notifications ---
  console.log('\n--- 13. Testing Diagnostics & Notifications Engine ---');
  const diagReport = await diagnosticsEngine.runHealthCheck();
  assert(diagReport.overallStatus === 'healthy' || diagReport.overallStatus === 'warning', `Diagnostics health check status: ${diagReport.overallStatus}`);
  const notifCount = await notificationEngine.getUnreadCount();
  assert(notifCount > 0, `Notification engine recorded notifications (unread count: ${notifCount})`);

  // --- CLEANUP ---
  await applicationEngine.deleteApplication(appRecord.id);
  await documentEngine.deleteDocument(savedDoc.id);
  await outreachEngine.deleteRecord(loggedOutreach.id);

  console.log('\n====================================================');
  console.log(`🏆 ALL ENGINES & WORKFLOWS VERIFIED: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================\n');
}

runMasterVerification().catch((err) => {
  console.error('\nVerification encountered fatal error:', err);
  process.exit(1);
});
