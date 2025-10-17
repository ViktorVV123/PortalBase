import { useMemo } from 'react';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';

export type HeaderPlanGroup = {
    id: number;                 // widget_column_id
    title: string;              // column_name (alias группы)
    labels: string[];           // подписи ref/combobox
    cols: FormDisplay['columns'];
};

export type HeaderPlanResult = {
    headerPlan: HeaderPlanGroup[];
    flatColumnsInRenderOrder: FormDisplay['columns'];
    valueIndexByKey: Map<string, number>;
    isColReadOnly: (c: FormDisplay['columns'][number]) => boolean;
};

export function useHeaderPlan(formDisplay: FormDisplay | null): HeaderPlanResult {
    const columns = formDisplay?.columns ?? [];

    // 1) Сортировка для отображения: column_order → ref_column_order → combobox_column_order
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

    // 2) Нормализация combobox: подменяем table_column_id на синтетический, чтобы ключи были уникальными
    const normalized = useMemo<FormDisplay['columns']>(() => {
        return ordered.map((c) => {
            if (c.type === 'combobox' && c.combobox_column_id != null && c.table_column_id != null) {
                const syntheticTcId = -1_000_000 - Number(c.combobox_column_id);
                return { ...c, table_column_id: syntheticTcId };
            }
            return c;
        });
    }, [ordered]);

    // 3) Подпись для колонки
    const getLabel = (c: FormDisplay['columns'][number]) => {
        if (c.type === 'combobox') {
            const alias = (c.combobox_alias ?? '').trim();
            if (alias) return alias;
        }
        const ref = (c.ref_column_name ?? '').trim();
        return ref || '—';
    };

    // 4) Группировка по widget_column_id (порядок групп — по column_order)
    const headerPlan = useMemo<HeaderPlanGroup[]>(() => {
        const byWc: Record<number, { title: string; cols: FormDisplay['columns']; labels: string[]; order: number }> = {};

        for (const c of normalized) {
            const wcId = c.widget_column_id;
            if (!byWc[wcId]) {
                byWc[wcId] = {
                    title: c.column_name ?? '',
                    cols: [],
                    labels: [],
                    order: c.column_order ?? 0,
                };
            }
            byWc[wcId].cols.push(c);
            byWc[wcId].labels.push(getLabel(c));
        }

        return Object.entries(byWc)
            .map(([id, g]) => ({
                id: Number(id),
                title: g.title,
                labels: g.labels,
                cols: g.cols,
            }))
            .sort((a, b) => {
                const aOrder = byWc[a.id].order ?? 0;
                const bOrder = byWc[b.id].order ?? 0;
                return aOrder - bOrder;
            });
    }, [normalized]);

    // 5) Плоский список для рендера (отсортированный/нормализованный)
    const flatColumnsInRenderOrder = normalized;

    // 6) Мапа индексов ДЛЯ ДАННЫХ — строго по оригинальному порядку columns!
    const valueIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        for (let i = 0; i < columns.length; i++) {
            const c = columns[i];
            const syntheticTcId =
                c.type === 'combobox' && c.combobox_column_id != null && c.table_column_id != null
                    ? -1_000_000 - Number(c.combobox_column_id)
                    : c.table_column_id ?? -1;

            map.set(`${c.widget_column_id}:${syntheticTcId}`, i);
        }
        return map;
    }, [columns]);

    // 7) readOnly-флаг
    const isColReadOnly = (c: FormDisplay['columns'][number]) => {
        // 🔴 ключевое: скрытые считаем нередактируемыми
        if (c.visible === false) return true;
        if (c.type === 'combobox') return true;
        if (c.table_column_id == null) return true;
        return !!c.readonly;
    };

    return { headerPlan, flatColumnsInRenderOrder, valueIndexByKey, isColReadOnly };
}
