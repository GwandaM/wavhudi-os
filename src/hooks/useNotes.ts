import { useCallback, useEffect, useState } from 'react';
import { DatabaseService } from '@/services/DatabaseService';
import type { Note } from '@/lib/db';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await DatabaseService.getAllNotes();
    setNotes(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createNote = useCallback(async (note: Omit<Note, 'id' | 'created_at' | 'updated_at'>) => {
    const id = await DatabaseService.createNote(note);
    await refresh();
    return id;
  }, [refresh]);

  const updateNote = useCallback(async (id: number, changes: Partial<Omit<Note, 'id' | 'created_at' | 'updated_at'>>) => {
    await DatabaseService.updateNote(id, changes);
    await refresh();
  }, [refresh]);

  const deleteNote = useCallback(async (id: number) => {
    await DatabaseService.deleteNote(id);
    await refresh();
  }, [refresh]);

  return {
    notes,
    loading,
    refresh,
    createNote,
    updateNote,
    deleteNote,
  };
}
