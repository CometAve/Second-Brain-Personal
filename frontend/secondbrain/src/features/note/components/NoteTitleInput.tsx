import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { ChangeEvent, Ref } from 'react';

type NoteTitleInputProps = {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  onEnter?: () => void;
  ref?: Ref<HTMLTextAreaElement>;
};

/** Titles wrap visually; Enter moves to the body without inserting a line break. */
export function NoteTitleInput({
  value,
  onChange,
  placeholder = '제목',
  readOnly = false,
  autoFocus = false,
  onEnter,
  ref,
}: NoteTitleInputProps) {
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const attachRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      titleRef.current = node;
      if (typeof ref === 'function') return ref(node);
      if (ref) ref.current = node;
    },
    [ref],
  );

  useLayoutEffect(() => {
    const textarea = titleRef.current;
    if (!textarea) return;
    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [value]);

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const textarea = titleRef.current;
    if (!textarea || !onEnter) return;
    // An IME owns its Enter key until composition ends. Suppress only the
    // browser's line-break insertion, without cancelling composition input.
    const preventLineBreak = (event: InputEvent) => {
      if (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph') {
        event.preventDefault();
      }
    };
    textarea.addEventListener('beforeinput', preventLineBreak);
    return () => textarea.removeEventListener('beforeinput', preventLineBreak);
  }, [onEnter]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange?.(event.currentTarget.value);
  }

  return (
    <textarea
      ref={attachRef}
      value={value}
      onChange={handleChange}
      readOnly={readOnly}
      onKeyDown={(event) => {
        if (event.defaultPrevented || event.nativeEvent.isComposing || readOnly) return;
        if (event.key === 'Enter' && onEnter) {
          event.preventDefault();
          onEnter();
        }
      }}
      placeholder={placeholder}
      rows={1}
      className="mb-6 w-full resize-none overflow-hidden border-0 bg-transparent text-[clamp(24px,3vw,32px)] leading-snug font-semibold tracking-normal text-[#eef1f6] ring-0 outline-hidden placeholder:text-[#768298] focus:border-0 focus:ring-0 focus:outline-hidden"
      aria-label="노트 제목"
    />
  );
}
