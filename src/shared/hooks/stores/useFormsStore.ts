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

// ═══════════════════════════════════════════════════════════
// КОНСТАНТЫ ПАГИНАЦИИ
// ═══════════════════════════════════════════════════════════
export const MAIN_TABLE_PAGE_SIZE = 80;

// ═══════════════════════════════════════════════════════════
// ТИПЫ ПАГИНАЦИИ
// ═══════════════════════════════════════════════════════════
export type PaginationState = {
    currentPage: number;
    totalRows: number;
    pageSize: number;
    hasMore: boolean;
    isLoadingMore: boolean;
};

export interface UseFormsStoreReturn {
    // State
    formsByWidget: Record<number, WidgetForm>;
    formsById: Record<number, WidgetForm>;
    formsListByWidget: Record<number, WidgetForm[]>;
    formDisplay: FormDisplay | null;
    formTrees: Record<number, FormTreeColumn[]>;
    subDisplay: SubDisplay | null;

    // Pagination state
    pagination: PaginationState;

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

    // Form Display Actions (с пагинацией и поиском)
    loadFormDisplay: (formId: number, page?: number, searchPattern?: string) => Promise<void>;
    loadFilteredFormDisplay: (
        formId: number,
        filter: { table_column_id: number; value: string | number },
        page?: number,
        searchPattern?: string
    ) => Promise<void>;
    setFormDisplay: (value: FormDisplay | null) => void;

    // Pagination Actions
    goToPage: (
        formId: number,
        page: number,
        filters?: Array<{ table_column_id: number; value: string | number }>,
        searchPattern?: string
    ) => Promise<void>;

    // Infinite Scroll Actions
    loadMoreRows: (
        formId: number,
        filters?: Array<{ table_column_id: number; value: string | number }>,
        searchPattern?: string
    ) => Promise<void>;

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

    const [formsByWidget, setFormsByWidget] = useState<Record<number, WidgetForm>>({});
    const [formsById, setFormsById] = useState<Record<number, WidgetForm>>({});
    const [formsListByWidget, setFormsListByWidget] = useState<Record<number, WidgetForm[]>>({});

    const [formDisplay, setFormDisplay] = useState<FormDisplay | null>(null);
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const [pagination, setPagination] = useState<PaginationState>({
        currentPage: 1,
        totalRows: 0,
        pageSize: MAIN_TABLE_PAGE_SIZE,
        hasMore: false,
        isLoadingMore: false,
    });

    const [subDisplay, setSubDisplay] = useState<SubDisplay | null>(null);
    const [subLoading, setSubLoading] = useState(false);
    const [subError, setSubError] = useState<string | null>(null);

    const [formTrees, setFormTrees] = useState<Record<number, FormTreeColumn[]>>({});

    const formsStatusRef = useRef<LoadStatus>('idle');
    const loadedRowsCountRef = useRef(0);

    // Храним ID текущей загруженной формы для проверки при смене
    const currentFormIdRef = useRef<number | null>(null);

    // Храним текущий search_pattern для использования в loadMoreRows
    const currentSearchPatternRef = useRef<string>('');

    // ─────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────

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

            if (!byWidget[f.main_widget_id]) {
                byWidget[f.main_widget_id] = normalized;
            }
        });

        setFormsByWidget(byWidget);
        setFormsById(byId);
        setFormsListByWidget(listByWidget);
    }, []);

    /**
     * Сброс состояния пагинации
     */
    const resetPagination = useCallback(() => {
        loadedRowsCountRef.current = 0;
        setPagination({
            currentPage: 1,
            totalRows: 0,
            pageSize: MAIN_TABLE_PAGE_SIZE,
            hasMore: false,
            isLoadingMore: false,
        });
    }, []);

    /**
     * Построение URL параметров с учётом пагинации и поиска
     */
    const buildQueryParams = useCallback((
        page: number,
        searchPattern?: string
    ): URLSearchParams => {
        const params = new URLSearchParams({
            limit: String(MAIN_TABLE_PAGE_SIZE),
            page: String(page),
        });

        // Добавляем search_pattern если есть
        if (searchPattern && searchPattern.trim()) {
            params.set('search_pattern', searchPattern.trim());
        }

        return params;
    }, []);

    /**
     * Обновление состояния пагинации из ответа API
     * ВАЖНО: displayed_widget.total — это количество СТРАНИЦ, не строк!
     */
    const updatePaginationFromResponse = useCallback((data: FormDisplay, page: number, loadedRowsCount: number) => {
        const totalPages = data.displayed_widget?.total ?? 1;
        const currentPage = data.displayed_widget?.page ?? page;
        const hasMore = currentPage < totalPages;

        loadedRowsCountRef.current = loadedRowsCount;

        setPagination({
            currentPage,
            totalRows: totalPages * MAIN_TABLE_PAGE_SIZE,
            pageSize: MAIN_TABLE_PAGE_SIZE,
            hasMore,
            isLoadingMore: false,
        });
    }, []);

    // ─────────────────────────────────────────────────────────────
    // FORM LIST ACTIONS
    // ─────────────────────────────────────────────────────────────

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
            const { data } = await api.get<WidgetForm[]>('/forms');
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

    const reloadWidgetForms = useCallback(async () => {
        const { data } = await api.get<WidgetForm[]>('/forms');
        normalizeForms(data);
    }, [normalizeForms]);

    const addForm = useCallback(async (
        payload: NewFormPayload | AddFormRequest
    ): Promise<WidgetForm> => {
        const body: AddFormRequest = 'form' in payload ? payload : { form: payload };

        const { data } = await api.post<WidgetForm>('/forms', body);

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

    const deleteForm = useCallback(async (formId: number) => {
        await api.delete(`/forms/${formId}`);
        await reloadWidgetForms();
    }, [reloadWidgetForms]);

    const deleteSubWidgetFromForm = useCallback(async (
        formId: number,
        subWidgetId: number
    ) => {
        await api.delete(`/forms/${formId}/sub/${subWidgetId}`);
    }, []);

    const deleteTreeFieldFromForm = useCallback(async (
        formId: number,
        tableColumnId: number
    ) => {
        await api.delete(`/forms/${formId}/tree/${tableColumnId}`);
    }, []);

    // ─────────────────────────────────────────────────────────────
    // FORM DISPLAY ACTIONS (с пагинацией и поиском)
    // ─────────────────────────────────────────────────────────────

    const loadFormDisplay = useCallback(async (
        formId: number,
        page: number = 1,
        searchPattern?: string
    ) => {
        // ═══════════════════════════════════════════════════════════
        // ИСПРАВЛЕНИЕ: Сбрасываем данные при смене формы
        // ═══════════════════════════════════════════════════════════
        if (currentFormIdRef.current !== formId) {
            // Новая форма — очищаем старые данные сразу
            setFormDisplay(null);
            resetPagination();
            currentFormIdRef.current = formId;
        }

        // Сохраняем текущий search_pattern
        currentSearchPatternRef.current = searchPattern ?? '';

        setFormLoading(true);
        setFormError(null);

        try {
            const params = buildQueryParams(page, searchPattern);

            const { data } = await api.post<FormDisplay>(
                `/display/${formId}/main?${params}`
            );

            setFormDisplay(data);
            updatePaginationFromResponse(data, page, data.data?.length ?? 0);
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
            resetPagination();
        } finally {
            setFormLoading(false);
        }
    }, [updatePaginationFromResponse, resetPagination, buildQueryParams]);

    const loadFilteredFormDisplay = useCallback(async (
        formId: number,
        filter: { table_column_id: number; value: string | number },
        page: number = 1,
        searchPattern?: string
    ) => {
        // При фильтрации тоже сбрасываем пагинацию
        resetPagination();

        // Сохраняем текущий search_pattern
        currentSearchPatternRef.current = searchPattern ?? '';

        try {
            const params = buildQueryParams(page, searchPattern);

            const { data } = await api.post<FormDisplay>(
                `/display/${formId}/main?${params}`,
                [filter]
            );

            setFormDisplay(data);
            updatePaginationFromResponse(data, page, data.data?.length ?? 0);
        } catch (e) {
            console.warn('Ошибка при загрузке данных формы с фильтром:', e);
        }
    }, [updatePaginationFromResponse, resetPagination, buildQueryParams]);

    const goToPage = useCallback(async (
        formId: number,
        page: number,
        filters?: Array<{ table_column_id: number; value: string | number }>,
        searchPattern?: string
    ) => {
        setFormLoading(true);

        // Сохраняем текущий search_pattern
        currentSearchPatternRef.current = searchPattern ?? '';

        try {
            const params = buildQueryParams(page, searchPattern);

            const body = filters?.length
                ? filters.map(f => ({ ...f, value: String(f.value) }))
                : [];

            const { data } = await api.post<FormDisplay>(
                `/display/${formId}/main?${params}`,
                body
            );

            setFormDisplay(data);
            updatePaginationFromResponse(data, page, data.data?.length ?? 0);
        } catch (e) {
            console.warn('Ошибка при переходе на страницу:', e);
        } finally {
            setFormLoading(false);
        }
    }, [updatePaginationFromResponse, buildQueryParams]);

    /**
     * Загрузка следующей страницы (ДОБАВЛЯЕТ строки к существующим)
     * Для infinite scroll
     */
    const loadMoreRows = useCallback(async (
        formId: number,
        filters?: Array<{ table_column_id: number; value: string | number }>,
        searchPattern?: string
    ) => {
        // Проверяем что это та же форма
        if (currentFormIdRef.current !== formId) {
            return;
        }

        if (pagination.isLoadingMore || !pagination.hasMore) {
            return;
        }

        const nextPage = pagination.currentPage + 1;

        // Используем переданный searchPattern или сохранённый
        const effectiveSearchPattern = searchPattern ?? currentSearchPatternRef.current;

        setPagination(prev => ({ ...prev, isLoadingMore: true }));

        try {
            const params = buildQueryParams(nextPage, effectiveSearchPattern);

            const body = filters?.length
                ? filters.map(f => ({ ...f, value: String(f.value) }))
                : [];

            const { data } = await api.post<FormDisplay>(
                `/display/${formId}/main?${params}`,
                body
            );

            // Проверяем ещё раз что форма не сменилась пока грузили
            if (currentFormIdRef.current !== formId) {
                return;
            }

            // Добавляем новые строки к существующим
            setFormDisplay(prev => {
                if (!prev) return data;

                return {
                    ...prev,
                    data: [...prev.data, ...data.data],
                    displayed_widget: data.displayed_widget ?? prev.displayed_widget,
                };
            });

            // ВАЖНО: total — это количество СТРАНИЦ, не строк!
            const totalPages = data.displayed_widget?.total ?? 1;
            const currentPage = data.displayed_widget?.page ?? nextPage;
            const hasMore = currentPage < totalPages;

            const newLoadedCount = loadedRowsCountRef.current + data.data.length;
            loadedRowsCountRef.current = newLoadedCount;

            setPagination({
                currentPage,
                totalRows: totalPages * MAIN_TABLE_PAGE_SIZE,
                pageSize: MAIN_TABLE_PAGE_SIZE,
                hasMore,
                isLoadingMore: false,
            });
        } catch (e) {
            console.warn('Ошибка при загрузке дополнительных строк:', e);
            setPagination(prev => ({ ...prev, isLoadingMore: false }));
        }
    }, [pagination, buildQueryParams]);

    // ─────────────────────────────────────────────────────────────
    // SUB DISPLAY ACTIONS
    // ─────────────────────────────────────────────────────────────

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
        }
    }, []);

    return {
        formsByWidget,
        formsById,
        formsListByWidget,
        formDisplay,
        formTrees,
        subDisplay,
        pagination,
        formLoading,
        formError,
        subLoading,
        subError,
        loadWidgetForms,
        reloadWidgetForms,
        addForm,
        deleteForm,
        deleteSubWidgetFromForm,
        deleteTreeFieldFromForm,
        loadFormDisplay,
        loadFilteredFormDisplay,
        setFormDisplay,
        goToPage,
        loadMoreRows,
        loadSubDisplay,
        setSubDisplay,
        loadFormTree,
    };
}