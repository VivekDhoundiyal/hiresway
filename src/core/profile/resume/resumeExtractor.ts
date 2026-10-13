import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import {
  PersonalInfo,
  ProfessionalSummary,
  RolePreferences,
  SkillsData,
  WorkExperienceItem,
  EducationItem,
  CertificationItem,
  LanguageSkill,
} from '../types';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type ExtractionConfidence = 'high' | 'medium' | 'low' | 'none';

export interface ExtractedResumeData {
  rawText: string;
  personalInfo: Partial<PersonalInfo>;
  professionalSummary: Partial<ProfessionalSummary>;
  rolePreferences: Partial<RolePreferences>;
  skills: Partial<SkillsData>;
  workExperience: WorkExperienceItem[];
  entrepreneurialExperience?: WorkExperienceItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  languages?: LanguageSkill[];
  confidence: Record<string, ExtractionConfidence>;
  diagnostics: Record<string, string>;
}

/**
 * Extract raw text from uploaded resume file (PDF, DOC, DOCX, TXT)
 * Uses layout-aware vertical/horizontal sorting for PDFs to preserve
 * true visual lines, section headers, bullet lists, and paragraphs.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (extension === 'txt') {
    return await file.text();
  }

  const arrayBuffer = await file.arrayBuffer();

  if (extension === 'pdf') {
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        useSystemFonts: true,
      });
      const pdf = await loadingTask.promise;
      const fullDocumentLines: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Extract items that contain text
        const items = textContent.items.filter(
          (item: unknown) =>
            typeof item === 'object' &&
            item !== null &&
            'str' in item &&
            String((item as { str: unknown }).str).trim().length > 0
        ) as Array<{ str: string; transform: number[]; width?: number; height?: number }>;

        if (items.length === 0) continue;

        // Sort items: Y descending (top to bottom), then X ascending (left to right)
        // PDF Y coordinates count upwards from bottom, so higher Y is higher on page.
        const sorted = [...items].sort((a, b) => {
          const yA = a.transform[5];
          const yB = b.transform[5];
          // Cluster items on the same visual line (within 4pt vertical tolerance)
          if (Math.abs(yA - yB) > 4) {
            return yB - yA;
          }
          return a.transform[4] - b.transform[4];
        });

        let currentLine: typeof items = [];
        let currentY: number | null = null;
        const pageLines: string[] = [];

        for (const item of sorted) {
          const y = item.transform[5];
          if (currentY === null) {
            currentY = y;
            currentLine.push(item);
          } else if (Math.abs(y - currentY) <= 4) {
            currentLine.push(item);
          } else {
            // Sort current line items left-to-right
            currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
            pageLines.push(
              currentLine
                .map((it) => it.str)
                .join(' ')
                .trim()
            );
            currentLine = [item];
            currentY = y;
          }
        }

        if (currentLine.length > 0) {
          currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
          pageLines.push(
            currentLine
              .map((it) => it.str)
              .join(' ')
              .trim()
          );
        }

        fullDocumentLines.push(...pageLines);
      }

      const fullText = fullDocumentLines.join('\n');
      if (fullText.trim().length > 30) {
        return fullText;
      }
    } catch {
      // Fallback: direct ASCII/UTF-8 extraction from PDF buffer
      return extractReadableStringsFromBuffer(arrayBuffer);
    }
  }

  if (extension === 'docx') {
    try {
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (result.value && result.value.trim().length > 30) {
        return result.value.replace(/\r\n/g, '\n');
      }
    } catch {
      return extractReadableStringsFromBuffer(arrayBuffer);
    }
  }

  if (extension === 'doc') {
    return extractTextFromBinaryDoc(arrayBuffer);
  }

  return extractReadableStringsFromBuffer(arrayBuffer);
}

/**
 * Text extractor for binary legacy Word (.doc) and raw buffers
 */
function extractTextFromBinaryDoc(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let text = '';

  for (let i = 0; i < bytes.length - 1; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if ((code >= 32 && code <= 126) || code === 10 || code === 13) {
      text += String.fromCharCode(code);
    } else if (text.length > 0 && !text.endsWith(' ')) {
      text += ' ';
    }
  }

  if (text.replace(/\s+/g, ' ').trim().length >= 40) {
    return text.replace(/\r\n/g, '\n');
  }

  return extractReadableStringsFromBuffer(buffer);
}

function extractReadableStringsFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  let currentWord = '';

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      currentWord += String.fromCharCode(b);
    } else {
      if (currentWord.trim().length >= 2) {
        result += currentWord + ' ';
      }
      currentWord = '';
    }
  }

  if (currentWord.trim().length >= 2) {
    result += currentWord;
  }

  return result.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n');
}

/**
 * Broad Known Tools Reference Taxonomy
 */
const KNOWN_TOOLS_TAXONOMY = [
  'Zoho CRM',
  'Salesforce',
  'HubSpot',
  'Monday',
  'Monday.com',
  'Apollo',
  'Apollo.io',
  'Lusha',
  'ClickUp',
  'Notion',
  'Jira',
  'Confluence',
  'Slack',
  'LinkedIn',
  'ChatGPT',
  'Perplexity',
  'Gemini',
  'Claude',
  'Figma',
  'Canva',
  'Postman',
  'VS Code',
  'Git',
  'GitHub',
  'GitLab',
  'Docker',
  'Kubernetes',
  'AWS',
  'Google Analytics',
  'Tableau',
  'Power BI',
  'Excel',
  'Google Sheets',
  'Zendesk',
  'Intercom',
];

const MONTHS_MAP: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

function normalizeDate(monthStr?: string, yearStr?: string): string {
  if (!yearStr) return '';
  if (!monthStr) return yearStr;
  const cleanM = monthStr.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const mNum =
    MONTHS_MAP[cleanM] || (/^\d+$/.test(cleanM) ? cleanM.padStart(2, '0') : '');
  return mNum ? `${yearStr}-${mNum}` : yearStr;
}

/**
 * Parse raw multi-line text into structured CareerOs profile fields
 * generically across various industries (Sales, Tech, Ops, Design, Founder).
 */
export function parseResumeText(rawText: string): ExtractedResumeData {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const confidence: Record<string, ExtractionConfidence> = {};
  const diagnostics: Record<string, string> = {};

  // 1. Personal Information Extraction
  const personalInfo: Partial<PersonalInfo> = {};

  // Email
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;
  const emailMatch = rawText.match(emailRegex);
  if (emailMatch) {
    personalInfo.email = emailMatch[0];
  }

  // Phone: handles (+91) 750-301-6766, +1-555-234-5678, (555) 000-0000, 123.456.7890
  const phoneRegex =
    /(?:\(\+\d{1,4}\)[-.\s]*)?\d{3,4}[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{1,4}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/;
  const phoneMatch = rawText.match(phoneRegex);
  if (phoneMatch) {
    personalInfo.phone = phoneMatch[0].trim();
  }

  // LinkedIn
  const linkedinRegex =
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)|Linkedin\/([a-zA-Z0-9_-]+)/i;
  const linkedinMatch = rawText.match(linkedinRegex);
  if (linkedinMatch) {
    const handle = linkedinMatch[1] || linkedinMatch[2];
    personalInfo.linkedinUrl = `https://linkedin.com/in/${handle}`;
  }

  // GitHub
  const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i;
  const githubMatch = rawText.match(githubRegex);
  if (githubMatch) {
    personalInfo.githubUrl = githubMatch[0].startsWith('http')
      ? githubMatch[0]
      : `https://${githubMatch[0]}`;
  }

  // Portfolio / Website
  const portfolioRegex =
    /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9_-]+\.(?:io|dev|me|design|tech|app))(?:\/[^\s]*)?/i;
  const portfolioMatch = rawText.match(portfolioRegex);
  if (portfolioMatch) {
    personalInfo.portfolioUrl = portfolioMatch[0].startsWith('http')
      ? portfolioMatch[0]
      : `https://${portfolioMatch[0]}`;
  }

  // Full Name detection: check first 5 lines for candidate name
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i];
    if (
      line.length >= 2 &&
      line.length <= 40 &&
      !line.includes('@') &&
      !line.includes('http') &&
      !line.includes('.com') &&
      !/\d/.test(line) &&
      !/resume|curriculum|vitae|profile|summary|experience|education|contact/i.test(line)
    ) {
      personalInfo.fullName = line.replace(/^[#*•\s]+/, '').trim();
      break;
    }
  }

  // Location detection: looks for "Location: City, Country" or "City, State" patterns
  const locLabeledMatch = rawText.match(/Location:\s*([A-Za-z\s,.-]+?)(?:\(|\n|\||$)/i);
  if (locLabeledMatch) {
    const locParts = locLabeledMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    personalInfo.city = locParts[0] || '';
    personalInfo.country = locParts[1] || '';
  } else {
    // Standard city/state regex
    const locationRegex = /\b([A-Z][a-zA-Z\s.-]+),\s*([A-Z]{2}|[A-Z][a-zA-Z]+)\b/;
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const match = lines[i].match(locationRegex);
      if (match && !/University|College|Institute|Company|Solutions/i.test(lines[i])) {
        personalInfo.city = match[1].trim();
        personalInfo.stateProvince = match[2].trim();
        personalInfo.country = match[2].length === 2 ? 'United States' : match[2].trim();
        break;
      }
    }
  }

  // 2. Generic Semantic Section Recognition
  const sectionPatterns: Array<{ name: string; regex: RegExp }> = [
    {
      name: 'summary',
      regex:
        /^(?:professional\s+|career\s+|executive\s+)?(?:summary|profile|about\s+me|about|overview|objective|career\s+objective)\b/i,
    },
    {
      name: 'core_skills',
      regex:
        /^(?:core\s+|key\s+|technical\s+|professional\s+)?(?:skills|competencies|core\s+competencies|expertise|areas\s+of\s+expertise|technologies)\b/i,
    },
    {
      name: 'tools',
      regex:
        /^(?:tools|platforms|tools\s+&\s+platforms|technologies\s+&\s+tools|tech\s+stack|software\s+&\s+tools)\b/i,
    },
    {
      name: 'experience',
      regex:
        /^(?:professional\s+|work\s+|career\s+)?(?:experience|employment|employment\s+history|career\s+history|work\s+history|relevant\s+experience)\b/i,
    },
    {
      name: 'entrepreneurial',
      regex:
        /^(?:entrepreneurial\s+experience|entrepreneurship|ventures|startups|founder\s+experience)\b/i,
    },
    {
      name: 'education',
      regex:
        /^(?:education|academic\s+background|academic\s+qualifications|qualifications|education\s+&\s+training)\b/i,
    },
    {
      name: 'certifications',
      regex:
        /^(?:certifications|certificates|licenses|licenses\s+&\s+certifications|professional\s+certifications|accreditations)\b/i,
    },
    {
      name: 'languages',
      regex: /^(?:languages|language\s+skills|language\s+proficiency)\b/i,
    },
  ];

  const sectionIndices: Array<{ name: string; index: number; header: string }> = [];

  lines.forEach((line, idx) => {
    // Only test lines that look like section headings (<= 45 chars, no bullets, not an email/link)
    if (
      line.length <= 45 &&
      !line.startsWith('●') &&
      !line.startsWith('•') &&
      !line.startsWith('-') &&
      !line.includes('@') &&
      !line.includes('http')
    ) {
      for (const pattern of sectionPatterns) {
        if (pattern.regex.test(line)) {
          sectionIndices.push({ name: pattern.name, index: idx, header: line });
          break;
        }
      }
    }
  });

  const getSectionLines = (name: string): string[] => {
    const idx = sectionIndices.findIndex((s) => s.name === name);
    if (idx === -1) return [];
    const start = sectionIndices[idx].index + 1;
    const end =
      idx + 1 < sectionIndices.length ? sectionIndices[idx + 1].index : lines.length;
    return lines.slice(start, end);
  };

  // 3. Professional Summary
  const professionalSummary: Partial<ProfessionalSummary> = {};
  const summaryLines = getSectionLines('summary');

  if (summaryLines.length > 0) {
    const bioParagraphs = summaryLines
      .filter((l) => !l.startsWith('●') && !l.startsWith('•') && !l.startsWith('-'))
      .join(' ');

    if (bioParagraphs.trim().length >= 15) {
      professionalSummary.summaryText = bioParagraphs.trim();
    }

    const summaryBullets = summaryLines
      .filter(
        (l) =>
          l.startsWith('●') || l.startsWith('•') || l.startsWith('-') || l.startsWith('*')
      )
      .map((l) => l.replace(/^[●•\-*]\s*/, '').trim())
      .filter((b) => b.length > 5);

    if (summaryBullets.length > 0) {
      professionalSummary.keyHighlights = summaryBullets;
    }

    confidence.summary = 'high';
    diagnostics.summary = 'Professional summary detected from resume';
  } else {
    confidence.summary = 'none';
    diagnostics.summary = 'No summary section detected in document';
  }

  // 4. Skills & Tools Extraction (Dynamic from Section + Taxonomy)
  const coreSkillLines = getSectionLines('core_skills');
  const toolLines = getSectionLines('tools');

  const detectedTech: Set<string> = new Set();
  const detectedSoft: Set<string> = new Set();
  const detectedTools: Set<string> = new Set();

  // Parse items directly written in Core Skills section
  if (coreSkillLines.length > 0) {
    coreSkillLines.forEach((l) => {
      // Split on bullets, pipes, or commas
      const tokens = l
        .split(/[●•|*]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && t.length <= 45);

      tokens.forEach((token) => {
        // If multiple comma-separated items within a token
        const subItems = token
          .split(/,\s*/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 2);
        subItems.forEach((skill) => {
          // Check if it's a known tool
          const isTool = KNOWN_TOOLS_TAXONOMY.some(
            (tool) => tool.toLowerCase() === skill.toLowerCase()
          );
          if (isTool) {
            detectedTools.add(skill);
          } else {
            detectedTech.add(skill);
          }
        });
      });
    });
  }

  // Parse items directly written in Tools section
  if (toolLines.length > 0) {
    toolLines.forEach((l) => {
      const tokens = l
        .split(/[●•|*]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && t.length <= 40);

      tokens.forEach((token) => {
        const subItems = token
          .split(/,\s*/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 2);
        subItems.forEach((tool) => detectedTools.add(tool));
      });
    });
  }

  // Also scan document for any mention of known tools
  KNOWN_TOOLS_TAXONOMY.forEach((tool) => {
    const escaped = tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(rawText)) {
      detectedTools.add(tool);
    }
  });

  const totalDetectedSkills = detectedTech.size + detectedSoft.size + detectedTools.size;
  if (totalDetectedSkills > 0) {
    confidence.skills = totalDetectedSkills >= 5 ? 'high' : 'medium';
    diagnostics.skills = `${totalDetectedSkills} skills and tools extracted`;
  } else {
    confidence.skills = 'none';
    diagnostics.skills = 'No skills or tools detected in document';
  }

  // 5. Work Experience Extraction (Standard and Entrepreneurial)
  const parseExperienceBlocks = (
    sectionLines: string[],
    isEntrepreneurial: boolean
  ): WorkExperienceItem[] => {
    const items: WorkExperienceItem[] = [];
    const dateRegex =
      /(?:\(?\s*(?:(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2}\/)?\s*(\d{4}))\s*(?:-|–|—|to)\s*(?:(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Sept?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|\d{1,2}\/)?\s*(\d{4}|present|current))\s*\)?)/i;

    let currentItem: Partial<WorkExperienceItem> | null = null;
    let achievements: string[] = [];

    for (let i = 0; i < sectionLines.length; i++) {
      const line = sectionLines[i];
      const dateMatch = line.match(dateRegex);

      if (dateMatch) {
        // Push previous item if valid
        if (currentItem && (currentItem.company || currentItem.title)) {
          items.push({
            id: `exp-${Date.now()}-${items.length}`,
            company: currentItem.company || '',
            title: currentItem.title || '',
            employmentType: isEntrepreneurial ? 'contract' : 'full-time',
            location: currentItem.location || '',
            locationType: currentItem.locationType || 'remote',
            startDate: currentItem.startDate || '',
            endDate: currentItem.endDate || '',
            isCurrent: !!currentItem.isCurrent,
            description: currentItem.description || '',
            keyAchievements: achievements,
            skillsUsed: [],
          });
          achievements = [];
        }

        const isCurrent = /present|current/i.test(dateMatch[4]);
        const startMonth = dateMatch[1];
        const startYear = dateMatch[2];
        const endMonth = dateMatch[3];
        const endYear = isCurrent ? '' : dateMatch[4];

        const formattedStart = normalizeDate(startMonth, startYear);
        const formattedEnd = isCurrent ? '' : normalizeDate(endMonth, endYear);

        // Strip date from line to find title and company
        const matchIdx = dateMatch.index ?? 0;
        const lineWithoutDate = (
          line.substring(0, matchIdx) +
          ' ' +
          line.substring(matchIdx + dateMatch[0].length)
        )
          .replace(/[()|–—-]+$/, '')
          .trim();

        let title = '';
        let company = '';
        let location = '';

        // Check pipe split first: "Role | Company" or "Role – Details | Company"
        const pipeParts = lineWithoutDate.split(/\s*\|\s*/);
        if (pipeParts.length >= 2) {
          title = pipeParts[0].trim();
          company = pipeParts[1].trim();
          if (pipeParts.length >= 3) {
            location = pipeParts[2].trim();
          }
        } else if (pipeParts.length === 1 && pipeParts[0]) {
          // Check "at" split
          const atParts = pipeParts[0].split(/\s+(?:at|@)\s+/i);
          if (atParts.length >= 2) {
            title = atParts[0].trim();
            company = atParts[1].trim();
          } else {
            title = pipeParts[0].trim();
          }
        }

        // If line had no title, look at preceding line
        if (!title && i > 0 && sectionLines[i - 1].length < 70) {
          title = sectionLines[i - 1].trim();
        }

        currentItem = {
          title: isEntrepreneurial && !title ? 'Founder / Co-Founder' : title,
          company,
          location,
          locationType: /hybrid/i.test(line)
            ? 'hybrid'
            : /on-?site/i.test(line)
              ? 'on-site'
              : 'remote',
          startDate: formattedStart,
          endDate: formattedEnd,
          isCurrent,
          description: '',
        };
      } else if (
        line.startsWith('●') ||
        line.startsWith('•') ||
        line.startsWith('-') ||
        line.startsWith('*')
      ) {
        const bullet = line.replace(/^[●•\-*]\s*/, '').trim();
        if (bullet.length >= 5) {
          achievements.push(bullet);
        }
      } else if (currentItem && line.length > 20 && !line.includes('|')) {
        // Descriptive narrative preceding bullet points
        currentItem.description =
          (currentItem.description ? currentItem.description + ' ' : '') + line.trim();
      }
    }

    if (currentItem && (currentItem.company || currentItem.title)) {
      items.push({
        id: `exp-${Date.now()}-${items.length}`,
        company: currentItem.company || '',
        title: currentItem.title || '',
        employmentType: isEntrepreneurial ? 'contract' : 'full-time',
        location: currentItem.location || '',
        locationType: currentItem.locationType || 'remote',
        startDate: currentItem.startDate || '',
        endDate: currentItem.endDate || '',
        isCurrent: !!currentItem.isCurrent,
        description: currentItem.description || '',
        keyAchievements: achievements,
        skillsUsed: [],
      });
    }

    return items;
  };

  const standardExperience = parseExperienceBlocks(getSectionLines('experience'), false);
  const entrepreneurialExperience = parseExperienceBlocks(
    getSectionLines('entrepreneurial'),
    true
  );

  // Combine into canonical work experience with entrepreneurial roles clearly tagged
  const allWorkExperience: WorkExperienceItem[] = [
    ...standardExperience,
    ...entrepreneurialExperience.map((item) => ({
      ...item,
      title: item.title.includes('[Entrepreneurial]')
        ? item.title
        : `${item.title} [Entrepreneurial]`,
    })),
  ];

  if (allWorkExperience.length > 0) {
    confidence.experience = 'high';
    diagnostics.experience = `${standardExperience.length} professional roles and ${entrepreneurialExperience.length} entrepreneurial ventures detected`;
  } else {
    confidence.experience = 'none';
    diagnostics.experience = 'No professional experience entries detected in document';
  }

  // 6. Education Extraction
  const education: EducationItem[] = [];
  const eduLines = getSectionLines('education');
  const degRegex =
    /(?:B\.?Tech|B\.?E|B\.?S|B\.?A|B\.?Com|M\.?Tech|M\.?S|MBA|PhD|Doctorate|Associate|Diploma|Bachelor|Master)/i;
  const eduYearRegex = /\b(20\d{2}|19\d{2})\b/g;

  eduLines.forEach((l) => {
    if (
      degRegex.test(l) ||
      /University|College|Institute|School|Academy|Polytechnic/i.test(l)
    ) {
      const parts = l.split(/\s*\|\s*/);
      const degreePart = parts[0]?.trim() || '';
      const instPart = parts[1]?.trim() || '';
      const yearPart = parts[2]?.trim() || '';

      const degMatch = degreePart.match(degRegex);
      const degree = degMatch ? degMatch[0] : instPart.match(degRegex)?.[0] || 'Degree';
      const field = degreePart
        .replace(degRegex, '')
        .replace(/^[,:\s-]+/, '')
        .trim();
      const years = (yearPart || l).match(eduYearRegex) || [];

      education.push({
        id: `edu-${Date.now()}-${education.length}`,
        institution: instPart || (parts.length === 1 ? l : 'University / College'),
        degree,
        fieldOfStudy: field,
        startDate: years[0] || '',
        endDate: years[1] || (years.length === 1 ? years[0] : ''),
        gradeGpa: '',
        activitiesAndHonors: '',
      });
    }
  });

  if (education.length > 0) {
    confidence.education = 'high';
    diagnostics.education = `${education.length} degree credentials detected`;
  } else {
    confidence.education = 'none';
    diagnostics.education = 'No academic degrees detected in document';
  }

  // 7. Languages Extraction
  const languages: LanguageSkill[] = [];
  const langLines = getSectionLines('languages');
  const inlineLangMatch = rawText.match(/Languages:\s*([^\n\r]+)/i);

  const langTextSources = [
    ...langLines,
    ...(inlineLangMatch ? [inlineLangMatch[1]] : []),
  ];

  langTextSources.forEach((l) => {
    const rawLanguages = l.replace(/^Languages:\s*/i, '').split(/\s*[|•,]\s*/);
    rawLanguages.forEach((item) => {
      const trimmed = item.trim();
      if (trimmed.length >= 2 && trimmed.length <= 40) {
        let proficiency: 'native' | 'fluent' | 'conversational' | 'basic' = 'fluent';
        if (/native|mother/i.test(trimmed)) proficiency = 'native';
        else if (/fluent|professional/i.test(trimmed)) proficiency = 'fluent';
        else if (/conversational|intermediate/i.test(trimmed))
          proficiency = 'conversational';
        else if (/basic|elementary/i.test(trimmed)) proficiency = 'basic';

        const cleanLang = trimmed.replace(/\s*\([^)]+\)/g, '').trim();
        if (
          cleanLang &&
          !languages.some(
            (existing) => existing.language.toLowerCase() === cleanLang.toLowerCase()
          )
        ) {
          languages.push({
            id: `lang-${Date.now()}-${languages.length}`,
            language: cleanLang,
            proficiency,
          });
        }
      }
    });
  });

  if (languages.length > 0) {
    confidence.languages = 'high';
    diagnostics.languages = `${languages.length} languages detected`;
  }

  // 8. Certifications Extraction
  const certifications: CertificationItem[] = [];
  const certLines = getSectionLines('certifications');

  certLines.forEach((line, idx) => {
    if (
      line.length >= 5 &&
      line.length <= 90 &&
      !line.startsWith('●') &&
      !line.startsWith('•')
    ) {
      const parts = line.split(/\s*[-–—|]\s*/);
      const yearMatch = line.match(/\b(20\d{2}|19\d{2})\b/);
      certifications.push({
        id: `cert-${Date.now()}-${idx}`,
        name: parts[0].trim(),
        issuingOrganization: parts[1]?.replace(/\b(20\d{2}|19\d{2})\b/g, '').trim() || '',
        issueDate: yearMatch ? `${yearMatch[0]}-01` : '',
        expirationDate: '',
        doesNotExpire: true,
        credentialId: '',
        credentialUrl: '',
      });
    }
  });

  if (certifications.length > 0) {
    confidence.certifications = 'high';
    diagnostics.certifications = `${certifications.length} certifications detected`;
  } else {
    confidence.certifications = 'none';
    diagnostics.certifications = 'No certifications detected in document';
  }

  // 9. Target Roles & Seniority Detection
  const rolePreferences: Partial<RolePreferences> = {};
  if (allWorkExperience.length > 0 && allWorkExperience[0].title) {
    const cleanTitle = allWorkExperience[0].title.replace(/\s*\[Entrepreneurial\]/g, '');
    rolePreferences.targetPrimaryTitle = cleanTitle;
    rolePreferences.currentTitle = cleanTitle;
    rolePreferences.currentCompany = allWorkExperience[0].company;
  } else if (personalInfo.headline) {
    rolePreferences.targetPrimaryTitle = personalInfo.headline;
  }

  // Calculate actual total years of experience across all experiences
  let calculatedYears = 0;
  if (allWorkExperience.length > 0) {
    const yearsList: number[] = [];
    allWorkExperience.forEach((exp) => {
      const sMatch = exp.startDate.match(/\b(19\d{2}|20\d{2})\b/);
      if (sMatch) yearsList.push(parseInt(sMatch[0], 10));
      const eMatch = exp.endDate.match(/\b(19\d{2}|20\d{2})\b/);
      if (eMatch) yearsList.push(parseInt(eMatch[0], 10));
      else if (exp.isCurrent) yearsList.push(new Date().getFullYear());
    });

    if (yearsList.length > 0) {
      const minYear = Math.min(...yearsList);
      const maxYear = Math.max(...yearsList);
      calculatedYears = Math.max(0, maxYear - minYear);
    }
  }

  rolePreferences.totalYearsExperience = calculatedYears;
  rolePreferences.experienceLevel =
    calculatedYears >= 10
      ? 'lead'
      : calculatedYears >= 5
        ? 'senior'
        : calculatedYears >= 2
          ? 'mid'
          : 'entry';

  // Overall personal info confidence
  confidence.personal =
    personalInfo.fullName && (personalInfo.email || personalInfo.phone)
      ? 'high'
      : 'medium';
  diagnostics.personal = personalInfo.fullName
    ? `Identified profile for ${personalInfo.fullName}`
    : 'Identity partially detected';

  return {
    rawText,
    personalInfo,
    professionalSummary,
    rolePreferences,
    skills: {
      technicalSkills: Array.from(detectedTech),
      softSkills: Array.from(detectedSoft),
      toolsAndPlatforms: Array.from(detectedTools),
      languages,
    },
    workExperience: allWorkExperience,
    entrepreneurialExperience,
    education,
    certifications,
    languages,
    confidence,
    diagnostics,
  };
}
