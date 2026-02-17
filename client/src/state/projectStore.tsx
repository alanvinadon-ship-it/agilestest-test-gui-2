import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Project } from '../types';

const STORAGE_KEY = 'agilestest_current_project';

interface ProjectStoreValue {
  currentProject: Project | null;
  selectProject: (project: Project) => void;
  clearProject: () => void;
}

const ProjectStoreContext = createContext<ProjectStoreValue | null>(null);

function loadProjectFromStorage(): Project | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (json) return JSON.parse(json) as Project;
  } catch {
    // corrupted
  }
  return null;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Project | null>(loadProjectFromStorage);

  const selectProject = useCallback((project: Project) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    setCurrentProject(project);
  }, []);

  const clearProject = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCurrentProject(null);
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setCurrentProject(loadProjectFromStorage());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <ProjectStoreContext.Provider value={{ currentProject, selectProject, clearProject }}>
      {children}
    </ProjectStoreContext.Provider>
  );
}

export function useProject(): ProjectStoreValue {
  const ctx = useContext(ProjectStoreContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
