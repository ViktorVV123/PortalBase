import {
    useRef,
    useState,
    useEffect,
    RefObject,
    useCallback,
} from 'react';
import { useTableColumns } from '@/shared/hooks/useTableColumns';
import { useOutsideClick } from '@/shared/hooks/useOutsideClick';

export const useColumnEdit = (tableId: number | null) => {
    /* загрузка / CRUD столбцов */
    const columnApi = useTableColumns();           // columns, loadColumns, update, delete …

    /* редактирование строки */
    const [editingId, setEditingId] = useState<number | null>(null);
    const [draft, setDraft] = useState<Record<string, any>>({});
    const rowRef = useRef<HTMLTableRowElement>(null);

    const startEdit = (col: typeof columnApi.columns[number]) => {
        setEditingId(col.id);
        setDraft({ ...col });
    };

    const finishEdit = useCallback(
        async (save: boolean) => {
            if (save && editingId !== null) {
                const { id, ...payload } = draft;
                await columnApi.updateColumn(editingId, payload);
            }
            setEditingId(null);
        },
        [editingId, draft, columnApi],
    );

    useOutsideClick(rowRef as RefObject<HTMLElement>, () => finishEdit(true));

    const onDraft = (k: string, v: any) => setDraft(p => ({ ...p, [k]: v }));

    /* подгружаем колонки при смене таблицы */
    useEffect(() => {
        if (tableId != null) columnApi.loadColumns(tableId);
    }, [tableId, columnApi.loadColumns]);

    return {
        ...columnApi,          // columns, loading, error, deleteColumn …
        editingId,
        draft,
        startEdit,
        finishEdit,
        onDraft,
        rowRef,
    };
};
