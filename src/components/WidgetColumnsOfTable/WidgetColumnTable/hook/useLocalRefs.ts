import {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import {logApi, reindex, getFormId} from '../../ref-helpers';
import type {RefItem, ColumnOption} from '../../types';
import type {WidgetColumn} from '@/shared/hooks/useWorkSpaces';

type Deps = {
    /** Отсортированные группы виджет-колонок (по column_order), см. orderedWc */
    orderedWc: WidgetColumn[];
    /** Карта ссылок, пришедшая сверху */
    referencesMap: Record<number, RefItem[] | undefined>;
    /** Все таблицные колонки (для AddReferenceDialog) */
    allColumns?: { id: number; name: string; datatype: string }[];
    /** Нотификация наверх при изменении локальных ссылок */
    onRefsChange?: (next: Record<number, RefItem[]>) => void;
};

export function useLocalRefs({
                                 orderedWc,
                                 referencesMap,
                                 allColumns,
                                 onRefsChange,
                             }: Deps) {
    /** локальное состояние ссылок по wcId */
    const [localRefs, setLocalRefs] = useState<Record<number, RefItem[]>>({});
    /** ref для актуального снимка */
    const localRefsRef = useRef<Record<number, RefItem[]>>({});
    useEffect(() => { localRefsRef.current = localRefs; }, [localRefs]);

    /** снапшот порядка (массив table_column.id) для каждой группы */
    const snapshotRef = useRef<Record<number, number[]>>({});

    /** инициализация из props (orderedWc + referencesMap) */
    useEffect(() => {
        const next: Record<number, RefItem[]> = {};
        const snap: Record<number, number[]> = {};

        for (const wc of orderedWc) {
            const src = (referencesMap[wc.id] ?? wc.reference ?? []) as RefItem[];

            const normalized = src.map((r) => {
                const copy: RefItem = {
                    ...r,
                    table_column: r.table_column ? { ...r.table_column } : r.table_column,
                } as RefItem;

                // NEW: combobox как массив, отсортированный по combobox_column_order
                let combo: any = (r as any).combobox ?? null;
                if (Array.isArray(combo)) {
                    combo = [...combo].sort(
                        (a, b) => (a?.combobox_column_order ?? 0) - (b?.combobox_column_order ?? 0)
                    );
                } else if (combo && typeof combo === 'object') {
                    combo = [combo]; // на всякий случай
                } else {
                    combo = null;
                }
                (copy as any).combobox = combo;

                const fid = getFormId((r as any).form ?? (r as any).form_id ?? null);
                (copy as any).form = fid;
                (copy as any).form_id = fid;

                return copy;
            });
            const sorted = normalized.sort((a, b) => (a.ref_column_order ?? 0) - (b.ref_column_order ?? 0));
            next[wc.id] = reindex(sorted);
            snap[wc.id] = sorted.map(r => r.table_column?.id).filter(Boolean) as number[];
        }

        setLocalRefs(next);
        snapshotRef.current = snap;
        logApi('INIT:localRefs', { snapshot: snap });
    }, [orderedWc, referencesMap]);

    /** прокидываем наружу onRefsChange при каждом апдейте */
    useEffect(() => { onRefsChange?.(localRefs); }, [localRefs, onRefsChange]);

    /** уже занятые table_column.id (чтобы дизейблить выбор в AddReferenceDialog) */
    const usedColumnIds = useMemo(() => {
        const ids = new Set<number>();
        Object.values(localRefs).forEach(list =>
            list?.forEach(r => {
                const id = r.table_column?.id;
                if (typeof id === 'number') ids.add(id);
            })
        );
        return ids;
    }, [localRefs]);

    /** опции для AddReferenceDialog */
    const columnOptions: ColumnOption[] = useMemo(() => {
        return (allColumns ?? []).map(c => ({
            id: c.id,
            name: c.name,
            datatype: c.datatype,
            disabled: usedColumnIds.has(c.id),
        }));
    }, [allColumns, usedColumnIds]);

    const getColLabel = useCallback(
        (o?: ColumnOption | null) => (o ? `${o.name} (id:${o.id}, ${o.datatype})` : ''),
        []
    );

    /** быстрый поиск индекса ссылки по table_column.id в группе */
    const getIdxById = useCallback((wcId: number, tableColumnId: number) => {
        const list = localRefsRef.current[wcId] ?? [];
        return list.findIndex(r => r.table_column?.id === tableColumnId);
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
