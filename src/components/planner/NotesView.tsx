import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import type { Note } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from './RichTextEditor';

type SaveState = 'saved' | 'saving' | 'unsaved';

interface NotesViewProps {
  note: Note;
  onUpdateNote: (id: number, changes: { title?: string; content?: string }) => Promise<void>;
  onDeleteNote: (id: number) => Promise<void>;
  onClose: () => void;
}

function formatNoteTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'MMM d, yyyy HH:mm');
}

export function NotesView({
  note,
  onUpdateNote,
  onDeleteNote,
  onClose,
}: NotesViewProps) {
  const [draftTitle, setDraftTitle] = useState(note.title);
  const [draftContent, setDraftContent] = useState(note.content);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const latestSavedRef = useRef({ title: note.title, content: note.content });
  const saveTokenRef = useRef(0);

  useEffect(() => {
    setDraftTitle(note.title);
    setDraftContent(note.content);
    latestSavedRef.current = { title: note.title, content: note.content };
    setSaveState('saved');
  }, [note]);

  useEffect(() => {
    if (
      draftTitle === latestSavedRef.current.title &&
      draftContent === latestSavedRef.current.content
    ) {
      setSaveState('saved');
      return;
    }

    setSaveState('unsaved');
    const token = saveTokenRef.current + 1;
    saveTokenRef.current = token;

    const timer = window.setTimeout(() => {
      setSaveState('saving');

      void onUpdateNote(note.id, {
        title: draftTitle.trim() || 'Untitled note',
        content: draftContent,
      })
        .then(() => {
          if (saveTokenRef.current !== token) return;
          latestSavedRef.current = {
            title: draftTitle.trim() || 'Untitled note',
            content: draftContent,
          };
          setSaveState('saved');
        })
        .catch(() => {
          if (saveTokenRef.current !== token) return;
          setSaveState('unsaved');
        });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [draftContent, draftTitle, note.id, onUpdateNote]);

  const saveLabel =
    saveState === 'saving'
      ? 'Saving...'
      : saveState === 'saved'
        ? 'Saved'
        : 'Unsaved';

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border/30 px-6 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            {saveState === 'saving' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {saveLabel}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => { void onDeleteNote(note.id); }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>

        <Input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="Untitled note"
          className="h-12 border-0 bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
        />

        <p className="mt-2 text-xs text-muted-foreground">
          Updated {formatNoteTimestamp(note.updated_at)}
        </p>
      </div>

      <div className="flex-1 min-h-0 px-6 py-6">
        <RichTextEditor
          content={draftContent}
          onChange={setDraftContent}
          placeholder="Start writing..."
          className="h-full min-h-full border-border/30 shadow-sm"
          editorClassName="min-h-full flex-1 px-0 py-0 text-[15px] leading-7"
        />
      </div>
    </div>
  );
}
