import { useMemo } from 'react';
import Fuse from 'fuse.js';
import { normalizeText } from '@/shared/utils/normalize';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';

// Минимальный тип колонки из FormDisplay.columns, который нужен для извлечения значения
export type RenderColumn = {
    widget_column_id: number;
    table_column_id: number | null;
    column_name: string;
    placeholder?: string | null;
};

type SearchRow = { row: FormDisplay['data'][number]; idx: number; blob: string };

export type UseFuzzyRowsOptions = {
    threshold?: number;    // 0..1, чем больше — тем «мягче». По умолчанию 0.35
    distance?: number;     // насколько далеко допускаем расхождения, дефолт 120
};

/**
 * Фаззи-поиск по данным формы (formDisplay.data) на фронте.
 * Ищет по всем ВИДИМЫМ колонкам, которые вы передали через `flatColumns`.
 *
 * @param formDisplay — объект формы со столбцами и данными
 * @param flatColumns — массив колонок в порядке рендера (flatColumnsInRenderOrder)
 * @param valueIndexByKey — Map "wcId:tcId" -> индекс значения в row.values
 * @param query — строка запроса (без дебаунса)
 * @param opts — параметры точности Fuse
 * @returns filtered: массив { row, idx } — idx это ИСХОДНЫЙ индекс строки в formDisplay.data
 */
export function useFuzzyRows(
    formDisplay: FormDisplay,
    flatColumns: RenderColumn[],
    valueIndexByKey: Map<string, number>,
    query: string,
    opts: UseFuzzyRowsOptions = {}
) {
    const rowsForSearch = useMemo<SearchRow[]>(() => {
        return formDisplay.data.map((row, idx) => {
            const parts: string[] = [];
            for (const col of flatColumns) {
                const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                const valIdx = valueIndexByKey.get(key);
                const val = valIdx != null ? row.values[valIdx] : '';
                if (val != null && val !== '') parts.push(String(val));
            }
            return { row, idx, blob: normalizeText(parts.join(' ')) };
        });
    }, [formDisplay.data, flatColumns, valueIndexByKey]);

    const fuse = useMemo(() => {
        return new Fuse<SearchRow>(rowsForSearch, {
            keys: ['blob'],
            includeScore: true,
            threshold: opts.threshold ?? 0.35,
            distance: opts.distance ?? 120,
            ignoreLocation: true,
        });
    }, [rowsForSearch, opts.threshold, opts.distance]);

    const filtered = useMemo(() => {
        const q = normalizeText(query.trim());
        if (!q) return rowsForSearch;               // без фильтра показываем все
        return fuse.search(q).map(r => r.item);     // оставляем {row, idx, blob}
    }, [fuse, query, rowsForSearch]);

    return { filtered };
}
