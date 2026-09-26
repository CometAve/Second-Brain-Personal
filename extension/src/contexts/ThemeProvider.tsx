import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils/utils';
import { ThemeContext, type Theme, type ResolvedTheme } from './ThemeContext';

const STORAGE_KEY = 'secondbrain-theme';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as Theme) || defaultTheme;
  });

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Resolve system preference
  const getSystemTheme = (): ResolvedTheme => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // resolvedTheme을 렌더링 중 계산 (파생 상태)
  const resolvedTheme: ResolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  // Apply theme to container ref (works in Shadow DOM)
  useEffect(() => {
    if (containerRef.current) {
      if (resolvedTheme === 'dark') {
        containerRef.current.classList.add('dark');
      } else {
        containerRef.current.classList.remove('dark');
      }
    }
  }, [resolvedTheme]);

  // Listen to system preference changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      // theme이 'system'이므로 강제 리렌더링으로 resolvedTheme 재계산
      // DOM 조작은 위의 useEffect에서 자동으로 처리됨
      setTheme('system');
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  // localStorage 변경 감지 (다른 ThemeProvider 인스턴스와 동기화)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setTheme(e.newValue as Theme);
      }
    };

    const handleThemeChange = ((e: CustomEvent<Theme>) => {
      setTheme(e.detail);
    }) as EventListener;

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('theme-change', handleThemeChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('theme-change', handleThemeChange);
    };
  }, []);

  const value = {
    theme,
    resolvedTheme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(STORAGE_KEY, newTheme);
      setTheme(newTheme);
      // 다른 ThemeProvider 인스턴스에 알림
      window.dispatchEvent(new CustomEvent('theme-change', { detail: newTheme }));
    },
  };

  return (
    <ThemeContext value={value}>
      <div
        ref={containerRef}
        className={cn(resolvedTheme === 'dark' ? 'dark' : '', 'text-foreground')}
      >
        {children}
      </div>
    </ThemeContext>
  );
}
