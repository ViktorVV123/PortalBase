// src/components/Form/hooks/useFormSearch.ts
import { useEffect, useMemo, useState } from 'react';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import { useDebounced } from '@/shared/hooks/useDebounced';
import { useFuzzyRows } from '@/shared/hooks/useFuzzySearch';

type Options = {
    threshold?: number;
    distance?: number;
    debounceMs?: number;
};

type FormRow = FormDisplay['data'][number];
export type RowView = { row: FormRow; idx: number };

// то, что реально возвращает fuzzy-хук
type SearchRow = { row: FormRow; idx: number; blob: string };

const isDigitsOnly = (s: string) => /^\d+$/.test(s);

const normalize = (s: string) =>
    s
        .toLowerCase()
        .replace(/ё/g, 'е')
        .trim();

const cellToText = (v: unknown) => {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.map((x) => (x == null ? '' : String(x))).join(' ');
    return String(v);
};

// ключ как в MainTableCombo.getValueKey (чтобы индексы совпадали с тем, что реально рендеришь)
function getValueKeyForSearch(col: any): string {
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
    const { threshold = 0.35, distance = 120, debounceMs = 250 } = opts;

    const [q, setQ] = useState('');
    const dq = useDebounced(q, debounceMs);

    useEffect(() => {
        if (!searchBarEnabled && q) setQ('');
    }, [searchBarEnabled, q]);

    const queryRaw = useMemo(() => dq.trim(), [dq]);
    const queryLower = useMemo(() => normalize(queryRaw), [queryRaw]);
    const digitsQuery = useMemo(() => (queryRaw ? isDigitsOnly(queryRaw) : false), [queryRaw]);

    // ✅ базовые RowView (idx нужен edit/delete!)
    const baseViews: RowView[] = useMemo(() => {
        const raw = formDisplay?.data ?? [];
        const views: Array<RowView | null> = raw.map((row, idx) => {
            if (!row) return null;
            if ((row as any).primary_keys == null) return null;
            return { row, idx };
        });
        return views.filter((v): v is RowView => v != null);
    }, [formDisplay]);

    // индексы колонок в values, по которым ищем
    const indices = useMemo(() => {
        return (flatColumnsInRenderOrder ?? [])
            .map((c) => valueIndexByKey.get(getValueKeyForSearch(c as any)))
            .filter((v): v is number => typeof v === 'number');
    }, [flatColumnsInRenderOrder, valueIndexByKey]);

    // fuzzy для текста (fallback)
    const { filtered: fuzzyFilteredRaw } = useFuzzyRows(
        formDisplay,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        dq,
        { threshold, distance },
    );

    // строгий contains по ячейкам (без fuzzy)
    const strictContains = useMemo(() => {
        if (!queryLower) return baseViews;
        if (!indices.length) return baseViews;

        return baseViews.filter(({ row }) => {
            const values = (row as any).values ?? [];

            for (const idx of indices) {
                const v = values[idx];
                if (v === null || v === undefined) continue;

                const text = normalize(cellToText(v));
                if (text.includes(queryLower)) return true;
            }

            return false;
        });
    }, [baseViews, indices, queryLower]);

    const fuzzyViews: RowView[] = useMemo(() => {
        const arr = (fuzzyFilteredRaw ?? []) as unknown as SearchRow[];

        // ⚠️ важный момент: fuzzy иногда возвращает “похожие”, но без подстроки.
        // Поэтому: если query есть — сначала оставляем только те, где blob реально содержит query.
        const filteredArr =
            queryLower.length >= 1
                ? arr.filter((x) => {
                    const blob = x?.blob ? normalize(String(x.blob)) : '';
                    return blob.includes(queryLower);
                })
                : arr;

        const views: Array<RowView | null> = filteredArr.map((x) => {
            if (!x || !x.row) return null;
            if ((x.row as any).primary_keys == null) return null;
            return { row: x.row, idx: x.idx };
        });

        return views.filter((v): v is RowView => v != null);
    }, [fuzzyFilteredRaw, queryLower]);

    const filteredRows: RowView[] = useMemo(() => {
        if (!searchBarEnabled) return baseViews;
        if (!queryRaw) return baseViews;

        // ✅ ЧИСЛА: префиксный поиск
        if (digitsQuery) {
            if (!indices.length) return baseViews;

            return baseViews.filter(({ row }) => {
                const values = (row as any).values ?? [];

                for (const idx of indices) {
                    const v = values[idx];
                    if (v === null || v === undefined) continue;

                    if (typeof v === 'number') {
                        if (String(v).startsWith(queryRaw)) return true;
                        continue;
                    }

                    const text = String(v).trim();
                    if (isDigitsOnly(text) && text.startsWith(queryRaw)) return true;
                    if (text.includes(queryRaw)) return true;
                }

                return false;
            });
        }

        // ✅ ТЕКСТ:
        // 1) для коротких запросов (<=3) — только strict contains (иначе fuzzy “угадывает”)
        if (queryLower.length <= 3) {
            return strictContains;
        }

        // 2) для длинных: сначала strict, если пусто — fallback fuzzy
        if (strictContains.length) return strictContains;
        return fuzzyViews.length ? fuzzyViews : strictContains;
    }, [
        searchBarEnabled,
        queryRaw,
        queryLower,
        digitsQuery,
        baseViews,
        indices,
        strictContains,
        fuzzyViews,
    ]);

    return {
        showSearch: !!searchBarEnabled,
        q,
        setQ,
        filteredRows,
    };
}
