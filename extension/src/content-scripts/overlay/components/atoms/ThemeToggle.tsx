import { Sun, Moon } from 'lucide-react';
import { Button } from '@/content-scripts/overlay/components/ui/button';
import { SimpleTooltip } from '@/content-scripts/overlay/components/ui/simple-tooltip';
import { useTheme } from '@/hooks/useTheme';

/**
 * Theme Toggle Button (Atom)
 * - Light/Dark 모드 전환
 * - Sun/Moon 아이콘 자동 전환
 * - Simple Tooltip 포함
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function handleToggle() {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }

  return (
    <SimpleTooltip content={resolvedTheme === 'dark' ? '라이트 모드' : '다크 모드'} side="bottom">
      <Button variant="ghost" size="icon-sm" onClick={handleToggle}>
        <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        <span className="sr-only">테마 전환</span>
      </Button>
    </SimpleTooltip>
  );
}
