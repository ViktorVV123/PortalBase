// useHeaderPlan.ts
import { useMemo } from 'react';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';

type ExtCol = FormDisplay['columns'][number] & {
    __write_tc_id?: number;             // реальный tcId для записи (для combobox)
    __is_primary_combo_input?: boolean; // только одну колонку на группу делаем editable
};

export type HeaderPlanGroup = {
    id: number;
    title: string;
    labels: string[];
    cols: ExtCol[]; // ← расширили тип
};

export type HeaderPlanResult = {
    headerPlan: HeaderPlanGroup[];
    flatColumnsInRenderOrder: ExtCol[];        // ← расширили тип
    valueIndexByKey: Map<string, number>;
    isColReadOnly: (c: ExtCol) => boolean;     // ← расширили тип
};

export function useHeaderPlan(formDisplay: FormDisplay | null): HeaderPlanResult {
    const columns = (formDisplay?.columns ?? []) as ExtCol[];

    // 1) сортировка (как было)
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

    // 2) нормализация combobox: синтетический tcId для отображения,
    //    + сохраняем реальный tcId в __write_tc_id
    const normalized = useMemo<ExtCol[]>(() => {
        return ordered.map((c) => {
            if (c.type === 'combobox' && c.combobox_column_id != null && c.table_column_id != null) {
                const syntheticTcId = -1_000_000 - Number(c.combobox_column_id);
                return {
                    ...c,
                    __write_tc_id: c.table_column_id,      // сохраняем настоящий tcId
                    table_column_id: syntheticTcId,        // синтетический — только для чтения/ключей
                };
            }
            return c;
        });
    }, [ordered]);

    // 3) промаркируем primary-комбоколонку (минимальный combobox_column_order на один write_tc_id)
    const normalizedWithPrimary = useMemo<ExtCol[]>(() => {
        // группа по write_tc_id (только для combobox)
        const map: Record<number, ExtCol[]> = {};
        for (const c of normalized) {
            if (c.type === 'combobox' && c.__write_tc_id != null) {
                const k = c.__write_tc_id;
                (map[k] ??= []).push(c);
            }
        }
        const primaryKeys = new Set<string>(); // `${wcId}:${writeTcId}`
        Object.entries(map).forEach(([writeTcIdStr, arr]) => {
            const byWc: Record<number, ExtCol[]> = {};
            for (const c of arr) (byWc[c.widget_column_id] ??= []).push(c);
            Object.entries(byWc).forEach(([wcIdStr, list]) => {
                const primary = [...list].sort((a,b)=>(a.combobox_column_order ?? 0)-(b.combobox_column_order ?? 0))[0];
                primaryKeys.add(`${wcIdStr}:${writeTcIdStr}`);
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

    // 4) подписи (как было)
    const getLabel = (c: ExtCol) => {
        if (c.type === 'combobox') {
            const alias = (c.combobox_alias ?? '').trim();
            if (alias) return alias;
        }
        const ref = (c.ref_column_name ?? '').trim();
        return ref || '—';
    };

    // 5) группировка по widget_column_id
    const headerPlan = useMemo<HeaderPlanGroup[]>(() => {
        const byWc: Record<number, { title: string; cols: ExtCol[]; labels: string[]; order: number }> = {};
        for (const c of normalizedWithPrimary) {
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
    }, [normalizedWithPrimary]);

    const flatColumnsInRenderOrder = normalizedWithPrimary;

    // 6) индекс для values (по оригинальному columns без синтетики — как было)
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

    // 7) readonly-логика: combobox editable только в primary
    const isColReadOnly = (c: ExtCol) => {
        if (c.visible === false) return true;
        if (c.type === 'combobox') return !c.__is_primary_combo_input; // писать можно только в primary
        if (c.table_column_id == null) return true;
        return !!c.readonly;
    };

    return { headerPlan, flatColumnsInRenderOrder, valueIndexByKey, isColReadOnly };
}
