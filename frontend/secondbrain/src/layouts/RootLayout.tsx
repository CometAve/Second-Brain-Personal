import { Outlet } from '@tanstack/react-router';
import { Toaster } from 'sonner';

export function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster position="top-right" expand={false} richColors closeButton />
    </>
  );
}
