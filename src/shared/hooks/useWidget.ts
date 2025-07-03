import {useState, useCallback} from 'react';
import {api} from '@/services/api';

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
        width: number;
        primary: boolean;
        visible: boolean;
        table_column: {
            table_id: number;
            id: number;
            name: string;
            description: string | null;
            datatype: string;
            length: number | null;
            precision: number | null;
            primary: boolean;
            increment: boolean;
            datetime: boolean;
            required: boolean;
        };
    }[];
};


export const useWidget = () => {
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [columns, setColumns] = useState<WidgetColumn[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const reset = useCallback(() => setWidgets([]), []);
    /** GET /widgets?table_id=X */
    const loadWidgetsForTable = useCallback(async (tableId: number) => {
        setLoading(true);
        setError(null);
        try {
            const {data} = await api.get<Widget[]>('/widgets', {
                params: {table_id: tableId},
            });
            setWidgets(data);
            setColumns([]);               // очистить прошлые столбцы
        } catch {
            setError('Не удалось загрузить widgets');
        } finally {
            setLoading(false);
        }
    }, []);

    /** GET /widgets/{id}/columns */
    const loadColumns = useCallback(async (widgetId: number) => {
        setLoading(true);
        setError(null);
        try {
            const {data} = await api.get<WidgetColumn[]>(`/widgets/${widgetId}/columns`);
            setColumns(data);
        } catch {
            setError('Не удалось загрузить столбцы виджета');
        } finally {
            setLoading(false);
        }
    }, []);


      /** POST /widgets/tables/references/{widget_col_id}/{table_column_id} */
          const addReference = useCallback(
            async (
                  widgetColId: number,
              tblColId: number,
              payload: { width: number; visible: boolean; primary: boolean },
        ) => {
              await api.post(
                    `/widgets/tables/references/${widgetColId}/${tblColId}`,
                    payload,
                  );
            },
        [],
          );



    return {widgets, columns, loading, error, loadWidgetsForTable, loadColumns, reset,addReference};
};
