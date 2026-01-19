// src/components/Form/subForm/hook/useSubCrud.ts

import { useCallback, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { SubDisplay } from '@/shared/hooks/useWorkSpaces';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import {
    validateAddDraft,
    getRequiredColumns,
    isEmptyValue,
} from '@/shared/utils/requiredValidation/requiredValidation';

export type UseSubCrudDeps = {
    formIdForSub: number | null;
    currentWidgetId?: number;
    currentOrder: number | null;
    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;
    lastPrimary: Record<string, unknown>;
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

    subEditableTcIds: number[];

    // Валидация
    showSubValidationErrors: boolean;
    setShowSubValidationErrors: React.Dispatch<React.SetStateAction<boolean>>;
    subValidationMissingFields: string[];
    setSubValidationMissingFields: React.Dispatch<React.SetStateAction<string[]>>;
    resetSubValidation: () => void;
};

// ═══════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════

const isSyntheticComboboxId = (tcId: number): boolean => {
    return tcId < -1_000_000 + 1;
};

const getWriteTcId = (col: any): number | null => {
    if (col.type === 'combobox') {
        return col.__write_tc_id ?? null;
    }
    return col.table_column_id ?? null;
};

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

    // ═══════════════════════════════════════════════════════════
    // Состояние валидации для Sub
    // ═══════════════════════════════════════════════════════════
    const [showSubValidationErrors, setShowSubValidationErrors] = useState(false);
    const [subValidationMissingFields, setSubValidationMissingFields] = useState<string[]>([]);

    const resetSubValidation = useCallback(() => {
        setShowSubValidationErrors(false);
        setSubValidationMissingFields([]);
    }, []);

    // ═══════════════════════════════════════════════════════════
    // COMPUTED
    // ═══════════════════════════════════════════════════════════

    const subColumnsById = useMemo(() => {
        const map = new Map<number, SubDisplay['columns'][number]>();
        const cols = subDisplay?.columns ?? [];
        for (const c of cols) {
            if (c.table_column_id != null) {
                map.set(c.table_column_id as number, c);
            }
        }
        return map;
    }, [subDisplay?.columns]);

    const subColumnsAsExtCol = useMemo(() => {
        return (subDisplay?.columns ?? []) as ExtCol[];
    }, [subDisplay?.columns]);

    const subEditableTcIds = useMemo(() => {
        const cols = subDisplay?.columns ?? [];
        const ids: number[] = [];
        const seen = new Set<number>();

        for (const c of cols) {
            const col = c as any;

            if (col.primary || col.increment || col.readonly) continue;

            let writeTcId: number | null = null;

            if (col.type === 'combobox') {
                writeTcId = col.__write_tc_id ?? col.table_column_id ?? null;
                if (writeTcId != null && isSyntheticComboboxId(writeTcId)) {
                    writeTcId = col.__write_tc_id ?? null;
                }
            } else {
                writeTcId = col.table_column_id ?? null;
            }

            if (writeTcId != null && !isSyntheticComboboxId(writeTcId) && !seen.has(writeTcId)) {
                seen.add(writeTcId);
                ids.push(writeTcId);
            }
        }

        return ids;
    }, [subDisplay?.columns]);

    // ═══════════════════════════════════════════════════════════
    // PREFLIGHT
    // ═══════════════════════════════════════════════════════════

    const preflightInsertSub = useCallback(async (): Promise<{ ok: boolean }> => {
        if (!currentWidgetId) return { ok: false };
        try {
            const { data: widget } = await api.get(`/widgets/${currentWidgetId}`);
            const { data: table } = await api.get(`/tables/${widget.table_id}`);
            if (!table?.insert_query?.trim()) {
                alert('Для таблицы саб-виджета не настроен INSERT QUERY. Задайте его в метаданных таблицы.');
                return { ok: false };
            }
        } catch (e) {
            console.warn('preflight (sub/insert) failed:', e);
        }
        return { ok: true };
    }, [currentWidgetId]);

    // ═══════════════════════════════════════════════════════════
    // START ADD
    // ═══════════════════════════════════════════════════════════

    const startAddSub = useCallback(async () => {
        if (!formIdForSub || !currentWidgetId) return;

        if (!lastPrimary || Object.keys(lastPrimary).length === 0) {
            alert('Сначала выберите строку в основной таблице, чтобы добавить связанную запись в саб-таблицу.');
            return;
        }

        const pf = await preflightInsertSub();
        if (!pf.ok) return;

        const init: Record<number, string> = {};
        subEditableTcIds.forEach((tcId) => {
            init[tcId] = '';
        });

        console.debug('[useSubCrud] startAddSub → init draft:', init);
        console.debug('[useSubCrud] startAddSub → subEditableTcIds:', subEditableTcIds);

        setDraftSub(init);
        setIsAddingSub(true);
        resetSubValidation();
    }, [formIdForSub, currentWidgetId, lastPrimary, preflightInsertSub, subEditableTcIds, resetSubValidation]);

    // ═══════════════════════════════════════════════════════════
    // CANCEL ADD
    // ═══════════════════════════════════════════════════════════

    const cancelAddSub = useCallback(() => {
        setIsAddingSub(false);
        setDraftSub({});
        resetSubValidation();
    }, [resetSubValidation]);

    // ═══════════════════════════════════════════════════════════
    // SUBMIT ADD
    // ═══════════════════════════════════════════════════════════

    const submitAddSub = useCallback(async () => {
        if (!formIdForSub || !currentWidgetId) return;

        if (!lastPrimary || Object.keys(lastPrimary).length === 0) {
            alert('Сначала выберите строку в основной таблице.');
            return;
        }

        // ═══════════════════════════════════════════════════════════
        // ОТЛАДКА: выводим всё для диагностики
        // ═══════════════════════════════════════════════════════════
        console.group('[useSubCrud] submitAddSub VALIDATION');

        console.log('draftSub:', draftSub);

        console.log('subColumnsAsExtCol:', subColumnsAsExtCol.map(c => ({
            column_name: c.column_name,
            table_column_id: c.table_column_id,
            __write_tc_id: (c as any).__write_tc_id,
            required: c.required,
            visible: c.visible,
            type: c.type,
        })));

        const requiredCols = getRequiredColumns(subColumnsAsExtCol);
        console.log('requiredColumns:', requiredCols.map(c => ({
            column_name: c.column_name,
            table_column_id: c.table_column_id,
            __write_tc_id: (c as any).__write_tc_id,
            required: c.required,
        })));

        // Проверяем каждую required колонку вручную
        for (const col of requiredCols) {
            const tcId = ((col as any).__write_tc_id ?? col.table_column_id) ?? null;
            const value = tcId != null ? draftSub[tcId] : undefined;
            const isEmpty = isEmptyValue(value);
            console.log(`  Column "${col.column_name}": tcId=${tcId}, value="${value}", isEmpty=${isEmpty}`);
        }

        // ═══════════════════════════════════════════════════════════
        // ВАЛИДАЦИЯ REQUIRED ПОЛЕЙ
        // ═══════════════════════════════════════════════════════════
        const validation = validateAddDraft(draftSub, subColumnsAsExtCol);

        console.log('VALIDATION RESULT:', validation);
        console.groupEnd();

        if (!validation.isValid) {
            console.warn('[useSubCrud] VALIDATION FAILED — показываем ошибки');
            setShowSubValidationErrors(true);
            setSubValidationMissingFields(validation.missingFields);
            return; // НЕ отправляем на сервер
        }

        // Валидация прошла — продолжаем
        const pf = await preflightInsertSub();
        if (!pf.ok) return;

        setSavingSub(true);
        try {
            const values = Object.entries(draftSub)
                .filter(([tcIdStr]) => {
                    const tcId = Number(tcIdStr);
                    return !isSyntheticComboboxId(tcId);
                })
                .map(([tcIdStr, value]) => {
                    const tcId = Number(tcIdStr);
                    const col = subColumnsById.get(tcId);

                    const isCheckbox =
                        (col as any)?.type === 'checkbox' ||
                        (col as any)?.type === 'bool';

                    const s = value == null ? '' : String(value).trim();

                    let final: string | null;
                    if (isCheckbox) {
                        final = s === '' ? 'false' : s;
                    } else {
                        final = s === '' ? null : s;
                    }

                    return {
                        table_column_id: tcId,
                        value: final,
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

            console.debug('[useSubCrud] submitAddSub → body:', body);

            const url = `/data/${formIdForSub}/${currentWidgetId}`;
            try {
                await api.post(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 403) {
                    alert('У вас не хватает прав на добавление новой записи');
                    return;
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

            if (currentOrder != null) {
                loadSubDisplay(formIdForSub, currentOrder, lastPrimary);
            }
            setIsAddingSub(false);
            setDraftSub({});
            resetSubValidation();
        } finally {
            setSavingSub(false);
        }
    }, [
        formIdForSub,
        currentWidgetId,
        lastPrimary,
        draftSub,
        currentOrder,
        preflightInsertSub,
        loadSubDisplay,
        subColumnsById,
        subColumnsAsExtCol,
        resetSubValidation,
    ]);

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
        // Валидация
        showSubValidationErrors,
        setShowSubValidationErrors,
        subValidationMissingFields,
        setSubValidationMissingFields,
        resetSubValidation,
    };
}