import { createContext } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const initialState: ThemeContextType = {
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => null,
};

export const ThemeContext = createContext<ThemeContextType>(initialState);
