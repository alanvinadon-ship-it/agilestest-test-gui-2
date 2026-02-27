/**
 * ProjectProvider — Manages the currently selected project.
 *
 * MIGRATION NOTE:
 * - Replaced raw localStorage with uiStorage (lastProjectId only).
 * - Project details are fetched from tRPC when a lastProjectId is stored.
 * - selectProject stores the ID in uiStorage and sets state.
 */

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import type { Project } from "../types";
import { uiGet, uiSet, uiRemove } from "@/lib/uiStorage";
import { trpc } from "@/lib/trpc";

interface ProjectStoreValue {
  currentProject: Project | null;
  selectProject: (project: Project) => void;
  clearProject: () => void;
}

const ProjectStoreContext = createContext<ProjectStoreValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // On mount, try to restore last selected project from uiStorage
  const lastProjectId = uiGet("lastProjectId");
  const projectQuery = trpc.projects.get.useQuery(
    { projectId: String(lastProjectId ?? "") },
    {
      enabled: lastProjectId !== null && lastProjectId !== "" && currentProject === null,
      retry: false,
    }
  );

  // When the query resolves, set the current project
  useEffect(() => {
    if (projectQuery.data && !currentProject) {
      const p = projectQuery.data;
      setCurrentProject({
        id: p.uid || String(p.id),
        name: p.name,
        description: p.description ?? "",
        domain: p.domain,
        status: p.status as Project["status"],
        created_by: String(p.createdBy),
        created_at: p.createdAt ? new Date(p.createdAt).toISOString() : "",
        updated_at: p.updatedAt ? new Date(p.updatedAt).toISOString() : "",
      });
    }
  }, [projectQuery.data, currentProject]);

  const selectProject = useCallback((project: Project) => {
    uiSet("lastProjectId", project.id);
    setCurrentProject(project);
  }, []);

  const clearProject = useCallback(() => {
    uiRemove("lastProjectId");
    setCurrentProject(null);
  }, []);

  return (
    <ProjectStoreContext.Provider value={{ currentProject, selectProject, clearProject }}>
      {children}
    </ProjectStoreContext.Provider>
  );
}

export function useProject(): ProjectStoreValue {
  const ctx = useContext(ProjectStoreContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
