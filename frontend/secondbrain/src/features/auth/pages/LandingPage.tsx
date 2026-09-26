import { GoogleLoginButton } from '@/features/auth/components/GoogleLoginButton';
import { LandingLayout } from '@/layouts/LandingLayout';
import { BrandLogo } from '@/shared/components/BrandLogo';

export function LandingPage() {
  return (
    <LandingLayout>
      <main className="flex min-h-dvh items-center justify-center px-6 py-12">
        <section className="flex w-full max-w-sm flex-col items-center text-center">
          <BrandLogo className="h-16 w-23" />
          <h1 className="mt-4 text-2xl font-medium tracking-normal">Second Brain</h1>
          <div className="mt-8">
            <GoogleLoginButton />
          </div>
        </section>
      </main>
    </LandingLayout>
  );
}
