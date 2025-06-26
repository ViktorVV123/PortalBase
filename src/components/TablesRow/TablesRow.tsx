import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as s from './TablesRow.module.scss';

interface Table {
    id: number;
    workspace_id: number;
    name: string;
    description: string;
    published: boolean;
}

interface Props {
    workspaceId: number | null;
    tables: Table[];
    loadTables: (wsId: number | null, published?: boolean) => void;
}

export const TablesRow = ({ workspaceId, tables, loadTables }: Props) => {
    const [showPublished, setShowPublished] = useState<'all' | 'only' | 'hide'>('all');

    /* 1. грузим таблицы при смене workspace/флага */
    const fetchTables = useCallback(
        (id: number, onlyPublished?: boolean) => loadTables(id, onlyPublished),
        [loadTables],
    );

    useEffect(() => {
        if (workspaceId == null) return;
        fetchTables(
            workspaceId,
            showPublished === 'all' ? undefined : showPublished === 'only',
        );
    }, [workspaceId, showPublished, fetchTables]);

    /* 2. фильтруем “чужие” таблицы */
    const visibleTables = useMemo(
        () =>
            tables.filter(t => {
                if (workspaceId == null) return false;
                return t.workspace_id === workspaceId;
            }),
        [tables, workspaceId],
    );

    /* 3. отображаем только то, что нужно */
    return (
        <div>
            <label className={s.switcher}>
                <input
                    type="checkbox"
                    checked={showPublished === 'only'}
                    onChange={() =>
                        setShowPublished(p => (p === 'only' ? 'hide' : 'only'))
                    }
                />
                Показать только published
            </label>

            <div className={s.row}>
                {visibleTables.map(t => (
                    <div key={t.id} className={s.tile}>
                        <span className={s.name}>{t.name}</span>
                        <span className={s.desc}>{t.description}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
