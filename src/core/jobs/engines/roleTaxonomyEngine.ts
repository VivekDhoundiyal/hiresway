/**
 * CareerOS Hierarchical Role Taxonomy Engine
 *
 * Implements a normalized occupation taxonomy inspired by O*NET (1,016 occupation titles)
 * and ESCO v1.2.1 (3,039 occupation concepts).
 *
 * Capabilities:
 * - Hierarchical structure: Domain -> Role Family -> Occupation Concept -> Aliases & Synonyms.
 * - Preferred title, alternate titles, legacy titles, industry-specific variations, and synonyms.
 * - Dynamic learning of real job titles observed across verified postings.
 * - Semantic role matching: never requires exact substring matches.
 * - Support for primary, adjacent, and transferable role recommendations.
 */

export interface OccupationConcept {
  id: string;
  preferredTitle: string;
  familyId: string;
  familyName: string;
  alternateTitles: string[];
  synonyms: string[];
  coreSkills: string[];
  seniorityLevels: ('entry' | 'mid' | 'senior' | 'lead' | 'director' | 'executive')[];
  adjacentOccupations: string[];
}

export interface RoleFamily {
  id: string;
  name: string;
  description: string;
  occupations: OccupationConcept[];
  adjacentFamilies: string[];
}

export interface RoleMatchResult {
  matches: boolean;
  score: number; // 0 - 100
  matchedOccupation?: OccupationConcept;
  matchedFamily?: RoleFamily;
  matchedTitle?: string;
  isAdjacent?: boolean;
}

// -----------------------------------------------------------------------------
// CANONICAL ROLE FAMILIES (O*NET & ESCO Reference Structures)
// -----------------------------------------------------------------------------
const CANONICAL_ROLE_FAMILIES: RoleFamily[] = [
  // 1. B2B Sales & Revenue Growth
  {
    id: 'b2b_sales_revenue',
    name: 'B2B Sales & Revenue Growth',
    description: 'Enterprise sales, strategic partnerships, account management, and commercial leadership',
    adjacentFamilies: ['revenue_sales_ops', 'operations_strategy_leadership', 'marketing_growth'],
    occupations: [
      {
        id: 'enterprise_sales_ae',
        preferredTitle: 'Enterprise Account Executive',
        familyId: 'b2b_sales_revenue',
        familyName: 'B2B Sales & Revenue Growth',
        alternateTitles: [
          'Enterprise Sales Executive',
          'Strategic Account Executive',
          'Commercial Account Executive',
          'Senior Account Executive',
          'Corporate Account Executive',
          'Strategic Sales Manager',
          'Enterprise Sales Manager',
          'Major Accounts Executive',
          'Global Account Executive',
          'Account Executive',
        ],
        synonyms: [
          'account executive',
          'enterprise sales',
          'ae',
          'commercial ae',
          'strategic ae',
          'corporate sales',
          'enterprise ae',
          'sales executive',
        ],
        coreSkills: [
          'b2b sales',
          'enterprise sales',
          'deal negotiation',
          'pipeline management',
          'consultative selling',
          'crm',
          'hubspot',
          'salesforce',
        ],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['business_development_lead', 'strategic_partnerships_dir', 'revenue_operations_lead'],
      },
      {
        id: 'business_development_lead',
        preferredTitle: 'Business Development Manager',
        familyId: 'b2b_sales_revenue',
        familyName: 'B2B Sales & Revenue Growth',
        alternateTitles: [
          'Head of Business Development',
          'Director of Business Development',
          'Business Development Director',
          'Senior Manager – Business Development',
          'Lead – Enterprise Business Development',
          'VP of Business Development',
          'BD Manager',
          'Commercial Lead',
          'Business Development Representative',
          'BDR',
          'SDR',
        ],
        synonyms: [
          'business development',
          'bizdev',
          'bd manager',
          'new business acquisition',
          'lead business development',
          'commercial partnerships',
          'bdr',
          'sdr',
        ],
        coreSkills: [
          'business development',
          'new account acquisition',
          'gtm strategy',
          'commercial negotiation',
          'market expansion',
          'prospecting',
        ],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['enterprise_sales_ae', 'strategic_partnerships_dir', 'growth_revenue_lead'],
      },
      {
        id: 'strategic_partnerships_dir',
        preferredTitle: 'Director of Strategic Partnerships',
        familyId: 'b2b_sales_revenue',
        familyName: 'B2B Sales & Revenue Growth',
        alternateTitles: [
          'Head of Partnerships',
          'Director of Commercial Partnerships',
          'Alliances Director',
          'Channel Partnerships Manager',
          'Strategic Alliances Lead',
          'Ecosystem Partnerships Lead',
          'Growth Partnerships Manager',
          'Partnerships Manager',
        ],
        synonyms: [
          'strategic partnerships',
          'partnerships',
          'channel partners',
          'alliances',
          'commercial partnerships',
          'ecosystem partnerships',
        ],
        coreSkills: [
          'strategic partnerships',
          'channel sales',
          'executive pitching',
          'cross-functional collaboration',
          'deal structuring',
        ],
        seniorityLevels: ['mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['business_development_lead', 'growth_revenue_lead'],
      },
      {
        id: 'account_management_lead',
        preferredTitle: 'Key Account Manager',
        familyId: 'b2b_sales_revenue',
        familyName: 'B2B Sales & Revenue Growth',
        alternateTitles: [
          'Senior Account Manager',
          'Director of Account Management',
          'Head of Client Accounts',
          'Commercial Account Manager',
          'Strategic Account Manager',
        ],
        synonyms: ['account management', 'account manager', 'client relations', 'key accounts', 'client success'],
        coreSkills: ['account management', 'upselling', 'contract renewals', 'client stakeholder management'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['enterprise_sales_ae', 'customer_success_dir'],
      },
      {
        id: 'growth_revenue_lead',
        preferredTitle: 'VP of Sales & Revenue',
        familyId: 'b2b_sales_revenue',
        familyName: 'B2B Sales & Revenue Growth',
        alternateTitles: [
          'Director of Enterprise Sales',
          'VP of Sales',
          'Head of Revenue',
          'Chief Commercial Officer',
          'Chief Revenue Officer',
          'Head of Commercial Strategy',
          'Commercial Director',
          'Sales Director',
        ],
        synonyms: ['revenue lead', 'sales director', 'vp sales', 'head of sales', 'cro', 'revenue growth'],
        coreSkills: ['revenue growth', 'p&l management', 'sales leadership', 'quota attainment', 'forecasting'],
        seniorityLevels: ['lead', 'director', 'executive'],
        adjacentOccupations: ['enterprise_sales_ae', 'revenue_operations_lead'],
      },
    ],
  },

  // 2. Revenue Operations & Sales Operations
  {
    id: 'revenue_sales_ops',
    name: 'Revenue Operations & Sales Operations',
    description: 'RevOps, SalesOps, deal desk, sales enablement, and commercial infrastructure',
    adjacentFamilies: ['b2b_sales_revenue', 'operations_strategy_leadership', 'data_ai_ml'],
    occupations: [
      {
        id: 'revenue_operations_lead',
        preferredTitle: 'Revenue Operations Manager',
        familyId: 'revenue_sales_ops',
        familyName: 'Revenue Operations & Sales Operations',
        alternateTitles: [
          'Director of Revenue Operations',
          'RevOps Manager',
          'Head of Revenue Operations',
          'RevOps Lead',
          'Revenue Operations Analyst',
        ],
        synonyms: ['revops', 'revenue operations', 'rev ops', 'revenue ops'],
        coreSkills: ['salesforce', 'hubspot', 'sales analytics', 'pipeline optimization', 'revenue forecasting', 'gtm tools'],
        seniorityLevels: ['mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['sales_operations_lead', 'business_operations_lead'],
      },
      {
        id: 'sales_operations_lead',
        preferredTitle: 'Sales Operations Manager',
        familyId: 'revenue_sales_ops',
        familyName: 'Revenue Operations & Sales Operations',
        alternateTitles: [
          'Sales Operations Lead',
          'Head of Sales Operations',
          'Director of Sales Operations',
          'Deal Desk Analyst',
          'Deal Desk Manager',
          'Sales Enablement Manager',
        ],
        synonyms: ['sales ops', 'sales operations', 'deal desk', 'sales enablement'],
        coreSkills: ['crm administration', 'commission planning', 'sales process optimization', 'sales metrics'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['revenue_operations_lead', 'enterprise_sales_ae'],
      },
    ],
  },

  // 3. Marketing & Growth
  {
    id: 'marketing_growth',
    name: 'Marketing, Product Marketing & Growth',
    description: 'Product marketing, performance marketing, content strategy, brand marketing, and demand generation',
    adjacentFamilies: ['b2b_sales_revenue', 'product_management'],
    occupations: [
      {
        id: 'product_marketing_manager',
        preferredTitle: 'Product Marketing Manager',
        familyId: 'marketing_growth',
        familyName: 'Marketing, Product Marketing & Growth',
        alternateTitles: [
          'Senior Product Marketing Manager',
          'Lead Product Marketer',
          'Director of Product Marketing',
          'Head of Product Marketing',
          'PMM',
          'Principal Product Marketing Manager',
        ],
        synonyms: ['pmm', 'product marketing', 'product marketing manager', 'go to market marketing', 'gtm marketing'],
        coreSkills: ['product positioning', 'messaging', 'competitive analysis', 'gtm launches', 'customer research'],
        seniorityLevels: ['mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['growth_marketing_lead', 'product_manager'],
      },
      {
        id: 'growth_marketing_lead',
        preferredTitle: 'Growth Marketing Manager',
        familyId: 'marketing_growth',
        familyName: 'Marketing, Product Marketing & Growth',
        alternateTitles: [
          'Director of Growth',
          'Head of Growth',
          'Performance Marketing Lead',
          'Demand Generation Manager',
          'Director of Demand Generation',
          'Acquisition Marketing Manager',
        ],
        synonyms: ['growth', 'growth marketing', 'performance marketing', 'demand gen', 'demand generation', 'paid acquisition'],
        coreSkills: ['cac/ltv', 'conversion rate optimization', 'sem/seo', 'paid social', 'funnel analytics', 'experimentation'],
        seniorityLevels: ['mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['product_marketing_manager', 'content_marketing_lead'],
      },
      {
        id: 'content_marketing_lead',
        preferredTitle: 'Content Marketing Manager',
        familyId: 'marketing_growth',
        familyName: 'Marketing, Product Marketing & Growth',
        alternateTitles: [
          'Head of Content',
          'Director of Content Strategy',
          'Content Strategist',
          'Managing Editor',
          'Brand Marketing Manager',
          'Director of Brand',
        ],
        synonyms: ['content', 'content marketing', 'content strategy', 'brand', 'brand marketing', 'editorial'],
        coreSkills: ['storytelling', 'seo content', 'editorial calendar', 'brand voice', 'copywriting', 'thought leadership'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['product_marketing_manager', 'developer_advocate'],
      },
    ],
  },

  // 4. Product Management & Product Operations
  {
    id: 'product_management',
    name: 'Product Management & Product Operations',
    description: 'Product strategy, technical product management, product operations, and execution',
    adjacentFamilies: ['software_engineering', 'design_ux_research', 'marketing_growth', 'operations_strategy_leadership'],
    occupations: [
      {
        id: 'product_manager',
        preferredTitle: 'Product Manager',
        familyId: 'product_management',
        familyName: 'Product Management & Product Operations',
        alternateTitles: [
          'Senior Product Manager',
          'Lead Product Manager',
          'Group Product Manager',
          'Director of Product',
          'Head of Product',
          'VP of Product',
          'Technical Product Manager',
          'Principal Product Manager',
          'Associate Product Manager',
        ],
        synonyms: ['pm', 'product lead', 'product director', 'technical pm', 'tpm', 'product management', 'group pm'],
        coreSkills: ['product roadmap', 'agile', 'user stories', 'feature prioritization', 'data analytics', 'customer discovery'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['product_operations_lead', 'product_designer', 'program_manager'],
      },
      {
        id: 'product_operations_lead',
        preferredTitle: 'Product Operations Manager',
        familyId: 'product_management',
        familyName: 'Product Management & Product Operations',
        alternateTitles: [
          'Product Ops Lead',
          'Head of Product Operations',
          'Director of Product Ops',
          'Product Operations Specialist',
        ],
        synonyms: ['product ops', 'product operations', 'prod ops'],
        coreSkills: ['product launch governance', 'user feedback loops', 'product analytics', 'internal enablement'],
        seniorityLevels: ['mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['product_manager', 'program_manager'],
      },
    ],
  },

  // 5. Program & Project Management
  {
    id: 'program_project_management',
    name: 'Program & Project Management',
    description: 'Technical program management (TPM), enterprise project delivery, Scrum, and agile delivery',
    adjacentFamilies: ['product_management', 'software_engineering', 'operations_strategy_leadership'],
    occupations: [
      {
        id: 'technical_program_manager',
        preferredTitle: 'Technical Program Manager (TPM)',
        familyId: 'program_project_management',
        familyName: 'Program & Project Management',
        alternateTitles: [
          'Senior Technical Program Manager',
          'Lead TPM',
          'Director of Technical Program Management',
          'Principal TPM',
          'Program Manager',
          'Senior Program Manager',
          'Director of Program Management',
        ],
        synonyms: ['tpm', 'technical program manager', 'program manager', 'program management', 'pgm'],
        coreSkills: ['cross-functional execution', 'risk mitigation', 'dependency mapping', 'agile architecture', 'stakeholder management'],
        seniorityLevels: ['mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['project_manager', 'product_manager'],
      },
      {
        id: 'project_manager',
        preferredTitle: 'Project Manager',
        familyId: 'program_project_management',
        familyName: 'Program & Project Management',
        alternateTitles: [
          'Senior Project Manager',
          'Scrum Master',
          'Agile Delivery Lead',
          'Project Delivery Manager',
          'Implementation Project Manager',
        ],
        synonyms: ['project manager', 'project management', 'scrum master', 'agile coach', 'delivery lead'],
        coreSkills: ['jira', 'sprint planning', 'scrum', 'budget tracking', 'timeline management'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['technical_program_manager', 'implementation_specialist'],
      },
    ],
  },

  // 6. Operations, Strategy & Founder's Office
  {
    id: 'operations_strategy_leadership',
    name: 'Operations, Strategy & Founder’s Office',
    description: 'Business operations (BizOps), Chief of Staff, corporate strategy, and Founder’s Office',
    adjacentFamilies: ['b2b_sales_revenue', 'product_management', 'finance_accounting'],
    occupations: [
      {
        id: 'founders_office_lead',
        preferredTitle: "Founder's Office / Chief of Staff",
        familyId: 'operations_strategy_leadership',
        familyName: 'Operations, Strategy & Founder’s Office',
        alternateTitles: [
          'Lead – Founder’s Office',
          'Chief of Staff to CEO',
          'Chief of Staff',
          'Special Projects Lead',
          'Executive Assistant to CEO / Strategy',
          'Strategic Initiatives Lead',
        ],
        synonyms: ['founders office', 'founder office', 'chief of staff', 'special projects', 'cos'],
        coreSkills: ['cross-functional leadership', 'strategic planning', 'financial modeling', 'high-velocity execution', 'board presentations'],
        seniorityLevels: ['mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['business_operations_lead', 'growth_revenue_lead'],
      },
      {
        id: 'business_operations_lead',
        preferredTitle: 'Business Operations Manager (BizOps)',
        familyId: 'operations_strategy_leadership',
        familyName: 'Operations, Strategy & Founder’s Office',
        alternateTitles: [
          'Director of Business Operations',
          'BizOps Lead',
          'Head of Operations',
          'VP of Operations',
          'Operations Manager',
          'Corporate Strategy Manager',
          'Director of Strategy',
        ],
        synonyms: ['bizops', 'business operations', 'strategy and ops', 'stratops', 'operations manager', 'strategy'],
        coreSkills: ['process optimization', 'kpi dashboards', 'cost restructuring', 'capacity planning', 'cross-functional execution'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['founders_office_lead', 'revenue_operations_lead'],
      },
    ],
  },

  // 7. Finance & Accounting
  {
    id: 'finance_accounting',
    name: 'Finance & Accounting',
    description: 'FP&A, corporate finance, commercial finance, accounting, and controllership',
    adjacentFamilies: ['operations_strategy_leadership', 'revenue_sales_ops'],
    occupations: [
      {
        id: 'fpa_manager',
        preferredTitle: 'Financial Planning & Analysis (FP&A) Manager',
        familyId: 'finance_accounting',
        familyName: 'Finance & Accounting',
        alternateTitles: [
          'Senior FP&A Analyst',
          'Director of FP&A',
          'Head of Finance',
          'VP of Finance',
          'Chief Financial Officer (CFO)',
          'Strategic Finance Lead',
          'Finance Manager',
        ],
        synonyms: ['fp&a', 'fpa', 'finance', 'financial planning', 'strategic finance', 'cfo', 'head of finance'],
        coreSkills: ['financial modeling', 'budgeting', 'forecasting', 'cash runway', 'saas metrics', 'excel', 'p&l'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['accountant_controller', 'business_operations_lead'],
      },
      {
        id: 'accountant_controller',
        preferredTitle: 'Corporate Controller',
        familyId: 'finance_accounting',
        familyName: 'Finance & Accounting',
        alternateTitles: [
          'Accounting Manager',
          'Senior Accountant',
          'Head of Accounting',
          'Revenue Accountant',
          'Director of Accounting',
        ],
        synonyms: ['accounting', 'accountant', 'controller', 'cpa', 'statutory audit', 'revenue recognition'],
        coreSkills: ['gaap', 'ifrs', 'quickbooks', 'netsuite', 'reconciliation', 'financial statements'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['fpa_manager'],
      },
    ],
  },

  // 8. People, HR & Recruiting
  {
    id: 'people_hr_recruiting',
    name: 'People, HR & Talent Acquisition',
    description: 'People Operations, HRBP, talent acquisition, technical recruiting, and organizational culture',
    adjacentFamilies: ['operations_strategy_leadership'],
    occupations: [
      {
        id: 'talent_acquisition_lead',
        preferredTitle: 'Technical Recruiter / Talent Acquisition Lead',
        familyId: 'people_hr_recruiting',
        familyName: 'People, HR & Talent Acquisition',
        alternateTitles: [
          'Senior Technical Recruiter',
          'Head of Talent Acquisition',
          'Recruiting Manager',
          'Talent Partner',
          'Talent Acquisition Specialist',
          'Lead Recruiter',
        ],
        synonyms: ['recruiter', 'recruiting', 'talent acquisition', 'technical recruiter', 'talent partner', 'staffing'],
        coreSkills: ['candidate sourcing', 'interviewing', 'ats management', 'offer negotiation', 'linkedin recruiter'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['people_operations_lead'],
      },
      {
        id: 'people_operations_lead',
        preferredTitle: 'People Operations Manager (HRBP)',
        familyId: 'people_hr_recruiting',
        familyName: 'People, HR & Talent Acquisition',
        alternateTitles: [
          'Human Resources Business Partner (HRBP)',
          'Director of People',
          'Head of HR',
          'VP of People',
          'HR Manager',
          'Chief People Officer',
        ],
        synonyms: ['people ops', 'people operations', 'hr', 'human resources', 'hrbp', 'head of people'],
        coreSkills: ['employee relations', 'performance management', 'compensation & benefits', 'onboarding', 'culture'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['talent_acquisition_lead'],
      },
    ],
  },

  // 9. Software Engineering & Infrastructure
  {
    id: 'software_engineering',
    name: 'Software Engineering & Infrastructure',
    description: 'Frontend, backend, fullstack, mobile, platform, and infrastructure engineering',
    adjacentFamilies: ['data_ai_ml', 'product_management', 'solutions_sales_engineering', 'developer_relations_community'],
    occupations: [
      {
        id: 'fullstack_engineer',
        preferredTitle: 'Fullstack Software Engineer',
        familyId: 'software_engineering',
        familyName: 'Software Engineering & Infrastructure',
        alternateTitles: [
          'Senior Fullstack Engineer',
          'Full Stack Developer',
          'Staff Fullstack Engineer',
          'Lead Fullstack Developer',
          'Principal Engineer',
          'Software Engineer',
          'Senior Software Engineer',
        ],
        synonyms: ['fullstack', 'full stack', 'web developer', 'software engineer', 'software engineering', 'swe'],
        coreSkills: ['react', 'node.js', 'typescript', 'sql', 'rest apis', 'system design'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['frontend_engineer', 'backend_engineer'],
      },
      {
        id: 'backend_engineer',
        preferredTitle: 'Backend Software Engineer',
        familyId: 'software_engineering',
        familyName: 'Software Engineering & Infrastructure',
        alternateTitles: [
          'Senior Backend Developer',
          'Systems Engineer',
          'API Engineer',
          'Distributed Systems Engineer',
          'Staff Backend Engineer',
        ],
        synonyms: ['backend', 'server engineer', 'golang developer', 'python engineer', 'java developer'],
        coreSkills: ['python', 'golang', 'java', 'postgresql', 'microservices', 'redis', 'kafka'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['fullstack_engineer', 'devops_cloud_engineer'],
      },
      {
        id: 'frontend_engineer',
        preferredTitle: 'Frontend Engineer',
        familyId: 'software_engineering',
        familyName: 'Software Engineering & Infrastructure',
        alternateTitles: [
          'Senior UI Engineer',
          'React Developer',
          'Web Applications Engineer',
          'Staff Frontend Engineer',
          'Frontend Developer',
        ],
        synonyms: ['frontend', 'front end', 'ui engineer', 'client engineer', 'web developer'],
        coreSkills: ['react', 'typescript', 'next.js', 'tailwind css', 'javascript', 'html/css'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead'],
        adjacentOccupations: ['fullstack_engineer', 'product_designer'],
      },
      {
        id: 'devops_cloud_engineer',
        preferredTitle: 'DevOps & Site Reliability Engineer',
        familyId: 'software_engineering',
        familyName: 'Software Engineering & Infrastructure',
        alternateTitles: [
          'Site Reliability Engineer (SRE)',
          'Cloud Infrastructure Engineer',
          'Platform Engineer',
          'Kubernetes Engineer',
          'Senior DevOps Engineer',
        ],
        synonyms: ['devops', 'sre', 'cloud engineer', 'infrastructure', 'platform engineer', 'site reliability'],
        coreSkills: ['aws', 'kubernetes', 'terraform', 'docker', 'ci/cd', 'linux'],
        seniorityLevels: ['mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['backend_engineer'],
      },
      {
        id: 'mobile_engineer',
        preferredTitle: 'Mobile Software Engineer',
        familyId: 'software_engineering',
        familyName: 'Software Engineering & Infrastructure',
        alternateTitles: [
          'iOS Engineer',
          'Android Engineer',
          'React Native Developer',
          'Flutter Developer',
          'Senior Mobile Developer',
        ],
        synonyms: ['mobile engineer', 'ios', 'android', 'react native', 'flutter', 'mobile app'],
        coreSkills: ['swift', 'kotlin', 'react native', 'flutter', 'mobile ui', 'app store publishing'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead'],
        adjacentOccupations: ['fullstack_engineer'],
      },
    ],
  },

  // 10. Data, Analytics & AI/ML
  {
    id: 'data_ai_ml',
    name: 'Data Science, Analytics & AI/ML',
    description: 'Data science, analytics, machine learning, AI research, and data engineering',
    adjacentFamilies: ['software_engineering', 'product_management'],
    occupations: [
      {
        id: 'machine_learning_engineer',
        preferredTitle: 'Machine Learning / AI Engineer',
        familyId: 'data_ai_ml',
        familyName: 'Data Science, Analytics & AI/ML',
        alternateTitles: [
          'Senior AI Engineer',
          'Deep Learning Specialist',
          'LLM / NLP Engineer',
          'Computer Vision Engineer',
          'AI Solutions Architect',
          'Data Scientist',
          'Senior Data Scientist',
        ],
        synonyms: ['ml engineer', 'ai engineer', 'machine learning', 'llm engineer', 'data scientist', 'ai/ml', 'artificial intelligence'],
        coreSkills: ['python', 'pytorch', 'tensorflow', 'llms', 'nlp', 'scikit-learn', 'deep learning'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['data_engineer', 'data_analyst'],
      },
      {
        id: 'data_engineer',
        preferredTitle: 'Data Engineer',
        familyId: 'data_ai_ml',
        familyName: 'Data Science, Analytics & AI/ML',
        alternateTitles: [
          'Senior Data Engineer',
          'Analytics Engineer',
          'Data Platform Engineer',
          'Lead Data Engineer',
        ],
        synonyms: ['data engineer', 'analytics engineer', 'data pipeline', 'etl developer', 'data platform'],
        coreSkills: ['spark', 'snowflake', 'dbt', 'sql', 'python', 'airflow', 'data warehousing'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['backend_engineer', 'data_analyst'],
      },
      {
        id: 'data_analyst',
        preferredTitle: 'Data Analyst & BI Specialist',
        familyId: 'data_ai_ml',
        familyName: 'Data Science, Analytics & AI/ML',
        alternateTitles: [
          'Senior Business Intelligence Analyst',
          'Analytics Lead',
          'Data Insights Manager',
          'BI Developer',
        ],
        synonyms: ['data analyst', 'bi analyst', 'business intelligence', 'data analytics', 'sql analyst', 'analytics'],
        coreSkills: ['sql', 'tableau', 'power bi', 'python', 'data modeling', 'business metrics'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead'],
        adjacentOccupations: ['machine_learning_engineer', 'revenue_operations_lead'],
      },
    ],
  },

  // 11. Design & UX
  {
    id: 'design_ux_research',
    name: 'Design & User Experience (UX/UI)',
    description: 'Product design, UI/UX, interaction design, user research, and design systems',
    adjacentFamilies: ['product_management', 'software_engineering'],
    occupations: [
      {
        id: 'product_designer',
        preferredTitle: 'Product Designer (UI/UX)',
        familyId: 'design_ux_research',
        familyName: 'Design & User Experience (UX/UI)',
        alternateTitles: [
          'Product Designer',
          'Senior Product Designer',
          'Lead Product Designer',
          'Staff Product Designer',
          'Principal Product Designer',
          'Senior UX Designer',
          'Lead UI/UX Designer',
          'Design Lead',
          'Head of Design',
          'VP of Design',
          'Design Systems Specialist',
          'UX/UI Designer',
        ],
        synonyms: ['product designer', 'ux designer', 'ui designer', 'product design', 'visual designer', 'ux/ui', 'design', 'ui/ux'],
        coreSkills: ['figma', 'user research', 'wireframing', 'design systems', 'prototyping', 'interaction design'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['product_manager', 'user_researcher'],
      },
      {
        id: 'user_researcher',
        preferredTitle: 'User Experience (UX) Researcher',
        familyId: 'design_ux_research',
        familyName: 'Design & User Experience (UX/UI)',
        alternateTitles: [
          'Senior UX Researcher',
          'Design Researcher',
          'Head of User Research',
        ],
        synonyms: ['ux researcher', 'user research', 'ux research', 'qualitative research', 'customer insights'],
        coreSkills: ['usability testing', 'user interviews', 'surveys', 'persona development', 'journey mapping'],
        seniorityLevels: ['mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['product_designer', 'product_manager'],
      },
    ],
  },

  // 12. Customer Success & Support
  {
    id: 'customer_success_support',
    name: 'Customer Success & Support',
    description: 'Customer success management (CSM), client onboarding, implementation, and technical support',
    adjacentFamilies: ['b2b_sales_revenue', 'solutions_sales_engineering'],
    occupations: [
      {
        id: 'customer_success_dir',
        preferredTitle: 'Customer Success Manager (CSM)',
        familyId: 'customer_success_support',
        familyName: 'Customer Success & Support',
        alternateTitles: [
          'Director of Customer Success',
          'Head of Customer Success',
          'VP Customer Success',
          'Enterprise CSM',
          'Senior Customer Success Manager',
        ],
        synonyms: ['customer success', 'csm', 'client retention', 'client relationship', 'customer success manager'],
        coreSkills: ['retention', 'nrr', 'account management', 'onboarding', 'client empathy', 'qbrs'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['implementation_specialist', 'account_management_lead'],
      },
      {
        id: 'implementation_specialist',
        preferredTitle: 'Implementation & Onboarding Specialist',
        familyId: 'customer_success_support',
        familyName: 'Customer Success & Support',
        alternateTitles: [
          'Client Onboarding Manager',
          'Professional Services Consultant',
          'Director of Implementation',
          'Customer Support Engineer',
          'Technical Support Lead',
        ],
        synonyms: ['implementation', 'onboarding', 'customer support', 'support engineer', 'client onboarding'],
        coreSkills: ['solution delivery', 'client training', 'troubleshooting', 'workflow configuration'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['customer_success_dir', 'solutions_engineer'],
      },
    ],
  },

  // 13. Solutions & Technical Sales
  {
    id: 'solutions_sales_engineering',
    name: 'Solutions & Technical Sales',
    description: 'Solutions Engineering, pre-sales architecture, technical sales, and implementation architecture',
    adjacentFamilies: ['b2b_sales_revenue', 'software_engineering'],
    occupations: [
      {
        id: 'solutions_engineer',
        preferredTitle: 'Solutions Engineer (Pre-Sales)',
        familyId: 'solutions_sales_engineering',
        familyName: 'Solutions & Technical Sales',
        alternateTitles: [
          'Senior Solutions Engineer',
          'Solutions Architect',
          'Principal Solutions Architect',
          'Enterprise Solutions Architect',
          'Principal Solutions Engineer',
          'Lead Solutions Architect',
          'Pre-Sales Engineer',
          'Technical Sales Specialist',
          'Director of Solutions Engineering',
          'Head of Solutions',
        ],
        synonyms: ['solutions engineering', 'solutions engineer', 'pre-sales', 'solutions architect', 'technical sales'],
        coreSkills: ['technical demos', 'proof of concept (poc)', 'api integrations', 'rfp responses', 'enterprise architecture'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['enterprise_sales_ae', 'fullstack_engineer'],
      },
    ],
  },

  // 14. Developer Relations & Community
  {
    id: 'developer_relations_community',
    name: 'Developer Relations & Community',
    description: 'DevRel, Developer Advocacy, technical community building, and open-source evangelism',
    adjacentFamilies: ['software_engineering', 'marketing_growth'],
    occupations: [
      {
        id: 'developer_advocate',
        preferredTitle: 'Developer Advocate / DevRel Lead',
        familyId: 'developer_relations_community',
        familyName: 'Developer Relations & Community',
        alternateTitles: [
          'Developer Relations Manager',
          'Head of DevRel',
          'Developer Evangelist',
          'Community Manager',
          'Head of Developer Community',
        ],
        synonyms: ['devrel', 'developer relations', 'developer advocate', 'developer advocacy', 'community'],
        coreSkills: ['technical writing', 'public speaking', 'developer evangelism', 'sample apps', 'github community'],
        seniorityLevels: ['mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['fullstack_engineer', 'content_marketing_lead'],
      },
    ],
  },

  // 15. Legal & Compliance
  {
    id: 'legal_compliance',
    name: 'Legal & Regulatory Compliance',
    description: 'Corporate counsel, commercial contracts, regulatory compliance, and risk governance',
    adjacentFamilies: ['operations_strategy_leadership'],
    occupations: [
      {
        id: 'legal_counsel',
        preferredTitle: 'Corporate & Commercial Counsel',
        familyId: 'legal_compliance',
        familyName: 'Legal & Regulatory Compliance',
        alternateTitles: [
          'Senior Legal Counsel',
          'General Counsel',
          'Head of Legal',
          'Commercial Counsel',
          'Compliance Manager',
          'Director of Compliance',
        ],
        synonyms: ['legal', 'legal counsel', 'general counsel', 'corporate counsel', 'compliance', 'contracts'],
        coreSkills: ['commercial contracts', 'intellectual property', 'gdpr/data privacy', 'regulatory compliance'],
        seniorityLevels: ['mid', 'senior', 'lead', 'director', 'executive'],
        adjacentOccupations: ['business_operations_lead'],
      },
    ],
  },

  // 16. Procurement & Supply Chain
  {
    id: 'procurement_supply_chain',
    name: 'Procurement & Supply Chain Operations',
    description: 'Strategic sourcing, procurement, vendor management, logistics, and supply chain operations',
    adjacentFamilies: ['operations_strategy_leadership', 'finance_accounting'],
    occupations: [
      {
        id: 'supply_chain_manager',
        preferredTitle: 'Supply Chain & Procurement Manager',
        familyId: 'procurement_supply_chain',
        familyName: 'Procurement & Supply Chain Operations',
        alternateTitles: [
          'Supply Chain Manager',
          'Procurement Manager',
          'Strategic Sourcing Manager',
          'Senior Strategic Sourcing Manager',
          'Director of Supply Chain',
          'Strategic Sourcing Lead',
          'Head of Procurement',
          'Vendor Operations Manager',
          'Logistics Manager',
        ],
        synonyms: ['supply chain', 'procurement', 'sourcing', 'logistics', 'vendor management'],
        coreSkills: ['supplier negotiation', 'inventory management', 'cost reduction', 'vendor management'],
        seniorityLevels: ['entry', 'mid', 'senior', 'lead', 'director'],
        adjacentOccupations: ['business_operations_lead'],
      },
    ],
  },
];

export class RoleTaxonomyEngine {
  private families: RoleFamily[] = [...CANONICAL_ROLE_FAMILIES];
  private learnedTitles: Map<string, { familyId: string; canonicalId: string }> = new Map();

  /**
   * Normalizes a string for clean token comparison.
   */
  public cleanText(str: string): string {
    return (str || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /**
   * Returns all canonical role families.
   */
  public getAllFamilies(): RoleFamily[] {
    return this.families;
  }

  /**
   * Searches occupations and aliases across the taxonomy.
   */
  public searchOccupations(query: string): OccupationConcept[] {
    const q = this.cleanText(query);
    if (!q) return [];

    const results: OccupationConcept[] = [];
    for (const family of this.families) {
      for (const occ of family.occupations) {
        const matchesPref = this.cleanText(occ.preferredTitle).includes(q);
        const matchesAlt = occ.alternateTitles.some((t) => this.cleanText(t).includes(q));
        const matchesSyn = occ.synonyms.some((s) => this.cleanText(s).includes(q));
        if (matchesPref || matchesAlt || matchesSyn) {
          results.push(occ);
        }
      }
    }
    return results;
  }

  /**
   * Finds the best matching occupation concept for a given job title.
   */
  public findOccupation(title: string): OccupationConcept | undefined {
    const clean = this.cleanText(title);
    if (!clean) return undefined;

    // 1. Direct learned match
    if (this.learnedTitles.has(clean)) {
      const { canonicalId } = this.learnedTitles.get(clean)!;
      for (const fam of this.families) {
        const found = fam.occupations.find((o) => o.id === canonicalId);
        if (found) return found;
      }
    }

    // 2. Exact preferred title or alternate title match
    for (const fam of this.families) {
      for (const occ of fam.occupations) {
        if (this.cleanText(occ.preferredTitle) === clean) return occ;
        if (occ.alternateTitles.some((t) => this.cleanText(t) === clean)) return occ;
      }
    }

    // 3. Synonym exact match
    for (const fam of this.families) {
      for (const occ of fam.occupations) {
        if (occ.synonyms.some((s) => this.cleanText(s) === clean)) return occ;
      }
    }

    // 4. Substring / Token overlap match
    let bestMatch: OccupationConcept | undefined = undefined;
    let highestScore = 0;

    const GENERIC_TAXONOMY_TOKENS = new Set([
      'business',
      'manager',
      'sales',
      'growth',
      'lead',
      'associate',
      'operations',
      'head',
      'general',
      'vp',
      'director',
      'specialist',
      'representative',
      'consultant',
      'intern',
      'internship',
      'trainee',
      'assistant',
      'coordinator',
      'officer',
      'analyst',
      'entry',
      'junior',
      'senior',
    ]);

    for (const fam of this.families) {
      for (const occ of fam.occupations) {
        const occTokens = this.cleanText(occ.preferredTitle).split(' ');
        const titleTokens = clean.split(' ');
        const commonTokens = occTokens.filter((tok) => tok.length > 2 && titleTokens.includes(tok));
        
        // Requirement 6: Generic words alone cannot establish concept match
        const nonGenericCommon = commonTokens.filter((tok) => !GENERIC_TAXONOMY_TOKENS.has(tok));
        if (nonGenericCommon.length === 0) continue;

        const score = (commonTokens.length / Math.max(occTokens.length, titleTokens.length)) * 100;

        if (score > highestScore && score >= 40) {
          highestScore = score;
          bestMatch = occ;
        }

        // Check alternate titles as well
        for (const alt of occ.alternateTitles) {
          const altTokens = this.cleanText(alt).split(' ');
          const altCommon = altTokens.filter((tok) => tok.length > 2 && titleTokens.includes(tok));
          const altNonGeneric = altCommon.filter((tok) => !GENERIC_TAXONOMY_TOKENS.has(tok));
          if (altNonGeneric.length === 0) continue;

          const altScore = (altCommon.length / Math.max(altTokens.length, titleTokens.length)) * 100;
          if (altScore > highestScore && altScore >= 40) {
            highestScore = altScore;
            bestMatch = occ;
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * Evaluates if a job title matches a list of target role criteria using semantic taxonomy.
   */
  public matchesRoleCriteria(jobTitle: string, targetRoles: string[]): RoleMatchResult {
    if (!jobTitle || targetRoles.length === 0) {
      return { matches: false, score: 0 };
    }

    const jobClean = this.cleanText(jobTitle);
    const jobOcc = this.findOccupation(jobTitle);
    const jobWords = jobClean.split(' ').filter((w) => w.length > 2);

    const GENERIC_TAXONOMY_TOKENS = new Set([
      'business',
      'manager',
      'sales',
      'growth',
      'lead',
      'associate',
      'operations',
      'head',
      'general',
      'vp',
      'director',
      'specialist',
      'representative',
      'consultant',
      'intern',
      'internship',
      'trainee',
      'assistant',
      'coordinator',
      'officer',
      'analyst',
      'entry',
      'junior',
      'senior',
    ]);
    const isJobPureGeneric =
      jobWords.length > 0 && jobWords.every((w) => GENERIC_TAXONOMY_TOKENS.has(w));

    // 1. Direct or alternate match with any target role
    for (const target of targetRoles) {
      const targetClean = this.cleanText(target);
      if (!targetClean) continue;

      // Exact normalized match
      if (jobClean === targetClean) {
        return {
          matches: true,
          score: 100,
          matchedTitle: target,
          matchedOccupation: jobOcc,
        };
      }

      // Target title is contained within job title (e.g. "Director of Enterprise Sales" in "Senior Director of Enterprise Sales")
      if (jobClean.includes(targetClean)) {
        return {
          matches: true,
          score: 90,
          matchedTitle: target,
          matchedOccupation: jobOcc,
        };
      }

      // Reverse containment only if job title is specific (not pure generic words)
      if (!isJobPureGeneric && targetClean.includes(jobClean)) {
        return {
          matches: true,
          score: 85,
          matchedTitle: target,
          matchedOccupation: jobOcc,
        };
      }

      // If job title is purely generic, do NOT allow family or occupation mapping without direct match
      if (isJobPureGeneric) {
        continue;
      }

      // Check if both map to the same occupation concept in taxonomy
      const targetOcc = this.findOccupation(target);
      if (jobOcc && targetOcc && jobOcc.id === targetOcc.id) {
        return {
          matches: true,
          score: 95,
          matchedTitle: targetOcc.preferredTitle,
          matchedOccupation: jobOcc,
        };
      }

      // Check if both map to the same role family
      if (jobOcc && targetOcc && jobOcc.familyId === targetOcc.familyId) {
        return {
          matches: true,
          score: 80,
          matchedTitle: targetOcc.preferredTitle,
          matchedOccupation: jobOcc,
        };
      }

      // Check adjacent family match
      if (jobOcc && targetOcc) {
        const targetFam = this.families.find((f) => f.id === targetOcc.familyId);
        if (targetFam && targetFam.adjacentFamilies.includes(jobOcc.familyId)) {
          return {
            matches: true,
            score: 65,
            matchedTitle: targetOcc.preferredTitle,
            matchedOccupation: jobOcc,
            isAdjacent: true,
          };
        }
      }
    }

    // 2. Word token overlap fallback (requires non-generic overlap)
    if (!isJobPureGeneric) {
      for (const target of targetRoles) {
        const targetWords = this.cleanText(target).split(' ').filter((w) => w.length > 2);
        const matches = targetWords.filter((w) => jobWords.includes(w));
        const nonGenericMatches = matches.filter((w) => !GENERIC_TAXONOMY_TOKENS.has(w));
        if (nonGenericMatches.length >= 1 && matches.length >= 2 && matches.length >= targetWords.length * 0.5) {
          return {
            matches: true,
            score: 70,
            matchedTitle: target,
            matchedOccupation: jobOcc,
          };
        }
      }
    }

    return { matches: false, score: 0 };
  }

  /**
   * Infers primary, adjacent, and transferable roles for a user's profile.
   */
  public inferRoleSpectrum(targetTitles: string[]): {
    primaryRoles: string[];
    adjacentRoles: string[];
    transferableRoles: string[];
  } {
    const primarySet = new Set<string>();
    const adjacentSet = new Set<string>();
    const transferableSet = new Set<string>();

    for (const rawTitle of targetTitles) {
      const occ = this.findOccupation(rawTitle);
      if (!occ) {
        primarySet.add(rawTitle);
        continue;
      }

      primarySet.add(occ.preferredTitle);
      occ.alternateTitles.slice(0, 3).forEach((t) => primarySet.add(t));

      // Adjacent occupations within family
      const family = this.families.find((f) => f.id === occ.familyId);
      if (family) {
        family.occupations.forEach((other) => {
          if (other.id !== occ.id) {
            adjacentSet.add(other.preferredTitle);
          }
        });

        // Transferable from adjacent families
        family.adjacentFamilies.forEach((adjFamId) => {
          const adjFam = this.families.find((f) => f.id === adjFamId);
          if (adjFam) {
            adjFam.occupations.slice(0, 2).forEach((o) => transferableSet.add(o.preferredTitle));
          }
        });
      }
    }

    return {
      primaryRoles: Array.from(primarySet),
      adjacentRoles: Array.from(adjacentSet).filter((r) => !primarySet.has(r)),
      transferableRoles: Array.from(transferableSet).filter((r) => !primarySet.has(r) && !adjacentSet.has(r)),
    };
  }

  /**
   * Dynamically learns and caches observed job titles from live postings.
   */
  public learnTitleFromPosting(title: string, _company?: string): void {
    const clean = this.cleanText(title);
    if (!clean || this.learnedTitles.has(clean)) return;

    const matchedOcc = this.findOccupation(title);
    if (matchedOcc) {
      this.learnedTitles.set(clean, {
        familyId: matchedOcc.familyId,
        canonicalId: matchedOcc.id,
      });
      if (!matchedOcc.alternateTitles.includes(title)) {
        matchedOcc.alternateTitles.push(title);
      }
    }
  }

  /**
   * Evaluates if a role matches negative career signals or explicit exclusions
   * (Section 10 of CareerOS Engine 2.0).
   */
  public isExcludedNegativeRole(
    title: string,
    description?: string,
    customExclusions: string[] = []
  ): { isExcluded: boolean; reason?: string } {
    const cleanTitle = this.cleanText(title);
    const cleanDesc = description ? description.toLowerCase() : '';

    // 1. Check custom exclusions
    for (const custom of customExclusions) {
      const cleanCustom = this.cleanText(custom);
      if (cleanCustom && cleanTitle.includes(cleanCustom)) {
        return { isExcluded: true, reason: `Role matches excluded keyword: "${custom}"` };
      }
    }

    // 2. High-volume telesales / telecalling / call center
    if (
      /\b(telecaller|telecalling|telesales|call center|bpo executive|tele-sales|cold calling)\b/i.test(cleanTitle) ||
      /\b(telecaller|telecalling|telesales)\b/i.test(cleanDesc)
    ) {
      return { isExcluded: true, reason: 'High-volume telesales or telecalling role excluded' };
    }

    // 3. Commission-only / door-to-door
    if (
      /\b(door-to-door|door to door|commission-only|commission only|stipend only|unpaid)\b/i.test(cleanTitle) ||
      /\b(commission-only|door-to-door sales|unpaid internship)\b/i.test(cleanDesc)
    ) {
      return { isExcluded: true, reason: 'Commission-only or door-to-door sales role excluded' };
    }

    // 4. Misleading field sales / delivery
    if (/\b(delivery executive|field boy|van sales|retail counter executive)\b/i.test(cleanTitle)) {
      return { isExcluded: true, reason: 'Misleading retail or manual delivery role excluded' };
    }

    // 5. Clearly unrelated heavy engineering / technical hardware (when user is in business/product/sales)
    if (
      /\b(civil engineer|electrical engineer|mechanical engineer|chemical engineer|structural engineer|site supervisor|embedded hardware|pcb design|robotics technician)\b/i.test(
        cleanTitle
      )
    ) {
      return { isExcluded: true, reason: 'Unrelated technical engineering discipline excluded' };
    }

    // 6. Junior roles far below experience (e.g. Intern, Trainee, Data Entry)
    if (/\b(intern|internship|trainee|data entry operator|back office junior)\b/i.test(cleanTitle)) {
      return { isExcluded: true, reason: 'Junior entry-level internship or clerical role excluded' };
    }

    return { isExcluded: false };
  }

  /**
   * Disambiguates role confusion, preventing mismatch between high-level roles
   * and lower-level, clerical, or assistant positions.
   * e.g. AE vs AE Assistant, Growth vs Growth Intern, Product Manager vs Project Coordinator.
   */
  public checkRoleConfusion(targetRole: string, jobTitle: string): { isConfusedMismatch: boolean; reason?: string } {
    const target = this.cleanText(targetRole);
    const title = this.cleanText(jobTitle);

    // 1. Account Executive vs Assistant / Trainee
    if (target.includes('account executive') || target === 'ae') {
      if (/\b(assistant|apprentice|junior assistant|intern|trainee|coordinator)\b/i.test(title)) {
        return { isConfusedMismatch: true, reason: 'Assistant or trainee role does not qualify as Account Executive' };
      }
    }

    // 2. Growth Manager / Lead vs Growth Intern / Campus Ambassador
    if (target.includes('growth') && !target.includes('intern')) {
      if (/\b(growth intern|growth hacker intern|campus ambassador|college lead)\b/i.test(title)) {
        return { isConfusedMismatch: true, reason: 'Internship role does not qualify as Growth Lead/Manager' };
      }
    }

    // 3. Product Manager vs Project Coordinator / Tracker
    if (target.includes('product manager') || target.includes('product management')) {
      if (/\b(project coordinator|project tracker|pmo clerk|documentation assistant)\b/i.test(title)) {
        return { isConfusedMismatch: true, reason: 'Clerical project tracking does not qualify as Product Management' };
      }
    }

    // 4. Operations Lead vs Data Entry / Typing Clerk
    if (target.includes('operations') || target.includes('bizops')) {
      if (/\b(data entry|typing clerk|back office assistant|office boy)\b/i.test(title)) {
        return { isConfusedMismatch: true, reason: 'Data entry does not qualify as Operations/BizOps leadership' };
      }
    }

    // 5. Commercial VP / Sales Director vs Counter / Van / Door-to-door
    if (target.includes('vp') || target.includes('director') || target.includes('head')) {
      if (/\b(counter sales|van sales|door to door|field boy|promoter)\b/i.test(title)) {
        return { isConfusedMismatch: true, reason: 'Direct manual retail does not qualify as Executive Sales Leadership' };
      }
    }

    return { isConfusedMismatch: false };
  }

  /**
   * Returns synonyms and alternate titles for a given role title.
   */
  public getSynonymsForRole(role: string): string[] {
    const occ = this.findOccupation(role);
    if (!occ) return [];
    return Array.from(new Set([...occ.synonyms, ...occ.alternateTitles]));
  }

  /**
   * Recommends primary, adjacent, and transferable roles for a user's target titles.
   */
  public getRecommendedRoles(targetTitles: string[]): {
    primaryRoles: string[];
    adjacentRoles: string[];
    transferableRoles: string[];
  } {
    return this.inferRoleSpectrum(targetTitles);
  }

  /**
   * Dynamically generates rich, searchable taxonomy options for the Role MultiSelect Dropdown,
   * computing real live counts from active opportunities.
   */
  public getTaxonomyDropdownOptions(activeJobs: Array<{ title: string }> = []): Array<{ value: string; label: string; count: number }> {
    const countsMap = new Map<string, number>();

    // 1. Collect all canonical preferred titles and core occupation titles across taxonomy
    const allTitles: string[] = [];
    CANONICAL_ROLE_FAMILIES.forEach((family: RoleFamily) => {
      family.occupations.forEach((occ: OccupationConcept) => {
        allTitles.push(occ.preferredTitle);
        occ.alternateTitles.forEach((alt: string) => {
          if (!allTitles.includes(alt) && alt.length <= 40) {
            allTitles.push(alt);
          }
        });
      });
    });

    // 2. Tally occurrences in active jobs
    activeJobs.forEach((job) => {
      const lower = (job.title || '').toLowerCase();
      allTitles.forEach((t) => {
        if (lower.includes(t.toLowerCase())) {
          countsMap.set(t, (countsMap.get(t) || 0) + 1);
        }
      });
    });

    // 3. Prioritize roles with available jobs, followed by primary canonical roles
    const options = allTitles.map((title) => ({
      value: title,
      label: title,
      count: countsMap.get(title) || 0,
    }));

    // All canonical preferred occupation titles are always available for search in dropdown,
    // plus any alternate title with active jobs.
    const preferredSet = new Set<string>();
    CANONICAL_ROLE_FAMILIES.forEach((fam) => {
      fam.occupations.forEach((occ) => preferredSet.add(occ.preferredTitle));
    });

    return options
      .filter((opt) => opt.count > 0 || preferredSet.has(opt.value))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.label.localeCompare(b.label);
      });
  }
}

export const roleTaxonomyEngine = new RoleTaxonomyEngine();
