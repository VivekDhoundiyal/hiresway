/**
 * CareerOs Target Companies Excel Import Service
 *
 * Dedicated, secure Excel parser and validator for Target Companies.
 * Requires ONLY one column: "Company Name".
 * Protects against formula injection, ignores blank rows, detects duplicates,
 * and generates downloadable official templates.
 */

import * as XLSX from 'xlsx';
import {
  TargetCompany,
  ExcelCompanyImportRow,
  ExcelImportPreviewSummary,
  TargetCompanyTag,
} from '../jobs/types';
import { companyResolutionService } from './companyResolutionService';

/**
 * Strips dangerous formula injection prefixes from untrusted spreadsheet strings.
 * Disallows leading '=', '+', '-', '@', '\t', '\r'
 */
export function sanitizeCellValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  while (/^[=+\-@\t\r]/.test(str)) {
    str = str.substring(1).trim();
  }
  return str;
}

export class TargetCompaniesExcelImportService {
  /**
   * Generates and downloads the official single-column Excel template.
   */
  public downloadExcelTemplate(): void {
    const data = [
      ['Companies names'],
      ['Google'],
      ['Stripe'],
      ['Microsoft'],
      ['Notion'],
      ['Figma'],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column width
    ws['!cols'] = [{ wch: 35 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Target Companies');
    XLSX.writeFile(wb, 'CareerOs_Target_Companies_Template.xlsx');
  }

  /**
   * Parses an uploaded Excel (.xlsx, .xls) file buffer and performs strict validation.
   */
  public async parseAndValidateExcel(
    fileBuffer: ArrayBuffer,
    existingCompanies: TargetCompany[] = []
  ): Promise<ExcelImportPreviewSummary> {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('The uploaded file is empty or does not contain any worksheets.');
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      throw new Error('Could not read the first worksheet in the uploaded Excel file.');
    }

    // Convert sheet to array of arrays (header + rows)
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });

    if (rawRows.length === 0) {
      throw new Error('The spreadsheet appears empty. Please add company names and try again.');
    }

    // Identify header row and locate "Companies names" column
    const headerRow = (rawRows[0] || []) as unknown[];
    let companyNameColIndex = -1;

    for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
      const cellText = sanitizeCellValue(headerRow[colIdx]).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (
        cellText === 'companiesnames' ||
        cellText === 'companiesname' ||
        cellText === 'companynames' ||
        cellText === 'companyname' ||
        cellText === 'companies' ||
        cellText === 'company' ||
        cellText === 'organization' ||
        cellText === 'targetcompany'
      ) {
        companyNameColIndex = colIdx;
        break;
      }
    }

    if (companyNameColIndex === -1) {
      throw new Error(
        'Required header "Companies names" was not found in Row 1. Row 1 must be the header. Please download the template and add your companies starting from Row 2.'
      );
    }

    const dataRows = rawRows.slice(1);
    if (dataRows.length > 2500) {
      throw new Error(
        `This file contains ${dataRows.length} rows, which exceeds the supported limit of 2,500 companies per import. Please split the file into smaller batches.`
      );
    }

    const seenInFile = new Set<string>();
    const existingNormalizedNames = new Set(
      existingCompanies.map((c) => companyResolutionService.toKey(c.canonical_name || c.name))
    );
    const existingDomains = new Set(
      existingCompanies
        .map((c) => (c.domain || c.officialDomain || '').toLowerCase().trim())
        .filter(Boolean)
    );

    const rows: ExcelCompanyImportRow[] = [];
    let readyToAddCount = 0;
    let alreadyMonitoredCount = 0;
    let duplicateInFileCount = 0;
    let needsReviewCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      // Yield to event loop periodically on large files so the UI remains fluid
      if (i > 0 && i % 100 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }

      const rowNumber = i + 2; // 1-based, header was row 1
      const rowData = dataRows[i] as unknown[];
      const rawCell = rowData[companyNameColIndex];
      const rawName = sanitizeCellValue(rawCell);

      // Skip completely empty lines
      if (!rawName || rawName.trim().length === 0) {
        continue;
      }

      const cleaned = companyResolutionService.cleanCompanyName(rawName);
      const normalized = companyResolutionService.toKey(cleaned);

      // CRITICAL RULE: Row 1 header and "Companies names" must NEVER be imported as a company
      if (
        normalized === 'companiesnames' ||
        normalized === 'companiesname' ||
        normalized === 'companynames' ||
        normalized === 'companyname' ||
        normalized === 'companies' ||
        normalized === 'company'
      ) {
        continue;
      }

      if (!normalized || cleaned.length < 2) {
        needsReviewCount++;
        rows.push({
          rowNumber,
          rawName,
          cleanedName: cleaned || rawName,
          status: 'needs_review',
          reason: 'Company name too short or contains only symbols',
        });
        continue;
      }

      // Check if already monitored in user store (by normalized name or domain)
      const suggestions = companyResolutionService.getSuggestions(cleaned, existingCompanies);
      const topMatch = suggestions.length > 0 ? suggestions[0] : undefined;
      const topDomain = (topMatch?.domain || '').toLowerCase().trim();

      if (existingNormalizedNames.has(normalized) || (topDomain && existingDomains.has(topDomain))) {
        alreadyMonitoredCount++;
        rows.push({
          rowNumber,
          rawName,
          cleanedName: cleaned,
          status: 'already_monitored',
          reason: 'Company is already in your Target Companies list',
        });
        continue;
      }

      // Check duplicate within the same file
      if (seenInFile.has(normalized)) {
        duplicateInFileCount++;
        rows.push({
          rowNumber,
          rawName,
          cleanedName: cleaned,
          status: 'duplicate_in_file',
          reason: 'Duplicate company name appears multiple times in file',
        });
        continue;
      }

      seenInFile.add(normalized);

      // Valid new company ready to add
      readyToAddCount++;

      rows.push({
        rowNumber,
        rawName,
        cleanedName: topMatch?.canonicalName || cleaned,
        status: 'ready_to_add',
        tag: 'Priority' as TargetCompanyTag,
        resolvedCompany: topMatch,
      });
    }

    if (rows.length === 0) {
      throw new Error('No valid company names found in the spreadsheet. Please check your data.');
    }

    return {
      totalRowsFound: rows.length,
      readyToAddCount,
      alreadyMonitoredCount,
      duplicateInFileCount,
      needsReviewCount,
      rows,
    };
  }
}

export const targetCompaniesExcelImportService = new TargetCompaniesExcelImportService();
