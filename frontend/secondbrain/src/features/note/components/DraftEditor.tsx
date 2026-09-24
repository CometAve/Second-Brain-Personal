import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useNoteDraft } from '@/features/note/hooks/useNoteDraft';
import { SidePeekOverlay } from '@/features/note/components/SidePeekOverlay';
import { DraftToolbar } from '@/features/note/components/DraftToolbar';
import { NoteTitleInput } from '@/features/note/components/NoteTitleInput';
import { NoteEditor } from '@/features/note/components/NoteEditor';
import { useGraphStore } from '@/features/main/stores/graphStore';
import '@/shared/styles/custom-scrollbar.css';

interface DraftEditorProps {
  draftId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Draft 에디터 (Side Peek)
 * - NoteTitleInput + NoteEditor 재사용
 * - 자동 저장 (useNoteDraft)
 * - Toolbar: 뒤로가기, 모드 전환, 삭제
 * - 전체화면/부분화면 모드 지원
 * - draftId가 변경되면 key로 컴포넌트 리셋 (React 권장 패턴)
 */
export function DraftEditor({ draftId, isOpen, onClose }: DraftEditorProps) {
  return <DraftEditorInternal key={draftId} draftId={draftId} isOpen={isOpen} onClose={onClose} />;
}

/**
 * Draft 에디터 내부 구현
 * - key prop에 의해 draftId 변경 시 자동 리셋
 * - useEffect 없이 효율적인 상태 관리
 */
function DraftEditorInternal({ draftId, isOpen, onClose }: DraftEditorProps) {
  // 뷰 모드 상태 (draftId 변경 시 key로 자동 리셋됨)
  const [viewMode, setViewMode] = useState<'full-screen' | 'side-peek'>('full-screen');

  // Graph 렌더링 제어 (GPU 최적화)
  const { pauseGraph, resumeGraph } = useGraphStore();

  // isOpen=true일 때만 Graph 일시정지, cleanup에서 재개
  useEffect(() => {
    if (!isOpen) return;

    pauseGraph();
    return () => resumeGraph();
  }, [isOpen, pauseGraph, resumeGraph]);

  const handleToggleMode = () => {
    setViewMode((prev) => (prev === 'full-screen' ? 'side-peek' : 'full-screen'));
  };
  const {
    title,
    content,
    isLoading,
    handleTitleChange,
    handleContentChange,
    saveToDatabase,
    deleteDraft,
  } = useNoteDraft({
    draftId,
    onSaveToDatabase: () => {
      // DB 저장 성공 → 오버레이만 닫기 (main 페이지로 돌아감)
      onClose();
    },
  });

  const handleClose = async () => {
    // 유효한 Draft → DB 저장
    if (title.trim() && content.trim()) {
      try {
        await saveToDatabase();
        // saveToDatabase() 성공 시:
        // - DB에 Note 저장
        // - Redis에서 Draft 삭제
        // - onSaveToDatabase 콜백 실행 → onClose()
        return;
      } catch (error) {
        console.error('DB 저장 실패:', error);
        toast.error('노트 저장에 실패했습니다', {
          description: '작성하신 내용은 임시 저장되었어요. 잠시 후 다시 시도해주세요.',
        });
        // 에러 시 그냥 닫기 (Draft는 Redis에 유지)
      }
    }

    // 빈 Draft → Redis 삭제
    if (!title.trim() && !content.trim()) {
      try {
        await deleteDraft();
      } catch (error) {
        console.error('Draft 삭제 실패:', error);
      }
    }

    onClose();
  };

  const handleDelete = () => {
    void deleteDraft();
    onClose();
  };

  return (
    <SidePeekOverlay
      isOpen={isOpen}
      onClose={() => void handleClose()}
      mode={viewMode}
      onToggleMode={handleToggleMode}
    >
      <DraftToolbar
        onBack={() => void handleClose()}
        onDelete={handleDelete}
        mode={viewMode}
        onToggleMode={handleToggleMode}
      />

      {/* 중앙 컨텐츠: Title + Editor (전체 스크롤) */}
      <div className="custom-scrollbar absolute inset-x-0 top-32 bottom-0 flex flex-col items-center gap-8 overflow-y-auto px-24">
        <div
          className={`flex w-full max-w-4xl flex-col transition-all duration-500 ease-out ${
            isOpen ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}
          style={{
            transitionDelay: isOpen ? '150ms' : '0ms',
          }}
        >
          {/* 제목 입력 */}
          <NoteTitleInput
            value={title}
            onChange={handleTitleChange}
            placeholder="제목을 입력해주세요..."
          />

          {/* 마크다운 에디터 */}
          <div className="pb-20">
            {!isLoading && <NoteEditor defaultValue={content} onChange={handleContentChange} />}
          </div>
        </div>
      </div>
    </SidePeekOverlay>
  );
}
