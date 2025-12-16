// src/components/Form/hooks/useFormSearch.ts

import { useEffect, useMemo, useState } from 'react';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import { useDebounced } from '@/shared/hooks/useDebounced';

type Options = {
    debounceMs?: number;
};

type FormRow = FormDisplay['data'][number];
export type RowView = { row: FormRow; idx: number };

/** Нормализация текста для поиска */
const normalize = (s: string): string =>
    s.toLowerCase().replace(/ё/g, 'е').trim();

/** Преобразование значения ячейки в текст */
const cellToText = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.map((x) => (x == null ? '' : String(x))).join(' ');
    return String(v);
};

/** Ключ для поиска индекса значения */
function getValueKey(col: any): string {
    const syntheticTcId =
        col?.type === 'combobox' &&
        col?.combobox_column_id != null &&
        col?.table_column_id != null
            ? -1_000_000 - Number(col.combobox_column_id)
            : (col?.table_column_id ?? -1);

    return `${col?.widget_column_id}:${syntheticTcId}`;
}

export function useFormSearch(
    formDisplay: FormDisplay,
    flatColumnsInRenderOrder: FormDisplay['columns'],
    valueIndexByKey: Map<string, number>,
    searchBarEnabled: boolean | undefined | null,
    opts: Options = {},
) {
    const { debounceMs = 250 } = opts;

    const [q, setQ] = useState('');
    const debouncedQuery = useDebounced(q, debounceMs);

    // Сброс при отключении поиска
    useEffect(() => {
        if (!searchBarEnabled && q) setQ('');
    }, [searchBarEnabled, q]);

    const queryNormalized = useMemo(() => normalize(debouncedQuery), [debouncedQuery]);

    // Базовые строки с индексами
    const baseRows: RowView[] = useMemo(() => {
        const data = formDisplay?.data ?? [];
        return data
            .map((row, idx) => ({ row, idx }))
            .filter(({ row }) => row && (row as any).primary_keys != null);
    }, [formDisplay]);

    // Индексы колонок для поиска
    const columnIndices = useMemo(() => {
        return (flatColumnsInRenderOrder ?? [])
            .map((c) => valueIndexByKey.get(getValueKey(c)))
            .filter((v): v is number => typeof v === 'number');
    }, [flatColumnsInRenderOrder, valueIndexByKey]);

    // Фильтрация
    const filteredRows: RowView[] = useMemo(() => {
        // Если поиск отключён или запрос пустой — возвращаем все
        if (!searchBarEnabled || !queryNormalized) {
            return baseRows;
        }

        // Если нет колонок для поиска — возвращаем все
        if (!columnIndices.length) {
            return baseRows;
        }

        return baseRows.filter(({ row }) => {
            const values = (row as any).values ?? [];

            for (const idx of columnIndices) {
                const cellValue = values[idx];
                if (cellValue === null || cellValue === undefined) continue;

                const text = normalize(cellToText(cellValue));

                // Поиск подстроки (contains) — работает и для "21" в "2021"
                if (text.includes(queryNormalized)) {
                    return true;
                }
            }

            return false;
        });
    }, [searchBarEnabled, queryNormalized, baseRows, columnIndices]);

    return {
        showSearch: !!searchBarEnabled,
        q,
        setQ,
        filteredRows,
    };
}