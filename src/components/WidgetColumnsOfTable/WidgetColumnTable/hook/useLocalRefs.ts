import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { logApi, reindex, getFormId } from '../../ref-helpers';
import type { RefItem, ColumnOption } from '../../types';
import type { WidgetColumn } from '@/shared/hooks/useWorkSpaces';

type Deps = {
    /** Отсортированные группы виджет-колонок (по column_order) */
    orderedWc: WidgetColumn[];
    /** Карта ссылок, пришедшая сверху (из referencesMap) */
    referencesMap: Record<number, RefItem[] | undefined>;
    /** Все таблицные колонки (для AddReferenceDialog) */
    allColumns?: { id: number; name: string; datatype: string }[];
    /** Нотификация наверх при изменении локальных ссылок */
    onRefsChange?: (next: Record<number, RefItem[]>) => void;
};

/**
 * Нормализует один RefItem
 */
function normalizeRefItem(r: RefItem): RefItem {
    const copy: RefItem = {
        ...r,
        table_column: r.table_column ? { ...r.table_column } : r.table_column,
    } as RefItem;

    // combobox как массив, отсортированный по combobox_column_order
    let combo: any = (r as any).combobox ?? null;
    if (Array.isArray(combo)) {
        combo = [...combo].sort(
            (a, b) => (a?.combobox_column_order ?? 0) - (b?.combobox_column_order ?? 0)
        );
    } else if (combo && typeof combo === 'object') {
        combo = [combo];
    } else {
        combo = null;
    }
    (copy as any).combobox = combo;

    // Нормализуем form/form_id
    const fid = getFormId((r as any).form ?? (r as any).form_id ?? null);
    (copy as any).form = fid;
    (copy as any).form_id = fid;

    return copy;
}

/**
 * Сортирует refs по ref_column_order
 */
function sortByOrder(refs: RefItem[]): RefItem[] {
    return [...refs].sort((a, b) => {
        const orderA = a.ref_column_order ?? 0;
        const orderB = b.ref_column_order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        // Вторичная сортировка по id для стабильности
        const idA = a.table_column?.id ?? 0;
        const idB = b.table_column?.id ?? 0;
        return idA - idB;
    });
}

export function useLocalRefs({
                                 orderedWc,
                                 referencesMap,
                                 allColumns,
                                 onRefsChange,
                             }: Deps) {
    /** локальное состояние ссылок по wcId */
    const [localRefs, setLocalRefs] = useState<Record<number, RefItem[]>>({});

    /** ref для актуального снимка (используется в DnD) */
    const localRefsRef = useRef<Record<number, RefItem[]>>({});
    useEffect(() => {
        localRefsRef.current = localRefs;
    }, [localRefs]);

    /** снапшот порядка (массив table_column.id) для каждой группы */
    const snapshotRef = useRef<Record<number, number[]>>({});

    /**
     * Инициализация/обновление из props
     * КЛЮЧЕВОЕ: используем referencesMap, но fallback на wc.reference
     */
    useEffect(() => {
        const next: Record<number, RefItem[]> = {};
        const snap: Record<number, number[]> = {};

        for (const wc of orderedWc) {
            // ПРИОРИТЕТ: referencesMap > wc.reference
            const fromMap = referencesMap[wc.id];
            const fromWc = wc.reference ?? [];

            let src: RefItem[];
            if (fromMap && fromMap.length > 0) {
                src = fromMap as RefItem[];
            } else if (fromWc.length > 0) {
                src = fromWc as RefItem[];
                logApi('FALLBACK:wc.reference', { wcId: wc.id, count: fromWc.length });
            } else {
                src = [];
            }

            // Нормализуем каждый элемент
            const normalized = src.map(normalizeRefItem);

            // Сортируем по ref_column_order
            const sorted = sortByOrder(normalized);

            // Переиндексируем
            next[wc.id] = reindex(sorted);

            // Снапшот содержит все id
            snap[wc.id] = sorted
                .map((r) => r.table_column?.id)
                .filter((id): id is number => id != null);
        }

        setLocalRefs(next);
        snapshotRef.current = snap;

        logApi('INIT:localRefs', {
            groupCount: orderedWc.length,
            snapshot: snap,
            // Для отладки: какие группы пустые
            emptyGroups: orderedWc
                .filter((wc) => (next[wc.id]?.length ?? 0) === 0)
                .map((wc) => wc.id),
        });
    }, [orderedWc, referencesMap]);

    /** прокидываем наружу onRefsChange при каждом апдейте */
    useEffect(() => {
        onRefsChange?.(localRefs);
    }, [localRefs, onRefsChange]);

    /** уже занятые table_column.id */
    const usedColumnIds = useMemo(() => {
        const ids = new Set<number>();
        Object.values(localRefs).forEach((list) =>
            list?.forEach((r) => {
                const id = r.table_column?.id;
                if (typeof id === 'number') ids.add(id);
            })
        );
        return ids;
    }, [localRefs]);

    /** опции для AddReferenceDialog */
    const columnOptions: ColumnOption[] = useMemo(() => {
        return (allColumns ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            datatype: c.datatype,
            disabled: usedColumnIds.has(c.id),
        }));
    }, [allColumns, usedColumnIds]);

    const getColLabel = useCallback(
        (o?: ColumnOption | null) =>
            o ? `${o.name} (id:${o.id}, ${o.datatype})` : '',
        []
    );

    /** быстрый поиск индекса ссылки по table_column.id в группе */
    const getIdxById = useCallback((wcId: number, tableColumnId: number) => {
        const list = localRefsRef.current[wcId] ?? [];
        return list.findIndex((r) => r.table_column?.id === tableColumnId);
    }, []);

    return {
        // состояние
        localRefs,
        setLocalRefs,
        localRefsRef,

        // снапшот порядка
        snapshotRef,

        // производные для AddReferenceDialog
        usedColumnIds,
        columnOptions,
        getColLabel,

        // утилита поиска
        getIdxById,
    };
}