import { useMemo, useState } from 'react';
import { FilePlus2, Search } from 'lucide-react';
import type { Note } from '@/lib/db';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface SidebarNotesSectionProps {
  notes: Note[];
  loading?: boolean;
  activeNoteId: number | null;
  onSelectNote: (id: number) => void;
  onCreateNote: () => void | Promise<void>;
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function SidebarNotesSection({
  notes,
  loading,
  activeNoteId,
  onSelectNote,
  onCreateNote,
}: SidebarNotesSectionProps) {
  const [query, setQuery] = useState('');

  const filteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return notes;

    return notes.filter((note) => {
      const haystack = `${note.title} ${stripHtml(note.content)}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [notes, query]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes..."
            className="h-8 border-border/40 bg-muted/20 pl-7 text-[12px]"
          />
        </div>
        <button
          type="button"
          onClick={() => { void onCreateNote(); }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/40 bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          title="New note"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-64 space-y-1 overflow-y-auto scrollbar-thin pr-1">
        {loading ? (
          <div className="py-4 text-center text-xs text-muted-foreground">
            Loading notes...
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/40 px-3 py-4 text-center text-xs text-muted-foreground">
            {notes.length === 0 ? 'No notes yet' : 'No notes match your search'}
          </div>
        ) : (
          filteredNotes.map((note) => {
            const preview = stripHtml(note.content) || 'Empty note';
            const active = note.id === activeNoteId;

            return (
              <button
                key={note.id}
                type="button"
                onClick={() => onSelectNote(note.id)}
                className={cn(
                  'w-full rounded-md px-2.5 py-2 text-left transition-colors',
                  active
                    ? 'bg-primary/10 text-foreground ring-1 ring-primary/20'
                    : 'hover:bg-muted/30 text-muted-foreground'
                )}
              >
                <div className={cn('truncate text-[13px] font-medium', active ? 'text-foreground' : 'text-foreground/90')}>
                  {note.title}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                  {preview}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
