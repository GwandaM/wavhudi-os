import { useState, useEffect, useCallback } from 'react';
import { DatabaseService } from '@/services/DatabaseService';
import type { Task } from '@/lib/db';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await DatabaseService.getAllTasks();
    setTasks(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    DatabaseService.seedIfEmpty().then(refresh);
  }, [refresh]);

  const createTask = useCallback(async (task: Omit<Task, 'id' | 'created_at'>) => {
    await DatabaseService.createTask(task);
    await refresh();
  }, [refresh]);

  const updateTask = useCallback(async (id: number, changes: Partial<Task>) => {
    await DatabaseService.updateTask(id, changes);
    await refresh();
  }, [refresh]);

  const deleteTask = useCallback(async (id: number) => {
    await DatabaseService.deleteTask(id);
    await refresh();
  }, [refresh]);

  const moveTaskToDate = useCallback(async (id: number, date: string, newIndex: number) => {
    await DatabaseService.moveTaskToDate(id, date);
    await DatabaseService.reorderTask(id, newIndex);
    await refresh();
  }, [refresh]);

  const moveTaskToBacklog = useCallback(async (id: number) => {
    await DatabaseService.moveTaskToBacklog(id);
    await refresh();
  }, [refresh]);

  const completeTask = useCallback(async (id: number) => {
    await DatabaseService.completeTask(id);
    await refresh();
  }, [refresh]);

  const getTasksForDate = useCallback((date: string) => {
    return tasks
      .filter((t) => {
        if (t.status === 'completed' && t.start_date !== date) return false;
        if (t.status === 'backlog') return false;
        if (!t.start_date) return false;
        if (t.end_date) return date >= t.start_date && date <= t.end_date;
        return t.start_date === date;
      })
      .sort((a, b) => a.order_index - b.order_index);
  }, [tasks]);

  const getBacklogTasks = useCallback(() => {
    return tasks.filter((t) => t.status === 'backlog').sort((a, b) => a.order_index - b.order_index);
  }, [tasks]);

  return {
    tasks,
    loading,
    refresh,
    createTask,
    updateTask,
    deleteTask,
    moveTaskToDate,
    moveTaskToBacklog,
    completeTask,
    getTasksForDate,
    getBacklogTasks,
  };
}
