// src/shared/hooks/useColumnScale.ts

import { useSyncExternalStore } from 'react';

/**
 * Вычисляет множитель масштаба для ширины колонок таблицы
 * в зависимости от ширины окна пользователя.
 *
 * Базовая ширина: 1920px → scale = 1.0
 *
 * Примеры:
 *  - 1366px  → 1.0  (не уменьшаем ниже 1)
 *  - 1920px  → 1.0
 *  - 2560px  → 1.3
 *  - 3440px  → 1.6  (ultrawide)
 *  - 3840px  → 1.75 (4K)
 */

const BASE_WIDTH = 1920;
const MIN_SCALE = 1.0;
const MAX_SCALE = 2.0;

function calcScale(): number {
    if (typeof window === 'undefined') return 1;

    const w = window.innerWidth;

    if (w <= BASE_WIDTH) return MIN_SCALE;

    // Линейная интерполяция: каждые +1000px → +0.4 масштаба
    const extra = (w - BASE_WIDTH) / 1000;
    const scale = MIN_SCALE + extra * 0.4;

    return Math.min(MAX_SCALE, Math.round(scale * 100) / 100);
}

// Singleton для подписки на resize
let currentScale = calcScale();
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
    let timeout: ReturnType<typeof setTimeout>;

    window.addEventListener('resize', () => {
        clearTimeout(timeout);
        // Debounce 150ms чтобы не дёргать на каждый пиксель
        timeout = setTimeout(() => {
            const next = calcScale();
            if (next !== currentScale) {
                currentScale = next;
                // Обновляем CSS переменную
                document.documentElement.style.setProperty('--col-scale', String(next));
                listeners.forEach(fn => fn());
            }
        }, 150);
    });

    // Устанавливаем начальное значение CSS переменной
    document.documentElement.style.setProperty('--col-scale', String(currentScale));
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
}

function getSnapshot(): number {
    return currentScale;
}

/**
 * Хук: возвращает текущий множитель масштаба колонок
 *
 * Использование:
 * ```tsx
 * const scale = useColumnScale();
 * // scale = 1.0 на 1920px, 1.3 на 2560px, 1.75 на 3840px
 * ```
 */
export function useColumnScale(): number {
    return useSyncExternalStore(subscribe, getSnapshot, () => 1);
}

/**
 * Утилита: применяет масштаб к пикселям
 */
export function scaled(px: number, scale: number): number {
    return Math.round(px * scale);
}