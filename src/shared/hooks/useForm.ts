import {useCallback, useState} from "react";
import {api} from "@/services/api";

export type useFormType = {
    main_widget_id: number,
    name: string,
    description: string,
    form_id: number,
}

export type Column = {
    column_order: number;
    column_name: string;
};

export type Row = {
    values: (string | null)[];
};

export type DisplayMainResponse = {
    columns: Column[];
    data: Row[];
};


export const useForm = (formId: number) => {
    const [formList, setFormList] = useState<useFormType[]>([]); // ✅ оставляем только это
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [columns, setColumns] = useState<Column[]>([]);
    const [rows, setRows] = useState<Row[]>([]);

    const loadForm = useCallback(async () => {
        try {
            const { data } = await api.get<useFormType[]>('/forms');
            setFormList(data); // ✅ теперь данные действительно попадут в formList
        } catch {
            setError('Не удалось загрузить список форм');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadDisplayMain = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get<DisplayMainResponse>(`/display/${formId}/main`);
            setColumns(data.columns);
            setRows(data.data);
        } catch {
            setError('Не удалось загрузить данные формы');
        } finally {
            setLoading(false);
        }
    }, [formId]);

    const selectedForm = formList.find(f => f.form_id === formId) || null;

    return {
        loadForm,
        selectedForm,
        columns,
        rows,
        loadDisplayMain,
        loading,
        error,
    };
};