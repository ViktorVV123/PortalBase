// src/shared/theme/ThemeContext.tsx
// ═══════════════════════════════════════════════════════════════════════════
// Контекст для управления темой приложения
// ═══════════════════════════════════════════════════════════════════════════

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
    /** Выбранный режим темы */
    mode: ThemeMode;
    /** Реальная применённая тема (light или dark) */
    resolvedTheme: ResolvedTheme;
    /** Изменить режим темы */
    setMode: (mode: ThemeMode) => void;
    /** Переключить между light/dark */
    toggle: () => void;
    /** Является ли тема тёмной */
    isDark: boolean;
    /** Является ли тема светлой */
    isLight: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// КОНСТАНТЫ
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'app-theme-mode';
const THEME_ATTRIBUTE = 'data-theme';

// ═══════════════════════════════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════════════════════════════

function getSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSavedMode(): ThemeMode {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
            return saved;
        }
    } catch (e) {
        // localStorage недоступен
    }
    return 'dark'; // По умолчанию тёмная тема
}

function saveMode(mode: ThemeMode) {
    try {
        localStorage.setItem(STORAGE_KEY, mode);
    } catch (e) {
        // localStorage недоступен
    }
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
    if (mode === 'system') {
        return getSystemTheme();
    }
    return mode;
}

function applyThemeToDOM(theme: ResolvedTheme) {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);

    // Также обновляем meta theme-color для мобильных браузеров
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#FAFAFA');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// КОНТЕКСТ
// ═══════════════════════════════════════════════════════════════════════════

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ═══════════════════════════════════════════════════════════════════════════
// ПРОВАЙДЕР
// ═══════════════════════════════════════════════════════════════════════════

type ThemeProviderProps = {
    children: React.ReactNode;
    /** Начальный режим (переопределяет сохранённый) */
    defaultMode?: ThemeMode;
};

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, defaultMode }) => {
    const [mode, setModeState] = useState<ThemeMode>(() => defaultMode ?? getSavedMode());
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(mode));

    // Применяем тему при изменении mode
    useEffect(() => {
        const resolved = resolveTheme(mode);
        setResolvedTheme(resolved);
        applyThemeToDOM(resolved);
        saveMode(mode);
    }, [mode]);

    // Слушаем изменения системной темы
    useEffect(() => {
        if (mode !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e: MediaQueryListEvent) => {
            const newTheme = e.matches ? 'dark' : 'light';
            setResolvedTheme(newTheme);
            applyThemeToDOM(newTheme);
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [mode]);

    // Применяем тему при монтировании (для SSR/hydration)
    useEffect(() => {
        applyThemeToDOM(resolvedTheme);
    }, []);

    const setMode = useCallback((newMode: ThemeMode) => {
        setModeState(newMode);
    }, []);

    const toggle = useCallback(() => {
        setModeState((current) => {
            // Если system — переключаем на противоположную системной
            if (current === 'system') {
                return getSystemTheme() === 'dark' ? 'light' : 'dark';
            }
            // Иначе просто переключаем
            return current === 'dark' ? 'light' : 'dark';
        });
    }, []);

    const value = useMemo<ThemeContextValue>(() => ({
        mode,
        resolvedTheme,
        setMode,
        toggle,
        isDark: resolvedTheme === 'dark',
        isLight: resolvedTheme === 'light',
    }), [mode, resolvedTheme, setMode, toggle]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// ХУК
// ═══════════════════════════════════════════════════════════════════════════

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (!context) {
        // Fallback если используется вне ThemeProvider
        console.warn('[useTheme] Used outside ThemeProvider, returning defaults');
        return {
            mode: 'dark',
            resolvedTheme: 'dark',
            setMode: () => {},
            toggle: () => {},
            isDark: true,
            isLight: false,
        };
    }
    return context;
}

// ═══════════════════════════════════════════════════════════════════════════
// ЭКСПОРТ
// ═══════════════════════════════════════════════════════════════════════════

export default ThemeProvider;