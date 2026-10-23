import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { documentEngine, DocumentVariant } from '@/core/documents';
import { useProfile } from '@/core/profile';
import { userContextService } from '@/core/auth';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Modal } from '@/components/modal';
import {
  Archive,
  FileText,
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  Eye,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export const DocumentVaultPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [documents, setDocuments] = useState<DocumentVariant[]>(() => {
    return documentEngine.getDocumentsSync();
  });

  const [selectedDoc, setSelectedDoc] = useState<DocumentVariant | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  useEffect(() => {
    const unsub = documentEngine.subscribe((docs) => {
      setDocuments(docs);
    });
    return unsub;
  }, []);

  const handleCopy = (doc: DocumentVariant) => {
    navigator.clipboard.writeText(doc.content);
    setCopiedId(doc.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (doc: DocumentVariant) => {
    const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this document from your vault?')) {
      await documentEngine.deleteDocument(id);
      if (selectedDoc?.id === id) setSelectedDoc(null);
    }
  };

  const handleExportMasterResume = async () => {
    const masterMarkdown = `# ${profile.personalInfo.fullName || 'Candidate'}
${profile.personalInfo.headline || ''}
Email: ${profile.personalInfo.email} | Phone: ${profile.personalInfo.phone} | Location: ${profile.locationAndAuth.currentCity}, ${profile.locationAndAuth.currentCountry}
LinkedIn: ${profile.personalInfo.linkedinUrl} | GitHub: ${profile.personalInfo.githubUrl}

## Executive Summary
${profile.professionalSummary.summaryText}

## Core Competencies & Technical Skills
- **Technical Skills:** ${profile.skills.technicalSkills.join(', ')}
- **Tools & Platforms:** ${profile.skills.toolsAndPlatforms.join(', ')}
- **Soft Skills:** ${profile.skills.softSkills.join(', ')}

## Work Experience
${profile.workExperience
  .map(
    (w) => `### ${w.title} — ${w.company} (${w.startDate} - ${w.endDate || 'Present'})
Location: ${w.location} (${w.locationType})
${(w.keyAchievements || []).map((h) => `- ${h}`).join('\n')}`
  )
  .join('\n\n')}

## Education
${profile.education.map((e) => `- **${e.degree} in ${e.fieldOfStudy}**, ${e.institution} (${e.endDate || ''})`).join('\n')}
`;

    const doc: DocumentVariant = {
      id: `master-resume-${Date.now()}`,
      userId: userContextService.getUserId(),
      jobId: '',
      title: `Master Canonical Resume (${new Date().toLocaleDateString()})`,
      documentType: 'master_resume',
      content: masterMarkdown,
      format: 'markdown',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await documentEngine.saveDocument(doc);
  };

  const handleCreateNewDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const doc: DocumentVariant = {
      id: `doc-${Date.now()}`,
      userId: userContextService.getUserId(),
      jobId: '',
      title: newTitle.trim(),
      documentType: 'cover_letter',
      content: newContent.trim(),
      format: 'markdown',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await documentEngine.saveDocument(doc);
    setNewTitle('');
    setNewContent('');
    setIsNewDocModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <Typography as="h1" variant="h2" color="primary" className="text-2xl sm:text-3xl font-bold tracking-tight">
              Document Vault & Version Control
            </Typography>
            <Badge variant="primary" size="sm" icon={<Archive className="h-3 w-3" />}>
              Encrypted Local Storage
            </Badge>
          </div>
          <Typography as="p" variant="body-md" color="secondary" className="mt-1">
            Store, audit, and export ATS-tailored resume variants, master profiles, and application letters.
          </Typography>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMasterResume}
            leftIcon={<Sparkles className="h-4 w-4 text-primary" />}
          >
            Export Master Profile
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsNewDocModalOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            New Document
          </Button>
        </div>
      </div>

      {/* Security Banner */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
        <span>
          Your career documents are isolated to your local workspace in IndexedDB. Zero cloud leaks, zero third-party AI scraping.
        </span>
      </div>

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <Card variant="bordered" padding="lg" className="text-center py-16 space-y-4">
          <FileText className="h-12 w-12 text-slate-400 mx-auto" />
          <Typography as="h3" variant="h3" color="primary">
            No Documents in Vault Yet
          </Typography>
          <Typography as="p" variant="body-sm" color="secondary" className="max-w-md mx-auto">
            Generate tailored resumes inside <strong>Resume Studio</strong>, or export a master version of your canonical profile right now.
          </Typography>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="primary" size="sm" onClick={handleExportMasterResume}>
              Generate Master Profile Resume
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/resume-studio')}>
              Go to Resume Studio
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <Card
              key={doc.id}
              variant="bordered"
              padding="md"
              className="flex flex-col justify-between hover:border-slate-300 transition-colors space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-body-sm font-bold text-text-primary line-clamp-2">
                    {doc.title}
                  </span>
                  <Badge variant={doc.documentType === 'master_resume' ? 'primary' : 'neutral'} size="sm">
                    {doc.documentType.replace('_', ' ')}
                  </Badge>
                </div>

                <p className="text-caption text-text-muted">
                  Saved on {new Date(doc.createdAt).toLocaleDateString()}
                </p>

                <p className="text-caption text-text-secondary line-clamp-3 bg-surface-subtle p-2.5 rounded-md font-mono text-[11px]">
                  {doc.content.slice(0, 180)}...
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedDoc(doc)}
                    className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface-subtle"
                    title="View Full Document"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(doc)}
                    className="p-1.5 text-text-muted hover:text-primary rounded-md hover:bg-surface-subtle"
                    title="Copy Content"
                  >
                    {copiedId === doc.id ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-surface-subtle"
                    title="Download Markdown"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  className="p-1.5 text-text-muted hover:text-red-600 rounded-md hover:bg-red-50"
                  title="Delete Document"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Document View Modal */}
      {selectedDoc && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDoc(null)}
          title={selectedDoc.title}
          description={`Created on ${new Date(selectedDoc.createdAt).toLocaleString()}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(selectedDoc)}
                leftIcon={copiedId === selectedDoc.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              >
                {copiedId === selectedDoc.id ? 'Copied' : 'Copy Text'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDownload(selectedDoc)}
                leftIcon={<Download className="h-3.5 w-3.5" />}
              >
                Download (.md)
              </Button>
            </div>

            <pre className="max-h-[500px] overflow-y-auto p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono whitespace-pre-wrap leading-relaxed">
              {selectedDoc.content}
            </pre>
          </div>
        </Modal>
      )}

      {/* New Document Modal */}
      {isNewDocModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsNewDocModalOpen(false)}
          title="Add New Document to Vault"
          size="md"
        >
          <form onSubmit={handleCreateNewDoc} className="space-y-4">
            <div>
              <label className="block text-caption font-semibold text-text-secondary mb-1">
                Document Title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Cover Letter — Cloudflare Infrastructure Role"
                required
                className="w-full h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 font-medium focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-caption font-semibold text-text-secondary mb-1">
                Content (Markdown / Plain Text)
              </label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write or paste document contents..."
                rows={10}
                required
                className="w-full rounded-md bg-surface text-body-sm text-text-primary border border-border p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setIsNewDocModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm">
                Save to Vault
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
