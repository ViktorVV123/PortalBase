import {useCallback, useState} from "react";
import {api} from "@/services/api";
import {Column} from "@/shared/hooks/useTableColumns";


export type UseWidgetType = {
    table_id:number;
    name: string;
    description:string;
    id:number;
}
export type Reference = {
    visible: boolean;
    table_column_id: number;
    width: number;
    primary: boolean;
};
export type WidgetColumn = {
    id: number;
    widget_id: number;
    alias: string | null;
    default: string | null;
    promt: string | null;     // ← опечатка на сервере? если нужно – используйте prompt
    published: boolean;
    reference: Reference[];
};

export const UseWidget = () => {

    const [widget, setWidget] = useState<UseWidgetType[]>([])
    const [widgetColumn, setWidgetColumn] = useState<WidgetColumn[]>([])
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);


    const loadWidget = useCallback(async () => {
        try {
            const {data} = await api.get<UseWidgetType[]>('/widgets');
            setWidget(data);
        } catch {
            setError('Не удалось загрузить список соединений');
        } finally {
            setLoading(false);
        }
    },[])

    const loadWidgetForTable = useCallback(async (tableId: number) => {
        setLoading(true);
        setError(null);
        try {
            /* бэк поддерживает фильтр ?table_id=  */
            const { data } = await api.get<UseWidgetType[]>('/widgets', {
                params: { table_id: tableId },
            });

            if (!data.length) {
                setWidget(null);
                setWidgetColumn([]);
                return;
            }

            const w = data[0];          // берём первый (или все, если нужно)
            setWidget(w);

            /* шаг 2: колонки выбранного widget */
            const { data: cols } = await api.get<WidgetColumn>(
                `/widgets/${w.id}/columns`,
            );
            setWidgetColumn(cols);
        } catch {
            setError('Не удалось загрузить widget/columns');
        } finally {
            setLoading(false);
        }
    }, []);



    return {loadWidget,widget,widgetColumn,loadWidgetForTable}
};

