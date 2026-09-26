export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Global toast queue (outside React)
let toastQueue: Toast[] = [];
const listeners = new Set<() => void>();

export function getToastSnapshot(): Toast[] {
  return toastQueue;
}

export function subscribeToToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function addToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const toast: Toast = {
    id: `toast-${Date.now()}-${Math.random()}`,
    message,
    type,
  };

  toastQueue = [...toastQueue, toast];
  notifyListeners();

  // Auto remove after 4s
  setTimeout(() => {
    removeToast(toast.id);
  }, 4000);
}

export function removeToast(id: string) {
  toastQueue = toastQueue.filter((t) => t.id !== id);
  notifyListeners();
}

export const showToast = addToast;
