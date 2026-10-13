/**
 * HiresWay Document Studio Engine
 *
 * Manages customized resume variants, cover letters, and application materials:
 * 1. Generates deterministic ATS-tailored resume blueprints from canonical profile.
 * 2. Persists document variants scoped per job opportunity or application record.
 * 3. Multi-tier persistence (IndexedDB 'documents' store + localStorage fallback).
 * 4. User isolation and zero fake facts/integrity enforcement.
 */

import { persistentStorageEngine } from '../storage/persistentStorageEngine';
import { userContextService } from '../auth/userContext';
import { UserProfile } from '../profile/types';
import { JobPosting, generateTailoredResume, TailoredResumeBlueprint } from '../intelligence';
import { notificationEngine } from '../notifications/notificationEngine';

export type DocumentType = 'tailored_resume' | 'master_resume' | 'cover_letter';

export interface DocumentVariant {
  id: string;
  userId: string;
  jobId: string;
  applicationId?: string;
  title: string;
  documentType: DocumentType;
  content: string; // Markdown / structured text
  format: 'markdown' | 'text' | 'json';
  createdAt: string;
  updatedAt: string;
  blueprint?: TailoredResumeBlueprint;
}

const STORAGE_KEY = 'careeros_documents_v1';

class DocumentEngine {
  private documents: Map<string, DocumentVariant> = new Map();
  private listeners: Set<(docs: DocumentVariant[]) => void> = new Set();
  private isLoaded = false;

  constructor() {
    this.hydrate();
  }

  private async hydrate(): Promise<void> {
    try {
      const items = await persistentStorageEngine.getAll<DocumentVariant>('documents');
      const userId = userContextService.getUserId();

      if (items && items.length > 0) {
        for (const item of items) {
          if (!item.userId || item.userId === userId) {
            this.documents.set(item.id, { ...item, userId });
          }
        }
      } else {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const item of parsed) {
                const record: DocumentVariant = {
                  ...item,
                  userId,
                  id: item.id || `doc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                };
                this.documents.set(record.id, record);
                await persistentStorageEngine.set('documents', record);
              }
            }
          }
        }
      }

      this.isLoaded = true;
      this.notify();
    } catch (err) {
      console.warn('Failed to hydrate documents:', err);
      this.isLoaded = true;
    }
  }

  public async getDocuments(): Promise<DocumentVariant[]> {
    if (!this.isLoaded) {
      await this.hydrate();
    }
    const userId = userContextService.getUserId();
    return Array.from(this.documents.values()).filter((d) => d.userId === userId);
  }

  public getDocumentsSync(): DocumentVariant[] {
    const userId = userContextService.getUserId();
    return Array.from(this.documents.values()).filter((d) => d.userId === userId);
  }

  public async getDocumentById(id: string): Promise<DocumentVariant | undefined> {
    if (!this.isLoaded) {
      await this.hydrate();
    }
    return this.documents.get(id);
  }

  public async getDocumentsByJobId(jobId: string): Promise<DocumentVariant[]> {
    const docs = await this.getDocuments();
    return docs.filter((d) => d.jobId === jobId);
  }

  public async saveDocument(
    doc: Omit<DocumentVariant, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<DocumentVariant> {
    const userId = userContextService.getUserId();
    const id = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const now = new Date().toISOString();

    const record: DocumentVariant = {
      ...doc,
      id,
      userId,
      createdAt: now,
      updatedAt: now,
    };

    this.documents.set(id, record);
    await persistentStorageEngine.set('documents', record);
    this.persistLocalMirror();

    await notificationEngine.send({
      title: 'Document Saved',
      message: `Saved ${record.title} to Document Studio`,
      type: 'system',
      priority: 'low',
      actionUrl: '/resume-studio',
    });

    this.notify();
    return record;
  }

  public async updateDocument(
    id: string,
    updates: Partial<Omit<DocumentVariant, 'id' | 'userId' | 'createdAt'>>
  ): Promise<DocumentVariant | undefined> {
    const record = this.documents.get(id);
    if (!record) return undefined;

    Object.assign(record, updates, { updatedAt: new Date().toISOString() });
    await persistentStorageEngine.set('documents', record);
    this.persistLocalMirror();
    this.notify();
    return record;
  }

  public async deleteDocument(id: string): Promise<void> {
    this.documents.delete(id);
    await persistentStorageEngine.delete('documents', id);
    this.persistLocalMirror();
    this.notify();
  }

  public generateMarkdownResume(profile: UserProfile, job: JobPosting): { markdown: string; blueprint: TailoredResumeBlueprint } {
    const blueprint = generateTailoredResume(profile, job);
    const lines: string[] = [];

    lines.push(`# ${profile.personalInfo.fullName || 'Candidate'}`);
    lines.push(`**${blueprint.customHeadline}**`);
    lines.push(
      `${profile.personalInfo.email} | ${profile.personalInfo.phone} | ${profile.personalInfo.city}, ${profile.personalInfo.country}`
    );
    if (profile.personalInfo.linkedinUrl) {
      lines.push(`LinkedIn: ${profile.personalInfo.linkedinUrl}`);
    }
    lines.push('\n---\n');

    lines.push('## Professional Summary');
    lines.push(blueprint.customSummary);
    lines.push('\n---\n');

    lines.push('## Core Competencies & Keywords');
    lines.push(blueprint.highlightedSkills.join(' • '));
    lines.push('\n---\n');

    lines.push('## Work Experience');
    blueprint.prioritizedExperiences.forEach(({ experience, highlightedAchievements }) => {
      lines.push(
        `### ${experience.title} - ${experience.company} (${experience.startDate} to ${
          experience.isCurrent ? 'Present' : experience.endDate
        })`
      );
      highlightedAchievements.forEach((b: string) => lines.push(`- ${b}`));
      lines.push('');
    });

    lines.push('## Education');
    profile.education.forEach((edu) => {
      lines.push(
        `- ${edu.degree} in ${edu.fieldOfStudy}, ${edu.institution} (${edu.startDate} - ${edu.endDate})`
      );
    });

    return { markdown: lines.join('\n'), blueprint };
  }

  public subscribe(callback: (docs: DocumentVariant[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.getDocumentsSync());
    return () => this.listeners.delete(callback);
  }

  private persistLocalMirror(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        const all = Array.from(this.documents.values());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      } catch (e) {
        console.warn('Failed to mirror documents to localStorage', e);
      }
    }
  }

  private notify(): void {
    const docs = this.getDocumentsSync();
    this.listeners.forEach((cb) => {
      try {
        cb(docs);
      } catch (err) {
        console.error('DocumentEngine listener error:', err);
      }
    });
  }
}

export const documentEngine = new DocumentEngine();
