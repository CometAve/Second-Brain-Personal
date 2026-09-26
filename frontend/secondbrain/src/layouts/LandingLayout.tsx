import type { ReactNode } from 'react';
import { BaseLayout } from '@/layouts/BaseLayout';
interface LandingLayoutProps {
  children: ReactNode;
}
export function LandingLayout({ children }: LandingLayoutProps) {
  return (
    <BaseLayout>
      <div className="h-full overflow-y-auto">{children}</div>
    </BaseLayout>
  );
}
