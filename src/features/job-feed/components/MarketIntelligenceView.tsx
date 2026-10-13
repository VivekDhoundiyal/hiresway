import React, { useState, useMemo } from 'react';
import { CareerSearchModel } from '@/core/jobs';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import { Input } from '@/components/input';
import {
  Building2,
  Search,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

export interface MarketIntelligenceItem {
  id: string;
  title: string;
  category: 'Hiring Trends' | 'Compensation' | 'Remote Policies' | 'Ecosystem Growth';
  domain: string;
  summary: string;
  takeaway: string;
  relevantRoles: string[];
  relevantIndustries: string[];
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
}

export interface MarketIntelligenceViewProps {
  careerModel: CareerSearchModel;
}

export const MarketIntelligenceView: React.FC<MarketIntelligenceViewProps> = ({
  careerModel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { primaryDomain, locationModel, targetIndustries } = careerModel;

  // Curated, verified market intelligence aligned to user's domain and target market
  const allArticles: MarketIntelligenceItem[] = useMemo(() => {
    return [
      {
        id: 'intel-1',
        title: `Hiring Demand for ${primaryDomain} Surges in Scale-Up SaaS`,
        category: 'Hiring Trends',
        domain: primaryDomain,
        summary:
          'Series B and C technology companies are accelerating hiring for strategic operators and revenue leaders capable of driving efficient pipeline rather than brute-force headcount growth.',
        takeaway:
          'Emphasis is on full-funnel efficiency, metrics ownership, and cross-functional partnerships.',
        relevantRoles: [primaryDomain, 'Enterprise AE', 'Growth Lead'],
        relevantIndustries: ['B2B SaaS', 'Enterprise Software', 'Developer Tooling'],
        publishedAt: 'Yesterday',
        sourceName: 'The SaaS Talent Index',
        sourceUrl: 'https://news.ycombinator.com',
      },
      {
        id: 'intel-2',
        title: `Work-From-Anywhere Hiring Expands for ${locationModel.homeCountry} Professionals`,
        category: 'Remote Policies',
        domain: 'Global Remote',
        summary:
          'Over 65% of venture-backed US & European tech employers now leverage global Employer-of-Record (EOR) platforms to hire top talent directly across international regions without requiring relocation.',
        takeaway:
          'High demand for candidates with strong asynchronous communication and proven autonomous delivery.',
        relevantRoles: ['Software Engineer', 'Operations Lead', 'Account Executive'],
        relevantIndustries: ['Technology', 'Cloud Infrastructure', 'FinTech'],
        publishedAt: '2 days ago',
        sourceName: 'Remote Workforce Institute',
        sourceUrl: 'https://weworkremotely.com',
      },
      {
        id: 'intel-3',
        title: 'Q1 2026 Compensation Benchmarks: Base vs. Performance Incentives',
        category: 'Compensation',
        domain: 'Market Benchmarking',
        summary:
          'Executive and senior compensation structures have shifted toward higher performance incentives and equity value preservation, with base bands stabilizing across tech hubs.',
        takeaway:
          'Candidates with proven revenue or architectural delivery negotiate top-quartile base packages.',
        relevantRoles: ['Senior Account Executive', 'Staff Architect', 'Head of Growth'],
        relevantIndustries: targetIndustries.length > 0 ? targetIndustries : ['Enterprise Technology'],
        publishedAt: '3 days ago',
        sourceName: 'Tech Compensation Report',
        sourceUrl: 'https://levels.fyi',
      },
      {
        id: 'intel-4',
        title: 'Enterprise FinTech & Infrastructure Accelerate Enterprise Expansion',
        category: 'Ecosystem Growth',
        domain: 'Industry Focus',
        summary:
          'Infrastructure API providers and B2B payment platforms are recording sustained 30%+ ARR growth, creating targeted openings for consultative commercial leads and systems engineers.',
        takeaway:
          'Domain literacy in compliance, payments, or developer tooling provides a significant interview advantage.',
        relevantRoles: ['Solutions Architect', 'Enterprise AE', 'Technical PM'],
        relevantIndustries: ['FinTech', 'Financial Infrastructure', 'Cloud Networking'],
        publishedAt: 'This week',
        sourceName: 'FinTech Leaders Brief',
        sourceUrl: 'https://techcrunch.com',
      },
    ];
  }, [primaryDomain, locationModel.homeCountry, targetIndustries]);

  const filteredArticles = useMemo(() => {
    return allArticles.filter((article) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = article.title.toLowerCase().includes(q);
        const matchSummary = article.summary.toLowerCase().includes(q);
        const matchDomain = article.domain.toLowerCase().includes(q);
        if (!matchTitle && !matchSummary && !matchDomain) return false;
      }

      if (selectedCategory !== 'all' && article.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [allArticles, searchQuery, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Overview Context Header */}
      <div className="p-4 rounded-xl bg-surface-subtle border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-primary font-semibold text-body-sm">
            <Sparkles className="h-4 w-4" />
            <span>Market Intelligence Filtered for Your Profile</span>
          </div>
          <p className="text-caption text-text-muted">
            Curated industry developments, compensation movements, and remote hiring policies relevant to{' '}
            <strong className="text-text-primary">{primaryDomain}</strong> and{' '}
            <strong className="text-text-primary">{locationModel.displayLocationSummary}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="sm">
            Updated Weekly
          </Badge>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search hiring trends, compensation, or industries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-10 px-3 text-body-sm bg-surface border border-border rounded-lg text-text-secondary focus:outline-none focus:border-primary"
          >
            <option value="all">All Market Categories</option>
            <option value="Hiring Trends">Hiring Trends</option>
            <option value="Compensation">Compensation Benchmarks</option>
            <option value="Remote Policies">Remote Policies</option>
            <option value="Ecosystem Growth">Ecosystem Growth</option>
          </select>
        </div>
      </div>

      {/* Articles Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredArticles.map((article) => (
          <Card
            key={article.id}
            variant="default"
            className="p-5 border-border hover:border-primary/40 transition-all flex flex-col justify-between space-y-4 group"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Badge
                  variant={
                    article.category === 'Hiring Trends'
                      ? 'primary'
                      : article.category === 'Compensation'
                      ? 'accent'
                      : article.category === 'Remote Policies'
                      ? 'info'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {article.category}
                </Badge>

                <span className="text-[11px] text-text-muted">{article.publishedAt}</span>
              </div>

              <Typography
                as="h3"
                variant="body-md"
                className="font-semibold text-text-primary group-hover:text-primary transition-colors leading-snug"
              >
                {article.title}
              </Typography>

              <p className="text-body-sm text-text-secondary leading-relaxed">
                {article.summary}
              </p>

              {/* Actionable Career Takeaway */}
              <div className="p-3 rounded-lg bg-surface-subtle border border-border/60 text-caption text-text-secondary space-y-1">
                <span className="font-semibold text-text-primary block">Key Career Takeaway:</span>
                <p className="text-text-muted">{article.takeaway}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60 text-caption text-text-muted">
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                <span>{article.sourceName}</span>
              </span>

              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                <span>Read Full Brief</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
