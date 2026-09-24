import { useNavigate } from '@tanstack/react-router';
import { Check } from 'lucide-react';

interface NoteItemProps {
  note: {
    noteId?: number;
    id?: number;
    title: string;
    content?: string;
  };
  isSelected: boolean;
  onToggle: (id: number) => void;
  isDeleteMode: boolean;
}

export function NoteItem({ note, isSelected, onToggle, isDeleteMode }: NoteItemProps) {
  const navigate = useNavigate();
  const id = note.noteId ?? note.id ?? 0;

  const handleItemClick = () => {
    if (isDeleteMode) {
      // 삭제 모드: 선택 토글
      onToggle(id);
    } else {
      // 일반 모드: 노트 상세로 이동
      void navigate({
        to: '/notes/$noteId',
        params: { noteId: id.toString() },
      });
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(id);
  };

  return (
    <div
      onClick={handleItemClick}
      className={`flex items-center px-3 py-5 transition-all duration-200 ${
        isDeleteMode
          ? 'cursor-pointer hover:rounded-lg hover:bg-white/5'
          : 'cursor-pointer hover:rounded-lg hover:bg-white/10'
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleItemClick();
        }
      }}
    >
      {/* 체크박스: 삭제 모드일 때만 표시 */}
      {isDeleteMode && (
        <button
          onClick={handleCheckboxClick}
          className={`mr-3 flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
            isSelected
              ? 'border-green-500 bg-white'
              : 'border-white/80 bg-transparent hover:border-white'
          }`}
          aria-label="노트 선택"
          aria-checked={isSelected}
          role="checkbox"
        >
          {isSelected && <Check className="size-4 stroke-3 text-green-500" />}
        </button>
      )}

      <h3
        className={`flex-1 truncate text-base font-normal text-white/90 ${
          isDeleteMode ? '' : 'hover:text-white'
        }`}
      >
        {note.title}
      </h3>
    </div>
  );
}
