import { RefreshCw } from 'lucide-react';
import { BrandLogo } from '@/shared/components/BrandLogo';
import { Button } from '@/shared/components/ui/button';
export function SessionRestoreError() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background p-6 text-center text-foreground">
      <BrandLogo className="mb-2 h-20 w-28" />
      <div role="alert">
        <h1 className="text-base font-medium">로그인 상태를 확인하지 못했습니다.</h1>
      </div>
      <Button onClick={() => window.location.reload()}>
        <RefreshCw className="size-4" aria-hidden="true" />
        다시 시도
      </Button>
    </main>
  );
}
