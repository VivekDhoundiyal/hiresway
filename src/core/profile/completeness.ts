import { UserProfile, ProfileCompletenessDetails, SectionCompleteness } from './types';

export function calculateProfileCompleteness(
  profile: UserProfile
): ProfileCompletenessDetails {
  const sections: Record<string, SectionCompleteness> = {};
  const recommendations: string[] = [];

  // 1. Personal Info (20 pts)
  let piScore = 0;
  if (profile.personalInfo.fullName.trim()) piScore += 4;
  else recommendations.push('Add your full name (+4%)');

  if (profile.personalInfo.email.trim()) piScore += 4;
  else recommendations.push('Add your email address (+4%)');

  if (profile.personalInfo.phone.trim()) piScore += 2;
  if (profile.personalInfo.city.trim() && profile.personalInfo.country.trim())
    piScore += 3;
  if (profile.personalInfo.headline.trim()) piScore += 3;
  else recommendations.push('Add a professional headline (+3%)');

  if (profile.personalInfo.avatarUrl) piScore += 2;
  else recommendations.push('Upload a profile picture (+2%)');

  if (profile.personalInfo.linkedinUrl || profile.personalInfo.githubUrl) piScore += 2;

  sections['personal-info'] = {
    id: 'personal-info',
    label: 'Personal Info',
    score: piScore,
    maxScore: 20,
    percentage: Math.round((piScore / 20) * 100),
    isComplete: piScore >= 16,
  };

  // 2. Summary (10 pts)
  let sumScore = 0;
  if (profile.professionalSummary.summaryText.trim().length >= 40) sumScore += 6;
  else recommendations.push('Add a concise professional summary bio (+6%)');

  if (profile.professionalSummary.keyHighlights.length >= 1) sumScore += 4;
  else recommendations.push('Add at least 1 key career highlight bullet (+4%)');

  sections['summary'] = {
    id: 'summary',
    label: 'Summary',
    score: sumScore,
    maxScore: 10,
    percentage: Math.round((sumScore / 10) * 100),
    isComplete: sumScore >= 8,
  };

  // 3. Target Roles (10 pts)
  let roleScore = 0;
  if (profile.rolePreferences.targetPrimaryTitle.trim()) roleScore += 4;
  else recommendations.push('Specify your target primary job title (+4%)');

  if (profile.rolePreferences.targetJobTitles.length >= 1) roleScore += 3;
  if (
    profile.rolePreferences.experienceLevel &&
    profile.rolePreferences.totalYearsExperience > 0
  )
    roleScore += 3;

  sections['roles'] = {
    id: 'roles',
    label: 'Target Roles',
    score: roleScore,
    maxScore: 10,
    percentage: Math.round((roleScore / 10) * 100),
    isComplete: roleScore >= 7,
  };

  // 4. Skills & Tools (15 pts)
  let skillScore = 0;
  if (profile.skills.technicalSkills.length >= 3) skillScore += 6;
  else recommendations.push('Add at least 3 technical skills (+6%)');

  if (profile.skills.softSkills.length >= 2) skillScore += 3;
  if (profile.skills.toolsAndPlatforms.length >= 2) skillScore += 3;
  if (profile.skills.languages.length >= 1) skillScore += 3;

  sections['skills'] = {
    id: 'skills',
    label: 'Skills & Tools',
    score: skillScore,
    maxScore: 15,
    percentage: Math.round((skillScore / 15) * 100),
    isComplete: skillScore >= 12,
  };

  // 5. Work Experience (20 pts)
  let expScore = 0;
  if (profile.workExperience.length >= 1) {
    expScore += 10;
    const totalAchievements = profile.workExperience.reduce(
      (sum, item) => sum + (item.keyAchievements?.length || 0),
      0
    );
    if (totalAchievements >= 2) expScore += 5;
    else recommendations.push('Add bullet achievements to your work experiences (+5%)');

    const hasSkills = profile.workExperience.some(
      (item) => item.skillsUsed && item.skillsUsed.length > 0
    );
    if (hasSkills) expScore += 5;
  } else {
    recommendations.push('Add your work experience history (+20%)');
  }

  sections['experience'] = {
    id: 'experience',
    label: 'Work Experience',
    score: expScore,
    maxScore: 20,
    percentage: Math.round((expScore / 20) * 100),
    isComplete: expScore >= 15,
  };

  // 6. Education (10 pts)
  let eduScore = 0;
  if (profile.education.length >= 1) {
    eduScore = 10;
  } else {
    recommendations.push('Add your education credentials (+10%)');
  }

  sections['education'] = {
    id: 'education',
    label: 'Education',
    score: eduScore,
    maxScore: 10,
    percentage: Math.round((eduScore / 10) * 100),
    isComplete: eduScore >= 10,
  };

  // 7. Certifications (5 pts)
  let certScore = 0;
  if (profile.certifications.length >= 1) {
    certScore = 5;
  }

  sections['certifications'] = {
    id: 'certifications',
    label: 'Certifications',
    score: certScore,
    maxScore: 5,
    percentage: Math.round((certScore / 5) * 100),
    isComplete: certScore >= 5,
  };

  // 8. Work Preferences & Authorization (5 pts)
  let prefScore = 0;
  if (profile.workPreferences.workplaceTypes.length >= 1) prefScore += 2;
  if (profile.workPreferences.employmentTypes.length >= 1) prefScore += 1;
  if (profile.locationAndAuth.workAuthorizationStatus) prefScore += 2;

  sections['preferences'] = {
    id: 'preferences',
    label: 'Work Preferences',
    score: prefScore,
    maxScore: 5,
    percentage: Math.round((prefScore / 5) * 100),
    isComplete: prefScore >= 4,
  };

  // 9. Compensation (5 pts)
  let compScore = 0;
  if (profile.compensation.minBaseSalary > 0 || profile.compensation.targetBaseSalary > 0)
    compScore += 4;
  else recommendations.push('Set your salary expectations (+4%)');

  if (profile.compensation.expectedBonusPercent > 0 || profile.compensation.openToEquity)
    compScore += 1;

  sections['compensation'] = {
    id: 'compensation',
    label: 'Compensation',
    score: compScore,
    maxScore: 5,
    percentage: Math.round((compScore / 5) * 100),
    isComplete: compScore >= 4,
  };

  // 10. Availability & Goals (5 pts)
  let goalScore = 0;
  if (profile.availability.availabilityStatus) goalScore += 2;
  if (profile.availability.noticePeriod) goalScore += 1;
  if (
    profile.targetMarkets.targetIndustries.length > 0 ||
    profile.targetMarkets.targetCompanies.length > 0
  )
    goalScore += 1;
  if (profile.careerGoals.shortTermGoals || profile.careerGoals.longTermVision)
    goalScore += 1;

  sections['goals'] = {
    id: 'goals',
    label: 'Availability & Goals',
    score: goalScore,
    maxScore: 5,
    percentage: Math.round((goalScore / 5) * 100),
    isComplete: goalScore >= 4,
  };

  const totalScore = Math.min(
    100,
    piScore +
      sumScore +
      roleScore +
      skillScore +
      expScore +
      eduScore +
      certScore +
      prefScore +
      compScore +
      goalScore
  );

  // Contradiction detection
  const contradictions: string[] = [];

  // 1. Seniority vs Years of Experience
  const seniorKeywords =
    /staff|principal|director|head of|lead|architect|vp|vice president|chief/i;
  const isSeniorTitle =
    seniorKeywords.test(profile.rolePreferences.targetPrimaryTitle) ||
    seniorKeywords.test(profile.rolePreferences.currentTitle);
  const isSeniorLevel = ['senior', 'lead', 'manager', 'director', 'executive'].includes(
    profile.rolePreferences.experienceLevel
  );

  if (
    (isSeniorTitle || isSeniorLevel) &&
    profile.rolePreferences.totalYearsExperience > 0 &&
    profile.rolePreferences.totalYearsExperience < 3
  ) {
    contradictions.push(
      'Seniority alignment: Senior or leadership roles typically expect 3+ years of professional experience.'
    );
  }

  // 2. Compensation Expectations
  if (
    profile.compensation.minBaseSalary > 0 &&
    profile.compensation.targetBaseSalary > 0 &&
    profile.compensation.minBaseSalary > profile.compensation.targetBaseSalary
  ) {
    contradictions.push(
      'Compensation alignment: Minimum acceptable salary is configured higher than target salary.'
    );
  }

  return {
    totalScore,
    sections,
    recommendations: recommendations.slice(0, 3), // Top 3 actionable recommendations
    contradictions,
  };
}
