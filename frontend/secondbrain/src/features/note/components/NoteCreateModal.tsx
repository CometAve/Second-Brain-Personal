import { useState, lazy, Suspense } from 'react';
import { SlideOverModal } from '@/shared/components/SlideOverModal/SlideOverModal';
import { GlassElement } from '@/shared/components/GlassElement/GlassElement';
import { ToggleSwitch } from '@/shared/components/ToggleSwitch/ToggleSwitch';
import { NoteTitleInput } from '@/features/note/components/NoteTitleInput';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary/ErrorBoundary';

// 무거운 컴포넌트 lazy loading (Milkdown 번들 분리)
const NoteEditor = lazy(() =>
  import('@/features/note/components/NoteEditor').then((m) => ({ default: m.NoteEditor })),
);
import DeleteIcon from '@/shared/components/icon/Delete.svg?react';
import ExpandIcon from '@/shared/components/icon/Expand.svg?react';
import CompressIcon from '@/shared/components/icon/Compress.svg?react';

interface NoteCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

/**
 * Note 생성 모달 컴포넌트
 * - SlideOverModal + Milkdown 에디터 조합
 * - NoteLayout 버튼 구조 참고
 * - Notion Side Peek 스타일
 */
export function NoteCreateModal({ isOpen, onClose, onDelete }: NoteCreateModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [title, setTitle] = useState('');
  // TODO: NoteEditor ref를 통해 content 추출 및 저장 기능 구현 필요

  function toggleFullscreen() {
    setIsFullscreen((prev) => !prev);
  }

  function handleDelete() {
    if (onDelete) {
      onDelete();
    }
    onClose();
  }

  function handleTogglePublic(checked: boolean) {
    setIsPublic(checked);
    // TODO: isPublic 상태를 노트 저장 시 함께 전송
  }

  return (
    <SlideOverModal
      isOpen={isOpen}
      onClose={onClose}
      width={isFullscreen ? '100%' : '50%'}
      direction="right"
    >
      <div className="relative h-full">
        {/* 상단 좌측: 전체화면 토글 버튼 */}
        <div className="absolute top-10 left-10 z-10">
          <GlassElement
            as="button"
            icon={isFullscreen ? <CompressIcon /> : <ExpandIcon />}
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? '전체화면 해제' : '전체화면 확대'}
          />
        </div>

        {/* 상단 우측: 토글 스위치 + 삭제 버튼 */}
        <div className="absolute top-10 right-10 z-10 flex items-center gap-3">
          <ToggleSwitch checked={isPublic} onChange={handleTogglePublic} />
          <GlassElement
            as="button"
            icon={<DeleteIcon />}
            onClick={handleDelete}
            aria-label="노트 삭제"
          />
        </div>

        {/* Title + 에디터 영역 */}
        <div className="absolute inset-10 flex flex-col gap-4">
          {/* Title input */}
          <NoteTitleInput value={title} onChange={setTitle} />

          {/* Content editor (lazy loaded) */}
          <div className="flex-1">
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <NoteEditor documentId="note-create-modal" initialMarkdown="" />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </SlideOverModal>
  );
}
