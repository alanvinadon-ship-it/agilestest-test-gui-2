import { Redirect } from 'wouter';
import { useProject } from '../state/projectStore';
import type { ReactNode } from 'react';

interface RequireProjectProps {
  children: ReactNode;
}

export function RequireProject({ children }: RequireProjectProps) {
  const { currentProject } = useProject();

  if (!currentProject) {
    return <Redirect to="/projects" />;
  }

  return <>{children}</>;
}
