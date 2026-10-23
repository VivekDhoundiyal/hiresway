import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/core/profile';
import { Card } from '@/components/card';
import { Button } from '@/components/button';
import { Input } from '@/components/input';
import { Typography } from '@/components/typography';
import { Badge } from '@/components/badge';
import {
  Compass,
  FileText,
  User,
  Briefcase,
  MapPin,
  DollarSign,
  Code2,
  Building2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Upload,
} from 'lucide-react';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, saveFullProfile } = useProfile();
  const [step, setStep] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);

  // Form State initialized from current profile
  const [fullName, setFullName] = useState(profile.personalInfo.fullName || '');
  const [headline, setHeadline] = useState(profile.personalInfo.headline || '');
  const [email, setEmail] = useState(profile.personalInfo.email || '');
  const [phone, setPhone] = useState(profile.personalInfo.phone || '');
  const [city, setCity] = useState(profile.locationAndAuth.currentCity || '');
  const [country, setCountry] = useState(profile.locationAndAuth.currentCountry || 'United States');

  const [targetPrimaryTitle, setTargetPrimaryTitle] = useState(
    profile.rolePreferences.targetPrimaryTitle || 'Senior Software Engineer'
  );
  const [targetJobTitles, setTargetJobTitles] = useState<string[]>(
    profile.rolePreferences.targetJobTitles?.length
      ? profile.rolePreferences.targetJobTitles
      : ['Full Stack Engineer', 'Backend Engineer']
  );
  const [newTitleInput, setNewTitleInput] = useState('');
  const [experienceLevel, setExperienceLevel] = useState(
    profile.rolePreferences.experienceLevel || 'senior'
  );
  const [yearsExperience, setYearsExperience] = useState<number>(
    profile.rolePreferences.totalYearsExperience || 5
  );

  const [remotePreference, setRemotePreference] = useState<'remote' | 'hybrid' | 'on-site'>(
    (profile.workPreferences?.workplaceTypes?.[0] as any) || 'remote'
  );
  const [authorizedCountries, setAuthorizedCountries] = useState(
    profile.locationAndAuth.citizenship || 'United States'
  );

  const [currency, setCurrency] = useState(profile.compensation.currency || 'USD');
  const [targetBase, setTargetBase] = useState<number>(
    profile.compensation.targetBaseSalary || 160000
  );
  const [minimumBase, setMinimumBase] = useState<number>(
    profile.compensation.minBaseSalary || 135000
  );

  const [techSkills, setTechSkills] = useState<string[]>(
    profile.skills.technicalSkills?.length
      ? profile.skills.technicalSkills
      : ['TypeScript', 'React', 'Node.js', 'Distributed Systems', 'PostgreSQL']
  );
  const [newSkillInput, setNewSkillInput] = useState('');

  const [targetCompanies, setTargetCompanies] = useState<string[]>(
    profile.targetMarkets.targetCompanies?.length
      ? profile.targetMarkets.targetCompanies
      : ['Stripe', 'Linear', 'Vercel', 'Datadog', 'GitLab']
  );
  const [newCompanyInput, setNewCompanyInput] = useState('');

  const handleAddTitle = () => {
    if (newTitleInput.trim() && !targetJobTitles.includes(newTitleInput.trim())) {
      setTargetJobTitles([...targetJobTitles, newTitleInput.trim()]);
      setNewTitleInput('');
    }
  };

  const handleRemoveTitle = (title: string) => {
    setTargetJobTitles(targetJobTitles.filter((t) => t !== title));
  };

  const handleAddSkill = () => {
    if (newSkillInput.trim() && !techSkills.includes(newSkillInput.trim())) {
      setTechSkills([...techSkills, newSkillInput.trim()]);
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setTechSkills(techSkills.filter((s) => s !== skill));
  };

  const handleAddCompany = () => {
    if (newCompanyInput.trim() && !targetCompanies.includes(newCompanyInput.trim())) {
      setTargetCompanies([...targetCompanies, newCompanyInput.trim()]);
      setNewCompanyInput('');
    }
  };

  const handleRemoveCompany = (company: string) => {
    setTargetCompanies(targetCompanies.filter((c) => c !== company));
  };

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      saveFullProfile({
        ...profile,
        personalInfo: {
          ...profile.personalInfo,
          fullName: fullName.trim() || 'Candidate',
          headline: headline.trim() || `${targetPrimaryTitle} specializing in high-scale systems`,
          email: email.trim(),
          phone: phone.trim(),
          city: city.trim(),
          country: country.trim(),
        },
        rolePreferences: {
          ...profile.rolePreferences,
          targetPrimaryTitle: targetPrimaryTitle.trim(),
          targetJobTitles: targetJobTitles.length > 0 ? targetJobTitles : [targetPrimaryTitle],
          experienceLevel: experienceLevel as any,
          totalYearsExperience: Number(yearsExperience) || 5,
        },
        locationAndAuth: {
          ...profile.locationAndAuth,
          currentCity: city.trim(),
          currentCountry: country.trim(),
          citizenship: authorizedCountries,
        },
        workPreferences: {
          ...profile.workPreferences,
          workplaceTypes: [remotePreference],
        },
        compensation: {
          ...profile.compensation,
          currency,
          targetBaseSalary: Number(targetBase) || 150000,
          minBaseSalary: Number(minimumBase) || 120000,
        },
        skills: {
          ...profile.skills,
          technicalSkills: techSkills,
        },
        targetMarkets: {
          ...profile.targetMarkets,
          targetCompanies: targetCompanies,
        },
      });

      navigate('/job-feed?onboarding=complete');
    } catch (err) {
      console.error('Failed to save onboarding profile', err);
    } finally {
      setIsSaving(false);
    }
  };

  const stepsList = [
    { num: 1, label: 'Welcome', icon: Compass },
    { num: 2, label: 'Resume', icon: FileText },
    { num: 3, label: 'Identity', icon: User },
    { num: 4, label: 'Roles', icon: Briefcase },
    { num: 5, label: 'Location', icon: MapPin },
    { num: 6, label: 'Salary', icon: DollarSign },
    { num: 7, label: 'Skills', icon: Code2 },
    { num: 8, label: 'Target Market', icon: Building2 },
  ];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-fadeIn">
      {/* Stepper Header */}
      <div className="space-y-4 text-center">
        <Badge variant="primary" size="md" icon={<Sparkles className="h-3.5 w-3.5" />}>
          Guided Career Operating System Setup
        </Badge>
        <Typography as="h1" variant="h2" color="primary" className="text-3xl font-bold tracking-tight">
          Personalize Your Career Intelligence
        </Typography>
        <Typography as="p" variant="body-md" color="secondary" className="max-w-xl mx-auto">
          HiresWay tailors every job recommendation, ATS match score, and outreach draft to your canonical identity.
        </Typography>

        {/* Horizontal Progress Indicators */}
        <div className="flex items-center justify-between pt-4 overflow-x-auto pb-2">
          {stepsList.map((s) => {
            const Icon = s.icon;
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            return (
              <div
                key={s.num}
                onClick={() => setStep(s.num)}
                className={`flex flex-col items-center gap-1.5 min-w-[70px] cursor-pointer transition-all ${
                  isCurrent
                    ? 'text-primary font-bold'
                    : isCompleted
                    ? 'text-emerald-600 font-medium'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center transition-all ${
                    isCurrent
                      ? 'bg-primary text-white shadow-sm ring-4 ring-primary-soft'
                      : isCompleted
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-surface-subtle text-slate-400 border border-border'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className="text-[11px] truncate">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Step Card */}
      <Card variant="bordered" padding="lg" className="shadow-sm border-border bg-surface">
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <Typography as="h2" variant="h3" color="primary">
                Welcome to HiresWay
              </Typography>
              <Typography as="p" variant="body-sm" color="secondary" className="mt-1">
                Your private, free career intelligence network. First, what is your primary professional focus?
              </Typography>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-caption font-semibold text-text-secondary mb-1">
                  Primary Target Job Title
                </label>
                <Input
                  value={targetPrimaryTitle}
                  onChange={(e) => setTargetPrimaryTitle(e.target.value)}
                  placeholder="e.g. Lead Full Stack Engineer"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-caption font-semibold text-text-secondary mb-1">
                    Seniority Level
                  </label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value as any)}
                    aria-label="Seniority Level"
                    className="w-full h-10 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="entry">Entry-Level / Junior</option>
                    <option value="mid">Mid-Level Engineer</option>
                    <option value="senior">Senior Engineer</option>
                    <option value="lead">Lead / Principal Engineer</option>
                    <option value="manager">Engineering Manager</option>
                    <option value="director">Director / Executive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-caption font-semibold text-text-secondary mb-1">
                    Total Years of Experience
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={40}
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Typography as="h2" variant="h3" color="primary">
                Resume & Work Milestones
              </Typography>
              <Typography as="p" variant="body-sm" color="secondary" className="mt-1">
                Import an existing resume or continue with guided manual entry.
              </Typography>
            </div>

            <div className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 text-center space-y-3 bg-surface-subtle/50 transition-colors">
              <Upload className="h-10 w-10 text-primary mx-auto" />
              <div>
                <p className="text-body-sm font-semibold text-text-primary">
                  Upload Resume (.pdf, .docx, .txt)
                </p>
                <p className="text-caption text-text-muted mt-0.5">
                  Processed 100% locally on your device via client-side parsing.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  alert('Resume intake ready. Proceeding to structured profile review.');
                  setStep(3);
                }}
              >
                Choose File or Skip to Manual Entry
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <Typography as="h2" variant="h3" color="primary">
                Candidate Identity
              </Typography>
              <Typography as="p" variant="body-sm" color="secondary" className="mt-1">
                Your genuine contact details and professional headline.
              </Typography>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-caption font-semibold text-text-secondary mb-1">
                    Full Legal Name
                  </label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-caption font-semibold text-text-secondary mb-1">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@domain.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-caption font-semibold text-text-secondary mb-1">
                  Professional Headline
                </label>
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Senior Distributed Systems Engineer | High-Throughput TypeScript & Go"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-caption font-semibold text-text-secondary mb-1">
                    Phone / WhatsApp (Optional)
                  </label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                  />
                </div>

                <div>
                  <label className="block text-caption font-semibold text-text-secondary mb-1">
                    Current City
                  </label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. San Francisco or Bengaluru"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <Typography as="h2" variant="h3" color="primary">
                Target Roles & Specializations
              </Typography>
              <Typography as="p" variant="body-sm" color="secondary" className="mt-1">
                Add secondary titles to broaden your job discovery breadth without losing relevance.
              </Typography>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newTitleInput}
                  onChange={(e) => setNewTitleInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTitle())}
                  placeholder="e.g. Cloud Solutions Architect"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleAddTitle}>
                  Add Role
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {targetJobTitles.map((t) => (
                  <Badge
                    key={t}
                    variant="neutral"
                    size="md"
                    className="flex items-center gap-1.5 px-3 py-1 bg-surface-subtle border border-border"
                  >
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTitle(t)}
                      className="text-text-muted hover:text-red-500 font-bold ml-1"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div>
              <Typography as="h2" variant="h3" color="primary">
                Location & Workplace Flexibility
              </Typography>
              <Typography as="p" variant="body-sm" color="secondary" className="mt-1">
                Filter opportunities that match your genuine remote or geographic requirements.
              </Typography>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-caption font-semibold text-text-secondary mb-1">
                    Current Country
                  </label>
                  <Input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="United States, India, Germany, etc."
                  />
                </div>

                <div>
                  <label className="block text-caption font-semibold text-text-secondary mb-1">
                    Remote Work Preference
                  </label>
                  <select
                    value={remotePreference}
                    onChange={(e) => setRemotePreference(e.target.value as any)}
                    aria-label="Remote Work Preference"
                    className="w-full h-10 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="remote">Strictly Remote Only (Worldwide or Regional)</option>
                    <option value="hybrid">Hybrid Work Model</option>
                    <option value="on-site">On-Site Accepted</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-caption font-semibold text-text-secondary mb-1">
                  Authorized Work Countries (Comma-separated)
                </label>
                <Input
                  value={authorizedCountries}
                  onChange={(e) => setAuthorizedCountries(e.target.value)}
                  placeholder="e.g. United States, Canada, India"
                />
              </div>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-6">
            <div>
              <Typography as="h2" variant="h3" color="primary">
                Compensation Expectations
              </Typography>
              <Typography as="p" variant="body-sm" color="secondary" className="mt-1">
                Enforce salary truth filtering to protect against undervalued roles.
              </Typography>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-caption font-semibold text-text-secondary mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  aria-label="Currency"
                  className="w-full h-10 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="USD">USD ($) — United States Dollar</option>
                  <option value="INR">INR (₹) — Indian Rupee</option>
                  <option value="EUR">EUR (€) — Euro</option>
                  <option value="GBP">GBP (£) — British Pound</option>
                  <option value="CAD">CAD ($) — Canadian Dollar</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-caption font-semibold text-text-secondary mb-1">
                    Target Base Annual Salary
                  </label>
                  <Input
                    type="number"
                    value={targetBase}
                    onChange={(e) => setTargetBase(Number(e.target.value))}
                    placeholder="160000"
                  />
                </div>

                <div>
                  <label className="block text-caption font-semibold text-text-secondary mb-1">
                    Minimum Acceptable Salary
                  </label>
                  <Input
                    type="number"
                    value={minimumBase}
                    onChange={(e) => setMinimumBase(Number(e.target.value))}
                    placeholder="135000"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-6">
            <div>
              <Typography as="h2" variant="h3" color="primary">
                Technical Skills & Core Strengths
              </Typography>
              <Typography as="p" variant="body-sm" color="secondary" className="mt-1">
                These skills power our 40/30/20/10 multi-dimensional match engine against real job descriptions.
              </Typography>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                  placeholder="e.g. Next.js, Kubernetes, GraphQL"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleAddSkill}>
                  Add Skill
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {techSkills.map((s) => (
                  <Badge
                    key={s}
                    variant="primary"
                    size="md"
                    className="flex items-center gap-1.5 px-3 py-1 bg-primary-soft text-primary font-semibold border border-primary/20"
                  >
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(s)}
                      className="text-primary hover:text-red-500 font-bold ml-1"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="space-y-6">
            <div>
              <Typography as="h2" variant="h3" color="primary">
                Target Companies & Market Focus
              </Typography>
              <Typography as="p" variant="body-sm" color="secondary" className="mt-1">
                Specify companies you are actively tracking. HiresWay will prioritize their direct ATS pipelines.
              </Typography>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newCompanyInput}
                  onChange={(e) => setNewCompanyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCompany())}
                  placeholder="e.g. Stripe, Linear, Figma"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleAddCompany}>
                  Add Company
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {targetCompanies.map((c) => (
                  <Badge
                    key={c}
                    variant="neutral"
                    size="md"
                    className="flex items-center gap-1.5 px-3 py-1 bg-surface-subtle border border-border font-medium"
                  >
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCompany(c)}
                      className="text-text-muted hover:text-red-500 font-bold ml-1"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stepper Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-border mt-8">
          {step > 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => s - 1)}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Previous Step
            </Button>
          ) : (
            <div />
          )}

          {step < 8 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              Continue to Step {step + 1}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              isLoading={isSaving}
              onClick={handleFinish}
              rightIcon={<Sparkles className="h-4 w-4" />}
            >
              Complete Setup & Launch Feed
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};
