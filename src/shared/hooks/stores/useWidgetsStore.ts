// widgets + widget columns

// src/shared/hooks/stores/useWidgetsStore.ts

import { useCallback, useRef, useState } from 'react';
import { api } from '@/services/api';
import type { Widget, WidgetColumn, ReferenceItem, RefPatch } from './types';

export interface UseWidgetsStoreReturn {
    // State
    widgetsByTable: Record<number, Widget[]>;
    widgetColumns: WidgetColumn[];
    loading: boolean;
    error: string | null;

    // Widget Actions
    loadWidgetsForTable: (tableId: number, force?: boolean) => Promise<Widget[]>;
    deleteWidget: (widgetId: number, tableId: number) => Promise<void>;
    updateWidgetMeta: (id: number, patch: Partial<Widget>) => Promise<Widget>;
    fetchWidgetAndTable: (widgetId: number) => Promise<{ widget: Widget; tableId: number }>;

    // Widget Column Actions
    loadColumnsWidget: (widgetId: number) => Promise<void>;
    updateWidgetColumn: (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => Promise<void>;
    deleteColumnWidget: (widgetColumnId: number) => Promise<void>;
    addWidgetColumn: (payload: {
        widget_id: number;
        alias: string;
        column_order: number;
        default?: string;
        placeholder?: string;
        visible?: boolean;
        type?: string;
    }) => Promise<WidgetColumn>;

    // Reference Actions
    fetchReferences: (widgetColumnId: number) => Promise<ReferenceItem[]>;
    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: RefPatch & { form_id?: number | null }
    ) => Promise<ReferenceItem>;
    deleteReference: (widgetColumnId: number, tableColumnId: number) => Promise<void>;

    // Setters для интеграции
    setWidgetsByTable: React.Dispatch<React.SetStateAction<Record<number, Widget[]>>>;
    setWidgetColumns: React.Dispatch<React.SetStateAction<WidgetColumn[]>>;
}

export function useWidgetsStore(): UseWidgetsStoreReturn {
    const [widgetsByTable, setWidgetsByTable] = useState<Record<number, Widget[]>>({});
    const [widgetColumns, setWidgetColumns] = useState<WidgetColumn[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Трекинг forbidden tables для виджетов
    const forbiddenWidgetsTablesRef = useRef<Set<number>>(new Set());

    // ─────────────────────────────────────────────────────────────
    // WIDGET ACTIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Загрузка виджетов для таблицы
     */
    const loadWidgetsForTable = useCallback(async (
        tableId: number,
        force = false
    ): Promise<Widget[]> => {
        if (!force) {
            if (forbiddenWidgetsTablesRef.current.has(tableId)) {
                return widgetsByTable[tableId] ?? [];
            }
            if (widgetsByTable[tableId]) {
                return widgetsByTable[tableId];
            }
        }

        setLoading(true);
        setError(null);

        try {
            const { data } = await api.get<Widget[]>('/widgets', {
                params: { table_id: tableId },
            });

            setWidgetsByTable(prev => ({ ...prev, [tableId]: data }));
            forbiddenWidgetsTablesRef.current.delete(tableId);

            return data;
        } catch (e: any) {
            const status = e?.response?.status;

            if (status === 403 || status === 404) {
                forbiddenWidgetsTablesRef.current.add(tableId);
                setError('Нет доступа к виджетам этой таблицы');
            } else {
                setError('Не удалось загрузить widgets');
            }

            return widgetsByTable[tableId] ?? [];
        } finally {
            setLoading(false);
        }
    }, [widgetsByTable]);

    /**
     * Удаление виджета
     */
    const deleteWidget = useCallback(async (widgetId: number, tableId: number) => {
        try {
            await api.delete(`/widgets/${widgetId}`);

            setWidgetsByTable(prev => ({
                ...prev,
                [tableId]: (prev[tableId] ?? []).filter(w => w.id !== widgetId),
            }));

            // Очищаем колонки, если это был открытый виджет
            setWidgetColumns(prev => prev.filter(wc => wc.widget_id !== widgetId));
        } catch {
            setError('Ошибка при удалении виджета');
        }
    }, []);

    /**
     * Обновление метаданных виджета
     */
    const updateWidgetMeta = useCallback(async (
        id: number,
        patch: Partial<Widget>
    ): Promise<Widget> => {
        const { data } = await api.patch<Widget>(`/widgets/${id}`, patch);

        setWidgetsByTable(prev => {
            const tbl = data.table_id;
            return {
                ...prev,
                [tbl]: (prev[tbl] ?? []).map(w => (w.id === id ? data : w)),
            };
        });

        return data;
    }, []);

    /**
     * Получение виджета и его tableId
     */
    const fetchWidgetAndTable = useCallback(async (widgetId: number) => {
        // Сначала ищем в кэше
        let widget = Object.values(widgetsByTable)
            .flat()
            .find(w => w?.id === widgetId);

        if (!widget) {
            const { data } = await api.get<Widget>(`/widgets/${widgetId}`);
            widget = data;

            setWidgetsByTable(prev => ({
                ...prev,
                [data.table_id]: [...(prev[data.table_id] ?? []), data],
            }));
        }

        return { widget, tableId: widget.table_id };
    }, [widgetsByTable]);

    // ─────────────────────────────────────────────────────────────
    // WIDGET COLUMN ACTIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Загрузка колонок виджета
     */
    const loadColumnsWidget = useCallback(async (widgetId: number) => {
        setLoading(true);
        setError(null);

        try {
            const { data } = await api.get<WidgetColumn[]>(`/widgets/${widgetId}/columns`);
            setWidgetColumns(data.sort((a, b) => a.id - b.id));
        } catch {
            setError('Не удалось загрузить столбцы виджета');
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Обновление колонки виджета
     */
    const updateWidgetColumn = useCallback(async (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => {
        // Очищаем пустые значения
        const clean: any = { ...patch };
        ['alias', 'default', 'promt', 'column_order'].forEach(f => {
            if (clean[f] === '') delete clean[f];
        });

        try {
            const { data } = await api.patch<WidgetColumn>(`/widgets/columns/${id}`, clean);

            setWidgetColumns(prev =>
                [...prev]
                    .map(wc => (wc.id === id ? { ...wc, ...data } : wc))
                    .sort((a, b) => a.id - b.id)
            );
        } catch {
            setError('Ошибка при сохранении столбца виджета');
            throw new Error('update failed');
        }
    }, []);

    /**
     * Удаление колонки виджета
     */
    const deleteColumnWidget = useCallback(async (widgetColumnId: number) => {
        try {
            await api.delete(`/widgets/columns/${widgetColumnId}`);
            setWidgetColumns(prev => prev.filter(wc => wc.id !== widgetColumnId));
        } catch {
            setError('Ошибка при удалении столбца виджета');
        }
    }, []);

    /**
     * Добавление колонки виджета
     */
    const addWidgetColumn = useCallback(async (payload: {
        widget_id: number;
        alias: string;
        column_order: number;
        default?: string;
        placeholder?: string;
        visible?: boolean;
        type?: string;
    }): Promise<WidgetColumn> => {
        const { data } = await api.post<WidgetColumn>('/widgets/columns', payload);

        setWidgetColumns(prev => [...prev, data].sort((a, b) => a.id - b.id));

        return data;
    }, []);

    // ─────────────────────────────────────────────────────────────
    // REFERENCE ACTIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Получение references для колонки виджета
     */
    const fetchReferences = useCallback(async (
        widgetColumnId: number
    ): Promise<ReferenceItem[]> => {
        const { data } = await api.get<ReferenceItem[]>(
            `/widgets/tables/references/${widgetColumnId}`
        );
        return data;
    }, []);

    /**
     * Обновление reference
     */
    const updateReference = useCallback(async (
        widgetColumnId: number,
        tableColumnId: number,
        patch: RefPatch & { form_id?: number | null }
    ): Promise<ReferenceItem> => {
        const { data } = await api.patch<ReferenceItem>(
            `/widgets/tables/references/${widgetColumnId}/${tableColumnId}`,
            patch
        );
        return data;
    }, []);

    /**
     * Удаление reference
     */
    const deleteReference = useCallback(async (
        widgetColumnId: number,
        tableColumnId: number
    ) => {
        await api.delete(
            `/widgets/tables/references/${widgetColumnId}/${tableColumnId}`
        );
    }, []);

    return {
        // State
        widgetsByTable,
        widgetColumns,
        loading,
        error,

        // Widget Actions
        loadWidgetsForTable,
        deleteWidget,
        updateWidgetMeta,
        fetchWidgetAndTable,

        // Widget Column Actions
        loadColumnsWidget,
        updateWidgetColumn,
        deleteColumnWidget,
        addWidgetColumn,

        // Reference Actions
        fetchReferences,
        updateReference,
        deleteReference,

        // Setters
        setWidgetsByTable,
        setWidgetColumns,
    };
}