

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Theme, ThemeContextType } from '../types';
import { STORAGE_KEYS } from '../constants';

const THEME_STORAGE_KEY = STORAGE_KEYS.THEME;

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    return (storedTheme as Theme) || 'system';
  });
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  const applyTheme = useCallback((currentTheme: Theme) => {
    let newEffectiveTheme: 'light' | 'dark';
    if (currentTheme === 'dark') {
      newEffectiveTheme = 'dark';
      document.documentElement.classList.add('dark');
    } else if (currentTheme === 'light') {
      newEffectiveTheme = 'light';
      document.documentElement.classList.remove('dark');
    } else { // system
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) {
        newEffectiveTheme = 'dark';
        document.documentElement.classList.add('dark');
      } else {
        newEffectiveTheme = 'light';
        document.documentElement.classList.remove('dark');
      }
    }
    setEffectiveTheme(newEffectiveTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, applyTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};