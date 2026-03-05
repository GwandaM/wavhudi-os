import { useState, useEffect, useCallback } from 'react';
import { DatabaseService } from '@/services/DatabaseService';
import type { Project } from '@/lib/db';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await DatabaseService.getAllProjects();
    setProjects(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createProject = useCallback(async (project: Omit<Project, 'id' | 'created_at'>) => {
    const id = await DatabaseService.createProject(project);
    await refresh();
    return id;
  }, [refresh]);

  const updateProject = useCallback(async (id: number, changes: Partial<Project>) => {
    await DatabaseService.updateProject(id, changes);
    await refresh();
  }, [refresh]);

  const deleteProject = useCallback(async (id: number) => {
    await DatabaseService.deleteProject(id);
    await refresh();
  }, [refresh]);

  const getProjectById = useCallback((id: number) => {
    return projects.find(p => p.id === id);
  }, [projects]);

  return {
    projects,
    loading,
    refresh,
    createProject,
    updateProject,
    deleteProject,
    getProjectById,
  };
}
