import {useCallback, useState} from "react";
import {api} from "@/services/api";
import {WorkSpaceTypes} from "@/types/typesWorkSpaces";
import {Connection} from "@/types/typesConnection";
import {useLoadConnections} from "@/shared/hooks/useLoadConnections";
import {WcReference} from "@/components/WidgetColumnsOfTable/WidgetColumnsOfTable";


export interface DTable {
    id: number;
    workspace_id: number;
    name: string;
    description: string;
    published: boolean;
    select_query?: string;
    insert_query?: string;
    update_query?: string;
    delete_query: string;
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
    datetime: number | null | string | boolean;
    // остальные поля по желанию
}

export type Widget = {
    id: number;
    table_id: number;
    name: string;
    description: string | null;
    published: boolean;
}


export type WidgetColumn = {
    widget_id: number;
    alias: string | null;
    column_order: number;
    id: number;
    reference: {
        ref_column_order: number;
        ref_alias: string | null;
        combobox: any
        form:any
        // ↓ эти поля теперь на уровне reference
        placeholder: string | null;
        width: number;
        type: string | null;
        default: string | null;
        visible: boolean;
        readonly: boolean;

        table_column: {
            table_id: number;
            name: string;
            datatype: string;
            precision: number | null;
            increment: boolean;
            id: number;
            description: string | null;
            length: number | null;
            primary: boolean;
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
    search_bar: boolean;
    description: string | null;
    form_id: number;
    sub_widgets: {
        widget_order: number;
        sub_widget_id: number;
        form_id: number;
        where_conditional: string | null;
    }[];
    tree_fields: {
        column_order: number;
        table_column_id: number;
    }[];
};

//типизация формы MAIN

export interface FormColumn {
    column_order: number;
    column_name: string;
    ref_column_name:string
    readonly: boolean;
    placeholder: string | null;
    type: string | null;
    default: string | null;
    published: boolean;
    required: boolean;
    width: number;
    widget_column_id: number;
    table_column_id: number
    form_id:number
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
    widget_column_id: number;
    table_column_id: number;
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

export interface FormTreeColumn {
    table_column_id: number;
    name: string;
    values: (string | number | null)[];
}

export type HeaderGroup = {
    id: number;
    order: number;
    title: string;
    span: number;
    labels: string[];
};

export type NewFormPayload = {
    main_widget_id: number;
    name: string;
    description?: string | null;
    path?: string | null;
};

export type NewSubWidgetItem = {
    widget_order: number;
    where_conditional?: string | null;
    sub_widget_id: number;
};

export type NewTreeFieldItem = {
    column_order: number;
    table_column_id: number;
};

export type AddFormRequest = {
    form: NewFormPayload;
    sub_widgets_lst?: NewSubWidgetItem[];
    tree_fields_lst?: NewTreeFieldItem[];
};
type RefPatch = Partial<{
    ref_column_order: number;
    width: number;
    type: string | null;
    ref_alias: string | null;
    default: string | null;
    placeholder: string | null;
    visible: boolean;
    readonly: boolean;
}>;


export type ReferenceItem = WidgetColumn['reference'][number];

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
            setWorkSpaces(data.sort((a, b) => a.id - b.id));
        } catch {
            setError('Не удалось загрузить рабочие пространства');
        } finally {
            setLoading(false);
        }
    }, []);

    const updateTableMeta = useCallback(
        async (id: number, patch: Partial<DTable>) => {
            try {
                const {data} = await api.patch<DTable>(`/tables/${id}`, patch);

                setTablesByWs(prev => {
                    const copy = {...prev};
                    const wsId = data.workspace_id;
                    copy[wsId] = (copy[wsId] || []).map(t => t.id === id ? {...t, ...data} : t);
                    return copy;
                });

                // 👇 Обновим selectedTable вручную
                setSelTable(prev => prev && prev.id === id ? {...prev, ...data} : prev);
            } catch (err) {
                console.warn('Ошибка при обновлении таблицы:', err);
            }
        },
        []
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


    // ↓ добавьте сразу под addReference
    /** GET /widgets/tables/references/{widgetColumnId} */
    const fetchReferences = useCallback(
        async (widgetColumnId: number) => {
            const {data} = await api.get<ReferenceItem[]>(
                `/widgets/tables/references/${widgetColumnId}`
            );
            return data;
        },
        [],
    );


    /** DELETE /widgets/tables/references/{widgetColumnId}/{tableColumnId} */
    const deleteReference = useCallback(
        async (widgetColumnId: number, tableColumnId: number) => {
            await api.delete(
                `/widgets/tables/references/${widgetColumnId}/${tableColumnId}`,
            );
        },
        [],
    );
    // внутри useWorkSpaces
    const updateWidgetMeta = useCallback(
        async (id: number, patch: Partial<Widget>): Promise<Widget> => {
            const {data} = await api.patch<Widget>(`/widgets/${id}`, patch);
            setWidgetsByTable(prev => {
                const tbl = data.table_id;
                return {
                    ...prev,
                    [tbl]: (prev[tbl] ?? []).map(w => (w.id === id ? data : w)),
                };
            });
            return data;
        },
        [setWidgetsByTable] // ← см. п.2
    );


    /** GET /widgets/{id}/columns */
    const loadColumnsWidget = useCallback(async (widgetId: number) => {
        setWColsLoading(true);
        setWColsError(null);
        try {
            const {data} = await api.get<WidgetColumn[]>(`/widgets/${widgetId}/columns`);
            setWidgetColumns(data.sort((a, b) => a.id - b.id));
        } catch {
            setWColsError('Не удалось загрузить столбцы виджета');
        } finally {
            setWColsLoading(false);
        }
    }, []);

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

    //ВСЕ О ТАБЛИЦАХ
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


    /** PATCH /tables/columns/{id}  — обновить одну колонку */
    const updateTableColumn = useCallback(
        async (id: number, patch: Partial<Omit<Column, 'id'>>) => {
            try {
                /* 1. запрос к бэку */
                const {data} = await api.patch<Column>(`/tables/columns/${id}`, patch);

                /* 2. локально подменяем в state */
                setColumns(prev =>
                    prev
                        .map(col => (col.id === id ? {...col, ...data} : col))
                        .sort((a, b) => a.id - b.id)           // порядок сохраняем
                );
            } catch {
                setError('Ошибка при сохранении изменений');
                throw new Error('update failed');
            }
        },
        []
    );


    //удаляем строку в Table
    const deleteColumnTable = useCallback(
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

    /* сразу после updateTableMeta */
    const publishTable = useCallback(
        async (id: number): Promise<void> => {
            try {
                /* PATCH — сервер может вернуть 204 */
                const res = await api.patch<DTable | ''>(`/tables/${id}/publish`);

                /* если бэк вернул тело — используем его,
                   иначе подтягиваем свежую таблицу */
                const table: DTable = typeof res.data === 'object' && res.data !== null
                    ? res.data
                    : (await api.get<DTable>(`/tables/${id}`)).data;

                /* синхронизируем кэши */
                setTablesByWs(prev => {
                    const wsId = table.workspace_id;
                    return {
                        ...prev,
                        [wsId]: (prev[wsId] ?? []).map(t => t.id === id ? table : t),
                    };
                });
                setSelTable(prev => (prev && prev.id === id ? table : prev));
            } catch (err: any) {
                if (err?.response?.status === 400) {
                    throw new Error('Нужно указать хотя бы один PRIMARY KEY');
                }
                throw err;
            }
        },
        [setTablesByWs, setSelTable],
    );
    //НАЧАЛО WIDGET (удаление ,update b т.д)

    // useWorkSpaces.ts
    const [formsByWidget, setFormsByWidget] = useState<Record<number, WidgetForm>>({});
    const [formsById, setFormsById] = useState<Record<number, WidgetForm>>({});
    const [formsListByWidget, setFormsListByWidget] = useState<Record<number, WidgetForm[]>>({});

// общий нормалайзер
    const normalizeForms = (data: WidgetForm[]) => {
        const byWidget: Record<number, WidgetForm> = {};
        const byId: Record<number, WidgetForm> = {};
        const listByWidget: Record<number, WidgetForm[]> = {};

        data.forEach(f => {
            const sortedSubs = [...f.sub_widgets].sort((a, b) => a.widget_order - b.widget_order);
            const normalized = {...f, sub_widgets: sortedSubs};

            byId[f.form_id] = normalized;
            (listByWidget[f.main_widget_id] ??= []).push(normalized);

            // «дефолт» форма для совместимости (первая встреченная)
            if (!byWidget[f.main_widget_id]) byWidget[f.main_widget_id] = normalized;
        });

        setFormsByWidget(byWidget);
        setFormsById(byId);
        setFormsListByWidget(listByWidget);
    };

    const loadWidgetForms = useCallback(async () => {
        if (Object.keys(formsById).length) return;       // уже загружено
        const {data} = await api.get<WidgetForm[]>('/forms');
        normalizeForms(data);
    }, [formsById]);

    const reloadWidgetForms = useCallback(async () => {
        const {data} = await api.get<WidgetForm[]>('/forms');
        normalizeForms(data);
    }, []);


    // ⬇️ создание формы
    const addForm = useCallback(
        async (payload: NewFormPayload | AddFormRequest) => {
            // поддерживаем старый вызов: addForm({ main_widget_id, name, ... })
            const body: AddFormRequest = 'form' in payload ? payload : {form: payload};

            const {data} = await api.post<WidgetForm>('/forms/', body);

            // аккуратно обновим кеш (если у тебя один form на widget — оставляем как есть)
            setFormsByWidget(prev => ({
                ...prev,
                [data.main_widget_id]: {
                    ...data,
                    sub_widgets: [...data.sub_widgets].sort((a, b) => a.widget_order - b.widget_order)
                }
            }));

            await reloadWidgetForms();
            return data;
        },
        [reloadWidgetForms]
    );

    // ⬇️ НОВОЕ: удаление формы
    const deleteForm = useCallback(async (formId: number) => {
        try {
            await api.delete(`/forms/${formId}`);
        } catch (err: any) {
            // на случай, если роут ожидает слэш
            if (err?.response?.status === 404) {
                await api.delete(`/forms/${formId}/`);
            } else {
                throw err;
            }
        }
        await reloadWidgetForms(); // синхронизируем меню
    }, [reloadWidgetForms]);


    //удаляем строку в Widget
    const deleteColumnWidget = useCallback(
        async (widgetColumnId: number) => {
            try {
                await api.delete(`/widgets/columns/${widgetColumnId}`);

                /* из стейта убираем весь объект WidgetColumnsOfTable с этим id */
                setWidgetColumns(prev => prev.filter(wc => wc.id !== widgetColumnId));
            } catch {
                setError('Ошибка при удалении столбца виджета');
            }
        },
        [],
    );

    const deleteWidget = useCallback(
        async (widgetId: number, tableId: number) => {
            try {
                await api.delete(`/widgets/${widgetId}`);

                /* 1. убираем из списка виджетов конкретной таблицы */
                setWidgetsByTable(prev => ({
                    ...prev,
                    [tableId]: (prev[tableId] ?? []).filter(w => w.id !== widgetId),
                }));

                /* 2. если этот виджет сейчас открыт — очищаем его столбцы */
                setWidgetColumns(prev => prev.filter(wc => wc.widget_id !== widgetId));
            } catch {
                setError('Ошибка при удалении виджета');
            }
        },
        [],
    );


    /* ---------- WIDGET-COLUMNS PATCH  обновляем значения в widget/columns ---------- */
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


    const updateWidgetColumn = useCallback(
        async (
            id: number,
            patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
        ) => {
            const clean: any = {...patch};
            ['alias', 'default', 'promt', 'column_order'].forEach(f => {
                if (clean[f] === '') delete clean[f];
            });

            try {
                const {data} = await api.patch<WidgetColumn>(`/widgets/columns/${id}`, clean);

                setWidgetColumns(prev =>
                    [...prev]                              // создаём копию
                        .map(wc => (wc.id === id ? {...wc, ...data} : wc))
                        .sort((a, b) => a.id - b.id)        // !!! сортируем по id
                );
            } catch {
                setWColsError('Ошибка при сохранении столбца виджета');
                throw new Error('update failed');
            }
        },
        []
    );

    // useWorkSpaces.ts
    const updateReference = useCallback(
        async (widgetColumnId: number, tableColumnId: number, patch: RefPatch) => {
            const {data} = await api.patch<ReferenceItem>(
                `/widgets/tables/references/${widgetColumnId}/${tableColumnId}`,
                patch
            );
            return data;
        },
        []
    );



    //ВСЕ ДЛЯ ФОРМ (они у нас самые последние из вывода таблиц и тд)
    const [formTrees, setFormTrees] = useState<Record<number, FormTreeColumn[]>>({});
    const [formTreeLoading, setFormTreeLoading] = useState(false);
    const [formTreeError, setFormTreeError] = useState<string | null>(null);

    const loadFormTree = useCallback(async (formId: number): Promise<void> => {
        setFormTreeLoading(true);
        setFormTreeError(null);
        try {
            const {data} = await api.post<FormTreeColumn[] | FormTreeColumn>(`/display/${formId}/tree`);

            const normalized: FormTreeColumn[] = Array.isArray(data) ? data : [data];

            setFormTrees(prev => ({...prev, [formId]: normalized}));
        } catch (err: any) {
            console.warn('Не удалось загрузить справочники:', err?.response?.status ?? err);
            // Не считаем ошибкой — справочники могут отсутствовать
        } finally {
            setFormTreeLoading(false);
        }
    }, []);

    /* --- sub форма --- */
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


                /* сортируем заголовки */
                const sorted = {
                    ...data, sub_widgets: [...data.sub_widgets].sort(
                        (a, b) => a.widget_order - b.widget_order
                    )
                };

                setSubDisplay(sorted);

            } catch {
                setSubError('Не удалось загрузить данные sub-виджета');
            } finally {
                setSubLoading(false);
            }
        },
        [],
    );
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

    const loadFilteredFormDisplay = useCallback(
        async (
            formId: number,
            filter: { table_column_id: number; value: string | number }
        ) => {
            try {
                const payload = [filter]; // 👈 оборачиваем в массив

                const {data} = await api.post<FormDisplay>(
                    `/display/${formId}/main`,
                    payload
                );

                setFormDisplay(data); // 👈 теперь данные отобразятся
            } catch (e) {
                console.warn('Ошибка при загрузке данных формы с фильтром:', e);
            }
        },
        []
    );


//connections
    const [connections, setConnections] = useState<Connection[]>([]);

    const loadConnections = useCallback(async () => {
        try {
            const {data} = await api.get<Connection[]>('/connections');
            setConnections(data);
        } catch {
            setError('Не удалось загрузить список соединений');
        } finally {
            setLoading(false);
        }
    }, []);

    /* ↓ рядом с loadConnections connections delete */
    const deleteConnection = useCallback(async (id: number) => {
        try {
            await api.delete(`/connections/${id}`);
            setConnections(prev => prev.filter(c => c.id !== id));  // убираем из стейта
        } catch {
            alert('Не удалось удалить подключение');
        }
    }, []);


    // ↓ сразу после updateWidgetColumn
    /* ↓ держим один-единственный аргумент – готовый payload */
    const addWidgetColumn = useCallback(
        async (payload: {
            widget_id: number;
            alias: string;
            default: string;
            placeholder: string;
            visible: boolean;
            type: string;
            column_order: number;
        }) => {
            /* POST именно в коллекцию */
            const {data} = await api.post<WidgetColumn>(
                '/widgets/columns/',    // ← слэш на конце, как у всех остальных
                payload,
            );

            /* подмешиваем сразу в стейт, чтобы не ждать доп. запроса */
            setWidgetColumns(prev => [...prev, data].sort((a, b) => a.id - b.id));
            return data;
        },
        [],
    );


    const deleteSubWidgetFromForm = useCallback(
        async (formId: number, subWidgetId: number) => {
            await api.delete(`/forms/${formId}/sub/${subWidgetId}`);
        },
        []
    );

    const deleteTreeFieldFromForm = useCallback(
        async (formId: number, tableColumnId: number) => {
            await api.delete(`/forms/${formId}/tree/${tableColumnId}`);
        },
        []
    );


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
        deleteColumnTable,
        deleteColumnWidget,
        deleteWidget,
        updateTableColumn,
        updateWidgetColumn,
        loadFormTree,
        formTrees,
        loadFilteredFormDisplay,
        setFormDisplay,
        setSubDisplay,
        updateTableMeta,
        connections,
        loadConnections,
        setWidgetsByTable,
        fetchReferences,
        deleteReference,
        updateWidgetMeta,
        addWidgetColumn,
        publishTable,
        deleteConnection,
        updateReference,
        addForm,
        reloadWidgetForms,
        formsListByWidget,     // ← НОВОЕ
        deleteForm,
        formsById,
        deleteSubWidgetFromForm,
        deleteTreeFieldFromForm,



    };
};
