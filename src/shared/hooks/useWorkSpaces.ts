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


/** Под-виджеты, которые входят в форму */
export interface SubWidget {
    widget_order: number;          // порядок отображения
    sub_widget_id: number;          // id виджета-детали
    form_id: number;          // id той же формы
    where_conditional: string | null;   // SQL-условие, может быть null
}

/** Объект формы, связанной с «главным» виджетом */
export type WidgetForm = {
    main_widget_id: number;
    name: string;
    description: string | null;
    form_id: number;
    sub_widgets: {
        widget_order: number;
        sub_widget_id: number;
        form_id: number;
        where_conditional: string | null;
    }[];
};


//типизация формы MAIN

export interface FormColumn {
    column_order: number;
    column_name: string;
    placeholder: string | null;
    type: string | null;
    default: string | null;
    published: boolean;
    required: boolean;
    width: number;
}

/** Одна строка данных */
export interface FormRow {
    /** первичные ключи приходят объектом вида { person_id: 3, … } */
    primary_keys: Record<string, number | string>;
    /** значения идут в том же порядке, что и columns */
    values: (string | number | null)[];
}

/** Заголовок блока “displayed_widget” */
export interface DisplayedWidget {
    name: string;
    description: string | null;
}

/** Итоговый объект ответа */
export interface FormDisplay {
    displayed_widget: DisplayedWidget;
    columns: FormColumn[];
    data: FormRow[];
}


export interface SubDisplayedWidget {
    widget_order: number;
    name: string;
    description: string | null;
}

export interface SubFormColumn {
    column_order: number;
    column_name: string;
    placeholder: string | null;
    type: string | null;
    default: string | null;
    published: boolean;
    required: boolean;
    width: number;
}

export interface SubFormRow {
    primary_keys: Record<string, number | string>;
    values: (number | string | null)[];
}

export interface SubDisplay {
    sub_widgets: SubDisplayedWidget[];  // список заголовков
    displayed_widget: SubDisplayedWidget;    // активный
    columns: SubFormColumn[];
    data: SubFormRow[];
}


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
        /** force = true → игнорируем кэш и перезапрашиваем */
        async (wsId: number, force = false): Promise<DTable[]> => {
            if (!force && tablesByWs[wsId]) return tablesByWs[wsId];

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
    const loadWidgetsForTable = useCallback(
        /** force=true — игнорируем кэш */
        async (tableId: number, force = false): Promise<Widget[]> => {
            setWidgetsLoading(true);
            setWidgetsError(null);

            if (!force && widgetsByTable[tableId]) {
                setWidgetsLoading(false);
                return widgetsByTable[tableId];
            }

            try {
                const {data} = await api.get<Widget[]>('/widgets', {
                    params: {table_id: tableId},
                });
                setWidgetsByTable(prev => ({...prev, [tableId]: data}));
                return data;
            } catch {
                setWidgetsError('Не удалось загрузить widgets');
                return [];
            } finally {
                setWidgetsLoading(false);
            }
        },
        [widgetsByTable],
    );


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

    const [formsByWidget, setFormsByWidget] = useState<Record<number, WidgetForm>>({});


    /* ─ загружаем все формы один раз ─ */
    const loadWidgetForms = useCallback(async () => {
        if (Object.keys(formsByWidget).length) return;      // уже загружено
        const {data} = await api.get<WidgetForm[]>('/forms');
        const map: Record<number, WidgetForm> = {};
        data.forEach(f => {
            map[f.main_widget_id] = f;
        });       // сохраняем OBJECT
        setFormsByWidget(map);
    }, [formsByWidget]);


    /* --- новое состояние --- */
    const [formDisplay, setFormDisplay] = useState<FormDisplay | null>(null);
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);


    /* --- загрузка таблицы формы --- */
    const loadFormDisplay = useCallback(async (formId: number) => {
        setFormLoading(true);
        setFormError(null);
        try {
            const {data} = await api.post<FormDisplay>(`/display/${formId}/main`);
            setFormDisplay(data);
        } catch {
            setFormError('Не удалось загрузить данные формы');
        } finally {
            setFormLoading(false);
        }
    }, []);


    /* --- sub-display state --- */
    const [subDisplay, setSubDisplay] = useState<SubDisplay | null>(null);
    const [subLoading, setSubLoading] = useState(false);
    const [subError, setSubError] = useState<string | null>(null);

    const loadSubDisplay = useCallback(
        /**
         * primary — опционален: {} → БЕЗ фильтра.
         */
        async (
            formId: number,
            subOrder: number,
            primary: Record<string, unknown> = {},   // ← default
        ) => {
            setSubLoading(true);
            setSubError(null);
            try {
                const {data} = await api.post<SubDisplay>(
                    `/display/${formId}/sub`,
                    {primary_keys: primary},
                    {params: {sub_widget_order: subOrder}},
                );
                setSubDisplay(data);
            } catch {
                setSubError('Не удалось загрузить данные sub-виджета');
            } finally {
                setSubLoading(false);
            }
        },
        [],
    );


    //DELETE_MET_ALL


    //удалили workspace
    const deleteWorkspace = useCallback(async (wsId: number) => {
        setWorkSpaces(prev => prev.filter(w => w.id !== wsId));
        setTablesByWs(prev => {
            const clone = {...prev};
            delete clone[wsId];
            return clone;
        });
        try {
            await api.delete(`/workspaces/${wsId}`);
        } catch {
            /* если не удалось ‒ перезагрузим список полностью */
            await loadWorkSpaces();
        }
    }, [loadWorkSpaces]);

//удалили таблицу
    const deleteTable = useCallback(
        async (table: DTable) => {
            /* ————————— 1. optimistic UI ————————— */
            setTablesByWs(prev => {
                const copy = {...prev};
                copy[table.workspace_id] =
                    (copy[table.workspace_id] ?? []).filter(t => t.id !== table.id);
                return copy;
            });

            /* если мы просматривали именно эту таблицу — сбрасываем выбор */
            if (selectedTable?.id === table.id) {
                setSelTable(null);
                setColumns([]);
            }

            try {
                await api.delete(`/tables/${table.id}`);
            } catch {
                /* «откат» — подтягиваем свежий список с сервера */
                await loadTables(table.workspace_id, /* force */ true);
            }
        },
        [selectedTable, loadTables],
    );



    const fetchWidgetAndTable = useCallback(async (widgetId: number) => {
        // widget
        let widget = Object.values(widgetsByTable)
            .flat()
            .find(w => w?.id === widgetId);

        if (!widget) {
            const {data} = await api.get<Widget>(`/widgets/${widgetId}`);
            widget = data;
            setWidgetsByTable(prev => ({
                ...prev,
                [data.table_id]: [data],        // кэшируем
            }));
        }

        // table
        let table = Object.values(tablesByWs)
            .flat()
            .find(t => t?.id === widget.table_id);

        if (!table) {
            const {data} = await api.get<DTable>(`/tables/${widget.table_id}`);
            table = data;
            setTablesByWs(prev => ({
                ...prev,
                [data.workspace_id]: [...(prev[data.workspace_id] ?? []), data],
            }));
        }

        return {widget, table};
    }, [widgetsByTable, tablesByWs]);


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
        formsByWidget,
        loadWidgetForms,
        widgetColumns,
        wColsLoading,
        wColsError,
        loadColumnsWidget,
        loadFormDisplay,
        formDisplay,
        formLoading,
        formError,
        loadSubDisplay,
        subDisplay,
        subLoading,
        subError,
        deleteWorkspace,
        deleteTable,
        fetchWidgetAndTable,
    };
};
