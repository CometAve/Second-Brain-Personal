import { type ReactNode, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type SidePeekOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  mode: 'full-screen' | 'side-peek';
  onToggleMode: () => void;
};
const FOCUSABLE_SELECTOR =
  'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/** The same modal surface survives loading, ready and failed states. */
export function SidePeekOverlay({ isOpen, onClose, children, mode }: SidePeekOverlayProps) {
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousInert = new Map<HTMLElement, boolean>();
    for (const child of document.body.children) {
      if (
        child instanceof HTMLElement &&
        child !== overlayRef.current &&
        child.tagName !== 'SCRIPT'
      ) {
        previousInert.set(child, child.inert);
        child.inert = true;
      }
    }
    document.body.style.overflow = 'hidden';
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    return () => {
      for (const [element, inert] of previousInert) element.inert = inert;
      document.body.style.overflow = previousOverflow;
      // Routing can replace the invoker or re-enable it later in this commit.
      queueMicrotask(() => {
        if (document.activeElement !== document.body) return;
        const destination = [
          trigger,
          document.getElementById('search-panel-close'),
          document.getElementById('note-create-button'),
        ].find(
          (element) =>
            element?.isConnected &&
            element.matches(FOCUSABLE_SELECTOR) &&
            !element.closest('[inert]') &&
            element.getClientRects().length > 0,
        );
        destination?.focus();
      });
    };
  }, [isOpen]);

  useEffect(
    () => () => {
      dragRef.current?.abort();
    },
    [],
  );

  return createPortal(
    <div ref={overlayRef}>
      <div
        className={`fixed inset-0 z-100 bg-black/10 transition-opacity duration-150 motion-reduce:transition-none ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="노트 편집"
        aria-modal="true"
        tabIndex={-1}
        inert={!isOpen}
        className={`fixed top-0 right-0 z-110 h-dvh border-l border-[#343d50] bg-[#11151e] outline-hidden transition-opacity duration-150 ease-out motion-reduce:transition-none ${isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'} ${mode === 'full-screen' ? 'w-full' : 'w-full md:w-3/4 lg:w-2/3 xl:w-1/2 2xl:w-2/5'}`}
        style={
          mode === 'side-peek' && customWidth !== null ? { width: `${customWidth}%` } : undefined
        }
        onKeyDown={(event) => {
          if (event.defaultPrevented || event.nativeEvent.isComposing) return;
          if (event.target instanceof Element && event.target.closest('[role="alertdialog"]'))
            return;
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key !== 'Tab') return;
          const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
          ).filter((element) => !element.closest('[inert]') && element.getClientRects().length > 0);
          const first = items[0];
          const last = items.at(-1);
          if (!first || !last) {
            event.preventDefault();
            event.currentTarget.focus();
            return;
          }
          if (
            event.shiftKey &&
            (document.activeElement === first || document.activeElement === event.currentTarget)
          ) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        {mode === 'side-peek' && (
          <div
            className="absolute top-0 left-0 z-20 h-full w-2 cursor-ew-resize hover:bg-white/30 focus-visible:bg-white/30"
            onPointerDown={(event) => {
              const panel = panelRef.current;
              if (!panel) return;
              event.preventDefault();
              dragRef.current?.abort();
              const controller = new AbortController();
              dragRef.current = controller;
              const startX = event.clientX;
              const startWidth = panel.getBoundingClientRect().width;
              const previousSelection = document.body.style.userSelect;
              document.body.style.userSelect = 'none';
              const finish = () => {
                document.body.style.userSelect = previousSelection;
                const width = Number.parseFloat(panel.style.width);
                if (Number.isFinite(width)) setCustomWidth(width);
                controller.abort();
                dragRef.current = null;
              };
              controller.signal.addEventListener(
                'abort',
                () => {
                  document.body.style.userSelect = previousSelection;
                },
                { once: true },
              );
              document.addEventListener(
                'pointermove',
                (move) => {
                  const width = ((startWidth + startX - move.clientX) / window.innerWidth) * 100;
                  panel.style.width = `${Math.min(Math.max(width, Math.min(30, (360 / window.innerWidth) * 100)), 100)}%`;
                },
                { signal: controller.signal },
              );
              document.addEventListener('pointerup', finish, {
                signal: controller.signal,
                once: true,
              });
              document.addEventListener('pointercancel', finish, {
                signal: controller.signal,
                once: true,
              });
            }}
            onDoubleClick={() => setCustomWidth(null)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                const current =
                  ((panelRef.current?.getBoundingClientRect().width ?? window.innerWidth / 2) /
                    window.innerWidth) *
                  100;
                setCustomWidth(
                  Math.min(Math.max(current + (event.key === 'ArrowLeft' ? 5 : -5), 30), 100),
                );
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setCustomWidth(null);
              }
            }}
            role="separator"
            aria-label="패널 크기 조절"
            aria-orientation="vertical"
            aria-valuemin={30}
            aria-valuemax={100}
            aria-valuenow={customWidth ?? 50}
            tabIndex={0}
          />
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
