import React, { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { X, Loader2, Share2, Globe, EyeOff, Tag } from 'lucide-react';
import type { TestScenario } from '../types';

interface PublishTemplateModalProps {
  scenario: TestScenario;
  projectId: string;
  onClose: () => void;
  onPublished?: () => void;
}

export default function PublishTemplateModal({ scenario, projectId, onClose, onPublished }: PublishTemplateModalProps) {
  const [name, setName] = useState(scenario.name || '');
  const [description, setDescription] = useState(scenario.description || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'UNLISTED'>('PUBLIC');

  const utils = trpc.useUtils();

  const publishMutation = trpc.scenarioTemplates.publish.useMutation({
    onSuccess: (data) => {
      toast.success(`Template "${data.name}" publié avec succès !`);
      utils.scenarioTemplates.list.invalidate();
      utils.scenarioTemplates.listPublic.invalidate();
      onPublished?.();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || 'Erreur lors de la publication');
    },
  });

  const handleAddTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags([...tags, t]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handlePublish = () => {
    if (!name.trim()) {
      toast.error('Le nom du template est requis');
      return;
    }
    // We need the scenario's uid - it's stored in the scenario object
    // The scenario.id from the list is the DB id, we need the uid
    // We'll pass it through the scenario_code or fetch it
    publishMutation.mutate({
      scenarioUid: scenario.id, // This is the uid from the list mapping
      projectId,
      name: name.trim(),
      description: description.trim() || undefined,
      tags,
      visibility,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-lg shadow-xl border border-border w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-green-500/10 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-semibold text-foreground">Publier comme template</h2>
              <p className="text-xs text-muted-foreground">Partagez ce scénario avec la communauté</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Source info */}
          <div className="bg-secondary/30 rounded-md p-3">
            <p className="text-sm font-medium text-foreground">{scenario.name}</p>
            {scenario.scenario_code && (
              <p className="text-xs font-mono text-cyan-400/80 mt-0.5">{scenario.scenario_code}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {scenario.steps?.length || 0} étape(s) · Version {scenario.version || 1}
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nom du template *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Registration SIP IMS"
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              maxLength={255}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Décrivez ce que teste ce scénario..."
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              maxLength={2000}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              <Tag className="w-3.5 h-3.5 inline mr-1" />
              Tags ({tags.length}/10)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ajouter un tag (Entrée pour valider)"
                className="flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                maxLength={50}
              />
              <button
                onClick={handleAddTag}
                disabled={!tagInput.trim() || tags.length >= 10}
                className="px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm hover:bg-primary/20 disabled:opacity-50 transition-colors"
              >
                Ajouter
              </button>
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Visibilité</label>
            <div className="flex gap-3">
              <button
                onClick={() => setVisibility('PUBLIC')}
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                  visibility === 'PUBLIC'
                    ? 'border-green-500/50 bg-green-500/10 text-green-400'
                    : 'border-border text-muted-foreground hover:border-border/80'
                }`}
              >
                <Globe className="w-4 h-4" />
                <div className="text-left">
                  <p className="font-medium">Public</p>
                  <p className="text-xs opacity-70">Visible dans la bibliothèque</p>
                </div>
              </button>
              <button
                onClick={() => setVisibility('UNLISTED')}
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                  visibility === 'UNLISTED'
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                    : 'border-border text-muted-foreground hover:border-border/80'
                }`}
              >
                <EyeOff className="w-4 h-4" />
                <div className="text-left">
                  <p className="font-medium">Non listé</p>
                  <p className="text-xs opacity-70">Accessible par lien uniquement</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-input text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handlePublish}
            disabled={!name.trim() || publishMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-sm font-medium text-white hover:bg-green-500 transition-colors disabled:opacity-50"
          >
            {publishMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            Publier
          </button>
        </div>
      </div>
    </div>
  );
}
