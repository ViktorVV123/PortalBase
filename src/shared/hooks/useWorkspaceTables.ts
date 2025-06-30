import { useCallback, useEffect, useMemo, useState } from 'react';
import { Table } from '@/components/TablesRow/TablesRow';

export type PublishedMode = 'all' | 'only' | 'hide';

interface Params {
    workspaceId: number | null;
    tables: Table[];
    loadTables: (wsId: number | null, published?: boolean) => void;
}

export const useWorkspaceTables = ({
                                       workspaceId,
                                       tables,
                                       loadTables,
                                   }: Params) => {
    const [published, setPublished] = useState<PublishedMode>('all');
    const togglePublished = () =>
        setPublished(p => (p === 'only' ? 'hide' : 'only'));


    /* загрузка при смене workspace или флага */
    useEffect(() => {
        if (workspaceId != null) {
            loadTables(
                workspaceId,
                published === 'all' ? undefined : published === 'only',
            );
        }
    }, [workspaceId, published, loadTables]);

    /* таблицы текущего workspace */
    const visibleTables = useMemo(
        () => tables.filter(t => t.workspace_id === workspaceId), // не t.id
        [tables, workspaceId],
    );


    /* выбранная таблица */
    const [selectedId, setSelectedId] = useState<number | null>(null);

    useEffect(() => {
        if (!visibleTables.length) setSelectedId(null);
        else if (!visibleTables.some(t => t.id === selectedId)) {
            setSelectedId(visibleTables[0].id);
        }
    }, [visibleTables, selectedId]);

    return {
        published,
        togglePublished,
        visibleTables,
        selectedId,
        setSelectedId,
    };
};
