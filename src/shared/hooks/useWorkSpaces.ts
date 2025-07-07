import {useCallback, useState} from "react";
import {api} from "@/services/api";
import {WorkSpaceTypes} from "@/types/typesWorkSpaces";


export interface DTable {
    id: number;
    workspace_id: number;
    name: string;
    description: string;
    published: boolean;
}

export interface Column {
    id: number;
    table_id: number;
    name: string;
    description: string | null
    datatype: string;
    required: boolean;
    length: number | null | string;
    precision: number | null | string;
    primary: boolean;
    increment: boolean;
    datetime: number | null | string;
    // остальные поля по желанию
}

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


// shared/hooks/useWorkSpaces.ts
export const useWorkSpaces = () => {
    const [workSpaces, setWorkSpaces] = useState<WorkSpaceTypes[]>([]);
    const [tablesByWs, setTablesByWs] = useState<Record<number, DTable[]>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [columns, setColumns] = useState<Column[]>([]);
    const [selectedTable, setSelTable] = useState<DTable | null>(null);

    /* — список WS — */
    const loadWorkSpaces = useCallback(async () => {
        setLoading(true);
        try {
            const {data} = await api.get<WorkSpaceTypes[]>('/workspaces');
            setWorkSpaces(data);
        } catch {
            setError('Не удалось загрузить рабочие пространства');
        } finally {
            setLoading(false);
        }
    }, []);

    /* — таблицы конкретного WS — */
    const loadTables = useCallback(
        async (wsId: number) => {
            // если уже загружали — просто вернём из стейта
            if (tablesByWs[wsId]) return tablesByWs[wsId];

            const {data} = await api.get<DTable[]>('/tables', {
                params: {workspace_id: wsId},
            });
            setTablesByWs(prev => ({...prev, [wsId]: data}));
            return data;
        },
        [tablesByWs],
    );

    const loadColumns = useCallback(
        async (table: DTable) => {
            setLoading(true);
            setError(null);
            setSelTable(table);             // сохраняем выбрано-е имя
            try {
                const {data} = await api.get<Column[]>(`/tables/${table.id}/columns`);
                setColumns(data.sort((a, b) => a.id - b.id));
            } catch {
                setError('Не удалось загрузить столбцы');
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    const [widgetsByTable, setWidgetsByTable] = useState<Record<number, Widget[]>>({});
    const [widgetsLoading, setWidgetsLoading] = useState(false);
    const [widgetsError, setWidgetsError] = useState<string | null>(null);

    const [widgetColumns, setWidgetColumns] = useState<WidgetColumn[]>([]);
    const [wColsLoading, setWColsLoading] = useState(false);
    const [wColsError, setWColsError] = useState<string | null>(null);

    /* — Загрузка виджетов конкретной таблицы — */
    const loadWidgetsForTable = useCallback(async (tableId: number) => {
        setWidgetsLoading(true);
        setWidgetsError(null);

        if (widgetsByTable[tableId]) {
            setWidgetsLoading(false);
            return;
        }

        try {
            const {data} = await api.get<Widget[]>('/widgets', {params: {table_id: tableId}});
            setWidgetsByTable(prev => ({...prev, [tableId]: data}));
        } catch {
            setWidgetsError('Не удалось загрузить widgets');
        } finally {
            setWidgetsLoading(false);
        }
    }, [widgetsByTable]);


    /** GET /widgets/{id}/columns */
    const loadColumnsWidget = useCallback(async (widgetId: number) => {
        setWColsLoading(true);
        setWColsError(null);
        try {
            const {data} = await api.get<WidgetColumn[]>(`/widgets/${widgetId}/columns`);
            setWidgetColumns(data);
        } catch {
            setWColsError('Не удалось загрузить столбцы виджета');
        } finally {
            setWColsLoading(false);
        }
    }, []);


    return {
        workSpaces,
        loadWorkSpaces,
        tablesByWs,      // <-- таблицы сгруппированы по WS
        loadTables,
        loading,
        error,
        columns,
        loadColumns,
        selectedTable,
        loadWidgetsForTable,
        widgetsByTable,
        widgetsLoading,
        widgetsError,
        widgetColumns, wColsLoading, wColsError, loadColumnsWidget,
    };
};
