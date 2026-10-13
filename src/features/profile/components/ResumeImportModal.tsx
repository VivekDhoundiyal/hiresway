import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '@/components/modal';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { UserProfile, WorkExperienceItem } from '@/core/profile';
import { isDefaultDemoProfile, createEmptyProfile } from '@/core/profile/defaultProfile';
import {
  extractTextFromFile,
  parseResumeText,
  ExtractedResumeData,
  ExtractionConfidence,
} from '@/core/profile/resume/resumeExtractor';
import { useSidebar } from '@/layout/useSidebar';
import {
  Upload,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronRight,
  User,
  FileText,
  Briefcase,
  GraduationCap,
  Award,
  Globe,
  Rocket,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

export interface ResumeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: UserProfile;
  onApplyProfile: (updatedProfile: UserProfile) => void;
}

export type SectionMergeAction = 'replace' | 'merge' | 'keep';

interface SectionActionsState {
  personalInfo: 'replace' | 'merge' | 'keep';
  summary: 'replace' | 'keep';
  roles: 'replace' | 'keep';
  skills: 'merge' | 'replace' | 'keep';
  tools: 'merge' | 'replace' | 'keep';
  standardExperience: 'replace' | 'merge' | 'keep';
  entrepreneurialExperience: 'merge' | 'keep';
  education: 'replace' | 'merge' | 'keep';
  languages: 'merge' | 'replace' | 'keep';
  certifications: 'replace' | 'merge' | 'keep';
}

const defaultActionsState: SectionActionsState = {
  personalInfo: 'replace',
  summary: 'replace',
  roles: 'replace',
  skills: 'merge',
  tools: 'merge',
  standardExperience: 'replace',
  entrepreneurialExperience: 'merge',
  education: 'replace',
  languages: 'merge',
  certifications: 'replace',
};

// Reusable Action Selector Pill Component
interface ActionPillProps {
  currentValue: string;
  onChange: (val: string) => void;
  options: { label: string; value: string; desc?: string }[];
}

const ActionPill: React.FC<ActionPillProps> = ({ currentValue, onChange, options }) => {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => {
        const isSelected = currentValue === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`
              px-2.5 py-1 text-caption font-medium rounded-md transition-all cursor-pointer select-none
              ${
                isSelected
                  ? 'bg-primary text-white shadow-xs ring-1 ring-primary'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-border-strong hover:bg-surface-subtle'
              }
            `}
            title={opt.desc}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export const ResumeImportModal: React.FC<ResumeImportModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onApplyProfile,
}) => {
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const prevCollapsedRef = useRef<boolean>(isCollapsed);

  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedResumeData | null>(null);

  // Section actions
  const [actions, setActions] = useState<SectionActionsState>(defaultActionsState);

  // Collapsible section states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    personal: true,
    summary: true,
    roles: true,
    skills: true,
    tools: true,
    experience: true,
    entrepreneurial: true,
    education: true,
    languages: true,
    certs: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-collapse sidebar during modal open to maximize comparison workspace
  useEffect(() => {
    if (isOpen) {
      prevCollapsedRef.current = isCollapsed;
      if (!isCollapsed) {
        setIsCollapsed(true);
      }
    } else {
      setIsCollapsed(prevCollapsedRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggleExpand = (sec: string) => {
    setExpandedSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const setAllExpanded = (expanded: boolean) => {
    setExpandedSections({
      personal: expanded,
      summary: expanded,
      roles: expanded,
      skills: expanded,
      tools: expanded,
      experience: expanded,
      entrepreneurial: expanded,
      education: expanded,
      languages: expanded,
      certs: expanded,
    });
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setErrorMessage(null);
    setExtractedData(null);
    setIsProcessing(false);
    setActions(defaultActionsState);
  };

  const handleFileChange = async (selectedFile: File) => {
    const validExtensions = ['pdf', 'doc', 'docx', 'txt'];
    const ext = selectedFile.name.split('.').pop()?.toLowerCase() || '';

    if (!validExtensions.includes(ext)) {
      setErrorMessage(
        `Unsupported file type ".${ext}". Please upload a PDF, DOC, DOCX, or TXT resume.`
      );
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setErrorMessage('File exceeds the 15MB maximum size limit.');
      return;
    }

    setFile(selectedFile);
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      const text = await extractTextFromFile(selectedFile);
      if (!text || text.trim().length < 20) {
        throw new Error(
          'Could not extract readable text from this file. If this is a scanned document or image, please upload a text-based resume.'
        );
      }

      const parsed = parseResumeText(text);
      setExtractedData(parsed);

      // Smart initial action defaults based on demo status
      const isDemo = isDefaultDemoProfile(currentProfile);
      if (isDemo) {
        setActions({
          personalInfo: 'replace',
          summary: 'replace',
          roles: 'replace',
          skills: 'replace',
          tools: 'replace',
          standardExperience: 'replace',
          entrepreneurialExperience: 'merge',
          education: 'replace',
          languages: 'replace',
          certifications: 'replace',
        });
      } else {
        setActions({
          personalInfo: 'merge',
          summary: 'replace',
          roles: 'replace',
          skills: 'merge',
          tools: 'merge',
          standardExperience: 'merge',
          entrepreneurialExperience: 'merge',
          education: 'merge',
          languages: 'merge',
          certifications: 'merge',
        });
      }

      setStep('review');
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to parse resume file. Please try another format.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Quick Batch Actions
  const handleApplyAllBatch = (mode: 'replace' | 'merge' | 'keep') => {
    if (mode === 'replace') {
      setActions({
        personalInfo: 'replace',
        summary: 'replace',
        roles: 'replace',
        skills: 'replace',
        tools: 'replace',
        standardExperience: 'replace',
        entrepreneurialExperience: 'merge',
        education: 'replace',
        languages: 'replace',
        certifications: 'replace',
      });
    } else if (mode === 'merge') {
      setActions({
        personalInfo: 'merge',
        summary: 'replace',
        roles: 'replace',
        skills: 'merge',
        tools: 'merge',
        standardExperience: 'merge',
        entrepreneurialExperience: 'merge',
        education: 'merge',
        languages: 'merge',
        certifications: 'merge',
      });
    } else {
      setActions({
        personalInfo: 'keep',
        summary: 'keep',
        roles: 'keep',
        skills: 'keep',
        tools: 'keep',
        standardExperience: 'keep',
        entrepreneurialExperience: 'keep',
        education: 'keep',
        languages: 'keep',
        certifications: 'keep',
      });
    }
  };

  const handleApply = () => {
    if (!extractedData) return;

    const isDemo = isDefaultDemoProfile(currentProfile);
    const baseProfile = isDemo ? createEmptyProfile() : currentProfile;
    const merged: UserProfile = {
      ...baseProfile,
      lastUpdated: new Date().toISOString(),
    };

    // Preserve existing uploaded avatars/banners
    if (currentProfile.personalInfo.avatarUrl) {
      merged.personalInfo.avatarUrl = currentProfile.personalInfo.avatarUrl;
    }
    if (currentProfile.personalInfo.bannerUrl) {
      merged.personalInfo.bannerUrl = currentProfile.personalInfo.bannerUrl;
    }

    // 1. Personal Info
    if (actions.personalInfo === 'replace') {
      merged.personalInfo = {
        ...merged.personalInfo,
        fullName:
          extractedData.personalInfo.fullName || baseProfile.personalInfo.fullName,
        headline:
          extractedData.personalInfo.headline || baseProfile.personalInfo.headline,
        email: extractedData.personalInfo.email || baseProfile.personalInfo.email,
        phone: extractedData.personalInfo.phone || baseProfile.personalInfo.phone,
        city: extractedData.personalInfo.city || baseProfile.personalInfo.city,
        stateProvince:
          extractedData.personalInfo.stateProvince ||
          baseProfile.personalInfo.stateProvince,
        country: extractedData.personalInfo.country || baseProfile.personalInfo.country,
        linkedinUrl:
          extractedData.personalInfo.linkedinUrl || baseProfile.personalInfo.linkedinUrl,
        githubUrl:
          extractedData.personalInfo.githubUrl || baseProfile.personalInfo.githubUrl,
        portfolioUrl:
          extractedData.personalInfo.portfolioUrl ||
          baseProfile.personalInfo.portfolioUrl,
      };
    } else if (actions.personalInfo === 'merge') {
      merged.personalInfo = {
        ...merged.personalInfo,
        fullName:
          baseProfile.personalInfo.fullName || extractedData.personalInfo.fullName || '',
        headline:
          baseProfile.personalInfo.headline || extractedData.personalInfo.headline || '',
        email: baseProfile.personalInfo.email || extractedData.personalInfo.email || '',
        phone: baseProfile.personalInfo.phone || extractedData.personalInfo.phone || '',
        city: baseProfile.personalInfo.city || extractedData.personalInfo.city || '',
        stateProvince:
          baseProfile.personalInfo.stateProvince ||
          extractedData.personalInfo.stateProvince ||
          '',
        country:
          baseProfile.personalInfo.country || extractedData.personalInfo.country || '',
        linkedinUrl:
          baseProfile.personalInfo.linkedinUrl ||
          extractedData.personalInfo.linkedinUrl ||
          '',
        githubUrl:
          baseProfile.personalInfo.githubUrl ||
          extractedData.personalInfo.githubUrl ||
          '',
        portfolioUrl:
          baseProfile.personalInfo.portfolioUrl ||
          extractedData.personalInfo.portfolioUrl ||
          '',
      };
    }

    // 2. Summary
    if (actions.summary === 'replace' && extractedData.professionalSummary?.summaryText) {
      merged.professionalSummary = {
        summaryText: extractedData.professionalSummary.summaryText,
        keyHighlights:
          extractedData.professionalSummary.keyHighlights &&
          extractedData.professionalSummary.keyHighlights.length > 0
            ? extractedData.professionalSummary.keyHighlights
            : baseProfile.professionalSummary.keyHighlights,
      };
    }

    // 3. Roles
    if (actions.roles === 'replace' && extractedData.rolePreferences) {
      merged.rolePreferences = {
        ...merged.rolePreferences,
        targetPrimaryTitle:
          extractedData.rolePreferences.targetPrimaryTitle ||
          baseProfile.rolePreferences.targetPrimaryTitle,
        currentTitle:
          extractedData.rolePreferences.currentTitle ||
          baseProfile.rolePreferences.currentTitle,
        currentCompany:
          extractedData.rolePreferences.currentCompany ||
          baseProfile.rolePreferences.currentCompany,
        experienceLevel:
          extractedData.rolePreferences.experienceLevel ||
          baseProfile.rolePreferences.experienceLevel,
        totalYearsExperience:
          extractedData.rolePreferences.totalYearsExperience ??
          baseProfile.rolePreferences.totalYearsExperience,
      };
    }

    // 4. Skills (Technical)
    const extTechSkills = extractedData.skills.technicalSkills || [];
    if (actions.skills === 'replace') {
      merged.skills = {
        ...merged.skills,
        technicalSkills: extTechSkills,
      };
    } else if (actions.skills === 'merge') {
      merged.skills = {
        ...merged.skills,
        technicalSkills: Array.from(
          new Set([...merged.skills.technicalSkills, ...extTechSkills])
        ),
      };
    }

    // 5. Tools & Platforms
    const extTools = extractedData.skills.toolsAndPlatforms || [];
    if (actions.tools === 'replace') {
      merged.skills = {
        ...merged.skills,
        toolsAndPlatforms: extTools,
      };
    } else if (actions.tools === 'merge') {
      merged.skills = {
        ...merged.skills,
        toolsAndPlatforms: Array.from(
          new Set([...merged.skills.toolsAndPlatforms, ...extTools])
        ),
      };
    }

    // 6. Standard Work Experience
    const standardExt = extractedData.workExperience.filter(
      (w) => !w.title.includes('[Entrepreneurial]')
    );
    let finalExperience: WorkExperienceItem[] = [...merged.workExperience];

    if (actions.standardExperience === 'replace') {
      finalExperience = standardExt;
    } else if (actions.standardExperience === 'merge') {
      // Append standard roles without exact duplicate titles at same company
      const existingKey = new Set(
        finalExperience.map((e) => `${e.company.toLowerCase()}-${e.title.toLowerCase()}`)
      );
      const toAdd = standardExt.filter(
        (e) => !existingKey.has(`${e.company.toLowerCase()}-${e.title.toLowerCase()}`)
      );
      finalExperience = [...finalExperience, ...toAdd];
    }

    // 7. Entrepreneurial Experience
    const extEntrepreneurial =
      extractedData.entrepreneurialExperience ||
      extractedData.workExperience.filter((w) => w.title.includes('[Entrepreneurial]'));

    if (actions.entrepreneurialExperience === 'merge' && extEntrepreneurial.length > 0) {
      const formattedVentureItems = extEntrepreneurial.map((item) => ({
        ...item,
        title: item.title.includes('[Entrepreneurial]')
          ? item.title
          : `${item.title} [Entrepreneurial]`,
      }));
      const existingKey = new Set(
        finalExperience.map((e) => `${e.company.toLowerCase()}-${e.title.toLowerCase()}`)
      );
      const newVentures = formattedVentureItems.filter(
        (v) => !existingKey.has(`${v.company.toLowerCase()}-${v.title.toLowerCase()}`)
      );
      finalExperience = [...finalExperience, ...newVentures];
    }
    merged.workExperience = finalExperience;

    // 8. Education
    if (actions.education === 'replace' && extractedData.education.length > 0) {
      merged.education = extractedData.education;
    } else if (actions.education === 'merge' && extractedData.education.length > 0) {
      const existingEdu = new Set(
        merged.education.map(
          (e) => `${e.institution.toLowerCase()}-${e.degree.toLowerCase()}`
        )
      );
      const newEdu = extractedData.education.filter(
        (e) =>
          !existingEdu.has(`${e.institution.toLowerCase()}-${e.degree.toLowerCase()}`)
      );
      merged.education = [...merged.education, ...newEdu];
    }

    // 9. Languages
    const extLangs = extractedData.languages || extractedData.skills.languages || [];
    if (actions.languages === 'replace' && extLangs.length > 0) {
      merged.skills = {
        ...merged.skills,
        languages: extLangs,
      };
    } else if (actions.languages === 'merge' && extLangs.length > 0) {
      const existingLangNames = new Set(
        merged.skills.languages.map((l) => l.language.toLowerCase())
      );
      const additionalLangs = extLangs.filter(
        (l) => !existingLangNames.has(l.language.toLowerCase())
      );
      merged.skills = {
        ...merged.skills,
        languages: [...merged.skills.languages, ...additionalLangs],
      };
    }

    // 10. Certifications
    if (actions.certifications === 'replace' && extractedData.certifications.length > 0) {
      merged.certifications = extractedData.certifications;
    } else if (
      actions.certifications === 'merge' &&
      extractedData.certifications.length > 0
    ) {
      const existingCerts = new Set(
        merged.certifications.map((c) => c.name.toLowerCase())
      );
      const newCerts = extractedData.certifications.filter(
        (c) => !existingCerts.has(c.name.toLowerCase())
      );
      merged.certifications = [...merged.certifications, ...newCerts];
    }

    onApplyProfile(merged);
    handleReset();
    onClose();
  };

  // Standard roles vs Entrepreneurial roles
  const standardExtractedRoles =
    extractedData?.workExperience.filter((w) => !w.title.includes('[Entrepreneurial]')) ||
    [];

  const entrepreneurialRoles =
    extractedData?.entrepreneurialExperience &&
    extractedData.entrepreneurialExperience.length > 0
      ? extractedData.entrepreneurialExperience
      : extractedData?.workExperience.filter((w) =>
          w.title.includes('[Entrepreneurial]')
        ) || [];

  const detectedLanguages =
    extractedData?.languages || extractedData?.skills.languages || [];

  const renderConfidenceBadge = (confidence?: ExtractionConfidence, text?: string) => {
    if (confidence === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-caption font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          {text || 'High confidence'}
        </span>
      );
    }
    if (confidence === 'medium') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-caption font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <Check className="h-3 w-3 shrink-0" />
          {text || 'Good match'}
        </span>
      );
    }
    if (confidence === 'low') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-caption font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {text || 'Review recommended'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-caption font-medium bg-slate-100 text-slate-600 border border-slate-200">
        <HelpCircle className="h-3 w-3 shrink-0" />
        {text || 'Not detected in document'}
      </span>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title={
        step === 'upload' ? 'Import Resume to Profile' : 'Review & Merge Resume Data'
      }
      description={
        step === 'upload'
          ? 'Upload your resume (PDF, DOC, DOCX, TXT). CareerOs extracts structured career data locally on your device without sending documents to external servers.'
          : 'Compare existing profile fields against extracted resume data side-by-side. Choose granular actions per section before saving.'
      }
      size={step === 'review' ? '6xl' : 'lg'}
    >
      {step === 'upload' ? (
        <div className="space-y-5">
          {/* Drag and Drop Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              border-border hover:border-primary hover:bg-primary-soft/30 group
              ${isProcessing ? 'opacity-60 pointer-events-none' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileChange(e.target.files[0]);
                }
              }}
            />

            <div className="mx-auto h-14 w-14 rounded-full bg-primary-soft text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-xs">
              <Upload className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <p className="text-body-md font-semibold text-text-primary">
                Click to browse or drag and drop your resume
              </p>
              <p className="text-body-sm text-text-muted">
                Supported formats: PDF, DOCX, DOC, TXT (up to 15MB)
              </p>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <Badge variant="neutral" size="sm">
                100% Client-Side
              </Badge>
              <Badge variant="accent" size="sm">
                Zero Hallucinations
              </Badge>
              <Badge variant="primary" size="sm">
                Layout-Aware Extraction
              </Badge>
            </div>
          </div>

          {isProcessing && (
            <div className="p-4 rounded-lg bg-surface-subtle border border-border flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
              <span className="text-body-sm font-medium text-text-primary">
                Extracting structured resume sections and layout lines...
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-body-sm flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3.5 rounded-lg bg-surface-subtle border border-border/70 text-caption text-text-muted space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-text-secondary">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Integrity & Privacy Guarantee</span>
            </div>
            <p className="leading-relaxed">
              CareerOs will only extract information explicitly written in your document.
              Your existing profile is never automatically overwritten; you will review
              and confirm every single section side-by-side.
            </p>
          </div>
        </div>
      ) : (
        /* Review & Merge Workspace (Side-by-Side 2-Column Comparison) */
        <div className="space-y-6 max-h-[72vh] overflow-y-auto pr-1">
          {/* Top Status & File Banner */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary text-white shrink-0 mt-0.5 shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="text-body-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-blue-950 text-body-md">
                    {file?.name}
                  </span>
                  <Badge variant="primary" size="sm">
                    Ready for Review
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-caption text-blue-800 mt-1 flex-wrap">
                  <span>
                    <strong>{extractedData?.skills.technicalSkills?.length || 0}</strong>{' '}
                    skills
                  </span>
                  <span>•</span>
                  <span>
                    <strong>
                      {extractedData?.skills.toolsAndPlatforms?.length || 0}
                    </strong>{' '}
                    tools
                  </span>
                  <span>•</span>
                  <span>
                    <strong>{standardExtractedRoles.length}</strong> standard roles
                  </span>
                  {entrepreneurialRoles.length > 0 && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-emerald-800">
                        {entrepreneurialRoles.length} venture
                      </span>
                    </>
                  )}
                  <span>•</span>
                  <span>
                    <strong>{extractedData?.education.length || 0}</strong> education
                  </span>
                  <span>•</span>
                  <span>
                    <strong>{detectedLanguages.length}</strong> languages
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Batch Controls */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <span className="text-caption text-blue-900 font-semibold hidden lg:inline">
                Apply to All:
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApplyAllBatch('replace')}
                className="bg-white hover:bg-blue-100 text-caption font-medium h-8"
                title="Replace all profile sections with extracted resume content"
              >
                Replace All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleApplyAllBatch('merge')}
                className="bg-white hover:bg-blue-100 text-caption font-medium h-8"
                title="Merge resume items into existing profile where applicable"
              >
                Merge All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleApplyAllBatch('keep')}
                className="hover:bg-blue-100 text-caption text-blue-900 h-8"
                title="Keep current profile unchanged across all sections"
              >
                Keep All Existing
              </Button>
            </div>
          </div>

          {/* Sample Profile Warning If Applicable */}
          {isDefaultDemoProfile(currentProfile) && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-body-sm flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">
                  Sample template profile detected
                </span>
                <span className="text-caption text-amber-800 block">
                  Applying this resume will cleanly replace all placeholder data ("Alex
                  Morgan", demo companies, and sample links) with your genuine career
                  details. Unextracted fields will remain empty for manual completion.
                </span>
              </div>
            </div>
          )}

          {/* Collapse/Expand Toggle Helper */}
          <div className="flex items-center justify-between px-1 text-caption text-text-muted">
            <span className="font-medium text-text-secondary">
              Review and configure section actions:
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAllExpanded(true)}
                className="hover:text-primary transition-colors cursor-pointer"
              >
                Expand All
              </button>
              <span>|</span>
              <button
                type="button"
                onClick={() => setAllExpanded(false)}
                className="hover:text-primary transition-colors cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* SECTION 1: Personal Information */}
          <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-xs">
            <div className="p-3.5 bg-surface-subtle/80 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                  <User className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-text-primary">
                    1. Personal Information
                  </span>
                  {renderConfidenceBadge(
                    extractedData?.confidence.personalInfo || 'high',
                    extractedData?.personalInfo.fullName
                      ? extractedData.personalInfo.fullName
                      : 'Extracted'
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ActionPill
                  currentValue={actions.personalInfo}
                  onChange={(v) =>
                    setActions((prev) => ({
                      ...prev,
                      personalInfo: v as 'replace' | 'merge' | 'keep',
                    }))
                  }
                  options={[
                    {
                      label: 'Replace existing',
                      value: 'replace',
                      desc: 'Overwrite profile personal details with resume',
                    },
                    {
                      label: 'Fill missing only',
                      value: 'merge',
                      desc: 'Only fill empty profile fields with resume data',
                    },
                    {
                      label: 'Keep existing',
                      value: 'keep',
                      desc: 'Leave existing personal information untouched',
                    },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand('personal')}
                  className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
                  aria-label="Toggle section"
                >
                  {expandedSections.personal ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {expandedSections.personal && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-body-sm">
                {/* Left Column: Existing */}
                <div className="p-3.5 rounded-lg border border-border/80 bg-surface space-y-2.5">
                  <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                    <span className="text-caption font-semibold uppercase text-text-muted tracking-wider">
                      Current Profile
                    </span>
                    <Badge variant="neutral" size="sm">
                      Existing
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-caption text-text-muted block">
                        Full Name
                      </span>
                      <span className="font-semibold text-text-primary">
                        {currentProfile.personalInfo.fullName || '— (Empty)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-caption text-text-muted block">Headline</span>
                      <span className="text-text-secondary">
                        {currentProfile.personalInfo.headline || '— (Empty)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-caption text-text-muted block">
                        Email & Phone
                      </span>
                      <span className="text-text-secondary">
                        {[
                          currentProfile.personalInfo.email,
                          currentProfile.personalInfo.phone,
                        ]
                          .filter(Boolean)
                          .join(' • ') || '— (Empty)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-caption text-text-muted block">Location</span>
                      <span className="text-text-secondary">
                        {[
                          currentProfile.personalInfo.city,
                          currentProfile.personalInfo.country,
                        ]
                          .filter(Boolean)
                          .join(', ') || '— (Empty)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-caption text-text-muted block">LinkedIn</span>
                      <span className="text-text-secondary truncate block">
                        {currentProfile.personalInfo.linkedinUrl || '— (Empty)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Extracted */}
                <div className="p-3.5 rounded-lg border border-blue-200/90 bg-blue-50/30 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-blue-200/60 pb-1.5">
                    <span className="text-caption font-semibold uppercase text-blue-900 tracking-wider">
                      Extracted from Resume
                    </span>
                    <Badge variant="primary" size="sm">
                      From Resume
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <span className="text-caption text-text-muted block">
                        Full Name
                      </span>
                      <span className="font-bold text-text-primary">
                        {extractedData?.personalInfo.fullName || (
                          <span className="text-text-muted italic">Not detected</span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-caption text-text-muted block">Headline</span>
                      <span className="font-medium text-text-primary">
                        {extractedData?.personalInfo.headline || (
                          <span className="text-text-muted italic">Not detected</span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-caption text-text-muted block">
                        Email & Phone
                      </span>
                      <span className="font-medium text-text-primary">
                        {[
                          extractedData?.personalInfo.email,
                          extractedData?.personalInfo.phone,
                        ]
                          .filter(Boolean)
                          .join(' • ') || (
                          <span className="text-text-muted italic">Not detected</span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-caption text-text-muted block">Location</span>
                      <span className="font-medium text-text-primary">
                        {[
                          extractedData?.personalInfo.city,
                          extractedData?.personalInfo.country,
                        ]
                          .filter(Boolean)
                          .join(', ') || (
                          <span className="text-text-muted italic">Not detected</span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-caption text-text-muted block">LinkedIn</span>
                      <span className="font-medium text-primary truncate block">
                        {extractedData?.personalInfo.linkedinUrl || (
                          <span className="text-text-muted italic">Not detected</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Professional Summary */}
          <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-xs">
            <div className="p-3.5 bg-surface-subtle/80 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-text-primary">
                    2. Professional Summary
                  </span>
                  {renderConfidenceBadge(
                    extractedData?.confidence.summary || 'high',
                    extractedData?.professionalSummary.summaryText
                      ? `${extractedData.professionalSummary.summaryText.length} chars detected`
                      : 'No summary detected'
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ActionPill
                  currentValue={actions.summary}
                  onChange={(v) =>
                    setActions((prev) => ({
                      ...prev,
                      summary: v as 'replace' | 'keep',
                    }))
                  }
                  options={[
                    {
                      label: 'Replace existing',
                      value: 'replace',
                      desc: 'Use the extracted bio summary',
                    },
                    {
                      label: 'Keep existing',
                      value: 'keep',
                      desc: 'Retain current profile summary text',
                    },
                    {
                      label: "Don't import",
                      value: 'keep',
                      desc: 'Skip importing summary from resume',
                    },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand('summary')}
                  className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {expandedSections.summary ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {expandedSections.summary && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-body-sm">
                <div className="p-3.5 rounded-lg border border-border/80 bg-surface space-y-2">
                  <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                    Current Profile Summary
                  </span>
                  <p className="text-text-secondary leading-relaxed text-caption italic">
                    {currentProfile.professionalSummary.summaryText ||
                      '— No existing summary in profile'}
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-blue-200/90 bg-blue-50/30 space-y-2">
                  <span className="text-caption font-semibold uppercase text-blue-900 tracking-wider block">
                    Extracted Resume Summary
                  </span>
                  {extractedData?.professionalSummary.summaryText ? (
                    <p className="text-text-primary leading-relaxed text-caption">
                      {extractedData.professionalSummary.summaryText}
                    </p>
                  ) : (
                    <p className="text-text-muted text-caption italic">
                      No explicit summary statement detected in document.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Target Roles & Seniority */}
          <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-xs">
            <div className="p-3.5 bg-surface-subtle/80 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-text-primary">
                    3. Target Roles & Seniority
                  </span>
                  {renderConfidenceBadge(
                    extractedData?.confidence.roles || 'high',
                    extractedData?.rolePreferences.targetPrimaryTitle || 'Calculated'
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ActionPill
                  currentValue={actions.roles}
                  onChange={(v) =>
                    setActions((prev) => ({
                      ...prev,
                      roles: v as 'replace' | 'keep',
                    }))
                  }
                  options={[
                    { label: 'Replace existing', value: 'replace' },
                    { label: 'Keep existing', value: 'keep' },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand('roles')}
                  className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {expandedSections.roles ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {expandedSections.roles && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-body-sm">
                <div className="p-3.5 rounded-lg border border-border/80 bg-surface space-y-2">
                  <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                    Current Profile Role
                  </span>
                  <div className="space-y-1 text-caption">
                    <div>
                      <span className="text-text-muted block">Target Title:</span>
                      <span className="font-semibold text-text-primary">
                        {currentProfile.rolePreferences.targetPrimaryTitle || '— (Empty)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block">Experience & Level:</span>
                      <span className="text-text-secondary capitalize">
                        {currentProfile.rolePreferences.experienceLevel} (
                        {currentProfile.rolePreferences.totalYearsExperience} yrs)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-blue-200/90 bg-blue-50/30 space-y-2">
                  <span className="text-caption font-semibold uppercase text-blue-900 tracking-wider block">
                    Extracted from Resume
                  </span>
                  <div className="space-y-1 text-caption">
                    <div>
                      <span className="text-text-muted block">
                        Detected Role / Target:
                      </span>
                      <span className="font-bold text-text-primary">
                        {extractedData?.rolePreferences.targetPrimaryTitle || (
                          <span className="text-text-muted italic">Not detected</span>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block">Calculated Seniority:</span>
                      <span className="font-semibold text-text-primary capitalize">
                        {extractedData?.rolePreferences.experienceLevel} (~
                        {extractedData?.rolePreferences.totalYearsExperience} yrs
                        calculated from career dates)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: Core Skills */}
          <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-xs">
            <div className="p-3.5 bg-surface-subtle/80 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-text-primary">
                    4. Core Skills
                  </span>
                  {renderConfidenceBadge(
                    extractedData?.confidence.skills || 'high',
                    `${extractedData?.skills.technicalSkills?.length || 0} skills detected`
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ActionPill
                  currentValue={actions.skills}
                  onChange={(v) =>
                    setActions((prev) => ({
                      ...prev,
                      skills: v as 'merge' | 'replace' | 'keep',
                    }))
                  }
                  options={[
                    {
                      label: 'Add / Merge (No Dups)',
                      value: 'merge',
                      desc: 'Combine extracted skills with existing skills',
                    },
                    {
                      label: 'Replace existing',
                      value: 'replace',
                      desc: 'Use only the extracted skills from resume',
                    },
                    {
                      label: 'Keep existing',
                      value: 'keep',
                      desc: 'Leave existing skills unchanged',
                    },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand('skills')}
                  className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {expandedSections.skills ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {expandedSections.skills && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-body-sm">
                <div className="p-3.5 rounded-lg border border-border/80 bg-surface space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-semibold uppercase text-text-muted tracking-wider">
                      Current Profile Skills (
                      {currentProfile.skills.technicalSkills.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentProfile.skills.technicalSkills.length === 0 ? (
                      <span className="text-caption text-text-muted italic">
                        No skills currently in profile
                      </span>
                    ) : (
                      currentProfile.skills.technicalSkills.map((s) => (
                        <Badge key={s} variant="neutral" size="sm">
                          {s}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-blue-200/90 bg-blue-50/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-semibold uppercase text-blue-900 tracking-wider">
                      Extracted Resume Skills (
                      {extractedData?.skills.technicalSkills?.length || 0})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {extractedData?.skills.technicalSkills &&
                    extractedData.skills.technicalSkills.length > 0 ? (
                      extractedData.skills.technicalSkills.map((s) => (
                        <Badge key={s} variant="primary" size="sm">
                          {s}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-caption text-text-muted italic">
                        No technical skills detected in document
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5: Tools & Platforms */}
          <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-xs">
            <div className="p-3.5 bg-surface-subtle/80 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                  <Wrench className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-text-primary">
                    5. Tools & Platforms
                  </span>
                  {renderConfidenceBadge(
                    extractedData?.confidence.tools || 'high',
                    `${extractedData?.skills.toolsAndPlatforms?.length || 0} tools detected`
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ActionPill
                  currentValue={actions.tools}
                  onChange={(v) =>
                    setActions((prev) => ({
                      ...prev,
                      tools: v as 'merge' | 'replace' | 'keep',
                    }))
                  }
                  options={[
                    { label: 'Add / Merge', value: 'merge' },
                    { label: 'Replace existing', value: 'replace' },
                    { label: 'Keep existing', value: 'keep' },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand('tools')}
                  className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {expandedSections.tools ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {expandedSections.tools && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-body-sm">
                <div className="p-3.5 rounded-lg border border-border/80 bg-surface space-y-2">
                  <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                    Current Profile Tools (
                    {currentProfile.skills.toolsAndPlatforms.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentProfile.skills.toolsAndPlatforms.length === 0 ? (
                      <span className="text-caption text-text-muted italic">
                        No tools listed in profile
                      </span>
                    ) : (
                      currentProfile.skills.toolsAndPlatforms.map((t) => (
                        <Badge key={t} variant="neutral" size="sm">
                          {t}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-blue-200/90 bg-blue-50/30 space-y-2">
                  <span className="text-caption font-semibold uppercase text-blue-900 tracking-wider block">
                    Extracted Resume Tools (
                    {extractedData?.skills.toolsAndPlatforms?.length || 0})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {extractedData?.skills.toolsAndPlatforms &&
                    extractedData.skills.toolsAndPlatforms.length > 0 ? (
                      extractedData.skills.toolsAndPlatforms.map((t) => (
                        <Badge key={t} variant="accent" size="sm">
                          {t}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-caption text-text-muted italic">
                        No specific tools or platforms detected
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 6: Standard Work Experience */}
          <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-xs">
            <div className="p-3.5 bg-surface-subtle/80 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                  <Briefcase className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-text-primary">
                    6. Professional Experience
                  </span>
                  {renderConfidenceBadge(
                    extractedData?.confidence.experience || 'high',
                    `${standardExtractedRoles.length} roles detected`
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ActionPill
                  currentValue={actions.standardExperience}
                  onChange={(v) =>
                    setActions((prev) => ({
                      ...prev,
                      standardExperience: v as 'replace' | 'merge' | 'keep',
                    }))
                  }
                  options={[
                    { label: 'Replace existing', value: 'replace' },
                    { label: 'Add to existing (Merge)', value: 'merge' },
                    { label: 'Keep existing', value: 'keep' },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand('experience')}
                  className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {expandedSections.experience ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {expandedSections.experience && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-body-sm">
                {/* Left: Existing Roles */}
                <div className="p-3.5 rounded-lg border border-border/80 bg-surface space-y-3">
                  <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                    Current Profile Roles ({currentProfile.workExperience.length})
                  </span>
                  <div className="space-y-3 divide-y divide-border/60">
                    {currentProfile.workExperience.length === 0 ? (
                      <span className="text-caption text-text-muted italic">
                        No work experience currently in profile
                      </span>
                    ) : (
                      currentProfile.workExperience.map((exp) => (
                        <div key={exp.id} className="pt-2 first:pt-0 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-text-primary text-body-sm">
                              {exp.title}
                            </span>
                            <span className="text-caption text-text-muted">
                              {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}
                            </span>
                          </div>
                          <span className="text-caption text-text-secondary block">
                            {exp.company} • {exp.location}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right: Extracted Standard Roles */}
                <div className="p-3.5 rounded-lg border border-blue-200/90 bg-blue-50/30 space-y-3">
                  <span className="text-caption font-semibold uppercase text-blue-900 tracking-wider block">
                    Extracted Resume Roles ({standardExtractedRoles.length})
                  </span>
                  <div className="space-y-3 divide-y divide-blue-200/60">
                    {standardExtractedRoles.length === 0 ? (
                      <span className="text-caption text-text-muted italic">
                        No standard work experience detected in document
                      </span>
                    ) : (
                      standardExtractedRoles.map((exp) => (
                        <div key={exp.id} className="pt-2.5 first:pt-0 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-text-primary text-body-sm">
                              {exp.title}
                            </span>
                            <Badge
                              variant={exp.isCurrent ? 'success' : 'neutral'}
                              size="sm"
                            >
                              {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}
                            </Badge>
                          </div>
                          <span className="text-caption font-medium text-primary block">
                            {exp.company} {exp.location ? `• ${exp.location}` : ''}
                          </span>
                          {exp.keyAchievements && exp.keyAchievements.length > 0 && (
                            <ul className="list-disc list-inside text-caption text-text-secondary space-y-0.5 mt-1">
                              {exp.keyAchievements.slice(0, 2).map((a, i) => (
                                <li key={i} className="line-clamp-2">
                                  {a}
                                </li>
                              ))}
                              {exp.keyAchievements.length > 2 && (
                                <li className="text-text-muted list-none pt-0.5">
                                  + {exp.keyAchievements.length - 2} more bullet points
                                </li>
                              )}
                            </ul>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 7: Entrepreneurial Experience (Distinct & Prominent) */}
          <div className="border border-emerald-300 rounded-xl overflow-hidden bg-surface shadow-xs">
            <div className="p-3.5 bg-emerald-50/70 border-b border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-emerald-600 text-white">
                  <Rocket className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-emerald-950">
                    7. Entrepreneurial Experience & Ventures
                  </span>
                  <Badge variant="accent" size="sm">
                    {entrepreneurialRoles.length > 0
                      ? `${entrepreneurialRoles.length} venture detected`
                      : 'None detected'}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ActionPill
                  currentValue={actions.entrepreneurialExperience}
                  onChange={(v) =>
                    setActions((prev) => ({
                      ...prev,
                      entrepreneurialExperience: v as 'merge' | 'keep',
                    }))
                  }
                  options={[
                    {
                      label: 'Import into Work Experience (Tagged)',
                      value: 'merge',
                      desc: 'Save venture to profile work experience with Entrepreneurial badge',
                    },
                    {
                      label: "Don't import",
                      value: 'keep',
                      desc: 'Exclude entrepreneurial venture from profile',
                    },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand('entrepreneurial')}
                  className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {expandedSections.entrepreneurial ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {expandedSections.entrepreneurial && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-body-sm">
                <div className="p-3.5 rounded-lg border border-border/80 bg-surface space-y-2">
                  <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                    Current Profile Ventures
                  </span>
                  <div className="text-caption text-text-secondary">
                    {currentProfile.workExperience.some((e) =>
                      e.title.includes('[Entrepreneurial]')
                    ) ? (
                      <span className="text-emerald-700 font-medium">
                        Existing entrepreneurial venture present in profile
                      </span>
                    ) : (
                      <span className="text-text-muted italic">
                        No entrepreneurial venture currently in profile
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-semibold uppercase text-emerald-900 tracking-wider">
                      Extracted Venture Details
                    </span>
                    <Badge variant="accent" size="sm">
                      Entrepreneurial Venture
                    </Badge>
                  </div>
                  {entrepreneurialRoles.length === 0 ? (
                    <span className="text-caption text-text-muted italic">
                      No entrepreneurial or founder experience detected in resume
                    </span>
                  ) : (
                    entrepreneurialRoles.map((exp) => (
                      <div key={exp.id} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-950 text-body-sm">
                            {exp.title.replace(/\s*\[Entrepreneurial\]/g, '')}
                          </span>
                          <span className="text-caption text-text-muted">
                            {exp.startDate} – {exp.isCurrent ? 'Present' : exp.endDate}
                          </span>
                        </div>
                        <span className="text-caption font-semibold text-emerald-800 block">
                          {exp.company} {exp.location ? `• ${exp.location}` : ''}
                        </span>
                        {exp.keyAchievements && exp.keyAchievements.length > 0 && (
                          <ul className="list-disc list-inside text-caption text-text-secondary space-y-1 mt-1">
                            {exp.keyAchievements.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 8: Education */}
          <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-xs">
            <div className="p-3.5 bg-surface-subtle/80 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-text-primary">
                    8. Education
                  </span>
                  {renderConfidenceBadge(
                    extractedData?.confidence.education || 'high',
                    `${extractedData?.education.length || 0} degree detected`
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ActionPill
                  currentValue={actions.education}
                  onChange={(v) =>
                    setActions((prev) => ({
                      ...prev,
                      education: v as 'replace' | 'merge' | 'keep',
                    }))
                  }
                  options={[
                    { label: 'Replace existing', value: 'replace' },
                    { label: 'Add / Merge', value: 'merge' },
                    { label: 'Keep existing', value: 'keep' },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand('education')}
                  className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {expandedSections.education ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {expandedSections.education && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-body-sm">
                <div className="p-3.5 rounded-lg border border-border/80 bg-surface space-y-2">
                  <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                    Current Profile Education ({currentProfile.education.length})
                  </span>
                  <div className="space-y-2">
                    {currentProfile.education.length === 0 ? (
                      <span className="text-caption text-text-muted italic">
                        No education records in profile
                      </span>
                    ) : (
                      currentProfile.education.map((edu) => (
                        <div key={edu.id} className="text-caption space-y-0.5">
                          <span className="font-semibold text-text-primary block">
                            {edu.degree}{' '}
                            {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}
                          </span>
                          <span className="text-text-muted">
                            {edu.institution} {edu.endDate ? `• ${edu.endDate}` : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-blue-200/90 bg-blue-50/30 space-y-2">
                  <span className="text-caption font-semibold uppercase text-blue-900 tracking-wider block">
                    Extracted Education ({extractedData?.education.length || 0})
                  </span>
                  <div className="space-y-2">
                    {extractedData?.education && extractedData.education.length > 0 ? (
                      extractedData.education.map((edu) => (
                        <div key={edu.id} className="text-caption space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-text-primary">
                              {edu.degree}{' '}
                              {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ''}
                            </span>
                            <span className="text-caption text-text-muted">
                              {edu.endDate}
                            </span>
                          </div>
                          <span className="font-medium text-primary block">
                            {edu.institution}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-caption text-text-muted italic">
                        No education records detected in document
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 9: Languages */}
          <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-xs">
            <div className="p-3.5 bg-surface-subtle/80 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                  <Globe className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-text-primary">
                    9. Languages
                  </span>
                  {renderConfidenceBadge(
                    extractedData?.confidence.languages || 'high',
                    `${detectedLanguages.length} detected`
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ActionPill
                  currentValue={actions.languages}
                  onChange={(v) =>
                    setActions((prev) => ({
                      ...prev,
                      languages: v as 'merge' | 'replace' | 'keep',
                    }))
                  }
                  options={[
                    { label: 'Add / Merge', value: 'merge' },
                    { label: 'Replace existing', value: 'replace' },
                    { label: 'Keep existing', value: 'keep' },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand('languages')}
                  className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {expandedSections.languages ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {expandedSections.languages && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-body-sm">
                <div className="p-3.5 rounded-lg border border-border/80 bg-surface space-y-2">
                  <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                    Current Profile Languages ({currentProfile.skills.languages.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {currentProfile.skills.languages.length === 0 ? (
                      <span className="text-caption text-text-muted italic">
                        No languages currently listed
                      </span>
                    ) : (
                      currentProfile.skills.languages.map((l) => (
                        <div
                          key={l.id}
                          className="px-2.5 py-1 rounded-md bg-surface-subtle border border-border text-caption flex items-center gap-1.5"
                        >
                          <span className="font-semibold text-text-primary">
                            {l.language}
                          </span>
                          <span className="text-text-muted capitalize">
                            · {l.proficiency}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-blue-200/90 bg-blue-50/30 space-y-2">
                  <span className="text-caption font-semibold uppercase text-blue-900 tracking-wider block">
                    Extracted Resume Languages ({detectedLanguages.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {detectedLanguages.length > 0 ? (
                      detectedLanguages.map((l) => (
                        <div
                          key={l.id}
                          className="px-2.5 py-1 rounded-md bg-white border border-blue-200 text-caption flex items-center gap-1.5 shadow-xs"
                        >
                          <span className="font-bold text-text-primary">
                            {l.language}
                          </span>
                          <span className="text-primary font-medium capitalize">
                            · {l.proficiency}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-caption text-text-muted italic">
                        No specific languages section detected in document
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 10: Certifications */}
          <div className="border border-border rounded-xl overflow-hidden bg-surface shadow-xs">
            <div className="p-3.5 bg-surface-subtle/80 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-md bg-primary-soft text-primary">
                  <Award className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-body-sm font-bold text-text-primary">
                    10. Certifications
                  </span>
                  {renderConfidenceBadge(
                    extractedData?.confidence.certifications || 'none',
                    extractedData?.certifications.length
                      ? `${extractedData.certifications.length} credentials detected`
                      : '0 detected · Verified absent'
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <ActionPill
                  currentValue={actions.certifications}
                  onChange={(v) =>
                    setActions((prev) => ({
                      ...prev,
                      certifications: v as 'replace' | 'merge' | 'keep',
                    }))
                  }
                  options={[
                    { label: 'Replace existing', value: 'replace' },
                    { label: 'Add / Merge', value: 'merge' },
                    { label: 'Keep existing', value: 'keep' },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => toggleExpand('certs')}
                  className="p-1 rounded text-text-muted hover:text-text-primary cursor-pointer"
                >
                  {expandedSections.certs ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {expandedSections.certs && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-body-sm">
                <div className="p-3.5 rounded-lg border border-border/80 bg-surface space-y-2">
                  <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block">
                    Current Profile Certifications ({currentProfile.certifications.length}
                    )
                  </span>
                  <div className="space-y-1.5">
                    {currentProfile.certifications.length === 0 ? (
                      <span className="text-caption text-text-muted italic">
                        No certifications in profile
                      </span>
                    ) : (
                      currentProfile.certifications.map((c) => (
                        <div key={c.id} className="text-caption space-y-0.5">
                          <span className="font-semibold text-text-primary block">
                            {c.name}
                          </span>
                          <span className="text-text-muted">{c.issuingOrganization}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                  <span className="text-caption font-semibold uppercase text-slate-700 tracking-wider block">
                    Extracted Certifications ({extractedData?.certifications.length || 0})
                  </span>
                  {extractedData?.certifications &&
                  extractedData.certifications.length > 0 ? (
                    extractedData.certifications.map((cert) => (
                      <div key={cert.id} className="space-y-0.5 text-caption">
                        <span className="font-bold text-text-primary block">
                          {cert.name}
                        </span>
                        <span className="text-text-secondary">
                          {cert.issuingOrganization}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-1 text-caption">
                      <p className="text-slate-600 font-medium">
                        No certifications detected in document.
                      </p>
                      <p className="text-slate-500 text-caption">
                        Verified: The parser thoroughly checked standard certification
                        headings. Since none are present, existing certifications will
                        remain untouched.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Confirmation Footer */}
          <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 bg-surface py-2 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              Upload Different File
            </Button>

            <div className="flex items-center gap-2.5">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Check className="h-4 w-4" />}
                onClick={handleApply}
                className="font-semibold px-5 shadow-sm cursor-pointer"
              >
                Confirm & Merge into Profile
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
