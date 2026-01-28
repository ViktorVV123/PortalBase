// src/components/Form/subForm/hook/useSubCrud.ts

import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { api } from '@/services/api';
import type { SubDisplay, FormDisplay } from '@/shared/hooks/useWorkSpaces';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import {
    validateAddDraft,
} from '@/shared/utils/requiredValidation/requiredValidation';

export type UseSubCrudDeps = {
    formIdForSub: number | null;
    currentWidgetId?: number;
    currentOrder: number | null;
    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;
    lastPrimary: Record<string, unknown>;
    subDisplay: SubDisplay | null;
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
    showSubValidationErrors: boolean;
    setShowSubValidationErrors: React.Dispatch<React.SetStateAction<boolean>>;
    subValidationMissingFields: string[];
    setSubValidationMissingFields: React.Dispatch<React.SetStateAction<string[]>>;
    resetSubValidation: () => void;
    autoFilledFields: Set<number>;
    clearAutoFilledField: (tcId: number) => void;
};

const isSyntheticComboboxId = (tcId: number): boolean => tcId < -1_000_000 + 1;

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
    const [showSubValidationErrors, setShowSubValidationErrors] = useState(false);
    const [subValidationMissingFields, setSubValidationMissingFields] = useState<string[]>([]);
    const [autoFilledFields, setAutoFilledFields] = useState<Set<number>>(new Set());

    // ═══════════════════════════════════════════════════════════
    // Защита от setState после unmount
    // ═══════════════════════════════════════════════════════════
    const unmountedRef = useRef(false);

    useEffect(() => {
        unmountedRef.current = false;
        return () => {
            unmountedRef.current = true;
        };
    }, []);

    const resetSubValidation = useCallback(() => {
        setShowSubValidationErrors(false);
        setSubValidationMissingFields([]);
    }, []);

    const clearAutoFilledField = useCallback((tcId: number) => {
        setAutoFilledFields((prev) => {
            if (!prev.has(tcId)) return prev;
            const next = new Set(prev);
            next.delete(tcId);
            return next;
        });
    }, []);

    const subColumnsById = useMemo(() => {
        const map = new Map<number, SubDisplay['columns'][number]>();
        (subDisplay?.columns ?? []).forEach((c) => {
            if (c.table_column_id != null) map.set(c.table_column_id as number, c);
        });
        return map;
    }, [subDisplay?.columns]);

    const subColumnsAsExtCol = useMemo(() => (subDisplay?.columns ?? []) as ExtCol[], [subDisplay?.columns]);

    const subEditableTcIds = useMemo(() => {
        const ids: number[] = [];
        const seen = new Set<number>();
        for (const c of subDisplay?.columns ?? []) {
            const col = c as any;
            if (col.type === 'rls' || col.primary || col.increment || col.readonly) continue;
            let writeTcId = col.type === 'combobox'
                ? (col.__write_tc_id ?? col.table_column_id ?? null)
                : (col.table_column_id ?? null);
            if (writeTcId != null && isSyntheticComboboxId(writeTcId)) writeTcId = col.__write_tc_id ?? null;
            if (writeTcId != null && !isSyntheticComboboxId(writeTcId) && !seen.has(writeTcId)) {
                seen.add(writeTcId);
                ids.push(writeTcId);
            }
        }
        return ids;
    }, [subDisplay?.columns]);

    const buildMainRowValuesMap = useCallback((): Map<string, string> => {
        const map = new Map<string, string>();
        if (!mainFormDisplay || mainSelectedRowIdx == null) return map;
        const row = mainFormDisplay.data?.[mainSelectedRowIdx];
        if (!row) return map;
        const mainColumns = mainFormDisplay.columns ?? [];
        const mainValueIndex = new Map<string, number>();
        mainColumns.forEach((col, idx) => {
            const syntheticTcId = col.type === 'combobox' && col.combobox_column_id != null && col.table_column_id != null
                ? -1_000_000 - Number(col.combobox_column_id)
                : col.table_column_id ?? -1;
            mainValueIndex.set(`${col.widget_column_id}:${syntheticTcId}`, idx);
        });
        mainColumns.forEach((col) => {
            const tableColumnName = (col as any).table_column_name;
            if (!tableColumnName) return;
            if (col.type === 'combobox') {
                const pkValue = lastPrimary[tableColumnName];
                if (pkValue != null) map.set(tableColumnName, String(pkValue));
            } else {
                const syntheticTcId = col.type === 'combobox' && col.combobox_column_id != null && col.table_column_id != null
                    ? -1_000_000 - Number(col.combobox_column_id)
                    : col.table_column_id ?? -1;
                const idx = mainValueIndex.get(`${col.widget_column_id}:${syntheticTcId}`);
                if (idx != null) {
                    const val = row.values[idx];
                    if (val != null && val !== '') map.set(tableColumnName, String(val));
                }
            }
        });
        Object.entries(lastPrimary).forEach(([key, value]) => {
            if (value != null && !map.has(key)) map.set(key, String(value));
        });
        return map;
    }, [mainFormDisplay, mainSelectedRowIdx, lastPrimary]);

    const buildSubColumnNameToWriteIdMap = useCallback((): Map<string, number> => {
        const map = new Map<string, number>();
        for (const c of subDisplay?.columns ?? []) {
            const col = c as any;
            const tableColumnName = col.table_column_name;
            if (!tableColumnName) continue;
            let writeTcId = col.type === 'combobox'
                ? (col.__write_tc_id ?? col.table_column_id ?? null)
                : (col.table_column_id ?? null);
            if (writeTcId != null && isSyntheticComboboxId(writeTcId)) writeTcId = col.__write_tc_id ?? null;
            if (writeTcId != null && !isSyntheticComboboxId(writeTcId)) map.set(tableColumnName, writeTcId);
        }
        return map;
    }, [subDisplay?.columns]);

    const preflightInsertSub = useCallback(async (): Promise<{ ok: boolean }> => {
        if (!currentWidgetId) return { ok: false };
        try {
            const { data: widget } = await api.get(`/widgets/${currentWidgetId}`);
            const { data: table } = await api.get(`/tables/${widget.table_id}`);
            if (!table?.insert_query?.trim()) {
                alert('Для таблицы саб-виджета не настроен INSERT QUERY.');
                return { ok: false };
            }
        } catch (e) {
            console.warn('preflight (sub/insert) failed:', e);
        }
        return { ok: true };
    }, [currentWidgetId]);

    const startAddSub = useCallback(async () => {
        if (!formIdForSub || !currentWidgetId) return;
        if (!lastPrimary || Object.keys(lastPrimary).length === 0) {
            alert('Сначала выберите строку в основной таблице.');
            return;
        }
        const pf = await preflightInsertSub();
        if (!pf.ok) return;

        const init: Record<number, string> = {};
        subEditableTcIds.forEach((tcId) => {
            const col = subColumnsById.get(tcId) as any;
            const isTriState = col?.type === 'checkboxNull';
            const isCheckbox = col?.type === 'checkbox' || col?.type === 'bool';
            const defaultValue = col?.default;
            const hasDefault = defaultValue != null && defaultValue !== '';
            if (isTriState) {
                if (hasDefault) {
                    const n = String(defaultValue).toLowerCase();
                    init[tcId] = (n === 'true' || n === '1' || n === 't') ? 'true' : (n === 'false' || n === '0' || n === 'f') ? 'false' : 'null';
                } else init[tcId] = 'null';
            } else if (isCheckbox) {
                if (hasDefault) {
                    const n = String(defaultValue).toLowerCase();
                    init[tcId] = (n === 'true' || n === '1' || n === 't') ? 'true' : 'false';
                } else init[tcId] = 'false';
            } else {
                init[tcId] = hasDefault ? String(defaultValue) : '';
            }
        });

        const mainRowValues = buildMainRowValuesMap();
        const subColumnNameToWriteId = buildSubColumnNameToWriteIdMap();
        const newAutoFilled = new Set<number>();
        mainRowValues.forEach((value, columnName) => {
            const writeTcId = subColumnNameToWriteId.get(columnName);
            if (writeTcId != null && subEditableTcIds.includes(writeTcId)) {
                init[writeTcId] = value;
                newAutoFilled.add(writeTcId);
            }
        });

        setDraftSub(init);
        setAutoFilledFields(newAutoFilled);
        setIsAddingSub(true);
        resetSubValidation();
    }, [formIdForSub, currentWidgetId, lastPrimary, preflightInsertSub, subEditableTcIds, subColumnsById, resetSubValidation, buildMainRowValuesMap, buildSubColumnNameToWriteIdMap]);

    const cancelAddSub = useCallback(() => {
        setIsAddingSub(false);
        setDraftSub({});
        setAutoFilledFields(new Set());
        resetSubValidation();
    }, [resetSubValidation]);

    const submitAddSub = useCallback(async () => {
        if (unmountedRef.current) return;
        if (!formIdForSub || !currentWidgetId) return;
        if (!lastPrimary || Object.keys(lastPrimary).length === 0) {
            alert('Сначала выберите строку в основной таблице.');
            return;
        }
        const validation = validateAddDraft(draftSub, subColumnsAsExtCol);
        if (!validation.isValid) {
            setShowSubValidationErrors(true);
            setSubValidationMissingFields(validation.missingFields);
            return;
        }
        const pf = await preflightInsertSub();
        if (!pf.ok) return;

        if (unmountedRef.current) return;

        setSavingSub(true);
        try {
            const values = Object.entries(draftSub)
                .filter(([tcIdStr]) => {
                    const tcId = Number(tcIdStr);
                    if (isSyntheticComboboxId(tcId)) return false;
                    const col = subColumnsById.get(tcId);
                    if ((col as any)?.type === 'rls') return false;
                    return true;
                })
                .map(([tcIdStr, value]) => {
                    const tcId = Number(tcIdStr);
                    const col = subColumnsById.get(tcId);
                    const isTriState = (col as any)?.type === 'checkboxNull';
                    const isCheckbox = (col as any)?.type === 'checkbox' || (col as any)?.type === 'bool';
                    const s = value == null ? '' : String(value).trim();
                    let final: string | null;
                    if (isTriState) {
                        const n = s.toLowerCase();
                        final = (n === 'null' || n === '') ? null : (n === 'true' || n === '1' || n === 't' || n === 'yes' || n === 'да') ? 'true' : 'false';
                    } else if (isCheckbox) {
                        const n = s.toLowerCase();
                        final = (n === 'true' || n === '1' || n === 't' || n === 'yes' || n === 'да') ? 'true' : 'false';
                    } else {
                        final = s === '' ? null : s;
                    }
                    return { table_column_id: tcId, value: final };
                });

            const body = {
                pk: { primary_keys: Object.fromEntries(Object.entries(lastPrimary).map(([k, v]) => [k, String(v)])) },
                values,
            };
            const url = `/data/${formIdForSub}/${currentWidgetId}`;

            try {
                await api.post(url, body);
            } catch (err: any) {
                if (unmountedRef.current) return;
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 403) { alert('У вас не хватает прав на добавление новой записи'); return; }
                if (status === 404 && String(detail).includes('Insert query not found')) { alert('Для саб-формы не настроен INSERT QUERY.'); return; }
                throw err;
            }

            if (unmountedRef.current) return;

            if (currentOrder != null) loadSubDisplay(formIdForSub, currentOrder, lastPrimary);
            setIsAddingSub(false);
            setDraftSub({});
            setAutoFilledFields(new Set());
            resetSubValidation();
        } finally {
            if (!unmountedRef.current) {
                setSavingSub(false);
            }
        }
    }, [formIdForSub, currentWidgetId, lastPrimary, draftSub, currentOrder, preflightInsertSub, loadSubDisplay, subColumnsById, subColumnsAsExtCol, resetSubValidation]);

    return {
        isAddingSub, setIsAddingSub, draftSub, setDraftSub, savingSub,
        startAddSub, cancelAddSub, submitAddSub, subEditableTcIds,
        showSubValidationErrors, setShowSubValidationErrors,
        subValidationMissingFields, setSubValidationMissingFields, resetSubValidation,
        autoFilledFields, clearAutoFilledField,
    };
}