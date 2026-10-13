/**
 * CareerOs Unified Company Resolution & Auto-Enrichment Service
 *
 * Single source of truth for resolving company identity, official full-color logos,
 * official domains, careers portals, and ATS platforms for both Manual Add and Excel Import.
 */

import {
  TargetCompany,
  CompanySuggestionItem,
  CompanyDisambiguationChoice,
  CareersPlatformType,
  TargetCompanyVerificationStatus,
  TargetCompanyMonitoringStatus,
  TargetCompanyTag,
} from '../jobs/types';
import { companyIdentityService } from '../companies/companyIdentityService';

// Authoritative metadata repository for high-confidence company matching
export interface AuthoritativeCompanyMetadata {
  canonicalName: string;
  domain: string;
  industry: string;
  headquarters: string;
  careersUrl: string;
  careersPlatform: CareersPlatformType;
  aliases: string[];
  hiringActivity: 'very_high' | 'active' | 'moderate' | 'low';
}

export const AUTHORITATIVE_ENTERPRISES: Record<string, AuthoritativeCompanyMetadata> = {
  camunda: {
    canonicalName: 'Camunda',
    domain: 'camunda.com',
    industry: 'Process Orchestration & Automation',
    headquarters: 'Berlin, Germany & Worldwide Remote',
    careersUrl: 'https://jobs.ashbyhq.com/camunda',
    careersPlatform: 'ashby',
    aliases: ['camunda services', 'camunda bpm'],
    hiringActivity: 'active',
  },
  duckduckgo: {
    canonicalName: 'DuckDuckGo',
    domain: 'duckduckgo.com',
    industry: 'Private Search & Internet Privacy',
    headquarters: 'Paoli, PA & Worldwide Remote',
    careersUrl: 'https://jobs.ashbyhq.com/duck-duck-go',
    careersPlatform: 'ashby',
    aliases: ['duck duck go', 'ddg', 'duckduckgo inc'],
    hiringActivity: 'active',
  },
  cloudlinux: {
    canonicalName: 'CloudLinux',
    domain: 'cloudlinux.com',
    industry: 'Cloud Infrastructure & Linux OS',
    headquarters: 'Palo Alto, CA & Worldwide Remote',
    careersUrl: 'https://cloudlinux.workable.com',
    careersPlatform: 'workable',
    aliases: ['cloudlinux inc', 'almalinux'],
    hiringActivity: 'active',
  },
  ghost: {
    canonicalName: 'Ghost Foundation',
    domain: 'ghost.org',
    industry: 'Open Source Publishing & Media Platforms',
    headquarters: 'Singapore & Worldwide Remote',
    careersUrl: 'https://jobs.ashbyhq.com/ghost',
    careersPlatform: 'ashby',
    aliases: ['ghost.org', 'ghost foundation', 'ghost platform'],
    hiringActivity: 'active',
  },
  ghostfoundation: {
    canonicalName: 'Ghost Foundation',
    domain: 'ghost.org',
    industry: 'Open Source Publishing & Media Platforms',
    headquarters: 'Singapore & Worldwide Remote',
    careersUrl: 'https://jobs.ashbyhq.com/ghost',
    careersPlatform: 'ashby',
    aliases: ['ghost.org', 'ghost foundation'],
    hiringActivity: 'active',
  },
  google: {
    canonicalName: 'Google',
    domain: 'google.com',
    industry: 'Technology & Cloud Infrastructure',
    headquarters: 'Mountain View, CA & Global Hubs',
    careersUrl: 'https://careers.google.com',
    careersPlatform: 'custom',
    aliases: ['alphabet', 'google llc'],
    hiringActivity: 'active',
  },
  stripe: {
    canonicalName: 'Stripe',
    domain: 'stripe.com',
    industry: 'Financial Infrastructure & Payments',
    headquarters: 'San Francisco, CA & Dublin, Ireland',
    careersUrl: 'https://stripe.com/jobs',
    careersPlatform: 'greenhouse',
    aliases: ['stripe payments'],
    hiringActivity: 'active',
  },
  coursera: {
    canonicalName: 'Coursera',
    domain: 'coursera.org',
    industry: 'EdTech & Online Learning Platforms',
    headquarters: 'Mountain View, CA & Worldwide Remote',
    careersUrl: 'https://job-boards.greenhouse.io/coursera',
    careersPlatform: 'greenhouse',
    aliases: ['coursera inc', 'coursera.org'],
    hiringActivity: 'active',
  },
  microsoft: {
    canonicalName: 'Microsoft',
    domain: 'microsoft.com',
    industry: 'Enterprise Software & Cloud Platforms',
    headquarters: 'Redmond, WA & Global Hubs',
    careersUrl: 'https://careers.microsoft.com',
    careersPlatform: 'custom',
    aliases: ['msft', 'microsoft corp'],
    hiringActivity: 'active',
  },
  notion: {
    canonicalName: 'Notion',
    domain: 'notion.so',
    industry: 'Productivity & Workplace Collaboration',
    headquarters: 'San Francisco, CA & Remote',
    careersUrl: 'https://www.notion.so/careers',
    careersPlatform: 'greenhouse',
    aliases: ['notion labs'],
    hiringActivity: 'active',
  },
  datadog: {
    canonicalName: 'Datadog',
    domain: 'datadoghq.com',
    industry: 'Cloud Monitoring & Observability',
    headquarters: 'New York, NY & Global Hubs',
    careersUrl: 'https://www.datadoghq.com/careers',
    careersPlatform: 'greenhouse',
    aliases: ['datadog inc'],
    hiringActivity: 'active',
  },
  linear: {
    canonicalName: 'Linear',
    domain: 'linear.app',
    industry: 'Developer Tools & SaaS',
    headquarters: 'San Francisco, CA & Worldwide Remote',
    careersUrl: 'https://linear.app/careers',
    careersPlatform: 'ashby',
    aliases: ['linear app'],
    hiringActivity: 'active',
  },
  supabase: {
    canonicalName: 'Supabase',
    domain: 'supabase.com',
    industry: 'Developer Platform & Open Source',
    headquarters: 'Singapore & Worldwide Remote',
    careersUrl: 'https://supabase.com/careers',
    careersPlatform: 'ashby',
    aliases: ['supabase inc'],
    hiringActivity: 'very_high',
  },
  vercel: {
    canonicalName: 'Vercel',
    domain: 'vercel.com',
    industry: 'Cloud Infrastructure & Frontend Frameworks',
    headquarters: 'San Francisco, CA & Worldwide Remote',
    careersUrl: 'https://vercel.com/careers',
    careersPlatform: 'greenhouse',
    aliases: ['zeit'],
    hiringActivity: 'very_high',
  },
  figma: {
    canonicalName: 'Figma',
    domain: 'figma.com',
    industry: 'Design Systems & Collaboration Software',
    headquarters: 'San Francisco, CA & Remote',
    careersUrl: 'https://www.figma.com/careers',
    careersPlatform: 'greenhouse',
    aliases: ['figma design'],
    hiringActivity: 'active',
  },
  openai: {
    canonicalName: 'OpenAI',
    domain: 'openai.com',
    industry: 'Artificial Intelligence & Deep Learning',
    headquarters: 'San Francisco, CA',
    careersUrl: 'https://openai.com/careers',
    careersPlatform: 'greenhouse',
    aliases: ['openai research'],
    hiringActivity: 'very_high',
  },
  anthropic: {
    canonicalName: 'Anthropic',
    domain: 'anthropic.com',
    industry: 'AI Safety & Frontier Models',
    headquarters: 'San Francisco, CA',
    careersUrl: 'https://www.anthropic.com/careers',
    careersPlatform: 'greenhouse',
    aliases: ['anthropic ai'],
    hiringActivity: 'very_high',
  },
  gitlab: {
    canonicalName: 'GitLab',
    domain: 'gitlab.com',
    industry: 'DevSecOps & Software Delivery',
    headquarters: 'All-Remote (Worldwide)',
    careersUrl: 'https://about.gitlab.com/jobs',
    careersPlatform: 'greenhouse',
    aliases: ['gitlab inc'],
    hiringActivity: 'active',
  },
  github: {
    canonicalName: 'GitHub',
    domain: 'github.com',
    industry: 'Developer Platform & Cloud Solutions',
    headquarters: 'San Francisco, CA & Remote',
    careersUrl: 'https://github.com/about/careers',
    careersPlatform: 'greenhouse',
    aliases: ['github inc'],
    hiringActivity: 'active',
  },
  meta: {
    canonicalName: 'Meta',
    domain: 'meta.com',
    industry: 'Social Technologies & Spatial Computing',
    headquarters: 'Menlo Park, CA & Global Hubs',
    careersUrl: 'https://www.metacareers.com',
    careersPlatform: 'custom',
    aliases: ['facebook', 'meta platforms'],
    hiringActivity: 'active',
  },
  apple: {
    canonicalName: 'Apple',
    domain: 'apple.com',
    industry: 'Consumer Technology & Silicon',
    headquarters: 'Cupertino, CA & Global',
    careersUrl: 'https://jobs.apple.com',
    careersPlatform: 'custom',
    aliases: ['apple inc'],
    hiringActivity: 'moderate',
  },
  amazon: {
    canonicalName: 'Amazon',
    domain: 'amazon.com',
    industry: 'Cloud (AWS) & Global Commerce',
    headquarters: 'Seattle, WA & Global Hubs',
    careersUrl: 'https://amazon.jobs',
    careersPlatform: 'custom',
    aliases: ['aws', 'amazon.com inc'],
    hiringActivity: 'active',
  },
  netflix: {
    canonicalName: 'Netflix',
    domain: 'netflix.com',
    industry: 'Entertainment Streaming & Content Tech',
    headquarters: 'Los Gatos, CA & Global',
    careersUrl: 'https://jobs.netflix.com',
    careersPlatform: 'custom',
    aliases: ['netflix streaming'],
    hiringActivity: 'moderate',
  },
  razorpay: {
    canonicalName: 'Razorpay',
    domain: 'razorpay.com',
    industry: 'FinTech & Payments Infrastructure',
    headquarters: 'Bengaluru, India',
    careersUrl: 'https://razorpay.com/jobs',
    careersPlatform: 'greenhouse',
    aliases: ['razorpay software'],
    hiringActivity: 'active',
  },
  postman: {
    canonicalName: 'Postman',
    domain: 'postman.com',
    industry: 'API Platform & DevTools',
    headquarters: 'Bengaluru, India & San Francisco, CA',
    careersUrl: 'https://www.postman.com/careers',
    careersPlatform: 'greenhouse',
    aliases: ['postman api'],
    hiringActivity: 'active',
  },
  cred: {
    canonicalName: 'CRED',
    domain: 'cred.club',
    industry: 'FinTech & Consumer Tech',
    headquarters: 'Bengaluru, India',
    careersUrl: 'https://careers.cred.club',
    careersPlatform: 'lever',
    aliases: ['dreamplug'],
    hiringActivity: 'moderate',
  },
  swiggy: {
    canonicalName: 'Swiggy',
    domain: 'swiggy.com',
    industry: 'Consumer Tech & Hyperlocal Delivery',
    headquarters: 'Bengaluru, India',
    careersUrl: 'https://careers.swiggy.com',
    careersPlatform: 'smartrecruiters',
    aliases: ['bundl technologies'],
    hiringActivity: 'active',
  },
  zepto: {
    canonicalName: 'Zepto',
    domain: 'zeptonow.com',
    industry: 'Quick Commerce & Logistics',
    headquarters: 'Mumbai & Bengaluru, India',
    careersUrl: 'https://www.zeptonow.com/careers',
    careersPlatform: 'lever',
    aliases: ['kiranakart'],
    hiringActivity: 'very_high',
  },
  freshworks: {
    canonicalName: 'Freshworks',
    domain: 'freshworks.com',
    industry: 'Customer Engagement SaaS',
    headquarters: 'San Mateo, CA & Chennai, India',
    careersUrl: 'https://www.freshworks.com/company/careers',
    careersPlatform: 'smartrecruiters',
    aliases: ['freshdesk'],
    hiringActivity: 'active',
  },
  canva: {
    canonicalName: 'Canva',
    domain: 'canva.com',
    industry: 'Visual Communication & Design SaaS',
    headquarters: 'Sydney, Australia & Worldwide Remote',
    careersUrl: 'https://www.lifeatcanva.com',
    careersPlatform: 'lever',
    aliases: ['canva design'],
    hiringActivity: 'very_high',
  },
  atlassian: {
    canonicalName: 'Atlassian',
    domain: 'atlassian.com',
    industry: 'Team Collaboration Software',
    headquarters: 'Sydney, Australia & Global Remote',
    careersUrl: 'https://www.atlassian.com/company/careers',
    careersPlatform: 'workday',
    aliases: ['jira', 'confluence'],
    hiringActivity: 'active',
  },
  ramp: {
    canonicalName: 'Ramp',
    domain: 'ramp.com',
    industry: 'Financial Automation & Corporate Spend',
    headquarters: 'New York, NY & Remote',
    careersUrl: 'https://ramp.com/careers',
    careersPlatform: 'ashby',
    aliases: ['ramp cards'],
    hiringActivity: 'very_high',
  },
  brex: {
    canonicalName: 'Brex',
    domain: 'brex.com',
    industry: 'Corporate Cards & AI Spend Management',
    headquarters: 'San Francisco, CA & Remote',
    careersUrl: 'https://www.brex.com/careers',
    careersPlatform: 'greenhouse',
    aliases: ['brex inc'],
    hiringActivity: 'active',
  },
  retool: {
    canonicalName: 'Retool',
    domain: 'retool.com',
    industry: 'Internal Tools & Application Platform',
    headquarters: 'San Francisco, CA & Remote',
    careersUrl: 'https://retool.com/careers',
    careersPlatform: 'greenhouse',
    aliases: ['retool inc'],
    hiringActivity: 'active',
  },
};

// Known ambiguous names requiring explicit user disambiguation choices
export const AMBIGUOUS_COMPANIES_MAP: Record<string, CompanyDisambiguationChoice[]> = {
  meta: [
    {
      id: 'meta-platforms',
      name: 'Meta',
      domain: 'meta.com',
      industry: 'Social Technologies & AI',
      headquarters: 'Menlo Park, CA',
      careersUrl: 'https://www.metacareers.com',
      careersPlatform: 'custom',
      description: 'Parent company of Facebook, Instagram, WhatsApp, and Quest.',
    },
    {
      id: 'meta-materials',
      name: 'Meta Materials',
      domain: 'metamaterial.com',
      industry: 'Advanced Materials & Nanotechnology',
      headquarters: 'Halifax, Nova Scotia, Canada',
      careersUrl: 'https://metamaterial.com/careers',
      careersPlatform: 'custom',
      description: 'Developer of functional materials and nanocomposites.',
    },
  ],
  square: [
    {
      id: 'block-square',
      name: 'Square (Block)',
      domain: 'squareup.com',
      industry: 'Financial Services & Merchant POS',
      headquarters: 'San Francisco, CA & Remote',
      careersUrl: 'https://block.xyz/careers',
      careersPlatform: 'smartrecruiters',
      description: 'Financial software and payment hardware for sellers.',
    },
    {
      id: 'square-enix',
      name: 'Square Enix',
      domain: 'square-enix.com',
      industry: 'Video Game Entertainment & Media',
      headquarters: 'Tokyo, Japan & Global',
      careersUrl: 'https://www.square-enix.com/careers',
      careersPlatform: 'custom',
      description: 'Video game developer (Final Fantasy, Dragon Quest).',
    },
  ],
  apollo: [
    {
      id: 'apollo-graphql',
      name: 'Apollo GraphQL',
      domain: 'apollographql.com',
      industry: 'Developer Platform & GraphQL Infra',
      headquarters: 'San Francisco, CA & Remote',
      careersUrl: 'https://www.apollographql.com/careers',
      careersPlatform: 'greenhouse',
      description: 'Supergraph platform for unifying data and APIs.',
    },
    {
      id: 'apollo-io',
      name: 'Apollo.io',
      domain: 'apollo.io',
      industry: 'B2B Sales Intelligence & Engagement',
      headquarters: 'San Francisco, CA & Remote',
      careersUrl: 'https://www.apollo.io/careers',
      careersPlatform: 'greenhouse',
      description: 'Sales intelligence and prospecting data platform.',
    },
  ],
};

export class CompanyResolutionService {
  /**
   * Cleans and normalizes an input company name.
   */
  public cleanCompanyName(raw: unknown): string {
    if (raw === null || raw === undefined) return '';
    const str = String(raw).trim();
    if (!str) return '';
    return str
      .replace(/^[\t\r\n=+\-@]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generates a deterministic lookup key.
   */
  public toKey(name: unknown): string {
    if (name === null || name === undefined) return '';
    return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Checks if a company query has multiple ambiguous entities.
   */
  public getDisambiguationChoices(query: string): CompanyDisambiguationChoice[] | null {
    const clean = this.cleanCompanyName(query).toLowerCase();
    if (AMBIGUOUS_COMPANIES_MAP[clean]) {
      return AMBIGUOUS_COMPANIES_MAP[clean].map((item) => {
        const logoData = companyIdentityService.getCompanyLogoData(item.name, item.domain);
        return {
          ...item,
          logoUrl: logoData.url,
          logoData,
        };
      });
    }
    return null;
  }

  /**
   * Intelligent suggestion query: returns prioritized matches as the user types.
   */
  public getSuggestions(query: string, existingCompanies: TargetCompany[] = []): CompanySuggestionItem[] {
    const clean = this.cleanCompanyName(query).toLowerCase();
    if (!clean || clean.length < 1) return [];

    const suggestions: CompanySuggestionItem[] = [];
    const seenDomains = new Set<string>();

    const existingNames = new Set(existingCompanies.map((c) => this.toKey(c.name)));

    // 1. Scan Authoritative Catalog
    for (const [key, meta] of Object.entries(AUTHORITATIVE_ENTERPRISES)) {
      const matchExact = key === clean || meta.canonicalName.toLowerCase() === clean;
      const matchPrefix = key.startsWith(clean) || meta.canonicalName.toLowerCase().startsWith(clean);
      const matchAlias = meta.aliases.some((a) => a.toLowerCase().includes(clean));
      const matchSub = key.includes(clean) || meta.domain.toLowerCase().includes(clean);

      if (matchExact || matchPrefix || matchAlias || matchSub) {
        let confidence = 50;
        if (matchExact) confidence = 100;
        else if (matchPrefix) confidence = 90;
        else if (matchAlias) confidence = 80;
        else confidence = 65;

        const logoData = companyIdentityService.getCompanyLogoData(meta.canonicalName, meta.domain);

        suggestions.push({
          name: meta.canonicalName,
          canonicalName: meta.canonicalName,
          domain: meta.domain,
          industry: meta.industry,
          headquarters: meta.headquarters,
          logoUrl: logoData.url,
          logoData,
          careersUrl: meta.careersUrl,
          careersPlatform: meta.careersPlatform,
          isVerified: true,
          confidence,
        });

        seenDomains.add(meta.domain.toLowerCase());
      }
    }

    // 2. Scan Existing CareerOs Company Records (if not already found)
    for (const comp of existingCompanies) {
      const domain = comp.officialDomain || comp.domain || '';
      if (domain && seenDomains.has(domain.toLowerCase())) continue;

      const compKey = this.toKey(comp.name);
      if (compKey.includes(clean) || (domain && domain.toLowerCase().includes(clean))) {
        const logoData =
          comp.logo || companyIdentityService.getCompanyLogoData(comp.name, domain, comp.logoUrl);

        suggestions.push({
          name: comp.name,
          canonicalName: comp.name,
          domain: domain,
          industry: comp.industry,
          headquarters: comp.headquarters,
          logoUrl: logoData.url,
          logoData,
          careersUrl: comp.careersUrl || comp.careerPageUrl,
          careersPlatform: comp.careersPlatform || 'unverified',
          isVerified: comp.verificationStatus === 'verified',
          confidence: 70,
        });

        if (domain) seenDomains.add(domain.toLowerCase());
      }
    }

    // 3. Fallback: Dynamic Resolution for uncataloged legitimate input
    if (suggestions.length === 0 && clean.length >= 2) {
      const identity = companyIdentityService.getCompanyIdentity(query);
      suggestions.push({
        name: identity.canonicalName,
        canonicalName: identity.canonicalName,
        domain: identity.domain,
        industry: 'Technology & Internet',
        headquarters: 'Global / Remote',
        logoUrl: identity.logo.url,
        logoData: identity.logo,
        careersUrl: identity.careerPageUrl,
        careersPlatform: 'custom',
        isVerified: false,
        confidence: 40,
      });
    }

    // Sort by confidence DESC, then prioritize unadded companies
    return suggestions
      .sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        const aExists = existingNames.has(this.toKey(a.canonicalName));
        const bExists = existingNames.has(this.toKey(b.canonicalName));
        if (aExists && !bExists) return 1;
        if (!aExists && bExists) return -1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 6);
  }

  /**
   * Auto-enriches a company name into a complete TargetCompany record.
   * Shared by Manual Add and Excel Import.
   */
  public async enrichCompany(
    rawName: string,
    addedVia: 'manual' | 'excel_import' | 'profile_sync' = 'manual',
    tagHint: TargetCompanyTag = 'Priority',
    domainOrUrlHint?: string
  ): Promise<TargetCompany> {
    const cleaned = this.cleanCompanyName(rawName);
    const lookupKey = this.toKey(cleaned);
    const now = new Date().toISOString();

    const known = AUTHORITATIVE_ENTERPRISES[lookupKey];
    const identity = companyIdentityService.getCompanyIdentity(
      known?.canonicalName || cleaned,
      domainOrUrlHint || known?.domain
    );

    const canonicalName = known?.canonicalName || identity.canonicalName;
    const domain = known?.domain || identity.domain;
    const industry = known?.industry || 'Technology & Internet';
    const headquarters = known?.headquarters || 'Global / Remote';
    const hiringActivity = known?.hiringActivity || 'active';

    let careersUrl = known?.careersUrl;
    let careersPlatform: CareersPlatformType = known?.careersPlatform || 'unverified';
    let verificationStatus: TargetCompanyVerificationStatus = 'unverified';

    if (known?.careersUrl) {
      careersUrl = known.careersUrl;
      careersPlatform = known.careersPlatform;
      verificationStatus = 'verified';
    } else {
      // Automatic detection via standard patterns (never fabricating)
      careersUrl = identity.careerPageUrl || `https://${domain}/careers`;
      careersPlatform = 'custom';
      verificationStatus = 'needs_verification';
    }

    const monitoringStatus: TargetCompanyMonitoringStatus =
      verificationStatus === 'verified' ? 'active' : 'needs_attention';

    const rawSlug = (canonicalName || 'company').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const cleanSlug = rawSlug || 'company';
    const id = `target-${cleanSlug}`;
    const discoverySourceId = `src-target-${cleanSlug}`;

    const targetCompany: TargetCompany = {
      // Canonical model fields (spec compliant)
      company_id: id,
      canonical_name: canonicalName,
      display_name: canonicalName,
      aliases: known?.aliases || [canonicalName],
      website: `https://${domain}`,
      domain,
      logo_url: identity.logo?.url || '',
      career_page_url: careersUrl,
      linkedin_url: identity.linkedinUrl,
      industry,
      company_size: '500-5,000 employees',
      location: headquarters,
      target_status: tagHint,
      created_at: now,
      updated_at: now,
      source: addedVia,
      discovery_enabled: true,

      // Discovery telemetry fields
      discovery_status: verificationStatus === 'verified' ? 'Active' : 'Discovering',
      discovery_source_id: discoverySourceId,
      last_checked_at: now,
      lastCheckedAt: now,
      jobs_discovered: 0,
      live_jobs: 0,
      failed_attempts: 0,

      // Backward compatibility aliases
      id,
      canonicalCompanyId: `company-${cleanSlug}`,
      name: canonicalName,
      normalizedName: this.toKey(canonicalName),
      tag: tagHint,
      officialDomain: domain,
      officialWebsite: `https://${domain}`,
      logoUrl: identity.logo?.url,
      logo: identity.logo,
      headquarters,
      careersUrl,
      careersPlatform,
      sourceType: 'company_career_portal',
      verificationStatus,
      monitoringStatus,
      discoveryStatus: verificationStatus === 'verified' ? 'complete' : 'idle',
      lastDiscoveryAt: now,
      matchingOpeningsCount: 0,
      totalOpeningsCount: 0,
      addedVia,
      createdAt: now,
      updatedAt: now,
      hiringActivity,
      websiteUrl: `https://${domain}`,
      careerPageUrl: careersUrl,
      linkedinUrl: identity.linkedinUrl,
      lastCheckedDate: now,
      openRolesCount: 0,
      matchingRolesCount: 0,
      dateAdded: now,
    };

    return targetCompany;
  }
}

export const companyResolutionService = new CompanyResolutionService();
