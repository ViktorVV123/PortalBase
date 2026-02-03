// src/shared/hooks/useColumnResize.ts

import { useState, useCallback, useEffect, useRef } from 'react';

// ═══════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════

export type ColumnWidths = Record<string, number>; // key: "widgetColId:tableColId" → width in px

type StoredData = {
    widths: ColumnWidths;
    updatedAt: number;
};

// ═══════════════════════════════════════════════════════════
// КОНСТАНТЫ
// ═══════════════════════════════════════════════════════════

const STORAGE_PREFIX = 'table-col-widths-form-';
const MIN_COL_WIDTH = 30;  // минимум для одной колонки
const MAX_COL_WIDTH = 800;

// ═══════════════════════════════════════════════════════════
// STORAGE HELPERS
// ═══════════════════════════════════════════════════════════

function getStorageKey(formId: number): string {
    return `${STORAGE_PREFIX}${formId}`;
}

function loadWidths(formId: number): ColumnWidths {
    try {
        const key = getStorageKey(formId);
        const raw = localStorage.getItem(key);
        console.log('[useColumnResize] LOAD:', { formId, key, raw });
        if (!raw) return {};

        const data: StoredData = JSON.parse(raw);
        console.log('[useColumnResize] LOADED widths:', data.widths);
        return data.widths ?? {};
    } catch (e) {
        console.error('[useColumnResize] LOAD ERROR:', e);
        return {};
    }
}

function saveWidths(formId: number, widths: ColumnWidths): void {
    try {
        const key = getStorageKey(formId);
        const data: StoredData = {
            widths,
            updatedAt: Date.now(),
        };
        console.log('[useColumnResize] SAVE:', { formId, key, widths });
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('[useColumnResize] Failed to save to localStorage:', e);
    }
}

// ═══════════════════════════════════════════════════════════
// ХУК
// ═══════════════════════════════════════════════════════════

export type UseColumnResizeReturn = {
    /** Текущие ширины колонок */
    columnWidths: ColumnWidths;

    /** Получить ширину конкретной колонки (или default) */
    getWidth: (colKey: string, defaultWidth: number) => number;

    /** Установить ширину колонки */
    setWidth: (colKey: string, width: number) => void;

    /** Сбросить все ширины к дефолтным */
    resetWidths: () => void;

    /** Состояние ресайза */
    resizing: {
        isResizing: boolean;
        colKey: string | null;
    };

    /** Начать ресайз колонки */
    startResize: (colKey: string, startX: number, startWidth: number) => void;
};

export function useColumnResize(formId: number | null): UseColumnResizeReturn {
    const [columnWidths, setColumnWidths] = useState<ColumnWidths>({});
    const [resizing, setResizing] = useState<{ isResizing: boolean; colKey: string | null }>({
        isResizing: false,
        colKey: null,
    });

    // Refs для drag
    const dragRef = useRef<{
        colKey: string;
        startX: number;
        startWidth: number;
    } | null>(null);

    // Загружаем при смене формы
    useEffect(() => {
        if (formId == null) {
            setColumnWidths({});
            return;
        }

        const loaded = loadWidths(formId);
        setColumnWidths(loaded);
    }, [formId]);

    // Сохраняем при изменении (debounced)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        if (formId == null) return;

        // Не сохраняем пустой объект при первой загрузке
        if (Object.keys(columnWidths).length === 0) return;

        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveWidths(formId, columnWidths);
        }, 300);

        return () => clearTimeout(saveTimeoutRef.current);
    }, [formId, columnWidths]);

    const getWidth = useCallback(
        (colKey: string, defaultWidth: number): number => {
            return columnWidths[colKey] ?? defaultWidth;
        },
        [columnWidths]
    );

    const setWidth = useCallback((colKey: string, width: number) => {
        const clamped = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, Math.round(width)));
        console.log('[useColumnResize] setWidth:', { colKey, width, clamped });
        setColumnWidths((prev) => ({
            ...prev,
            [colKey]: clamped,
        }));
    }, []);

    const resetWidths = useCallback(() => {
        setColumnWidths({});
        if (formId != null) {
            localStorage.removeItem(getStorageKey(formId));
        }
    }, [formId]);

    // ═══════════════════════════════════════════════════════════
    // DRAG RESIZE HANDLERS
    // ═══════════════════════════════════════════════════════════

    const startResize = useCallback((colKey: string, startX: number, startWidth: number) => {
        dragRef.current = { colKey, startX, startWidth };
        setResizing({ isResizing: true, colKey });

        // Добавляем класс на body чтобы изменить курсор
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    // Mouse move handler
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragRef.current) return;

            const { colKey, startX, startWidth } = dragRef.current;
            const delta = e.clientX - startX;
            const newWidth = startWidth + delta;

            setWidth(colKey, newWidth);
        };

        const handleMouseUp = () => {
            if (!dragRef.current) return;

            dragRef.current = null;
            setResizing({ isResizing: false, colKey: null });

            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [setWidth]);

    return {
        columnWidths,
        getWidth,
        setWidth,
        resetWidths,
        resizing,
        startResize,
    };
}

// ═══════════════════════════════════════════════════════════
// УТИЛИТА: создать ключ колонки
// ═══════════════════════════════════════════════════════════

export function makeColKey(widgetColumnId: number, tableColumnId: number | null): string {
    return `${widgetColumnId}:${tableColumnId ?? 'null'}`;
}