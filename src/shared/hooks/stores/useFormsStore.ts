// forms

// src/shared/hooks/stores/useFormsStore.ts

import { useCallback, useRef, useState } from 'react';
import { api } from '@/services/api';
import type {
    WidgetForm,
    FormDisplay,
    SubDisplay,
    FormTreeColumn,
    AddFormRequest,
    NewFormPayload,
    LoadStatus,
} from './types';

export interface UseFormsStoreReturn {
    // State
    formsByWidget: Record<number, WidgetForm>;
    formsById: Record<number, WidgetForm>;
    formsListByWidget: Record<number, WidgetForm[]>;
    formDisplay: FormDisplay | null;
    formTrees: Record<number, FormTreeColumn[]>;
    subDisplay: SubDisplay | null;

    // Loading states
    formLoading: boolean;
    formError: string | null;
    subLoading: boolean;
    subError: string | null;

    // Form List Actions
    loadWidgetForms: () => Promise<void>;
    reloadWidgetForms: () => Promise<void>;
    addForm: (payload: NewFormPayload | AddFormRequest) => Promise<WidgetForm>;
    deleteForm: (formId: number) => Promise<void>;
    deleteSubWidgetFromForm: (formId: number, subWidgetId: number) => Promise<void>;
    deleteTreeFieldFromForm: (formId: number, tableColumnId: number) => Promise<void>;

    // Form Display Actions
    loadFormDisplay: (formId: number) => Promise<void>;
    loadFilteredFormDisplay: (
        formId: number,
        filter: { table_column_id: number; value: string | number }
    ) => Promise<void>;
    setFormDisplay: (value: FormDisplay | null) => void;

    // Sub Display Actions
    loadSubDisplay: (
        formId: number,
        subOrder: number,
        primary?: Record<string, unknown>
    ) => Promise<void>;
    setSubDisplay: (value: SubDisplay | null) => void;

    // Tree Actions
    loadFormTree: (formId: number) => Promise<void>;
}

export function useFormsStore(): UseFormsStoreReturn {
    // ─────────────────────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────────────────────

    // Форма-списки
    const [formsByWidget, setFormsByWidget] = useState<Record<number, WidgetForm>>({});
    const [formsById, setFormsById] = useState<Record<number, WidgetForm>>({});
    const [formsListByWidget, setFormsListByWidget] = useState<Record<number, WidgetForm[]>>({});

    // Form display
    const [formDisplay, setFormDisplay] = useState<FormDisplay | null>(null);
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Sub display
    const [subDisplay, setSubDisplay] = useState<SubDisplay | null>(null);
    const [subLoading, setSubLoading] = useState(false);
    const [subError, setSubError] = useState<string | null>(null);

    // Tree
    const [formTrees, setFormTrees] = useState<Record<number, FormTreeColumn[]>>({});

    // Status ref
    const formsStatusRef = useRef<LoadStatus>('idle');

    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────

    /**
     * Нормализация форм в разные структуры
     */
    const normalizeForms = useCallback((data: WidgetForm[]) => {
        const byWidget: Record<number, WidgetForm> = {};
        const byId: Record<number, WidgetForm> = {};
        const listByWidget: Record<number, WidgetForm[]> = {};

        data.forEach(f => {
            const sortedSubs = [...f.sub_widgets].sort(
                (a, b) => a.widget_order - b.widget_order
            );
            const normalized = { ...f, sub_widgets: sortedSubs };

            byId[f.form_id] = normalized;
            (listByWidget[f.main_widget_id] ??= []).push(normalized);

            // «Дефолт» форма для совместимости (первая встреченная)
            if (!byWidget[f.main_widget_id]) {
                byWidget[f.main_widget_id] = normalized;
            }
        });

        setFormsByWidget(byWidget);
        setFormsById(byId);
        setFormsListByWidget(listByWidget);
    }, []);

    // ─────────────────────────────────────────────────────────────
    // FORM LIST ACTIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Загрузка всех форм
     */
    const loadWidgetForms = useCallback(async () => {
        if (
            formsStatusRef.current === 'loading' ||
            formsStatusRef.current === 'loaded' ||
            formsStatusRef.current === 'forbidden'
        ) {
            return;
        }

        formsStatusRef.current = 'loading';

        try {
            const { data } = await api.get<WidgetForm[]>('/forms/');
            normalizeForms(data);
            formsStatusRef.current = 'loaded';
        } catch (e: any) {
            const status = e?.response?.status;
            console.warn('loadWidgetForms error', status ?? e);

            if (status === 403) {
                formsStatusRef.current = 'forbidden';
            } else {
                formsStatusRef.current = 'idle';
            }
        }
    }, [normalizeForms]);

    /**
     * Принудительная перезагрузка форм
     */
    const reloadWidgetForms = useCallback(async () => {
        const { data } = await api.get<WidgetForm[]>('/forms/');
        normalizeForms(data);
    }, [normalizeForms]);

    /**
     * Создание формы
     */
    const addForm = useCallback(async (
        payload: NewFormPayload | AddFormRequest
    ): Promise<WidgetForm> => {
        const body: AddFormRequest = 'form' in payload ? payload : { form: payload };

        const { data } = await api.post<WidgetForm>('/forms/', body);

        // Обновляем кеш
        setFormsByWidget(prev => ({
            ...prev,
            [data.main_widget_id]: {
                ...data,
                sub_widgets: [...data.sub_widgets].sort(
                    (a, b) => a.widget_order - b.widget_order
                ),
            },
        }));

        await reloadWidgetForms();

        return data;
    }, [reloadWidgetForms]);

    /**
     * Удаление формы
     */
    const deleteForm = useCallback(async (formId: number) => {
        try {
            await api.delete(`/forms/${formId}`);
        } catch (err: any) {
            if (err?.response?.status === 404) {
                await api.delete(`/forms/${formId}/`);
            } else {
                throw err;
            }
        }

        await reloadWidgetForms();
    }, [reloadWidgetForms]);

    /**
     * Удаление sub-widget из формы
     */
    const deleteSubWidgetFromForm = useCallback(async (
        formId: number,
        subWidgetId: number
    ) => {
        await api.delete(`/forms/${formId}/sub/${subWidgetId}`);
    }, []);

    /**
     * Удаление tree field из формы
     */
    const deleteTreeFieldFromForm = useCallback(async (
        formId: number,
        tableColumnId: number
    ) => {
        await api.delete(`/forms/${formId}/tree/${tableColumnId}`);
    }, []);

    // ─────────────────────────────────────────────────────────────
    // FORM DISPLAY ACTIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Загрузка display формы
     */
    const loadFormDisplay = useCallback(async (formId: number) => {
        setFormLoading(true);
        setFormError(null);

        try {
            const { data } = await api.post<FormDisplay>(`/display/${formId}/main`);
            setFormDisplay(data);
        } catch (e: any) {
            const status = e?.response?.status;

            if (status === 403) {
                setFormError('У вас нет доступа к этой форме');
            } else if (status === 404) {
                setFormError('Форма не найдена');
            } else {
                setFormError('Не удалось загрузить данные формы');
            }

            setFormDisplay(null);
        } finally {
            setFormLoading(false);
        }
    }, []);

    /**
     * Загрузка отфильтрованного display
     */
    const loadFilteredFormDisplay = useCallback(async (
        formId: number,
        filter: { table_column_id: number; value: string | number }
    ) => {
        try {
            const { data } = await api.post<FormDisplay>(
                `/display/${formId}/main`,
                [filter]
            );
            setFormDisplay(data);
        } catch (e) {
            console.warn('Ошибка при загрузке данных формы с фильтром:', e);
        }
    }, []);

    // ─────────────────────────────────────────────────────────────
    // SUB DISPLAY ACTIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Загрузка sub display
     */
    const loadSubDisplay = useCallback(async (
        formId: number,
        subOrder: number,
        primary?: Record<string, unknown>
    ) => {
        if (!formId) return;

        setSubLoading(true);
        setSubError(null);

        try {
            const params = new URLSearchParams({ sub_widget_order: String(subOrder) });

            const body = primary && Object.keys(primary).length
                ? {
                    primary_keys: Object.fromEntries(
                        Object.entries(primary).map(([k, v]) => [
                            k,
                            v == null ? '' : String(v),
                        ])
                    ),
                }
                : {};

            const { data } = await api.post<SubDisplay>(
                `/display/${formId}/sub?${params}`,
                body
            );

            setSubDisplay(data);
        } catch (e: any) {
            const status = e?.response?.status;

            if (status === 403) {
                setSubError('Нет доступа к подформе');
            } else if (status === 404) {
                setSubError('Подформа не найдена');
            } else {
                setSubError(
                    typeof e?.message === 'string'
                        ? e.message
                        : 'Ошибка загрузки подформы (subDisplay)'
                );
            }

            setSubDisplay(null);
        } finally {
            setSubLoading(false);
        }
    }, []);

    // ─────────────────────────────────────────────────────────────
    // TREE ACTIONS
    // ─────────────────────────────────────────────────────────────

    /**
     * Загрузка дерева формы
     */
    const loadFormTree = useCallback(async (formId: number): Promise<void> => {
        try {
            const { data } = await api.post<FormTreeColumn[] | FormTreeColumn>(
                `/display/${formId}/tree`
            );

            const normalized: FormTreeColumn[] = Array.isArray(data) ? data : [data];
            setFormTrees(prev => ({ ...prev, [formId]: normalized }));
        } catch (err: any) {
            const status = err?.response?.status;

            if (status === 403) {
                console.warn('Нет доступа к дереву фильтров формы');
            } else if (status !== 404) {
                console.warn('Не удалось загрузить дерево фильтров');
            }
            // 404 считаем «дерево не настроено» — это норма
        }
    }, []);

    return {
        // State
        formsByWidget,
        formsById,
        formsListByWidget,
        formDisplay,
        formTrees,
        subDisplay,

        // Loading states
        formLoading,
        formError,
        subLoading,
        subError,

        // Form List Actions
        loadWidgetForms,
        reloadWidgetForms,
        addForm,
        deleteForm,
        deleteSubWidgetFromForm,
        deleteTreeFieldFromForm,

        // Form Display Actions
        loadFormDisplay,
        loadFilteredFormDisplay,
        setFormDisplay,

        // Sub Display Actions
        loadSubDisplay,
        setSubDisplay,

        // Tree Actions
        loadFormTree,
    };
}