import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table } from '@/components/TablesRow/TablesRow';

interface Params {
    workspaceId: number | null;
    tables: Table[];
    loadTables: (wsId: number | null, published?: boolean) => void;
}

/**
 * – чек-бокс ☑ → показываем ТОЛЬКО published и шлём published=true
 * – чек-бокс ⬜ → показываем ТОЛЬКО черновики и шлём published=false
 */
export const useWorkspaceTables = ({
                                       workspaceId,
                                       tables,
                                       loadTables,
                                   }: Params) => {
    /** true → показываем published, false → черновики */
    const [showOnlyPublished, setShowOnlyPublished] = useState(false);
    const togglePublished = useCallback(
        () => setShowOnlyPublished(p => !p),
        [],
    );

    /* ───── загрузка таблиц при смене флага / workspace ───── */
    useEffect(() => {
        if (workspaceId != null) {
            loadTables(workspaceId, showOnlyPublished); // ← один вызов
        }
    }, [workspaceId, showOnlyPublished, loadTables]);

    /* ───── локальная фильтрация + сортировка ───── */
    const visibleTables = useMemo(() => {
        return tables
            .filter(
                t =>
                    t.workspace_id === workspaceId &&
                    (showOnlyPublished ? t.published : !t.published),
            )
            .sort((a, b) => Number(b.published) - Number(a.published));
    }, [tables, workspaceId, showOnlyPublished]);

    /* ───── выбор активной таблицы ───── */
    const [selectedId, setSelectedId] = useState<number | null>(null);

    useEffect(() => {
        if (!visibleTables.length) setSelectedId(null);
        else if (!visibleTables.some(t => t.id === selectedId)) {
            setSelectedId(visibleTables[0].id);
        }
    }, [visibleTables, selectedId]);

    return {
        visibleTables,
        selectedId,
        setSelectedId,
        showOnlyPublished,
        togglePublished,
    };
};
