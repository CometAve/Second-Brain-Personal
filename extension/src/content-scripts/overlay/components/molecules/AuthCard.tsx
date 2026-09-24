import { GoogleLoginButton } from '@/content-scripts/overlay/GoogleLoginButton';
import { Spinner } from '@/content-scripts/overlay/components/atoms/Spinner';

/**
 * Auth Card (Molecule)
 * - 로딩/로그인 상태를 하나의 컴포넌트에서 처리
 * - Spinner DOM을 항상 유지하여 애니메이션 연속성 보장
 * - 하단 내용만 크로스페이드 전환으로 부드러운 UX
 * - Shadcn UI + Tailwind CSS 기반
 */

export interface AuthCardProps {
  /**
   * 카드 상태
   * - 'loading': 로딩/로그인/로그아웃 중
   * - 'login': 로그인 화면
   */
  state: 'loading' | 'login';

  /**
   * 로딩 메시지 (state='loading'일 때만 사용)
   * @example '로그인 중...', '로그아웃 중...', '로딩 중...'
   */
  message?: string;
}

export function AuthCard({ state, message = '로딩 중...' }: AuthCardProps) {
  return (
    <div className="w-80 rounded-xl border border-border bg-card p-6 shadow-lg">
      {/* Spinner - 항상 렌더링으로 DOM 유지, 애니메이션 연속성 보장 */}
      <div className="mb-6 flex justify-center">
        <Spinner size="lg" duration={6} />
      </div>

      {/* 하단 내용 - 크로스페이드 전환으로 부드러운 전환 */}
      <div className="relative min-h-20">
        {/* Loading 상태 내용 */}
        <div
          className={`transition-opacity duration-300 ${
            state === 'loading' ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0'
          }`}
        >
          <p className="text-center text-sm text-muted-foreground">{message}</p>
        </div>

        {/* Login 상태 내용 */}
        <div
          className={`transition-opacity duration-300 ${
            state === 'login' ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <h3 className="mb-2 text-center text-lg font-semibold text-card-foreground">
            Second Brain
          </h3>

          <div className="flex justify-center">
            <GoogleLoginButton text="signin" />
          </div>
        </div>
      </div>
    </div>
  );
}
