import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { MainPage } from '@/features/main/pages/MainPage';

/**
 * Search Params 스키마 정의
 * - draft: Draft UUID (선택)
 * - noteId: Note ID (선택)
 */
const mainSearchSchema = z.object({
  draft: z.string().uuid().optional(),
  noteId: z.number().int().positive().optional(),
});

export type MainSearch = z.infer<typeof mainSearchSchema>;

/**
 * 메인 라우트 (/main)
 * - 보호된 라우트 (인증 필요)
 * - Search Params 검증 (Zod)
 * - beforeLoad에서 인증 체크 및 리다이렉트
 * - 컴포넌트 렌더링 전에 인증 상태 검증
 */
export const Route = createFileRoute('/main')({
  validateSearch: mainSearchSchema,
  // 라우트 로드 전 인증 체크 (TanStack Router 공식 권장 패턴)
  beforeLoad: ({ context }) => {
    // 미인증 사용자는 랜딩페이지로 리다이렉트
    if (!context.auth.isAuthenticated) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: '/' });
    }
  },
  component: MainPage,
});
