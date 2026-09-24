import { useState, lazy, Suspense } from 'react';
import { NoteLayout } from '@/layouts/NoteLayout';
import { NoteTitleInput } from '@/features/note/components/NoteTitleInput';
import { ToggleSwitch } from '@/shared/components/ToggleSwitch/ToggleSwitch';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary/ErrorBoundary';

// 무거운 컴포넌트 lazy loading (Milkdown 번들 분리)
const NoteEditor = lazy(() =>
  import('@/features/note/components/NoteEditor').then((m) => ({ default: m.NoteEditor })),
);
import { GlassElement } from '@/shared/components/GlassElement/GlassElement';
import { useAuthStore } from '@/stores/authStore';
import { useReminderToggle } from '@/features/reminder/hooks/useReminderToggle';
import LogoIcon from '@/shared/components/icon/Logo.svg?react';
import '@/shared/styles/custom-scrollbar.css';

/**
 * NotePage 컴포넌트
 * - 보호된 라우트: /note (인증 필요)
 * - NoteLayout 사용 (BackArrow, DeleteIcon, PlusIcon 자동 제공)
 * - Logo: BackArrow 옆 추가
 * - ToggleSwitch: DeleteIcon 옆 추가 (리마인드 기능)
 * - NoteTitleInput + NoteEditor 중앙 배치
 * - Notion 스타일 UI
 */
export function NotePage() {
  const [title, setTitle] = useState('');
  // TODO: NoteEditor ref를 통해 content 추출 후 자동 저장 연동 필요

  // Reminder 상태 관리 (서버와 동기화)
  const { user } = useAuthStore();
  const { toggle: toggleReminder, isLoading: isTogglingReminder } = useReminderToggle();

  // 현재 리마인드 상태는 user.setAlarm에서 가져옴
  const isReminderEnabled = user?.setAlarm ?? false;

  function handleToggleReminder() {
    if (isTogglingReminder) return;
    toggleReminder();
  }

  return (
    <NoteLayout>
      {/* 좌측 상단: BackArrow 옆 Logo (BackArrow는 NoteLayout이 제공) */}
      <div className="fixed top-10 left-30 z-10">
        <GlassElement
          as="button"
          icon={<LogoIcon className="size-8" />}
          aria-label="Second Brain Logo"
        />
      </div>

      {/* 우측 상단: DeleteIcon 옆 ToggleSwitch (DeleteIcon은 NoteLayout이 제공) */}
      <div className="fixed top-10 right-30 z-10 flex h-14 items-center gap-3">
        <span className="text-sm font-medium text-white">리마인드</span>
        <ToggleSwitch
          checked={isReminderEnabled}
          onChange={handleToggleReminder}
          disabled={isTogglingReminder}
        />
      </div>

      {/* 중앙 컨텐츠: Title + Editor (Page 전체 스크롤) */}
      <div className="custom-scrollbar absolute inset-x-0 top-32 bottom-0 flex flex-col items-center gap-8 overflow-y-auto px-32">
        {/* 컨텐츠 영역 - Notion 스타일 최대 너비 제한 */}
        <div className="flex w-full max-w-225 flex-col">
          {/* 제목 입력 */}
          <NoteTitleInput value={title} onChange={setTitle} placeholder="제목을 입력해주세요..." />

          {/* 마크다운 에디터 (lazy loaded) */}
          <div className="pb-20">
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <NoteEditor defaultValue="" />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </NoteLayout>
  );
}
