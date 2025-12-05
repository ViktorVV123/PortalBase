// src/components/formTable/hooks/useSubCrud.ts
import {useCallback, useMemo, useState} from 'react';
import {api} from '@/services/api';
import type {FormDisplay, SubDisplay} from '@/shared/hooks/useWorkSpaces';

export type UseSubCrudDeps = {
    /** id формы для саба (selectedFormId ?? currentForm.form_id) */
    formIdForSub: number | null;
    /** sub_widget_id для активного саба */
    currentWidgetId?: number;
    /** активный order вкладки саба (widget_order) */
    currentOrder: number | null;
    /** загрузка саб-данных после добавления/переключения вкладок */
    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;
    /** PK выбранной строки основной таблицы (родитель) */
    lastPrimary: Record<string, unknown>;
    /** полный subDisplay (нужен, чтобы определить редактируемые tcId) */
    subDisplay: SubDisplay | null;
};

export type UseSubCrudResult = {
    isAddingSub: boolean;
    setIsAddingSub: (v: boolean) => void;
    draftSub: Record<number, string>;
    setDraftSub: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    savingSub: boolean;

    startAddSub: () => Promise<void>;
    cancelAddSub: () => void;
    submitAddSub: () => Promise<void>;

    /** вычисленные редактируемые поля саб-таблицы (table_column_id) */
    subEditableTcIds: number[];
};

/** Выделенная логика саб-вставки (start/cancel/submit + состояния) */
export function useSubCrud({
                               formIdForSub,
                               currentWidgetId,
                               currentOrder,
                               loadSubDisplay,
                               lastPrimary,
                               subDisplay,
                           }: UseSubCrudDeps): UseSubCrudResult {
    const [isAddingSub, setIsAddingSub] = useState(false);
    const [draftSub, setDraftSub] = useState<Record<number, string>>({});
    const [savingSub, setSavingSub] = useState(false);

    // Оставляем только редактируемые колонки саб-таблицы
    const subEditableTcIds = useMemo(() => {
        const cols = subDisplay?.columns ?? [];
        return cols
            .filter(c =>
                c.table_column_id != null &&
                !((c as any).primary || (c as any).increment || (c as any).readonly)
            )
            .map(c => c.table_column_id as number);
    }, [subDisplay?.columns]);

    // Проверка наличия INSERT QUERY у таблицы саб-виджета
    const preflightInsertSub = useCallback(async (): Promise<{ ok: boolean }> => {
        if (!currentWidgetId) return { ok: false };
        try {
            const { data: widget } = await api.get(`/widgets/${currentWidgetId}`);
            const { data: table }  = await api.get(`/tables/${widget.table_id}`);
            if (!table?.insert_query?.trim()) {
                alert('Для таблицы саб-виджета не настроен INSERT QUERY. Задайте его в метаданных таблицы.');
                return { ok: false };
            }
        } catch (e) {
            console.warn('preflight (sub/insert) failed:', e);
        }
        return { ok: true };
    }, [currentWidgetId]);

    // Начать добавление саб-строки
    const startAddSub = useCallback(async () => {
        if (!formIdForSub || !currentWidgetId) return;

        // Нужен выбранный родитель (обычно FK)
        if (!lastPrimary || Object.keys(lastPrimary).length === 0) {
            alert('Сначала выберите строку в основной таблице, чтобы добавить связанную запись в саб-таблицу.');
            return;
        }

        const pf = await preflightInsertSub();
        if (!pf.ok) return;

        const init: Record<number, string> = {};
        subEditableTcIds.forEach(tcId => { init[tcId] = ''; });
        setDraftSub(init);
        setIsAddingSub(true);
    }, [formIdForSub, currentWidgetId, lastPrimary, preflightInsertSub, subEditableTcIds]);

    // Отменить добавление
    const cancelAddSub = useCallback(() => {
        setIsAddingSub(false);
        setDraftSub({});
    }, []);

    // Отправить добавление
    const submitAddSub = useCallback(async () => {
        if (!formIdForSub || !currentWidgetId) return;

        if (!lastPrimary || Object.keys(lastPrimary).length === 0) {
            alert('Сначала выберите строку в основной таблице.');
            return;
        }

        const pf = await preflightInsertSub();
        if (!pf.ok) return;

        setSavingSub(true);
        try {
            const values = Object.entries(draftSub).map(([table_column_id, value]) => {
                const s = value == null ? '' : String(value).trim();
                return {
                    table_column_id: Number(table_column_id),
                    value: s === '' ? null : s, // пустое → null
                };
            });

            const body = {
                pk: {
                    primary_keys: Object.fromEntries(
                        Object.entries(lastPrimary).map(([k, v]) => [k, String(v)])
                    ),
                },
                values,
            };

            const url = `/data/${formIdForSub}/${currentWidgetId}`;
            try {
                await api.post(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail  = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 403) {
                    console.warn('[submitEdit] 403 Forbidden', { url, body, detail });
                    alert('У вас не хватает прав на добавление новой записи');
                    return; // не валим дальше, не делаем reload
                }

                if (status === 404 && String(detail).includes('Insert query not found')) {
                    alert('Для саб-формы не настроен INSERT QUERY. Задайте его и повторите.');
                    return;
                }
                if (status === 404) {
                    await api.post(`${url}/`, body);
                } else {
                    throw err;
                }
            }

            // Перезагрузить текущий саб-виджет
            if (currentOrder != null) {
                loadSubDisplay(formIdForSub, currentOrder, lastPrimary);
            }
            setIsAddingSub(false);
            setDraftSub({});
        } finally {
            setSavingSub(false);
        }
    }, [formIdForSub, currentWidgetId, lastPrimary, draftSub, currentOrder, preflightInsertSub, loadSubDisplay]);

    return {
        isAddingSub,
        setIsAddingSub,
        draftSub,
        setDraftSub,
        savingSub,
        startAddSub,
        cancelAddSub,
        submitAddSub,
        subEditableTcIds,
    };
}
