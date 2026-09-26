import { Outlet } from '@tanstack/react-router';
import { Toaster } from 'sonner';

export function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster theme="dark" position="bottom-right" expand={false} richColors closeButton />
    </>
  );
}
