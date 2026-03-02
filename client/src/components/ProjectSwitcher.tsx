import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useProjects } from '../hooks/useProjectQueries';
import { useProject } from '../state/projectStore';
import type { Project } from '../types';
import { ChevronDown, Check, FolderOpen } from 'lucide-react';

const domainColors: Record<string, string> = {
  WEB: 'bg-blue-500',
  API: 'bg-green-500',
  IMS: 'bg-purple-500',
  RAN: 'bg-orange-500',
  EPC: 'bg-red-500',
  '5GC': 'bg-indigo-500',
};

export function ProjectSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();

  const { currentProject, selectProject } = useProject();
  const { data } = useProjects({ limit: 50, status: 'ACTIVE' });
  const projects = data?.data || [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (project: Project) => {
    selectProject(project);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors max-w-[220px]"
      >
        {currentProject ? (
          <>
            <span className={`w-2 h-2 rounded-full shrink-0 ${domainColors[currentProject.domain] || 'bg-gray-400'}`} />
            <span className="truncate">{currentProject.name}</span>
          </>
        ) : (
          <>
            <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Sélectionner un projet</span>
          </>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Projets</p>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {projects.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Aucun projet disponible
              </div>
            ) : (
              projects.map((project) => {
                const isActive = currentProject?.id === project.id;
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleSelect(project)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                      isActive ? 'bg-primary/5' : 'hover:bg-secondary'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${domainColors[project.domain] || 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isActive ? 'font-semibold text-primary' : 'text-foreground'}`}>
                        {project.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{project.domain}</p>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={() => { setIsOpen(false); setLocation('/projects'); }}
              className="w-full text-left text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Gérer les projets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
