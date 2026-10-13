import React, { useState, useEffect } from 'react';
import { useProfile } from '@/core/profile';
import { AlertTriangle } from 'lucide-react';
import { ProfileSectionNav } from './components/ProfileSectionNav';
import { ProfileHeroHeader } from './components/ProfileHeroHeader';
import { SummarySection } from './components/SummarySection';
import { RoleAndExperienceSection } from './components/RoleAndExperienceSection';
import { SkillsSection } from './components/SkillsSection';
import { WorkExperienceSection } from './components/WorkExperienceSection';
import { EducationSection } from './components/EducationSection';
import { CertificationsSection } from './components/CertificationsSection';
import { WorkPreferencesSection } from './components/WorkPreferencesSection';
import { CompensationSection } from './components/CompensationSection';
import { AvailabilityAndGoalsSection } from './components/AvailabilityAndGoalsSection';
import { ImportExportModal } from './components/ImportExportModal';
import { ResumeImportModal } from './components/ResumeImportModal';

export const ProfilePage: React.FC = () => {
  const {
    profile,
    updateSection,
    saveFullProfile,
    resetProfile,
    exportJson,
    importJson,
    downloadJsonFile,
    completionScore,
    completenessDetails,
    setHasUnsavedChanges,
  } = useProfile();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [dirtySections, setDirtySections] = useState<Record<string, boolean>>({});

  const handleDirtyChange = (sectionKey: string, isDirty: boolean) => {
    setDirtySections((prev) => {
      const updated = { ...prev, [sectionKey]: isDirty };
      const hasDirty = Object.values(updated).some(Boolean);
      setHasUnsavedChanges(hasDirty);
      return updated;
    });
  };

  const hasAnyUnsaved = Object.values(dirtySections).some(Boolean);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasAnyUnsaved) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasAnyUnsaved]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Unsaved Changes Banner */}
      {hasAnyUnsaved && (
        <div
          role="alert"
          className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-body-sm flex items-center justify-between animate-fadeIn"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              You have unsaved changes in an active editing section. Be sure to click Save
              to record your updates.
            </span>
          </div>
        </div>
      )}

      {/* Full-Width Profile Hero Header (Primary Visual Starting Point) */}
      <ProfileHeroHeader
        personalInfo={profile.personalInfo}
        availabilityStatus={profile.availability.availabilityStatus}
        completionScore={completionScore}
        onSavePersonalInfo={(updated) => updateSection('personalInfo', updated)}
        onUpdateAvailabilityStatus={(newStatus) => {
          updateSection('availability', {
            ...profile.availability,
            availabilityStatus: newStatus,
          });
        }}
        onOpenResumeImport={() => setIsResumeModalOpen(true)}
        onOpenDataBackup={() => setIsModalOpen(true)}
      />

      {/* Compact Sticky Horizontal Section Navigation Bar */}
      <ProfileSectionNav
        completionScore={completionScore}
        completenessDetails={completenessDetails}
      />

      {/* Form Sections - Full Width Modern SaaS Stack */}
      <div className="space-y-6 sm:space-y-8 w-full">
        <SummarySection
          data={profile.professionalSummary}
          onSave={(updated) => updateSection('professionalSummary', updated)}
          onDirtyChange={(dirty) => handleDirtyChange('professionalSummary', dirty)}
        />

        <RoleAndExperienceSection
          data={profile.rolePreferences}
          onSave={(updated) => updateSection('rolePreferences', updated)}
          onDirtyChange={(dirty) => handleDirtyChange('rolePreferences', dirty)}
        />

        <SkillsSection
          data={profile.skills}
          onSave={(updated) => updateSection('skills', updated)}
          onDirtyChange={(dirty) => handleDirtyChange('skills', dirty)}
        />

        <WorkExperienceSection
          items={profile.workExperience}
          onSave={(updated) => updateSection('workExperience', updated)}
          onDirtyChange={(dirty) => handleDirtyChange('workExperience', dirty)}
        />

        <EducationSection
          items={profile.education}
          onSave={(updated) => updateSection('education', updated)}
          onDirtyChange={(dirty) => handleDirtyChange('education', dirty)}
        />

        <CertificationsSection
          items={profile.certifications}
          onSave={(updated) => updateSection('certifications', updated)}
          onDirtyChange={(dirty) => handleDirtyChange('certifications', dirty)}
        />

        <WorkPreferencesSection
          preferences={profile.workPreferences}
          auth={profile.locationAndAuth}
          onSave={(updatedPrefs, updatedAuth) => {
            saveFullProfile({
              ...profile,
              workPreferences: updatedPrefs,
              locationAndAuth: updatedAuth,
            });
          }}
          onDirtyChange={(dirty) => handleDirtyChange('workPreferences', dirty)}
        />

        <CompensationSection
          data={profile.compensation}
          onSave={(updated) => updateSection('compensation', updated)}
          onDirtyChange={(dirty) => handleDirtyChange('compensation', dirty)}
        />

        <AvailabilityAndGoalsSection
          availability={profile.availability}
          careerGoals={profile.careerGoals}
          targetMarkets={profile.targetMarkets}
          onSave={(updatedAvail, updatedGoals, updatedMarkets) => {
            saveFullProfile({
              ...profile,
              availability: updatedAvail,
              careerGoals: updatedGoals,
              targetMarkets: updatedMarkets,
            });
          }}
          onDirtyChange={(dirty) => handleDirtyChange('goals', dirty)}
        />
      </div>

      {/* JSON Import / Export / Reset Modal */}
      <ImportExportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        exportJson={exportJson}
        importJson={importJson}
        downloadJsonFile={downloadJsonFile}
        resetProfile={resetProfile}
      />

      {/* Structured Resume Import & Review Modal */}
      <ResumeImportModal
        isOpen={isResumeModalOpen}
        onClose={() => setIsResumeModalOpen(false)}
        currentProfile={profile}
        onApplyProfile={(updatedProfile) => saveFullProfile(updatedProfile)}
      />
    </div>
  );
};
