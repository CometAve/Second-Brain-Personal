import { useSyncExternalStore } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

import { getToastSnapshot, removeToast, subscribeToToasts, type Toast } from './simpleToastStore';

/**
 * Toast Item Component
 */
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const iconMap = {
    success: <CheckCircle className="size-5 text-green-500" />,
    error: <XCircle className="size-5 text-red-500" />,
    info: <Info className="size-5 text-blue-500" />,
  };

  const bgColorMap = {
    success: '#f0fdf4',
    error: '#fef2f2',
    info: '#eff6ff',
  };

  const borderColorMap = {
    success: '#86efac',
    error: '#fca5a5',
    info: '#93c5fd',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: bgColorMap[toast.type],
        border: `1px solid ${borderColorMap[toast.type]}`,
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        minWidth: '300px',
        maxWidth: '400px',
        pointerEvents: 'auto',
        animation: 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {iconMap[toast.type]}
      <span
        style={{
          flex: 1,
          fontSize: '14px',
          color: '#1f2937',
          fontWeight: 500,
        }}
      >
        {toast.message}
      </span>
      <button
        onClick={onClose}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          borderRadius: '4px',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <X className="size-4 text-gray-500" />
      </button>
    </div>
  );
}

/**
 * Simple Toast Container for Shadow DOM
 * - No external dependencies (Sonner removed)
 * - Inline styles for Shadow DOM compatibility
 * - Global toast queue management
 */
export function SimpleToastContainer() {
  const toasts = useSyncExternalStore(subscribeToToasts, getToastSnapshot);

  if (toasts.length === 0) return null;

  return (
    <>
      {/* Inject keyframes for animations */}
      <style>
        {`
          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>

      <div
        style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </>
  );
}
