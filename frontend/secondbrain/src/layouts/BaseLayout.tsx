import type { ReactNode } from 'react';
interface BaseLayoutProps {
  children: ReactNode;
}
export function BaseLayout({ children }: BaseLayoutProps) {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background text-foreground">
      {children}
    </div>
  );
}
