/**
 * CareerOs Dedicated Salary Truth Engine
 * 
 * Strict architectural rule: CareerOs NEVER invents, estimates, or hallucinates salary.
 * 
 * Compensation may ONLY be displayed if:
 * 1. The exact job posting contains stated salary text, OR
 * 2. An authoritative structured source (e.g. direct ATS API payload) provides it.
 *
 * If no compensation is explicitly present in the original posting:
 * status = 'NOT_DISCLOSED'
 * display = 'Salary: Not disclosed'
 */

import type {
  SalaryTruthRecord,
  SalaryPeriod,
  JobCompensation,
} from './types';

export interface SalaryExtractionInput {
  text?: string;
  description?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryPeriod?: SalaryPeriod;
  salaryRaw?: string;
  sourceUrl?: string;
  structuredStatus?: string;
}

export class SalaryTruthEngine {
  /**
   * Helper to detect if a matched pattern is funding, valuation, tier, or non-compensation metric
   */
  private isFundingOrMetric(text: string): boolean {
    return /\b(valuation|funding|raised|round|series\s+[a-z]|seed|arr|gmv|revenue|tier\s*[0-9]|level\s*[0-9]|step\s*[0-9]|section\s*[0-9]|page\s*[0-9]|rule\s*[0-9]|rank\s*[0-9])\b/i.test(
      text
    ) || /\$\s*[\d,.]+\s*(?:b|billion|m|million)\b/i.test(text);
  }

  /**
   * Extracts and validates salary truth from authentic posting text or structured data.
   */
  public extractSalary(input: SalaryExtractionInput): SalaryTruthRecord {
    const sourceUrl = input.sourceUrl;

    // 1. Structured explicit inputs (from verified ATS API payloads)
    if (
      (input.salaryMin && input.salaryMin > 0) ||
      (input.salaryMax && input.salaryMax > 0)
    ) {
      let min = input.salaryMin || input.salaryMax || 0;
      let max = input.salaryMax || min;
      const currency = input.salaryCurrency ? input.salaryCurrency.toUpperCase() : undefined;
      const period: SalaryPeriod = input.salaryPeriod || 'not_disclosed';

      // Reject non-realistic values (e.g. $1 or $0)
      const isRealistic =
        min > 0 &&
        max >= min &&
        ((period === 'hourly' && min >= 5 && max <= 500) ||
          (currency === 'INR' && (min >= 100000 || (min >= 1 && min <= 150))) || // 1 LPA to 150 LPA
          (currency !== 'INR' && min >= 5 && max <= 5000000));

      if (isRealistic) {
        if (currency === 'INR' && min <= 150 && max <= 150) {
          min = min * 100000;
          max = max * 100000;
        }
        const rawText = input.salaryRaw && !this.isFundingOrMetric(input.salaryRaw)
          ? input.salaryRaw
          : this.formatRange(min, max, currency, period);

        return {
          status: 'STRUCTURED_SOURCE_STATED',
          min,
          max,
          currency,
          period,
          rawText,
          sourceUrl,
          evidence: `Structured ATS salary payload: ${rawText}`,
          verifiedAt: new Date().toISOString(),
        };
      }
    }

    const textToScan = `${input.salaryRaw || ''}\n${input.text || ''}\n${(input.description || '').slice(0, 3000)}`;

    // 2. Parse INR patterns (e.g. ₹18L - ₹25L, 18-25 LPA, INR 2,000,000 - 3,000,000)
    const inrMatch = textToScan.match(
      /(?:₹|INR|Rs\.?)\s*([\d,.]+)\s*(?:L|LPA|Lakhs?)?(?:\s*[-–to]+\s*(?:₹|INR|Rs\.?)?\s*([\d,.]+)\s*(?:L|LPA|Lakhs?)?)?/i
    );
    if (inrMatch && inrMatch[1] && !this.isFundingOrMetric(inrMatch[0])) {
      let min = parseFloat(inrMatch[1].replace(/,/g, ''));
      let max = inrMatch[2] ? parseFloat(inrMatch[2].replace(/,/g, '')) : undefined;

      // Handle Lakhs format
      const isLakh = /lpa|lakh/i.test(inrMatch[0]) || (min > 0 && min < 100);
      if (isLakh) {
        min = min * 100000;
        if (max) max = max * 100000;
      }

      // Minimum realistic threshold for annual INR is ₹100,000 (1 LPA)
      if (min >= 100000) {
        const rawText = inrMatch[0].trim();
        const period: SalaryPeriod = /mo|month/i.test(inrMatch[0]) ? 'monthly' : 'annual';
        return {
          status: 'EMPLOYER_STATED',
          min,
          max: max || min,
          currency: 'INR',
          period,
          rawText,
          sourceUrl,
          evidence: `Original job description text: "${rawText}"`,
          verifiedAt: new Date().toISOString(),
        };
      }
    }

    // 3. Parse USD patterns (e.g. $100,000 - $130,000, $120k - $160k, $60/hr)
    const usdMatch = textToScan.match(
      /(?:\$|USD)\s*([\d,.]+)(?:k)?(?:\s*[-–to]+\s*(?:\$|USD)?\s*([\d,.]+)(?:k)?)?(?:\s*(?:\/|\bper\s+)?(hr|hour|yr|year|annual|annually|mo|month))?/i
    );
    if (usdMatch && usdMatch[1] && !this.isFundingOrMetric(usdMatch[0])) {
      let min = parseFloat(usdMatch[1].replace(/,/g, ''));
      if (usdMatch[0].toLowerCase().includes('k') && min < 1000) min *= 1000;

      let max: number | undefined;
      if (usdMatch[2]) {
        max = parseFloat(usdMatch[2].replace(/,/g, ''));
        if (usdMatch[0].toLowerCase().includes('k') && max < 1000) max *= 1000;
      }

      const periodStr = usdMatch[3]?.toLowerCase();
      const isHourlyDeclared = periodStr === 'hr' || periodStr === 'hour';
      const isAnnualDeclared = periodStr === 'yr' || periodStr === 'year' || periodStr === 'annual' || periodStr === 'annually';
      const isMonthlyDeclared = periodStr === 'mo' || periodStr === 'month';
      const period: SalaryPeriod = isHourlyDeclared
        ? 'hourly'
        : isAnnualDeclared
        ? 'annual'
        : isMonthlyDeclared
        ? 'monthly'
        : 'not_disclosed';

      // Strict Validation: Eradicate "$1" or false metrics
      const isValid = min >= 5 && (max || min) <= 3000000;

      if (isValid) {
        const rawText = usdMatch[0].trim();
        return {
          status: 'EMPLOYER_STATED',
          min,
          max: max || min,
          currency: 'USD',
          period,
          rawText,
          sourceUrl,
          evidence: `Original job description text: "${rawText}"`,
          verifiedAt: new Date().toISOString(),
        };
      }
    }

    // 4. Parse EUR patterns (e.g. €80,000 - €100,000, €70k)
    const eurMatch = textToScan.match(
      /(?:€|EUR)\s*([\d,.]+)(?:k)?(?:\s*[-–to]+\s*(?:€|EUR)?\s*([\d,.]+)(?:k)?)?(?:\s*(?:\/|\bper\s+)?(hr|hour|yr|year|annual|annually|mo|month))?/i
    );
    if (eurMatch && eurMatch[1] && !this.isFundingOrMetric(eurMatch[0])) {
      let min = parseFloat(eurMatch[1].replace(/,/g, ''));
      let max = eurMatch[2] ? parseFloat(eurMatch[2].replace(/,/g, '')) : undefined;
      if (eurMatch[0].toLowerCase().includes('k') && min < 1000) min *= 1000;
      if (max && eurMatch[0].toLowerCase().includes('k') && max < 1000) max *= 1000;

      const periodStr = eurMatch[3]?.toLowerCase();
      const period: SalaryPeriod =
        periodStr === 'hr' || periodStr === 'hour'
          ? 'hourly'
          : periodStr === 'yr' || periodStr === 'year' || periodStr === 'annual' || periodStr === 'annually'
          ? 'annual'
          : 'not_disclosed';

      if (min >= 5) {
        const rawText = eurMatch[0].trim();
        return {
          status: 'EMPLOYER_STATED',
          min,
          max: max || min,
          currency: 'EUR',
          period,
          rawText,
          sourceUrl,
          evidence: `Original job description text: "${rawText}"`,
          verifiedAt: new Date().toISOString(),
        };
      }
    }

    // 5. Parse GBP patterns (e.g. £65,000 - £85,000, £70k)
    const gbpMatch = textToScan.match(
      /(?:£|GBP)\s*([\d,.]+)(?:k)?(?:\s*[-–to]+\s*(?:£|GBP)?\s*([\d,.]+)(?:k)?)?(?:\s*(?:\/|\bper\s+)?(hr|hour|yr|year|annual|annually|mo|month))?/i
    );
    if (gbpMatch && gbpMatch[1] && !this.isFundingOrMetric(gbpMatch[0])) {
      let min = parseFloat(gbpMatch[1].replace(/,/g, ''));
      let max = gbpMatch[2] ? parseFloat(gbpMatch[2].replace(/,/g, '')) : undefined;
      if (gbpMatch[0].toLowerCase().includes('k') && min < 1000) min *= 1000;
      if (max && gbpMatch[0].toLowerCase().includes('k') && max < 1000) max *= 1000;

      const periodStr = gbpMatch[3]?.toLowerCase();
      const period: SalaryPeriod =
        periodStr === 'hr' || periodStr === 'hour'
          ? 'hourly'
          : periodStr === 'yr' || periodStr === 'year' || periodStr === 'annual' || periodStr === 'annually'
          ? 'annual'
          : 'not_disclosed';

      if (min >= 5) {
        const rawText = gbpMatch[0].trim();
        return {
          status: 'EMPLOYER_STATED',
          min,
          max: max || min,
          currency: 'GBP',
          period,
          rawText,
          sourceUrl,
          evidence: `Original job description text: "${rawText}"`,
          verifiedAt: new Date().toISOString(),
        };
      }
    }

    // 6. Strict Fallback: When no authentic compensation was present in the posting
    return {
      status: 'NOT_DISCLOSED',
      period: 'not_disclosed',
      rawText: 'Salary not disclosed',
      sourceUrl,
      evidence: 'No authentic employer compensation was disclosed in the posting',
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Helper: Formats a min-max range into readable string
   */
  private formatRange(
    min: number,
    max: number,
    currency?: string,
    period?: SalaryPeriod
  ): string {
    const sym =
      currency === 'INR'
        ? '₹'
        : currency === 'EUR'
        ? '€'
        : currency === 'GBP'
        ? '£'
        : currency === 'USD'
        ? '$'
        : currency
        ? `${currency} `
        : '';
    const periodSuffix = period === 'hourly' ? '/hr' : period === 'annual' ? '/yr' : period === 'monthly' ? '/mo' : '';

    if (currency === 'INR') {
      const minL = (min / 100000).toFixed(0);
      const maxL = (max / 100000).toFixed(0);
      return minL === maxL ? `₹${minL}L${periodSuffix}` : `₹${minL}L–₹${maxL}L${periodSuffix}`;
    }

    if (
      currency &&
      min >= 1000 &&
      max >= 1000 &&
      (currency === 'USD' || currency === 'EUR' || currency === 'GBP' || currency === 'CAD' || currency === 'AUD')
    ) {
      const minK = Math.round(min / 1000);
      const maxK = Math.round(max / 1000);
      return minK === maxK ? `${sym}${minK}k${periodSuffix}` : `${sym}${minK}k–${sym}${maxK}k${periodSuffix}`;
    }

    if (!currency) {
      const base = min === max ? min.toLocaleString() : `${min.toLocaleString()}–${max.toLocaleString()}`;
      return `${base} (Currency not disclosed)${periodSuffix}`;
    }

    return min === max
      ? `${sym}${min.toLocaleString()}${periodSuffix}`
      : `${sym}${min.toLocaleString()}–${sym}${max.toLocaleString()}${periodSuffix}`;
  }

  /**
   * Formats salary display string conforming strictly to truth guidelines.
   */
  public formatSalaryDisplay(salary: SalaryTruthRecord | JobCompensation | undefined): {
    text: string;
    isDisclosed: boolean;
    evidence?: string;
  } {
    if (!salary) {
      return { text: 'Salary not disclosed', isDisclosed: false };
    }

    // Check SalaryTruthRecord
    const st = salary as SalaryTruthRecord;
    if (
      st.status === 'NOT_DISCLOSED' ||
      !st.min ||
      st.min < 5 ||
      st.rawText === '$1' ||
      st.rawText === 'Salary not disclosed' ||
      st.rawText === 'Salary: Not disclosed'
    ) {
      return { text: 'Salary not disclosed', isDisclosed: false, evidence: st.evidence };
    }

    if (st.status === 'EMPLOYER_STATED' || st.status === 'STRUCTURED_SOURCE_STATED') {
      const displayRange = st.rawText || (st.min && st.max ? this.formatRange(st.min, st.max, st.currency, st.period) : '');
      if (displayRange) {
        return {
          text: displayRange.includes('Employer stated') ? displayRange : `${displayRange} · Employer stated`,
          isDisclosed: true,
          evidence: st.evidence,
        };
      }
    }

    // Check legacy JobCompensation
    const jc = salary as JobCompensation;
    if (!jc.disclosed || jc.salary_status === 'not_disclosed' || (!jc.min && !jc.rawText)) {
      return { text: 'Salary: Not disclosed', isDisclosed: false };
    }

    if (jc.rawText) {
      return {
        text: `${jc.rawText} · Employer stated`,
        isDisclosed: true,
        evidence: jc.salary_source_excerpt,
      };
    }

    if (jc.min && jc.max) {
      const formatted = this.formatRange(jc.min, jc.max, jc.currency, jc.period);
      return {
        text: `${formatted} · Employer stated`,
        isDisclosed: true,
      };
    }

    return { text: 'Salary: Not disclosed', isDisclosed: false };
  }
}

export const salaryTruthEngine = new SalaryTruthEngine();
