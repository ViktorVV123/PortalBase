// hooks/useTableColumns.ts
import { useState, useCallback } from 'react';
import { api } from '@/services/api';

export interface Column {
    id: number;
    table_id: number;
    name: string;
    description:string | null
    datatype: string;
    required: boolean;
    length: number | null | string;
    precision: number | null | string;
    primary: boolean;
    increment:boolean;
    datetime: number | null | string;
    // остальные поля по желанию
}

export const useTableColumns = () => {
    const [columns, setColumns] = useState<Column[]>([]);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState<string | null>(null);

    const loadColumns = useCallback(async (tableId: number) => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get<Column[]>(`/tables/${tableId}/columns`);
            setColumns(data.sort((a, b) => a.id - b.id));   // ← сортируем один раз
        } catch {
            setError('Не удалось загрузить столбцы');
        } finally {
            setLoading(false);
        }
    }, []);


    /** patch-обновление одной колонки */
    const updateColumn = useCallback(
        async (id: number, patch: Partial<Omit<Column, 'id'>>) => {
            try {
                const { data } = await api.patch<Column>(`/tables/columns/${id}`, patch);

                setColumns(prev => {
                    const next = prev.map(col =>
                        col.id === id ? { ...col, ...data } : col,
                    );

                    /* ← гарантируем фиксированный порядок */
                    return next.sort((a, b) => a.id - b.id);
                });
            } catch {
                setError('Ошибка при сохранении изменений');
                throw new Error('update failed');
            }
        },
        [],
    );

    const deleteColumn = useCallback(
        async (id: number) => {
            try {
                await api.delete(`/tables/columns/${id}`);
                setColumns(prev => prev.filter(c => c.id !== id));   // ← убираем локально
            } catch {
                setError('Ошибка при удалении столбца');
                throw new Error('delete failed');
            }
        },
        [],
    );

    return { columns, loading, error, loadColumns, updateColumn,deleteColumn };
};
