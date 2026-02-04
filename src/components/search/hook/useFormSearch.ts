// src/components/Form/hooks/useFormSearch.ts

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import { useDebounced } from '@/shared/hooks/useDebounced';

type Options = {
    debounceMs?: number;
};

type FormRow = FormDisplay['data'][number];
export type RowView = { row: FormRow; idx: number };

type ServerSearchCallback = (searchPattern: string) => Promise<void>;

export function useFormSearch(
    formDisplay: FormDisplay,
    flatColumnsInRenderOrder: FormDisplay['columns'],
    valueIndexByKey: Map<string, number>,
    searchBarEnabled: boolean | undefined | null,
    opts: Options = {},
    // ═══════════════════════════════════════════════════════════
    // НОВЫЙ ПАРАМЕТР: callback для серверного поиска
    // ═══════════════════════════════════════════════════════════
    onServerSearch?: ServerSearchCallback,
) {
    const { debounceMs = 350 } = opts; // Увеличил debounce для серверного поиска

    const [q, setQ] = useState('');
    const debouncedQuery = useDebounced(q, debounceMs);

    // Флаг для отслеживания первого рендера (не делаем запрос при монтировании)
    const isFirstRender = useRef(true);

    // Предыдущее значение debouncedQuery для сравнения
    const prevDebouncedQuery = useRef(debouncedQuery);

    // Сброс при отключении поиска
    useEffect(() => {
        if (!searchBarEnabled && q) setQ('');
    }, [searchBarEnabled, q]);

    // ═══════════════════════════════════════════════════════════
    // СЕРВЕРНЫЙ ПОИСК: вызываем callback при изменении запроса
    // ═══════════════════════════════════════════════════════════
    useEffect(() => {
        // Пропускаем первый рендер
        if (isFirstRender.current) {
            isFirstRender.current = false;
            prevDebouncedQuery.current = debouncedQuery;
            return;
        }

        // Пропускаем если значение не изменилось
        if (prevDebouncedQuery.current === debouncedQuery) {
            return;
        }

        prevDebouncedQuery.current = debouncedQuery;

        // Если есть callback для серверного поиска — вызываем его
        if (onServerSearch && searchBarEnabled) {
            onServerSearch(debouncedQuery);
        }
    }, [debouncedQuery, onServerSearch, searchBarEnabled]);

    // Базовые строки с индексами (без фильтрации — данные уже отфильтрованы сервером)
    const filteredRows: RowView[] = useMemo(() => {
        const data = formDisplay?.data ?? [];
        return data
            .map((row, idx) => ({ row, idx }))
            .filter(({ row }) => row && (row as any).primary_keys != null);
    }, [formDisplay]);

    return {
        showSearch: !!searchBarEnabled,
        q,
        setQ,
        filteredRows,
        // Экспортируем debouncedQuery для использования в loadMoreRows
        searchPattern: debouncedQuery,
    };
}