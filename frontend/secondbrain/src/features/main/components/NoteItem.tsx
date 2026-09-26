import { useNavigate } from '@tanstack/react-router';
import { Check, FileText, ArrowUpRight } from 'lucide-react';
import type { Note, RecentNote } from '@/features/main/types/search';

interface NoteItemProps {
  note: Note | RecentNote;
  isSelected: boolean;
  onToggle: (id: number) => void;
  isDeleteMode: boolean;
}

export function NoteItem({ note, isSelected, onToggle, isDeleteMode }: NoteItemProps) {
  const navigate = useNavigate();
  const id = 'noteId' in note ? note.noteId : note.id;
  const preview =
    'content' in note
      ? note.content
          .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
          .replace(/[#*`>_~]/g, '')
          .trim()
      : null;
  const rowClassName =
    'group flex w-full items-start gap-3 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-white/5 focus-visible:bg-white/5';
  const content = (
    <span className="min-w-0 flex-1">
      <span className="line-clamp-2 text-sm leading-6 font-medium wrap-break-word text-foreground">
        {note.title}
      </span>
      {preview && (
        <span className="mt-1 line-clamp-2 text-xs leading-5 wrap-break-word text-muted-foreground">
          {preview}
        </span>
      )}
    </span>
  );

  if (isDeleteMode) {
    return (
      <label className={`${rowClassName} cursor-pointer ${isSelected ? 'bg-primary/8' : ''}`}>
        <input
          type="checkbox"
          className="peer sr-only"
          checked={isSelected}
          onChange={() => onToggle(id)}
          aria-label={note.title}
        />
        <span
          aria-hidden="true"
          className={`mt-1 flex size-4.5 shrink-0 items-center justify-center rounded border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-primary ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'}`}
        >
          {isSelected && <Check className="size-3.5" />}
        </span>
        {content}
      </label>
    );
  }

  return (
    <button
      type="button"
      data-note-link
      className={rowClassName}
      onClick={() => void navigate({ to: '/notes/$noteId', params: { noteId: String(id) } })}
    >
      <FileText className="mt-1 size-4.5 shrink-0 text-primary/70" aria-hidden="true" />
      {content}
      <ArrowUpRight
        className="mt-1 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
}
