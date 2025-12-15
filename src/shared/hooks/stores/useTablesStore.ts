// tables + columns

// src/shared/hooks/stores/useTablesStore.ts

import { useCallback, useRef, useState } from 'react';
import { api } from '@/services/api';
import type { DTable, Column, LoadStatus } from './types';

export interface UseTablesStoreReturn {
    // State
    tablesByWs: Record<number, DTable[]>;
    columns: Column[];
    selectedTable: DTable | null;
    loading: boolean;
    error: string | null;

    // Table Actions
    loadTables: (wsId: number, force?: boolean) => Promise<DTable[]>;
    deleteTable: (table: DTable) => Promise<void>;
    updateTableMeta: (id: number, patch: Partial<DTable>) => Promise<void>;
    publishTable: (id: number) => Promise<void>;
    setSelectedTable: (table: DTable | null) => void;

    // Column Actions
    loadColumns: (table: DTable) => Promise<void>;
    updateTableColumn: (id: number, patch: Partial<Omit<Column, 'id'>>) => Promise<void>;
    deleteColumnTable: (id: number) => Promise<void>;
    createTableColumn: (tableId: number, data: Partial<Column>) => Promise<Column>;

    // Setters для интеграции
    setTablesByWs: React.Dispatch<React.SetStateAction<Record<number, DTable[]>>>;
}

export function useTablesStore(): UseTablesStoreReturn {
    const [tablesByWs, setTablesByWs] = useState<Record<number, DTable[]>>({});
    const [columns, setColumns] = useState<Column[]>([]);
    const [selectedTable, setSelectedTable] = useState<DTable | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Трекинг forbidden workspaces для таблиц
    const forbiddenTablesWsRef = useRef<Set<number>>(new Set());

    // ─────────────────────────────────────────────────────────────
    // TABLE ACTIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Загрузка таблиц для workspace
     */
    const loadTables = useCallback(async (wsId: number, force = false): Promise<DTable[]> => {
        // Проверяем forbidden
        if (!force && forbiddenTablesWsRef.current.has(wsId)) {
            return tablesByWs[wsId] ?? [];
        }

        // Проверяем кэш
        if (!force && tablesByWs[wsId]) {
            return tablesByWs[wsId];
        }

        try {
            const { data } = await api.get<DTable[]>('/tables', {
                params: { workspace_id: wsId },
            });

            setTablesByWs(prev => ({ ...prev, [wsId]: data }));
            forbiddenTablesWsRef.current.delete(wsId);

            return data;
        } catch (e: any) {
            const status = e?.response?.status;

            if (status === 403 || status === 404) {
                forbiddenTablesWsRef.current.add(wsId);
            }

            setError('Не удалось загрузить таблицы рабочей области');
            return tablesByWs[wsId] ?? [];
        }
    }, [tablesByWs]);

    /**
     * Удаление таблицы
     */
    const deleteTable = useCallback(async (table: DTable) => {
        // Оптимистичное удаление
        setTablesByWs(prev => {
            const copy = { ...prev };
            copy[table.workspace_id] = (copy[table.workspace_id] ?? [])
                .filter(t => t.id !== table.id);
            return copy;
        });

        // Сбрасываем выбор, если удаляем текущую таблицу
        if (selectedTable?.id === table.id) {
            setSelectedTable(null);
            setColumns([]);
        }

        try {
            await api.delete(`/tables/${table.id}`);
        } catch {
            // Откат — перезагружаем список
            await loadTables(table.workspace_id, true);
        }
    }, [selectedTable, loadTables]);

    /**
     * Обновление метаданных таблицы
     */
    const updateTableMeta = useCallback(async (id: number, patch: Partial<DTable>) => {
        try {
            const { data } = await api.patch<DTable>(`/tables/${id}`, patch);

            setTablesByWs(prev => {
                const copy = { ...prev };
                const wsId = data.workspace_id;
                copy[wsId] = (copy[wsId] || []).map(t =>
                    t.id === id ? { ...t, ...data } : t
                );
                return copy;
            });

            // Обновляем selectedTable, если это она
            setSelectedTable(prev =>
                prev && prev.id === id ? { ...prev, ...data } : prev
            );
        } catch (err) {
            console.warn('Ошибка при обновлении таблицы:', err);
            throw err;
        }
    }, []);

    /**
     * Публикация таблицы
     */
    const publishTable = useCallback(async (id: number): Promise<void> => {
        try {
            const res = await api.patch<DTable | ''>(`/tables/${id}/publish`);

            // Если бэк вернул тело — используем, иначе подтягиваем
            const table: DTable = typeof res.data === 'object' && res.data !== null
                ? res.data
                : (await api.get<DTable>(`/tables/${id}`)).data;

            setTablesByWs(prev => {
                const wsId = table.workspace_id;
                return {
                    ...prev,
                    [wsId]: (prev[wsId] ?? []).map(t => t.id === id ? table : t),
                };
            });

            setSelectedTable(prev => (prev && prev.id === id ? table : prev));
        } catch (err: any) {
            if (err?.response?.status === 400) {
                throw new Error('Нужно указать хотя бы один PRIMARY KEY');
            }
            throw err;
        }
    }, []);

    // ─────────────────────────────────────────────────────────────
    // COLUMN ACTIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Загрузка колонок таблицы
     */
    const loadColumns = useCallback(async (table: DTable) => {
        setLoading(true);
        setError(null);
        setSelectedTable(table);

        try {
            const { data } = await api.get<Column[]>(`/tables/${table.id}/columns`);
            setColumns(data.sort((a, b) => a.id - b.id));
        } catch {
            setError('Не удалось загрузить столбцы');
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Обновление колонки таблицы
     */
    const updateTableColumn = useCallback(async (
        id: number,
        patch: Partial<Omit<Column, 'id'>>
    ) => {
        try {
            const { data } = await api.patch<Column>(`/tables/columns/${id}`, patch);

            setColumns(prev =>
                prev
                    .map(col => (col.id === id ? { ...col, ...data } : col))
                    .sort((a, b) => a.id - b.id)
            );
        } catch {
            setError('Ошибка при сохранении изменений');
            throw new Error('update failed');
        }
    }, []);

    /**
     * Удаление колонки таблицы
     */
    const deleteColumnTable = useCallback(async (id: number) => {
        try {
            await api.delete(`/tables/columns/${id}`);
            setColumns(prev => prev.filter(c => c.id !== id));
        } catch {
            setError('Ошибка при удалении столбца');
            throw new Error('delete failed');
        }
    }, []);

    /**
     * Создание колонки таблицы
     */
    const createTableColumn = useCallback(async (
        tableId: number,
        data: Partial<Column>
    ): Promise<Column> => {
        const { data: newColumn } = await api.post<Column>('/tables/columns/', {
            table_id: tableId,
            ...data,
        });

        setColumns(prev => [...prev, newColumn].sort((a, b) => a.id - b.id));

        return newColumn;
    }, []);

    return {
        // State
        tablesByWs,
        columns,
        selectedTable,
        loading,
        error,

        // Table Actions
        loadTables,
        deleteTable,
        updateTableMeta,
        publishTable,
        setSelectedTable,

        // Column Actions
        loadColumns,
        updateTableColumn,
        deleteColumnTable,
        createTableColumn,

        // Setters
        setTablesByWs,
    };
}