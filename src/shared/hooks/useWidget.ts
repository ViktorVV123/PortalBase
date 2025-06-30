import { useState, useCallback } from 'react';
import { api } from '@/services/api';

export type Widget = {
    id: number;
    table_id: number;
    name: string;
    description: string | null;
}

export type WidgetColumn = {
    id: number;
    widget_id: number;
    alias: string | null;
    default: string | null;
    promt: string | null;
    published: boolean;
    reference: {
        visible: boolean;
        table_column_id: number;
        width: number;
        primary: boolean;
    }[];
}

export const useWidget = () => {
    const [widgets, setWidgets]           = useState<Widget[]>([]);
    const [columns, setColumns]           = useState<WidgetColumn[]>([]);
    const [loading, setLoading]           = useState(false);
    const [error,   setError]             = useState<string | null>(null);
    const reset = useCallback(() => setWidgets([]), []);
    /** GET /widgets?table_id=X */
    const loadWidgetsForTable = useCallback(async (tableId: number) => {
        setLoading(true); setError(null);
        try {
            const { data } = await api.get<Widget[]>('/widgets', {
                params: { table_id: tableId },
            });
            setWidgets(data);
            setColumns([]);               // очистить прошлые столбцы
        } catch {
            setError('Не удалось загрузить widgets');
        } finally { setLoading(false); }
    }, []);

    /** GET /widgets/{id}/columns */
    const loadColumns = useCallback(async (widgetId: number) => {
        setLoading(true); setError(null);
        try {
            const { data } = await api.get<WidgetColumn[]>(`/widgets/${widgetId}/columns`);
            setColumns(data);
        } catch {
            setError('Не удалось загрузить столбцы виджета');
        } finally { setLoading(false); }
    }, []);

    return { widgets, columns, loading, error, loadWidgetsForTable, loadColumns,reset };
};
