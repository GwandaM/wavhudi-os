import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useCallback, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Table as TableIcon,
  Heading2,
  Heading3,
  Quote,
  Code,
  Palette,
  Highlighter,
  Undo,
  Redo,
  Minus,
  Trash2,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
}

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Purple', value: '#a855f7' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Gray', value: '#6b7280' },
];

const HIGHLIGHT_COLORS = [
  { label: 'None', value: '' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Pink', value: '#fbcfe8' },
  { label: 'Purple', value: '#e9d5ff' },
  { label: 'Orange', value: '#fed7aa' },
];

const DEFAULT_TABLE_ROWS = 4;
const DEFAULT_TABLE_COLS = 4;
const MIN_TABLE_DIMENSION = 1;
const MAX_TABLE_DIMENSION = 12;

function clampTableDimension(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(MAX_TABLE_DIMENSION, Math.max(MIN_TABLE_DIMENSION, parsed));
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-7 w-7 flex items-center justify-center rounded transition-colors',
        isActive
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border/60 mx-0.5" />;
}

function ColorPicker({
  colors,
  activeColor,
  onSelect,
  icon: Icon,
  title,
}: {
  colors: { label: string; value: string }[];
  activeColor: string | undefined;
  onSelect: (color: string) => void;
  icon: typeof Palette;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <ToolbarButton
        onClick={() => setOpen(!open)}
        isActive={!!activeColor}
        title={title}
      >
        <Icon className="h-3.5 w-3.5" />
      </ToolbarButton>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-2 grid grid-cols-5 gap-1 min-w-[140px]">
          {colors.map((c) => (
            <button
              key={c.label}
              type="button"
              title={c.label}
              onClick={() => {
                onSelect(c.value);
                setOpen(false);
              }}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                activeColor === c.value ? 'border-primary ring-2 ring-primary/30' : 'border-border/40',
                !c.value && 'bg-foreground'
              )}
              style={c.value ? { backgroundColor: c.value } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [tableRows, setTableRows] = useState(DEFAULT_TABLE_ROWS);
  const [tableCols, setTableCols] = useState(DEFAULT_TABLE_COLS);
  const tableMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTableMenu) return;
    const handler = (e: MouseEvent) => {
      if (tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) {
        setShowTableMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTableMenu]);

  const currentColor = editor.getAttributes('textStyle').color;
  const currentHighlight = editor.getAttributes('highlight').color;
  const isInTable = editor.isActive('table');

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run();
    setTableRows(DEFAULT_TABLE_ROWS);
    setTableCols(DEFAULT_TABLE_COLS);
    setShowTableMenu(false);
  };

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-border/40 bg-muted/30">
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (⌘B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (⌘I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (⌘U)"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="Inline code"
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Colors */}
      <ColorPicker
        colors={TEXT_COLORS}
        activeColor={currentColor}
        onSelect={(color) => {
          if (color) {
            editor.chain().focus().setColor(color).run();
          } else {
            editor.chain().focus().unsetColor().run();
          }
        }}
        icon={Palette}
        title="Text color"
      />
      <ColorPicker
        colors={HIGHLIGHT_COLORS}
        activeColor={currentHighlight}
        onSelect={(color) => {
          if (color) {
            editor.chain().focus().toggleHighlight({ color }).run();
          } else {
            editor.chain().focus().unsetHighlight().run();
          }
        }}
        icon={Highlighter}
        title="Highlight"
      />

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered list"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>

      {/* Blockquote */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Blockquote"
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>

      {/* Horizontal rule */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Table */}
      <div className="relative" ref={tableMenuRef}>
        <ToolbarButton
          onClick={() => setShowTableMenu(!showTableMenu)}
          isActive={isInTable}
          title="Table"
        >
          <TableIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        {showTableMenu && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[220px]">
            {!isInTable ? (
              <div className="space-y-2 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium text-muted-foreground">
                      Rows
                    </span>
                    <Input
                      type="number"
                      min={MIN_TABLE_DIMENSION}
                      max={MAX_TABLE_DIMENSION}
                      value={tableRows}
                      onChange={(e) => setTableRows(clampTableDimension(e.target.value, DEFAULT_TABLE_ROWS))}
                      className="h-8 px-2 text-xs"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[11px] font-medium text-muted-foreground">
                      Columns
                    </span>
                    <Input
                      type="number"
                      min={MIN_TABLE_DIMENSION}
                      max={MAX_TABLE_DIMENSION}
                      value={tableCols}
                      onChange={(e) => setTableCols(clampTableDimension(e.target.value, DEFAULT_TABLE_COLS))}
                      className="h-8 px-2 text-xs"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2 rounded text-xs font-medium hover:bg-muted transition-colors px-2.5 py-1.5"
                  onClick={insertTable}
                >
                  <Plus className="h-3 w-3" />
                  Insert {tableRows}×{tableCols} table
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs hover:bg-muted transition-colors"
                  onClick={() => { editor.chain().focus().addColumnAfter().run(); setShowTableMenu(false); }}
                >
                  Add column after
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs hover:bg-muted transition-colors"
                  onClick={() => { editor.chain().focus().addRowAfter().run(); setShowTableMenu(false); }}
                >
                  Add row after
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs hover:bg-muted transition-colors"
                  onClick={() => { editor.chain().focus().deleteColumn().run(); setShowTableMenu(false); }}
                >
                  Delete column
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs hover:bg-muted transition-colors"
                  onClick={() => { editor.chain().focus().deleteRow().run(); setShowTableMenu(false); }}
                >
                  Delete row
                </button>
                <div className="my-1 h-px bg-border/40" />
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => { editor.chain().focus().deleteTable().run(); setShowTableMenu(false); }}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete table
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <ToolbarDivider />

      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (⌘Z)"
      >
        <Undo className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (⌘⇧Z)"
      >
        <Redo className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({ content, onChange, onBlur, placeholder, className, editorClassName }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleUpdate = useCallback(({ editor }: { editor: Editor }) => {
    const html = editor.getHTML();
    const isEmpty = editor.isEmpty;
    onChangeRef.current(isEmpty ? '' : html);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: 'tiptap-table' },
      }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder: placeholder || 'Start writing...',
      }),
    ],
    content: content || '',
    onUpdate: handleUpdate,
    onBlur: () => onBlur?.(),
    editorProps: {
      attributes: {
        class: cn(
          'tiptap prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[120px] px-3 py-2',
          editorClassName
        ),
      },
    },
  });

  // Sync content when the task changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML() && content !== (editor.isEmpty ? '' : editor.getHTML())) {
      editor.commands.setContent(content || '');
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className={cn('flex flex-col rounded-lg border border-border/40 bg-card overflow-hidden transition-all focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/20', className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
