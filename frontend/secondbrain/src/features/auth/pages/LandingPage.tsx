import { GoogleLoginButton } from '@/features/auth/components/GoogleLoginButton';
import { LandingLayout } from '@/layouts/LandingLayout';

/**
 * 랜딩 페이지
 * - Google 로그인 버튼 표시
 * - 인증 체크는 라우트 레벨(index.tsx)에서 beforeLoad로 처리
 */
export function LandingPage() {
  return (
    <LandingLayout>
      <div className="relative flex h-screen w-screen items-center overflow-hidden">
        {/* 배경 비디오 */}
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute right-0 h-full w-auto min-w-full object-cover"
            preload="metadata"
            poster="/landing-poster.webp"
            style={{ transform: 'scale(1.3) translateX(10%)' }}
          >
            <source src="/landing.mp4" type="video/mp4" />
          </video>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="absolute top-10 left-10 z-10">
          {/* 헤더 섹션 */}
          <div className="mb-12 flex flex-col gap-4">
            <h1 className="text-9xl font-bold tracking-tight text-white">Second Brain</h1>
            <p
              className="text-2xl font-medium text-[#7F86C1]"
              style={{
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2)',
              }}
            >
              새로운 세상을 위한 새로운 두뇌
            </p>
            <div className="pt-3">
              <GoogleLoginButton text="signin" />
            </div>
          </div>
        </div>

        {/* 하단 장식 */}
        <div className="absolute inset-x-0 bottom-0 z-0 h-32 bg-linear-to-t/srgb from-black to-transparent" />
      </div>
    </LandingLayout>
  );
}
