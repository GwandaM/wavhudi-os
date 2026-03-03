import { useState } from 'react';
import { Plus } from 'lucide-react';

interface AddTaskInputProps {
  onAdd: (title: string) => void;
  placeholder?: string;
}

export function AddTaskInput({ onAdd, placeholder = 'Add a task...' }: AddTaskInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="flex-1 flex items-center gap-2 rounded-lg border bg-card px-3 py-2 transition-colors focus-within:border-primary/30">
        <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
        />
      </div>
    </form>
  );
}
