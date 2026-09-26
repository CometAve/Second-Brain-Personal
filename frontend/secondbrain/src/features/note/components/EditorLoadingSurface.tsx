import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

type EditorLoadingSurfaceProps = {
  className?: string;
};

/** Centered loading state below the note toolbar. */
export function EditorLoadingSurface({
  className = 'absolute inset-x-0 top-24 bottom-0',
}: EditorLoadingSurfaceProps) {
  return (
    <div className={`flex items-center justify-center px-6 ${className}`}>
      <LoadingSpinner fullScreen={false} />
    </div>
  );
}
