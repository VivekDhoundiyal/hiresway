/**
 * CareerOs Job Description Normalizer
 *
 * Converts raw HTML, messy markdown, and unstructured job descriptions from ATS endpoints
 * (Ashby, Greenhouse, Lever, Workable, Remotive, etc.) into clean, semantic, human-readable
 * structured sections while strictly preventing raw HTML tags (e.g. <h2>, <p>) from leaking into the UI.
 *
 * Preserves original raw text for auditability and provenance.
 */

export interface JobDescriptionSection {
  key:
    | 'about_company'
    | 'role_overview'
    | 'responsibilities'
    | 'requirements'
    | 'preferred_qualifications'
    | 'benefits'
    | 'compensation'
    | 'location_workplace'
    | 'general';
  title: string;
  content: string;
  items?: string[];
}

export interface NormalizedJobDescription {
  rawOriginal: string;
  cleanedText: string;
  summary: string;
  sections: JobDescriptionSection[];
  hasHtmlMarkup: boolean;
  wordCount: number;
}

/**
 * Decodes all standard and numerical HTML entities
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';

  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&mdash;/gi, ' — ')
    .replace(/&ndash;/gi, ' – ')
    .replace(/&bull;/gi, '•')
    .replace(/&hellip;/gi, '…')
    .replace(/&trade;/gi, '™')
    .replace(/&copy;/gi, '©')
    .replace(/&reg;/gi, '®')
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    });
}

/**
 * Strips script tags, styles, iframes, tracking pixels, and inline CSS
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<img\b[^>]*>/gi, '');
}

/**
 * Converts HTML into clean semantic text with markdown headings and list bullets
 */
export function htmlToCleanText(html: string): string {
  if (!html) return '';

  const sanitized = sanitizeHtml(html);

  // Structural conversions
  let transformed = sanitized
    // Preserve headings with semantic markers
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n### $1\n\n')
    // Preserve list items as clean dashes
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1')
    .replace(/<\/(?:ul|ol)>/gi, '\n\n')
    // Paragraph and division breaks
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n\n$1\n\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    // Bold and italics
    .replace(/<(?:strong|b)[^>]*>(.*?)<\/(?:strong|b)>/gi, '**$1**')
    .replace(/<(?:em|i)[^>]*>(.*?)<\/(?:em|i)>/gi, '*$1*')
    // Anchor tags: keep link text
    .replace(/<a\b[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    // Strip remaining tags
    .replace(/<[^>]+>/g, ' ');

  // Decode entities
  transformed = decodeHtmlEntities(transformed);

  // Normalize whitespace and line breaks
  return transformed
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .replace(/\n[ ]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Strips all HTML tags and returns purely plain text without markdown markers
 */
export function stripHtmlToPlainText(html: string): string {
  if (!html) return '';
  const text = htmlToCleanText(html);
  return text
    .replace(/###\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^[ \t]*-[ \t]*/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Keywords for section classification
 */
const SECTION_KEYWORDS: Record<JobDescriptionSection['key'], RegExp[]> = {
  about_company: [
    /^about\s+(?:us|the\s+company|our\s+company|supabase|linear|stripe|vercel|retool|openai|figma|airtable|notion|freshworks|postman)/i,
    /^(?:who\s+we\s+are|company\s+overview|our\s+mission|the\s+company)/i,
  ],
  role_overview: [
    /^about\s+(?:the|this)\s+role/i,
    /^(?:the\s+opportunity|role\s+overview|job\s+summary|overview|what\s+is\s+this\s+role)/i,
  ],
  responsibilities: [
    /^(?:responsibilities|key\s+responsibilities|what\s+you(?:'ll|\s+will)\s+do|duties|in\s+this\s+role\s+you\s+will|your\s+role|scope\s+of\s+work)/i,
    /^(?:day\s+to\s+day|core\s+functions|what\s+you'll\s+be\s+working\s+on)/i,
  ],
  requirements: [
    /^(?:requirements|what\s+you\s+(?:bring|need)|qualifications|minimum\s+qualifications|basic\s+qualifications)/i,
    /^(?:who\s+you\s+are|what\s+we(?:'re|\s+are)\s+looking\s+for|skills\s+(?:&|and)\s+experience|candidate\s+profile)/i,
  ],
  preferred_qualifications: [
    /^(?:nice\s+to\s+have|preferred\s+qualifications|bonus\s+(?:points|skills|qualifications)|extra\s+points|preferred\s+experience)/i,
  ],
  benefits: [
    /^(?:benefits|what\s+we\s+offer|perks\s+(?:&|and)\s+benefits|why\s+(?:join|work\s+at)\s+us|life\s+at|our\s+benefits)/i,
    /^(?:health\s+(?:&|and)\s+wellness|perks)/i,
  ],
  compensation: [
    /^(?:compensation|salary|salary\s+range|pay\s+transparency|pay\s+and\s+benefits|remuneration)/i,
  ],
  location_workplace: [
    /^(?:location|work\s+model|remote\s+policy|where\s+you(?:'ll|\s+will)\s+work|workplace\s+type)/i,
  ],
  general: [],
};

function classifyHeading(headingText: string): {
  key: JobDescriptionSection['key'];
  title: string;
} {
  const cleanHeading = headingText.trim().replace(/^###\s*/, '').replace(/\*\*/g, '').trim();

  for (const [key, patterns] of Object.entries(SECTION_KEYWORDS)) {
    if (key === 'general') continue;
    for (const pattern of patterns) {
      if (pattern.test(cleanHeading)) {
        return {
          key: key as JobDescriptionSection['key'],
          title: cleanHeading,
        };
      }
    }
  }

  return {
    key: 'general',
    title: cleanHeading,
  };
}

/**
 * Parses cleaned markdown/text into structured sections
 */
export function parseSections(cleanedText: string): JobDescriptionSection[] {
  if (!cleanedText) return [];

  // Split by markdown headings or common prominent capitalized headers
  const lines = cleanedText.split('\n');
  const sections: JobDescriptionSection[] = [];

  let currentKey: JobDescriptionSection['key'] = 'role_overview';
  let currentTitle = 'Overview';
  let currentLines: string[] = [];

  const flushCurrent = () => {
    const content = currentLines.join('\n').trim();
    if (content.length > 0) {
      // Extract bullet items if section has multiple bullets
      const items = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('- ') || l.startsWith('• '))
        .map((l) => l.replace(/^[-•]\s*/, '').trim())
        .filter(Boolean);

      sections.push({
        key: currentKey,
        title: currentTitle,
        content,
        items: items.length > 0 ? items : undefined,
      });
    }
    currentLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isHeading =
      line.startsWith('### ') ||
      (/^\*\*[A-Z][A-Za-z0-9\s&,/-]{2,40}\*\*:?$/.test(line.trim()) && lines[i + 1]?.trim() === '') ||
      (/^[A-Z][A-Za-z0-9\s&,/-]{2,40}:$/.test(line.trim()) && lines[i + 1]?.trim() === '');

    if (isHeading) {
      flushCurrent();
      const rawTitle = line
        .replace(/^###\s*/, '')
        .replace(/^\*\*/, '')
        .replace(/\*\*:?$/, '')
        .replace(/:$/, '')
        .trim();

      const classified = classifyHeading(rawTitle);
      currentKey = classified.key;
      currentTitle = classified.title;
    } else {
      currentLines.push(line);
    }
  }

  flushCurrent();

  // If no sections were identified, return a single overview section
  if (sections.length === 0 && cleanedText.trim().length > 0) {
    const items = cleanedText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- ') || l.startsWith('• '))
      .map((l) => l.replace(/^[-•]\s*/, '').trim())
      .filter(Boolean);

    sections.push({
      key: 'role_overview',
      title: 'Job Overview',
      content: cleanedText.trim(),
      items: items.length > 0 ? items : undefined,
    });
  }

  return sections;
}

/**
 * Normalizes raw job descriptions from any source into structured format
 */
export function normalizeJobDescription(
  rawInput: string | undefined | null,
  companyName?: string
): NormalizedJobDescription {
  const rawOriginal = rawInput || '';
  const hasHtmlMarkup = /<[a-z][\s\S]*>/i.test(rawOriginal);

  const cleanedText = htmlToCleanText(rawOriginal);
  const sections = parseSections(cleanedText);

  // Generate short 1-2 sentence executive summary from the first meaningful paragraph
  const firstParagraph =
    cleanedText
      .split('\n\n')
      .find((p) => p.trim().length > 40 && !p.startsWith('###') && !p.startsWith('-')) ||
    cleanedText.slice(0, 180);

  const summary = firstParagraph
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .trim()
    .slice(0, 240);

  const wordCount = cleanedText.trim().split(/\s+/).filter(Boolean).length;

  return {
    rawOriginal,
    cleanedText: cleanedText || (companyName ? `Direct opening at ${companyName}.` : 'No description provided.'),
    summary: summary || (companyName ? `Role at ${companyName}` : 'Opportunity Details'),
    sections,
    hasHtmlMarkup,
    wordCount,
  };
}

export const jobDescriptionNormalizer = {
  normalize: normalizeJobDescription,
  toCleanText: htmlToCleanText,
  stripToPlain: stripHtmlToPlainText,
  decodeEntities: decodeHtmlEntities,
};
