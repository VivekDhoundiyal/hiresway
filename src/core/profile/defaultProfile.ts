import {
  UserProfile,
  WorkExperienceItem,
  EducationItem,
  CertificationItem,
  LanguageSkill,
  PublicPortfolioProfileConfig,
} from './types';

export const defaultProfile: UserProfile = {
  version: '2.0.0',
  lastUpdated: new Date().toISOString(),
  personalInfo: {
    fullName: 'Vivek Dhoundiyal',
    headline:
      'B2B Sales & Business Development Leader | Enterprise Sales, Strategic Partnerships & Revenue Growth',
    email: 'VivekDhoundiyal2901@gmail.com',
    phone: '(+91) 750-301-6766',
    city: 'Delhi',
    stateProvince: 'Delhi',
    country: 'India',
    linkedinUrl: 'https://linkedin.com/in/vivekdhoundiyal',
    githubUrl: '',
    portfolioUrl: '',
    websiteUrl: '',
  },
  professionalSummary: {
    summaryText:
      'B2B Sales and Business Development professional with 8+ years of experience across enterprise sales, new business acquisition, account management, partnerships and entrepreneurship. Experienced across the complete sales cycle—from prospecting and discovery to solution pitching, commercial negotiation, closure and client management. Hands-on experience building businesses, acquiring customers, developing distribution networks and managing recurring B2B relationships.',
    keyHighlights: [
      '8+ years scaling B2B enterprise revenue pipelines, new account acquisition, and strategic brand partnerships',
      'Managed end-to-end sales lifecycles from target account prospecting through commercial pricing negotiations and deal closures',
      'Founded and scaled distribution and services businesses, driving P&L ownership, client retention, and market expansion',
    ],
  },
  rolePreferences: {
    currentTitle: 'Growth & Revenue Consultant',
    currentCompany: 'SuperSurge',
    targetPrimaryTitle: 'Head of Business Development / Director of Enterprise Sales',
    targetJobTitles: [
      'Head of Business Development',
      'Director of Enterprise Sales',
      'Senior Manager – Business Development & Strategic Partnerships',
      'Lead – Enterprise Business Development',
      'Growth & Revenue Lead',
      'Strategic Account Executive',
      'Director of Commercial Partnerships',
      'VP of Sales / Commercial Lead',
    ],
    experienceLevel: 'lead',
    totalYearsExperience: 8,
  },
  skills: {
    technicalSkills: [
      'B2B Sales',
      'Business Development',
      'Enterprise Sales',
      'New Business Acquisition',
      'Lead Generation',
      'Outbound Sales',
      'Consultative Selling',
      'Key Account Management',
      'Client Relationship Management',
      'Strategic Partnerships',
      'Sales Pipeline Management',
      'Commercial Negotiation',
      'Proposal Development',
      'Stakeholder Management',
      'CRM Management',
      'Revenue Operations',
      'Market Expansion',
      'GTM Strategy',
    ],
    softSkills: [
      'Commercial Leadership',
      'Strategic Deal Negotiation',
      'Cross-Functional Collaboration',
      'Executive Pitching & Presentation',
      'Client Empathy & Relationship Building',
      'Entrepreneurial Problem Solving',
      'Team Mentorship',
    ],
    toolsAndPlatforms: [
      'HubSpot CRM',
      'Salesforce CRM',
      'Apollo.io',
      'LinkedIn Sales Navigator',
      'Outreach.io',
      'ZoomInfo',
      'Google Workspace',
      'Slack',
      'Excel / Commercial Modeling',
    ],
    languages: [
      { id: 'lang-1', language: 'English', proficiency: 'fluent' },
      { id: 'lang-2', language: 'Hindi', proficiency: 'native' },
    ],
  },
  workExperience: [
    {
      id: 'exp-1',
      company: 'SuperSurge',
      title: 'Growth & Revenue Consultant',
      employmentType: 'contract',
      location: 'Delhi, India',
      locationType: 'remote',
      startDate: '2024-10',
      endDate: '',
      isCurrent: true,
      description:
        'Drive business development and revenue opportunities across brand and media partnerships. Identify target accounts, conduct prospect research and execute outbound sales campaigns.',
      keyAchievements: [
        'Manage opportunities from prospecting and discovery through pitching, negotiation and deal coordination',
        'Develop commercial proposals around client objectives and campaign requirements',
        'Build relationships with brands, agencies, creators and senior marketing stakeholders',
      ],
      skillsUsed: [
        'B2B Sales',
        'Business Development',
        'Outbound Sales',
        'Strategic Partnerships',
        'Commercial Negotiation',
      ],
    },
    {
      id: 'exp-2',
      company: 'KreedOn',
      title: 'Media Sales Manager',
      employmentType: 'full-time',
      location: 'Delhi, India',
      locationType: 'hybrid',
      startDate: '2023-12',
      endDate: '2024-10',
      isCurrent: false,
      description:
        'Managed B2B sales for brand partnerships, sponsorships and media campaigns. Built sales pipeline through outbound prospecting, account research and relationship-led business development.',
      keyAchievements: [
        'Conducted client discovery, developed proposals and negotiated commercial terms',
        'Managed opportunities through the complete sales cycle and maintained client relationships for repeat business',
        'Coordinated with internal teams to ensure successful campaign delivery',
      ],
      skillsUsed: [
        'B2B Sales',
        'Media Partnerships',
        'Sponsorship Sales',
        'Account Management',
        'Deal Closure',
      ],
    },
    {
      id: 'exp-3',
      company: 'CollegeDunia Web Pvt. Ltd.',
      title: 'Senior Manager – Business Development',
      employmentType: 'full-time',
      location: 'Delhi, India',
      locationType: 'on-site',
      startDate: '2023-04',
      endDate: '2023-09',
      isCurrent: false,
      description:
        'Managed B2B business development across universities, coaching institutes and education businesses. Owned the sales cycle from target-account identification and prospecting through negotiation and closure.',
      keyAchievements: [
        'Generated and qualified opportunities through outbound outreach and relationship building',
        'Conducted discovery with senior decision-makers and developed proposals aligned with business requirements',
        'Negotiated pricing and commercials and coordinated with delivery teams after closure',
      ],
      skillsUsed: [
        'Enterprise Sales',
        'Business Development',
        'Lead Generation',
        'Commercial Negotiation',
        'Contract Closure',
      ],
    },
    {
      id: 'exp-4',
      company: 'Fixins, Dark Kitchen, SettleMyCar',
      title: 'Founder / Co-Founder',
      employmentType: 'full-time',
      location: 'Delhi, India',
      locationType: 'on-site',
      startDate: '2017-07',
      endDate: '2023-02',
      isCurrent: false,
      description:
        'Built and operated businesses across B2B distribution, food supply and automotive services, with direct ownership of revenue generation, client acquisition, operations, and P&L.',
      keyAchievements: [
        'Acquired corporate clients, negotiated long-term vendor contracts, and managed recurring accounts',
        'Built and managed distribution channels and supply chain partnerships from zero to scale',
        'Led cross-functional teams across operations, sales, procurement, and customer success',
      ],
      skillsUsed: [
        'Entrepreneurship',
        'B2B Distribution',
        'Revenue Operations',
        'Contract Negotiation',
        'P&L Ownership',
      ],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'University of Delhi',
      degree: 'Bachelor of Commerce',
      fieldOfStudy: 'Business Administration & Commercial Studies',
      startDate: '2014',
      endDate: '2017',
      gradeGpa: 'First Class',
      activitiesAndHonors: 'Commerce Association, Inter-College Business Strategy Case Competitions',
    },
  ],
  certifications: [
    {
      id: 'cert-1',
      name: 'HubSpot Inbound Sales Certified',
      issuingOrganization: 'HubSpot Academy',
      issueDate: '2023-05',
      expirationDate: '2026-05',
      doesNotExpire: false,
      credentialId: 'HS-INB-78219',
      credentialUrl: 'https://academy.hubspot.com',
    },
    {
      id: 'cert-2',
      name: 'Enterprise Sales Mastery & Account-Based Strategy',
      issuingOrganization: 'Commercial Excellence Institute',
      issueDate: '2022-08',
      expirationDate: '',
      doesNotExpire: true,
      credentialId: 'CEI-ES-5512',
      credentialUrl: '',
    },
  ],
  locationAndAuth: {
    currentCity: 'Delhi',
    currentCountry: 'India',
    openToRelocation: true,
    preferredRelocationLocations: ['Delhi NCR', 'Bengaluru', 'Mumbai', 'Remote (Worldwide WFA)'],
    citizenship: 'India',
    workAuthorizationStatus: 'citizen',
    requiresSponsorshipNow: false,
    requiresSponsorshipFuture: false,
  },
  workPreferences: {
    workplaceTypes: ['remote', 'hybrid', 'on-site'],
    employmentTypes: ['full-time', 'contract'],
    preferredRemoteLocations: ['Worldwide (WFA)', 'India (All Hubs)'],
    targetLocations: ['India', 'Remote Worldwide / Work From Anywhere'],
  },
  targetMarkets: {
    targetIndustries: [
      'Enterprise Software & SaaS',
      'Fintech & Payments',
      'Brand Partnerships & Media',
      'Consumer Tech & Marketplaces',
      'Developer Tooling & Cloud Platforms',
    ],
    targetCompanies: [
      'Stripe',
      'Razorpay',
      'Postman',
      'Freshworks',
      'PhonePe',
      'Swiggy',
      'Zepto',
      'CRED',
      'InMobi',
      'Notion',
      'Linear',
      'Supabase',
      'Vercel',
      'GitLab',
      'Shopify',
    ],
  },
  compensation: {
    currency: 'INR',
    minBaseSalary: 3500000,
    targetBaseSalary: 4800000,
    expectedBonusPercent: 25,
    openToEquity: true,
    compensationNotes:
      'Targeting ₹38L – ₹55L INR base + performance incentives. Open to global USD remote contracts ($90k – $150k).',
  },
  availability: {
    availabilityStatus: 'actively_interviewing',
    noticePeriod: 'immediate',
    customAvailabilityDate: '',
  },
  careerGoals: {
    shortTermGoals:
      'Join a high-growth tech or SaaS enterprise as a Head of Business Development, Lead Enterprise BD, or Strategic Partnerships Director. Scale commercial pipeline and establish market-leading revenue streams.',
    longTermVision:
      'Grow into a VP of Sales / Chief Commercial Officer (CCO) steering global go-to-market, enterprise distribution, and strategic alliances.',
    primaryMotivation:
      'Revenue impact, building high-converting commercial partnerships, solving complex client challenges, and scaling business units.',
  },
  publicPortfolio: {
    isEnabled: false,
    primarySlug: '',
    versions: [],
  },
};

export const createEmptyExperience = (): WorkExperienceItem => ({
  id: `exp-${Date.now()}`,
  company: '',
  title: '',
  employmentType: 'full-time',
  location: '',
  locationType: 'remote',
  startDate: '',
  endDate: '',
  isCurrent: false,
  description: '',
  keyAchievements: [],
  skillsUsed: [],
});

export const createEmptyEducation = (): EducationItem => ({
  id: `edu-${Date.now()}`,
  institution: '',
  degree: '',
  fieldOfStudy: '',
  startDate: '',
  endDate: '',
  gradeGpa: '',
  activitiesAndHonors: '',
});

export const createEmptyCertification = (): CertificationItem => ({
  id: `cert-${Date.now()}`,
  name: '',
  issuingOrganization: '',
  issueDate: '',
  expirationDate: '',
  doesNotExpire: true,
  credentialId: '',
  credentialUrl: '',
});

export const createEmptyLanguage = (): LanguageSkill => ({
  id: `lang-${Date.now()}`,
  language: '',
  proficiency: 'conversational',
});

export const createEmptyPublicPortfolioConfig = (): PublicPortfolioProfileConfig => ({
  isEnabled: false,
  primarySlug: '',
  versions: [],
});

/**
 * Checks whether a profile is currently using an obsolete placeholder template.
 */
export const isDefaultDemoProfile = (profile: UserProfile): boolean => {
  return (
    profile.personalInfo.fullName === 'Alex Morgan' ||
    profile.personalInfo.email === 'alex.morgan@example.com'
  );
};

/**
 * Create a completely clean, empty profile with zero placeholder or demo data.
 */
export const createEmptyProfile = (): UserProfile => ({
  version: '2.0.0',
  lastUpdated: new Date().toISOString(),
  personalInfo: {
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    city: '',
    stateProvince: '',
    country: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    websiteUrl: '',
  },
  professionalSummary: {
    summaryText: '',
    keyHighlights: [],
  },
  rolePreferences: {
    currentTitle: '',
    currentCompany: '',
    targetPrimaryTitle: '',
    targetJobTitles: [],
    experienceLevel: 'mid',
    totalYearsExperience: 0,
  },
  skills: {
    technicalSkills: [],
    softSkills: [],
    toolsAndPlatforms: [],
    languages: [],
  },
  workExperience: [],
  education: [],
  certifications: [],
  locationAndAuth: {
    currentCity: '',
    currentCountry: '',
    openToRelocation: false,
    preferredRelocationLocations: [],
    citizenship: '',
    workAuthorizationStatus: 'citizen',
    requiresSponsorshipNow: false,
    requiresSponsorshipFuture: false,
  },
  workPreferences: {
    workplaceTypes: ['remote', 'hybrid'],
    employmentTypes: ['full-time'],
    preferredRemoteLocations: [],
  },
  targetMarkets: {
    targetIndustries: [],
    targetCompanies: [],
  },
  compensation: {
    currency: 'INR',
    minBaseSalary: 0,
    targetBaseSalary: 0,
    expectedBonusPercent: 0,
    openToEquity: false,
    compensationNotes: '',
  },
  availability: {
    availabilityStatus: 'open_to_offers',
    noticePeriod: 'immediate',
    customAvailabilityDate: '',
  },
  careerGoals: {
    shortTermGoals: '',
    longTermVision: '',
    primaryMotivation: '',
  },
  publicPortfolio: {
    isEnabled: false,
    primarySlug: '',
    versions: [],
  },
});
