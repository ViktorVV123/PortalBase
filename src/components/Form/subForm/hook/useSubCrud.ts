// src/components/Form/subForm/hook/useSubCrud.ts

import { useCallback, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { SubDisplay, FormDisplay } from '@/shared/hooks/useWorkSpaces';
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
    // Данные MainTable для автозаполнения
    mainFormDisplay?: FormDisplay | null;
    mainSelectedRowIdx?: number | null;
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

    // NEW: Автозаполненные поля (для визуальной индикации)
    autoFilledFields: Set<number>;
    clearAutoFilledField: (tcId: number) => void;
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
                               mainFormDisplay,
                               mainSelectedRowIdx,
                           }: UseSubCrudDeps): UseSubCrudResult {
    const [isAddingSub, setIsAddingSub] = useState(false);
    const [draftSub, setDraftSub] = useState<Record<number, string>>({});
    const [savingSub, setSavingSub] = useState(false);

    // ═══════════════════════════════════════════════════════════
    // Состояние валидации для Sub
    // ═══════════════════════════════════════════════════════════
    const [showSubValidationErrors, setShowSubValidationErrors] = useState(false);
    const [subValidationMissingFields, setSubValidationMissingFields] = useState<string[]>([]);

    // ═══════════════════════════════════════════════════════════
    // NEW: Автозаполненные поля (write_tc_id)
    // ═══════════════════════════════════════════════════════════
    const [autoFilledFields, setAutoFilledFields] = useState<Set<number>>(new Set());

    const resetSubValidation = useCallback(() => {
        setShowSubValidationErrors(false);
        setSubValidationMissingFields([]);
    }, []);

    // Очистить индикацию автозаполнения для конкретного поля (когда пользователь его изменит)
    const clearAutoFilledField = useCallback((tcId: number) => {
        setAutoFilledFields((prev) => {
            if (!prev.has(tcId)) return prev;
            const next = new Set(prev);
            next.delete(tcId);
            return next;
        });
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

            // ═══════════════════════════════════════════════════════════
            // ИСПРАВЛЕНО: Пропускаем колонки rls — они виртуальные и не существуют в БД
            // ═══════════════════════════════════════════════════════════
            if (col.type === 'rls') continue;

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
    // ХЕЛПЕР: Построить маппинг table_column_name → value из MainTable row
    // ═══════════════════════════════════════════════════════════
    const buildMainRowValuesMap = useCallback((): Map<string, string> => {
        const map = new Map<string, string>();

        if (!mainFormDisplay || mainSelectedRowIdx == null) {
            return map;
        }

        const row = mainFormDisplay.data?.[mainSelectedRowIdx];
        if (!row) return map;

        const mainColumns = mainFormDisplay.columns ?? [];

        // Строим индекс значений для MainTable
        const mainValueIndex = new Map<string, number>();
        mainColumns.forEach((col, idx) => {
            const syntheticTcId =
                col.type === 'combobox' && col.combobox_column_id != null && col.table_column_id != null
                    ? -1_000_000 - Number(col.combobox_column_id)
                    : col.table_column_id ?? -1;
            mainValueIndex.set(`${col.widget_column_id}:${syntheticTcId}`, idx);
        });

        // Собираем значения по table_column_name
        mainColumns.forEach((col) => {
            const tableColumnName = (col as any).table_column_name;
            if (!tableColumnName) return;

            const writeTcId = col.type === 'combobox'
                ? ((col as any).__write_tc_id ?? col.table_column_id)
                : col.table_column_id;

            if (writeTcId == null) return;

            if (col.type === 'combobox') {
                const pkValue = lastPrimary[tableColumnName];
                if (pkValue != null) {
                    map.set(tableColumnName, String(pkValue));
                }
            } else {
                const syntheticTcId =
                    col.type === 'combobox' && col.combobox_column_id != null && col.table_column_id != null
                        ? -1_000_000 - Number(col.combobox_column_id)
                        : col.table_column_id ?? -1;

                const key = `${col.widget_column_id}:${syntheticTcId}`;
                const idx = mainValueIndex.get(key);

                if (idx != null) {
                    const val = row.values[idx];
                    if (val != null && val !== '') {
                        map.set(tableColumnName, String(val));
                    }
                }
            }
        });

        // Также добавляем все primary_keys (они часто содержат FK)
        Object.entries(lastPrimary).forEach(([key, value]) => {
            if (value != null && !map.has(key)) {
                map.set(key, String(value));
            }
        });

        return map;
    }, [mainFormDisplay, mainSelectedRowIdx, lastPrimary]);

    // ═══════════════════════════════════════════════════════════
    // ХЕЛПЕР: Маппинг Sub колонок по table_column_name → write_tc_id
    // ═══════════════════════════════════════════════════════════
    const buildSubColumnNameToWriteIdMap = useCallback((): Map<string, number> => {
        const map = new Map<string, number>();
        const cols = subDisplay?.columns ?? [];

        for (const c of cols) {
            const col = c as any;
            const tableColumnName = col.table_column_name;
            if (!tableColumnName) continue;

            let writeTcId: number | null = null;

            if (col.type === 'combobox') {
                writeTcId = col.__write_tc_id ?? col.table_column_id ?? null;
                if (writeTcId != null && isSyntheticComboboxId(writeTcId)) {
                    writeTcId = col.__write_tc_id ?? null;
                }
            } else {
                writeTcId = col.table_column_id ?? null;
            }

            if (writeTcId != null && !isSyntheticComboboxId(writeTcId)) {
                map.set(tableColumnName, writeTcId);
            }
        }

        return map;
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

        // ═══════════════════════════════════════════════════════════
        // 1. Инициализируем все поля дефолтными значениями
        // ═══════════════════════════════════════════════════════════
        const init: Record<number, string> = {};
        subEditableTcIds.forEach((tcId) => {
            // Находим колонку для этого tcId
            const col = subColumnsById.get(tcId);
            const isTriStateCheckbox = (col as any)?.type === 'checkboxNull';
            const isRegularCheckbox = (col as any)?.type === 'checkbox' || (col as any)?.type === 'bool';

            if (isTriStateCheckbox) {
                init[tcId] = 'null'; // Tri-state по умолчанию null
            } else if (isRegularCheckbox) {
                init[tcId] = 'false';
            } else {
                init[tcId] = '';
            }
        });

        // ═══════════════════════════════════════════════════════════
        // 2. Автозаполнение из MainTable row + отслеживание
        // ═══════════════════════════════════════════════════════════
        const mainRowValues = buildMainRowValuesMap();
        const subColumnNameToWriteId = buildSubColumnNameToWriteIdMap();
        const newAutoFilledFields = new Set<number>();

        if (mainRowValues.size > 0) {
            console.debug('[useSubCrud] startAddSub → applying MainTable values to Sub draft', {
                mainRowValues: Object.fromEntries(mainRowValues),
                subColumnNameToWriteId: Object.fromEntries(subColumnNameToWriteId),
            });

            mainRowValues.forEach((value, columnName) => {
                const writeTcId = subColumnNameToWriteId.get(columnName);

                if (writeTcId != null && subEditableTcIds.includes(writeTcId)) {
                    init[writeTcId] = value;
                    newAutoFilledFields.add(writeTcId); // Помечаем как автозаполненное

                    console.debug('[useSubCrud] startAddSub → auto-filled from MainTable', {
                        columnName,
                        writeTcId,
                        value,
                    });
                }
            });
        }

        console.debug('[useSubCrud] startAddSub → final init draft:', init);
        console.debug('[useSubCrud] startAddSub → autoFilledFields:', Array.from(newAutoFilledFields));

        setDraftSub(init);
        setAutoFilledFields(newAutoFilledFields);
        setIsAddingSub(true);
        resetSubValidation();
    }, [
        formIdForSub,
        currentWidgetId,
        lastPrimary,
        preflightInsertSub,
        subEditableTcIds,
        resetSubValidation,
        buildMainRowValuesMap,
        buildSubColumnNameToWriteIdMap,
    ]);

    // ═══════════════════════════════════════════════════════════
    // CANCEL ADD
    // ═══════════════════════════════════════════════════════════

    const cancelAddSub = useCallback(() => {
        setIsAddingSub(false);
        setDraftSub({});
        setAutoFilledFields(new Set());
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
        // ВАЛИДАЦИЯ REQUIRED ПОЛЕЙ
        // ═══════════════════════════════════════════════════════════
        const validation = validateAddDraft(draftSub, subColumnsAsExtCol);

        if (!validation.isValid) {
            console.warn('[useSubCrud] VALIDATION FAILED — показываем ошибки');
            setShowSubValidationErrors(true);
            setSubValidationMissingFields(validation.missingFields);
            return;
        }

        const pf = await preflightInsertSub();
        if (!pf.ok) return;

        setSavingSub(true);
        try {
            const values = Object.entries(draftSub)
                .filter(([tcIdStr]) => {
                    const tcId = Number(tcIdStr);
                    // Фильтруем синтетические ID
                    if (isSyntheticComboboxId(tcId)) return false;

                    // ═══════════════════════════════════════════════════════════
                    // ИСПРАВЛЕНО: Фильтруем колонки типа rls — они виртуальные
                    // ═══════════════════════════════════════════════════════════
                    const col = subColumnsById.get(tcId);
                    if ((col as any)?.type === 'rls') return false;

                    return true;
                })
                .map(([tcIdStr, value]) => {
                    const tcId = Number(tcIdStr);
                    const col = subColumnsById.get(tcId);

                    const isTriStateCheckbox = (col as any)?.type === 'checkboxNull';
                    const isRegularCheckbox =
                        (col as any)?.type === 'checkbox' ||
                        (col as any)?.type === 'bool';

                    const s = value == null ? '' : String(value).trim();

                    let final: string | null;
                    if (isTriStateCheckbox) {
                        // TRISTATE: может быть null
                        const normalized = s.toLowerCase();
                        if (normalized === 'null' || normalized === '') {
                            final = null;
                        } else if (normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'yes' || normalized === 'да') {
                            final = 'true';
                        } else {
                            final = 'false';
                        }
                    } else if (isRegularCheckbox) {
                        // Обычный checkbox: только true/false
                        const normalized = s.toLowerCase();
                        if (normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'yes' || normalized === 'да') {
                            final = 'true';
                        } else {
                            final = 'false';
                        }
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
            setAutoFilledFields(new Set());
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
        // NEW: Автозаполненные поля
        autoFilledFields,
        clearAutoFilledField,
    };
}