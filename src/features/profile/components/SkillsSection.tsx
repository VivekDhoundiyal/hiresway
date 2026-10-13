import React, { useState } from 'react';
import { SkillsData, LanguageSkill } from '@/core/profile';
import { Card } from '@/components/card';
import { Typography } from '@/components/typography';
import { Button } from '@/components/button';
import { Badge } from '@/components/badge';
import { Wrench, Edit2, Check, X, Plus, Trash2 } from 'lucide-react';

export interface SkillsSectionProps {
  data: SkillsData;
  onSave: (updated: SkillsData) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const SkillsSection: React.FC<SkillsSectionProps> = ({
  data,
  onSave,
  onDirtyChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<SkillsData>(data);

  // New tag inputs
  const [newTech, setNewTech] = useState('');
  const [newSoft, setNewSoft] = useState('');
  const [newTool, setNewTool] = useState('');
  const [newLangName, setNewLangName] = useState('');
  const [newLangProf, setNewLangProf] = useState<LanguageSkill['proficiency']>('fluent');

  const handleStartEdit = () => {
    setFormData(data);
    setNewTech('');
    setNewSoft('');
    setNewTool('');
    setNewLangName('');
    setIsEditing(true);
    onDirtyChange?.(true);
  };

  const handleCancel = () => {
    setFormData(data);
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const handleSave = () => {
    onSave(formData);
    setIsEditing(false);
    onDirtyChange?.(false);
  };

  const addTag = (
    category: 'technicalSkills' | 'softSkills' | 'toolsAndPlatforms',
    tag: string
  ) => {
    if (!tag.trim()) return;
    if (!formData[category].includes(tag.trim())) {
      setFormData((prev) => ({
        ...prev,
        [category]: [...prev[category], tag.trim()],
      }));
    }
  };

  const removeTag = (
    category: 'technicalSkills' | 'softSkills' | 'toolsAndPlatforms',
    tag: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [category]: prev[category].filter((t) => t !== tag),
    }));
  };

  const addLanguage = () => {
    if (!newLangName.trim()) return;
    const newLang: LanguageSkill = {
      id: `lang-${Date.now()}`,
      language: newLangName.trim(),
      proficiency: newLangProf,
    };
    setFormData((prev) => ({
      ...prev,
      languages: [...prev.languages, newLang],
    }));
    setNewLangName('');
  };

  const removeLanguage = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.filter((l) => l.id !== id),
    }));
  };

  return (
    <Card id="skills" variant="default" padding="lg" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary-soft text-primary border border-blue-200/60 shadow-sm shrink-0">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <Typography as="h2" variant="h3" color="primary">
              Skills & Expertise
            </Typography>
            <Typography as="p" variant="body-sm" color="muted">
              Categorized core competencies powering automated resume and job matching
            </Typography>
          </div>
        </div>

        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Edit2 className="h-3.5 w-3.5" />}
            onClick={handleStartEdit}
          >
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-6">
          {/* Technical Skills */}
          <div className="space-y-2">
            <label className="text-body-sm font-semibold text-text-primary block">
              Technical & Engineering Skills
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.technicalSkills.map((tag) => (
                <Badge key={tag} variant="primary" size="md">
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag('technicalSkills', tag)}
                    className="ml-1.5 hover:text-red-500 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add technical skill (e.g. Next.js, GraphQL)..."
                value={newTech}
                onChange={(e) => setNewTech(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag('technicalSkills', newTech);
                    setNewTech('');
                  }
                }}
                className="flex-1 h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  addTag('technicalSkills', newTech);
                  setNewTech('');
                }}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Soft Skills */}
          <div className="space-y-2">
            <label className="text-body-sm font-semibold text-text-primary block">
              Soft Skills & Leadership
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.softSkills.map((tag) => (
                <Badge key={tag} variant="neutral" size="md">
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag('softSkills', tag)}
                    className="ml-1.5 hover:text-red-500 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add soft skill (e.g. Cross-functional leadership)..."
                value={newSoft}
                onChange={(e) => setNewSoft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag('softSkills', newSoft);
                    setNewSoft('');
                  }
                }}
                className="flex-1 h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  addTag('softSkills', newSoft);
                  setNewSoft('');
                }}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Tools & Platforms */}
          <div className="space-y-2">
            <label className="text-body-sm font-semibold text-text-primary block">
              Tools, Cloud & Infrastructure
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.toolsAndPlatforms.map((tag) => (
                <Badge key={tag} variant="info" size="md">
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag('toolsAndPlatforms', tag)}
                    className="ml-1.5 hover:text-red-500 rounded"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add tool/platform (e.g. Docker, AWS, Figma)..."
                value={newTool}
                onChange={(e) => setNewTool(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag('toolsAndPlatforms', newTool);
                    setNewTool('');
                  }
                }}
                className="flex-1 h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  addTag('toolsAndPlatforms', newTool);
                  setNewTool('');
                }}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Languages */}
          <div className="space-y-2 pt-2 border-t border-border/70">
            <label className="text-body-sm font-semibold text-text-primary block">
              Languages
            </label>
            <div className="space-y-2">
              {formData.languages.map((lang) => (
                <div
                  key={lang.id}
                  className="flex items-center justify-between p-2.5 rounded-md bg-surface-subtle border border-border/60"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-body-sm text-text-primary">
                      {lang.language}
                    </span>
                    <Badge variant="neutral" size="sm" className="capitalize">
                      {lang.proficiency}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLanguage(lang.id)}
                    className="p-1 text-text-muted hover:text-error rounded"
                    aria-label={`Remove ${lang.language}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Language (e.g. German, Japanese)..."
                  value={newLangName}
                  onChange={(e) => setNewLangName(e.target.value)}
                  className="flex-1 h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <select
                  value={newLangProf}
                  onChange={(e) =>
                    setNewLangProf(e.target.value as LanguageSkill['proficiency'])
                  }
                  className="h-9 rounded-md bg-surface text-body-sm text-text-primary border border-border px-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="basic">Basic</option>
                  <option value="conversational">Conversational</option>
                  <option value="fluent">Fluent</option>
                  <option value="native">Native</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={addLanguage}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/70">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<X className="h-4 w-4" />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Check className="h-4 w-4" />}
              onClick={handleSave}
            >
              Save Changes
            </Button>
          </div>
        </div>
      ) : (
        /* View Mode */
        <div className="space-y-4">
          <div>
            <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block mb-2">
              Technical & Engineering
            </span>
            <div className="flex flex-wrap gap-2">
              {data.technicalSkills.map((skill) => (
                <Badge key={skill} variant="primary" size="md">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block mb-2">
              Soft Skills & Leadership
            </span>
            <div className="flex flex-wrap gap-2">
              {data.softSkills.map((skill) => (
                <Badge key={skill} variant="neutral" size="md">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block mb-2">
              Tools, Cloud & Infrastructure
            </span>
            <div className="flex flex-wrap gap-2">
              {data.toolsAndPlatforms.map((tool) => (
                <Badge key={tool} variant="info" size="md">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>

          {data.languages.length > 0 && (
            <div className="pt-2 border-t border-border/60">
              <span className="text-caption font-semibold uppercase text-text-muted tracking-wider block mb-2">
                Languages
              </span>
              <div className="flex flex-wrap gap-2">
                {data.languages.map((lang) => (
                  <Badge key={lang.id} variant="neutral" size="md">
                    {lang.language} ({lang.proficiency})
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
