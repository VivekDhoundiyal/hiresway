/**
 * HiresWay Career Copilot Orchestrator & Tool Registry
 *
 * Provides intelligent, zero-cost deterministic tool orchestration across all HiresWay engines:
 * 1. search_jobs: Filters opportunities by title, location, or match score.
 * 2. get_job_match: Evaluates deep 4-factor match between candidate profile and a specific job.
 * 3. tailor_resume: Generates ATS-optimized resume blueprints and markdown documents.
 * 4. draft_outreach: Generates context-aware networking messages referencing verified achievements.
 * 5. prepare_interview: Produces STAR narratives and strategic interview questions.
 * 6. get_pipeline_summary: Summarizes active applications, conversion rates, and pipeline health.
 * 7. get_target_companies: Inspects target employers and ATS verification status.
 */

import { jobRepository } from '../jobs/jobRepository';
import { targetCompaniesStore } from '../target-companies/targetCompanyStore';
import { applicationEngine } from '../applications/applicationEngine';
import { documentEngine } from '../documents/documentEngine';
import { outreachEngine } from '../outreach/outreachEngine';
import { interviewPrepEngine } from '../interviews/interviewPrepEngine';
import { analyzeJobMatch, opportunityToJobPosting } from '../intelligence';
import { UserProfile } from '../profile/types';

export interface CopilotTool {
  name: string;
  description: string;
  parameters: Record<string, string>;
  execute: (params: Record<string, any>, profile: UserProfile) => Promise<any> | any;
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'copilot' | 'tool';
  text: string;
  timestamp: string;
  toolCall?: {
    toolName: string;
    params: Record<string, any>;
    result?: any;
  };
}

class CareerCopilotEngine {
  private tools: Map<string, CopilotTool> = new Map();

  constructor() {
    this.registerCoreTools();
  }

  private registerCoreTools(): void {
    // 1. search_jobs
    this.registerTool({
      name: 'search_jobs',
      description: 'Search discovered and verified jobs by keyword, title, location, or min match score.',
      parameters: {
        query: 'string: search term in job title or company',
        minScore: 'number: minimum match score (e.g. 70)',
        limit: 'number: maximum jobs to return (default 5)',
      },
      execute: (params) => {
        const query = (params.query || '').toLowerCase().trim();
        const minScore = typeof params.minScore === 'number' ? params.minScore : 0;
        const limit = typeof params.limit === 'number' ? params.limit : 5;

        const all = [
          ...jobRepository.getDatabaseOpportunities(),
          ...jobRepository.getActiveOpportunities(),
        ];

        const filtered = all
          .filter((j) => {
            const matchesQuery =
              !query ||
              j.title.toLowerCase().includes(query) ||
              j.company.toLowerCase().includes(query) ||
              (j.location && j.location.toLowerCase().includes(query));
            const matchesScore = (j.match_score || 0) >= minScore;
            return matchesQuery && matchesScore;
          })
          .slice(0, limit)
          .map((j) => ({
            id: j.id,
            title: j.title,
            company: j.company,
            location: j.location,
            salary: j.salary ? `${j.salary.currency}${j.salary.min} - ${j.salary.max}` : undefined,
            matchScore: j.match_score,
            url: j.jobUrl || j.applyUrl,
          }));

        return { count: filtered.length, jobs: filtered };
      },
    });

    // 2. get_job_match
    this.registerTool({
      name: 'get_job_match',
      description: 'Analyze deep profile match breakdown for a specific opportunity.',
      parameters: {
        jobId: 'string: id of the opportunity',
      },
      execute: (params, profile) => {
        const opp = jobRepository.getOpportunityById(params.jobId);
        if (!opp) return { error: `Job with id '${params.jobId}' not found.` };
        const jobPosting = opportunityToJobPosting(opp);
        const match = analyzeJobMatch(profile, jobPosting);
        return {
          jobId: opp.id,
          title: opp.title,
          company: opp.company,
          overallScore: match.overallScore,
          fitCategory: match.fitCategory,
          strengths: match.strengths,
          gaps: match.gaps,
          breakdown: match.breakdown,
        };
      },
    });

    // 3. tailor_resume
    this.registerTool({
      name: 'tailor_resume',
      description: 'Generate an ATS-tailored resume blueprint for a target job.',
      parameters: {
        jobId: 'string: id of the opportunity',
      },
      execute: (params, profile) => {
        const opp = jobRepository.getOpportunityById(params.jobId);
        if (!opp) return { error: `Job with id '${params.jobId}' not found.` };
        const jobPosting = opportunityToJobPosting(opp);
        const { markdown, blueprint } = documentEngine.generateMarkdownResume(profile, jobPosting);
        return {
          headline: blueprint.customHeadline,
          summary: blueprint.customSummary,
          highlightedSkills: blueprint.highlightedSkills,
          markdownSnippet: markdown.slice(0, 500) + '...',
        };
      },
    });

    // 4. draft_outreach
    this.registerTool({
      name: 'draft_outreach',
      description: 'Draft a personalized networking message for a company or role.',
      parameters: {
        jobId: 'string: id of the opportunity',
        recipientName: 'string: recipient contact name',
      },
      execute: (params, profile) => {
        const opp = jobRepository.getOpportunityById(params.jobId);
        if (!opp) return { error: `Job with id '${params.jobId}' not found.` };
        const jobPosting = opportunityToJobPosting(opp);
        const draft = outreachEngine.draftMessage(profile, jobPosting, params.recipientName || 'Hiring Lead');
        return draft;
      },
    });

    // 5. prepare_interview
    this.registerTool({
      name: 'prepare_interview',
      description: 'Produce behavioral STAR briefs and strategic questions for an upcoming interview.',
      parameters: {
        jobId: 'string: id of the opportunity',
      },
      execute: (params, profile) => {
        const opp = jobRepository.getOpportunityById(params.jobId);
        if (!opp) return { error: `Job with id '${params.jobId}' not found.` };
        const jobPosting = opportunityToJobPosting(opp);
        const brief = interviewPrepEngine.generateBrief(profile, jobPosting);
        return {
          role: brief.jobTitle,
          company: brief.companyName,
          questionsCount: brief.predictedQuestions.length,
          questions: brief.predictedQuestions.map((q) => ({
            question: q.question,
            category: q.category,
            whyAsked: q.whyAsked,
            story: q.recommendedStory,
          })),
        };
      },
    });

    // 6. get_pipeline_summary
    this.registerTool({
      name: 'get_pipeline_summary',
      description: 'Summarize the user active application pipeline and interview stages.',
      parameters: {},
      execute: () => {
        const apps = applicationEngine.getApplicationsSync();
        const active = apps.filter((a) => a.stage !== 'rejected');
        const interviewing = apps.filter((a) => a.stage === 'interviewing' || a.stage === 'screening');
        const offers = apps.filter((a) => a.stage === 'offer');

        return {
          totalTracked: apps.length,
          activeCount: active.length,
          interviewingCount: interviewing.length,
          offerCount: offers.length,
          applications: active.slice(0, 5).map((a) => ({
            id: a.id,
            role: a.roleTitle,
            company: a.company,
            stage: a.stage,
          })),
        };
      },
    });

    // 7. get_target_companies
    this.registerTool({
      name: 'get_target_companies',
      description: 'Retrieve verified target companies, career page URLs, and ATS status.',
      parameters: {
        limit: 'number: max companies to return (default 10)',
      },
      execute: (params) => {
        const limit = typeof params.limit === 'number' ? params.limit : 10;
        const companies = targetCompaniesStore.getCompanies();
        return {
          totalCount: companies.length,
          companies: companies.slice(0, limit).map((c) => ({
            id: c.id,
            name: c.name,
            domain: c.domain,
            careersUrl: c.careersUrl || c.career_page_url,
            atsType: c.careersPlatform || 'direct',
            verified: c.verificationStatus === 'verified',
          })),
        };
      },
    });
  }

  public registerTool(tool: CopilotTool): void {
    this.tools.set(tool.name, tool);
  }

  public getToolList(): { name: string; description: string; parameters: Record<string, string> }[] {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  public async executeTool(
    name: string,
    params: Record<string, any>,
    profile: UserProfile
  ): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Copilot tool '${name}' is not registered.`);
    }
    return await tool.execute(params, profile);
  }

  /**
   * Processes a user question or command and deterministically selects the right tool.
   */
  public async handleUserPrompt(
    prompt: string,
    profile: UserProfile
  ): Promise<CopilotMessage> {
    const lower = prompt.toLowerCase();
    const id = `msg-${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Deterministic intent matching
    if (lower.includes('search') || lower.includes('find job') || lower.includes('remote job')) {
      const result = await this.executeTool('search_jobs', { query: prompt.replace(/search|find|job|jobs/gi, '').trim(), limit: 3 }, profile);
      return {
        id,
        sender: 'copilot',
        text: `Found ${result.count} matching opportunities in your Job Feed and Database:`,
        timestamp,
        toolCall: { toolName: 'search_jobs', params: { query: prompt }, result },
      };
    }

    if (lower.includes('pipeline') || lower.includes('application') || lower.includes('status')) {
      const result = await this.executeTool('get_pipeline_summary', {}, profile);
      return {
        id,
        sender: 'copilot',
        text: `Here is your current career pipeline overview (${result.activeCount} active roles, ${result.interviewingCount} interviewing):`,
        timestamp,
        toolCall: { toolName: 'get_pipeline_summary', params: {}, result },
      };
    }

    if (lower.includes('company') || lower.includes('target') || lower.includes('ats')) {
      const result = await this.executeTool('get_target_companies', { limit: 5 }, profile);
      return {
        id,
        sender: 'copilot',
        text: `Here are your top tracked target employers and verified career portals:`,
        timestamp,
        toolCall: { toolName: 'get_target_companies', params: { limit: 5 }, result },
      };
    }

    // Default intelligent assistant response
    return {
      id,
      sender: 'copilot',
      text: `I'm your HiresWay Career Copilot. I can search jobs, analyze role matches, generate ATS tailored resumes, draft personalized outreach, and prepare STAR interview stories. How can I assist your job search today?`,
      timestamp,
    };
  }
}

export const careerCopilotEngine = new CareerCopilotEngine();
