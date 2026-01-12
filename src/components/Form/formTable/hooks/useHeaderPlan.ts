// useHeaderPlan.ts
import { useMemo } from 'react';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import { ExtCol } from "@/components/Form/formTable/parts/FormatByDatatype";

export type HeaderPlanGroup = {
    id: number;
    title: string;
    labels: string[];
    cols: ExtCol[];
};

export type StylesColumnMeta = {
    exists: boolean;
    valueIndex: number | null;
    columnNameToIndex: Map<string, number>;
};

export type HeaderPlanResult = {
    headerPlan: HeaderPlanGroup[];
    flatColumnsInRenderOrder: ExtCol[];
    valueIndexByKey: Map<string, number>;
    isColReadOnly: (c: ExtCol) => boolean;
    stylesColumnMeta: StylesColumnMeta | null;
};

export function useHeaderPlan(formDisplay: FormDisplay | null): HeaderPlanResult {
    const columns = (formDisplay?.columns ?? []) as ExtCol[];

    // 1) сортировка
    const ordered = useMemo(() => {
        return [...columns].sort((a, b) => {
            const colA = a.column_order ?? 0;
            const colB = b.column_order ?? 0;
            if (colA !== colB) return colA - colB;
            const refA = a.ref_column_order ?? 0;
            const refB = b.ref_column_order ?? 0;
            if (refA !== refB) return refA - refB;
            const comboA = a.combobox_column_order ?? 0;
            const comboB = b.combobox_column_order ?? 0;
            return comboA - comboB;
        });
    }, [columns]);

    // 2) нормализация combobox
    const normalized = useMemo<ExtCol[]>(() => {
        return ordered.map((c) => {
            if (c.type === 'combobox' && c.combobox_column_id != null && c.table_column_id != null) {
                const syntheticTcId = -1_000_000 - Number(c.combobox_column_id);
                return {
                    ...c,
                    __write_tc_id: c.table_column_id,
                    table_column_id: syntheticTcId,
                };
            }
            return c;
        });
    }, [ordered]);

    // 3) помечаем primary для combobox
    const normalizedWithPrimary = useMemo<ExtCol[]>(() => {
        const map: Record<number, ExtCol[]> = {};
        for (const c of normalized) {
            if (c.type === 'combobox' && c.__write_tc_id != null) {
                const k = c.__write_tc_id;
                (map[k] ??= []).push(c);
            }
        }
        const primaryKeys = new Set<string>();
        Object.entries(map).forEach(([writeTcIdStr, arr]) => {
            const byWc: Record<number, ExtCol[]> = {};
            for (const c of arr) (byWc[c.widget_column_id] ??= []).push(c);
            Object.entries(byWc).forEach(([wcIdStr, list]) => {
                const primary = [...list].sort((a, b) => (a.combobox_column_order ?? 0) - (b.combobox_column_order ?? 0))[0];
                if (primary) primaryKeys.add(`${wcIdStr}:${writeTcIdStr}`);
            });
        });

        return normalized.map((c) => {
            if (c.type === 'combobox' && c.__write_tc_id != null) {
                const key = `${c.widget_column_id}:${c.__write_tc_id}`;
                return { ...c, __is_primary_combo_input: primaryKeys.has(key) };
            }
            return c;
        });
    }, [normalized]);

    // 4) подписи
    const getLabel = (c: ExtCol) => {
        const ref = (c.ref_column_name ?? '').trim();
        return ref || '—';
    };

    // 5) индекс для values (нужен ДО stylesColumnMeta)
    const valueIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        for (let i = 0; i < columns.length; i++) {
            const c = columns[i] as ExtCol;
            const syntheticTcId =
                c.type === 'combobox' && c.combobox_column_id != null && c.table_column_id != null
                    ? -1_000_000 - Number(c.combobox_column_id)
                    : c.table_column_id ?? -1;
            map.set(`${c.widget_column_id}:${syntheticTcId}`, i);
        }
        return map;
    }, [columns]);

    // 6) NEW: мета для колонки стилей
    const stylesColumnMeta = useMemo<StylesColumnMeta | null>(() => {
        const stylesCol = columns.find(c => c.type === 'styles');
        if (!stylesCol) return null;

        const key = `${stylesCol.widget_column_id}:${stylesCol.table_column_id ?? -1}`;
        const valueIndex = valueIndexByKey.get(key) ?? null;

        const columnNameToIndex = new Map<string, number>();
        columns.forEach((c, idx) => {
            if (c.column_name) {
                columnNameToIndex.set(c.column_name, idx);
            }
        });

        return {
            exists: true,
            valueIndex,
            columnNameToIndex,
        };
    }, [columns, valueIndexByKey]);

    // 7) NEW: фильтруем styles из рендера
    const normalizedWithoutStyles = useMemo(() => {
        return normalizedWithPrimary.filter(c => c.type !== 'styles');
    }, [normalizedWithPrimary]);

    // 8) группировка по widget_column_id (БЕЗ styles)
    const headerPlan = useMemo<HeaderPlanGroup[]>(() => {
        const byWc: Record<number, { title: string; cols: ExtCol[]; labels: string[]; order: number }> = {};
        for (const c of normalizedWithoutStyles) {
            const wcId = c.widget_column_id;
            if (!byWc[wcId]) {
                byWc[wcId] = { title: c.column_name ?? '', cols: [], labels: [], order: c.column_order ?? 0 };
            }
            byWc[wcId].cols.push(c);
            byWc[wcId].labels.push(getLabel(c));
        }
        return Object.entries(byWc)
            .map(([id, g]) => ({ id: Number(id), title: g.title, labels: g.labels, cols: g.cols }))
            .sort((a, b) => (byWc[a.id].order ?? 0) - (byWc[b.id].order ?? 0));
    }, [normalizedWithoutStyles]);

    // 9) readonly-логика
    const isColReadOnly = (c: ExtCol) => {
        if (c.visible === false) return true;
        if (c.type === 'combobox') return !c.__is_primary_combo_input;
        if (c.table_column_id == null) return true;
        return !!c.readonly;
    };

    // 10) RETURN — теперь включает stylesColumnMeta и использует normalizedWithoutStyles
    return {
        headerPlan,
        flatColumnsInRenderOrder: normalizedWithoutStyles,
        valueIndexByKey,
        isColReadOnly,
        stylesColumnMeta,
    };
}