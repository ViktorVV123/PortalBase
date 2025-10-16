// src/components/formTable/hooks/useHeaderPlan.ts

import {useCallback, useMemo} from 'react';
import type {FormDisplay} from '@/shared/hooks/useWorkSpaces';

import {HeaderModelItem, HeaderPlanGroup} from "@/components/formTable/types";


export function useHeaderPlan(
    formDisplay: FormDisplay,
    headerGroups?: HeaderModelItem[]
) {
    const safe = useCallback((v?: string | null) => (v?.trim() ? v.trim() : '—'), []);

    // Стабильная сортировка колонок формы
    const sortedColumns = useMemo(
        () => [...formDisplay.columns].sort((a, b) => a.column_order - b.column_order),
        [formDisplay.columns]
    );

    // Индексация по widget_column_id
    const byWcId = useMemo(() => {
        const map: Record<number, typeof sortedColumns> = {};
        for (const col of sortedColumns) (map[col.widget_column_id] ||= []).push(col);
        return map;
    }, [sortedColumns]);

    // Построение headerPlan (группы, подписи, порядок колонок внутри группы)
    const headerPlan: HeaderPlanGroup[] = useMemo(() => {
        // fallback, если нет headerGroups — группируем последовательные колонки по (name, wcId)
        if (!headerGroups?.length) {
            const groups: HeaderPlanGroup[] = [];
            let i = 0;
            while (i < sortedColumns.length) {
                const name = sortedColumns[i].column_name;
                const wcId = sortedColumns[i].widget_column_id;
                const cols: typeof sortedColumns = [];
                while (
                    i < sortedColumns.length &&
                    sortedColumns[i].column_name === name &&
                    sortedColumns[i].widget_column_id === wcId
                    ) {
                    cols.push(sortedColumns[i]);
                    i++;
                }
                groups.push({
                    id: wcId,
                    title: safe(name),
                    labels: cols.map(() => '—'),
                    cols,
                });
            }
            return groups;
        }

        const visibleGroups = headerGroups.filter((g) => g.visible !== false);
        const planned: HeaderPlanGroup[] = [];

        for (const g of visibleGroups) {
            const allCols = (byWcId[g.id] ?? []).slice();
            let cols = allCols;
            let labels: string[] = [];

            if (g.refIds?.length) {
                // 1) словарь refId -> label
                const labelByRefId = new Map<number, string>();
                const total = g.refIds.length;
                for (let i = 0; i < total; i++) {
                    const refId = g.refIds[i];
                    const lblRaw = g.labels?.[i] ?? '';
                    labelByRefId.set(refId, safe(lblRaw));
                }

                // 2) берём только колонки с table_column_id из refIds
                const candidateCols = allCols.filter(
                    (c) => c.table_column_id != null && labelByRefId.has(c.table_column_id!)
                );

                // 3) сортируем ровно по порядку g.refIds
                const order = new Map<number, number>();
                g.refIds.forEach((id, idx) => order.set(id, idx));
                cols = candidateCols.sort((a, b) => {
                    const ai = order.get(a.table_column_id!) ?? Number.MAX_SAFE_INTEGER;
                    const bi = order.get(b.table_column_id!) ?? Number.MAX_SAFE_INTEGER;
                    return ai - bi;
                });

                if (!cols.length) continue;

                // 4) финальные labels — по фактическим col
                labels = cols.map((c) => labelByRefId.get(c.table_column_id!) ?? '—');
            } else {
                // поведение для групп без refIds
                if (!allCols.length) continue;
                cols = allCols;
                labels = (g.labels ?? []).slice(0, cols.length).map(safe);
                while (labels.length < cols.length) labels.push('—');
            }

            planned.push({ id: g.id, title: safe(g.title), labels, cols });
        }

        return planned;
    }, [headerGroups, byWcId, safe, sortedColumns]);

    // Плоский порядок колонок рендера
    const flatColumnsInRenderOrder = useMemo(
        () => headerPlan.flatMap((g) => g.cols),
        [headerPlan]
    );

    // Индексация "wcId:tcId" -> индекс значения в строке
    const valueIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        formDisplay.columns.forEach((c, i) => {
            map.set(`${c.widget_column_id}:${c.table_column_id ?? -1}`, i);
        });
        return map;
    }, [formDisplay.columns]);

    // Рид-онли признак для колонки
    type DisplayColumn = FormDisplay['columns'][number];
    const isColReadOnly = useCallback((col: DisplayColumn): boolean => {
        const anyCol = col as any;
        const explicit =
            anyCol?.readonly === true ||
            anyCol?.read_only === true ||
            anyCol?.is_readonly === true ||
            anyCol?.meta?.readonly === true;
        const implicit = anyCol?.primary === true || anyCol?.increment === true;
        return !!(explicit || implicit);
    }, []);

    return {
        headerPlan,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        isColReadOnly,
    };
}
