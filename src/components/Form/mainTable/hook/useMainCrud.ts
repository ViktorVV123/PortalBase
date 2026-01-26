// useMainCrud.ts — с валидацией required полей, поддержкой Toast и автозаполнением из фильтров дерева
import { useCallback, useState } from 'react';
import { api } from '@/services/api';
import type { DTable, FormDisplay, Widget, WidgetForm } from '@/shared/hooks/useWorkSpaces';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import { loadComboOptionsOnce, normalizeValueForColumn } from '@/components/Form/mainTable/InputCell';
import type { CellStyles } from '@/components/Form/mainTable/CellStylePopover';
import {
    validateAddDraft,
    validateEditDraft,
} from '@/shared/utils/requiredValidation/requiredValidation';

const DEBUG_MAINCRUD = true;
const log = (label: string, payload?: unknown) => {
    if (!DEBUG_MAINCRUD) return;
    console.groupCollapsed(`[CRUD] ${label}`);
    if (payload !== undefined) {
        console.log(payload);
    }
    console.groupEnd();
};

type EnsureQueryKind = 'insert' | 'update' | 'delete';

export type StylesColumnMeta = {
    exists: boolean;
    valueIndex: number | null;
    tableColumnNameMap: Map<string, string>;
    columnNameToTableColumnName: Map<string, string>;
} | null;

export type UseMainCrudDeps = {
    formDisplay: FormDisplay;
    selectedWidget: Widget | null;
    selectedFormId: number | null;
    formsByWidget: Record<number, { form_id: number }>;
    formsById: Record<number, WidgetForm>;
    activeFilters: Array<{ table_column_id: number; value: string | number }>;
    setFormDisplay: (v: FormDisplay) => void;
    reloadTree: () => Promise<void>;
    isColReadOnly: (col: ExtCol) => boolean;
    flatColumnsInRenderOrder: ExtCol[];
    valueIndexByKey: Map<string, number>;
    setSubDisplay: (v: null) => void;
    pkToKey: (pk: Record<string, unknown>) => string;
    lastPrimary: Record<string, unknown>;
    setLastPrimary: (v: Record<string, unknown>) => void;
    setSelectedKey: React.Dispatch<React.SetStateAction<string | null>>;
    preflightTableId?: number | null;
    stylesColumnMeta?: StylesColumnMeta;
    resetFilters?: () => Promise<void>;
    setActiveFilters?: React.Dispatch<React.SetStateAction<Array<{ table_column_id: number; value: string | number }>>>;
    onResetTreeDrawer?: () => void;
};

export function useMainCrud({
                                formDisplay,
                                selectedWidget,
                                selectedFormId,
                                formsByWidget,
                                activeFilters,
                                setFormDisplay,
                                reloadTree,
                                isColReadOnly,
                                flatColumnsInRenderOrder,
                                valueIndexByKey,
                                setSubDisplay,
                                pkToKey,
                                lastPrimary,
                                setLastPrimary,
                                formsById,
                                setSelectedKey,
                                preflightTableId,
                                stylesColumnMeta,
                                resetFilters,
                                setActiveFilters,
                                onResetTreeDrawer,
                            }: UseMainCrudDeps) {
    const [isAdding, setIsAdding] = useState(false);
    const [draft, setDraft] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);

    const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<Record<number, string>>({});
    const [editSaving, setEditSaving] = useState(false);

    const [deletingRowIdx, setDeletingRowIdx] = useState<number | null>(null);
    const [editStylesDraft, setEditStylesDraft] = useState<Record<string, CellStyles | null>>({});

    // ═══════════════════════════════════════════════════════════
    // Состояние валидации
    // ═══════════════════════════════════════════════════════════
    const [showValidationErrors, setShowValidationErrors] = useState(false);
    const [validationMissingFields, setValidationMissingFields] = useState<string[]>([]);

    // ═══════════════════════════════════════════════════════════
    // NEW: Автозаполненные поля (write_tc_id)
    // ═══════════════════════════════════════════════════════════
    const [autoFilledFields, setAutoFilledFields] = useState<Set<number>>(new Set());

    // Очистить индикацию автозаполнения для конкретного поля
    const clearAutoFilledField = useCallback((tcId: number) => {
        setAutoFilledFields((prev) => {
            if (!prev.has(tcId)) return prev;
            const next = new Set(prev);
            next.delete(tcId);
            return next;
        });
    }, []);

    const getEffectiveFormId = useCallback((): number | null => {
        if (selectedFormId != null) return selectedFormId;
        if (!selectedWidget) return null;
        return formsByWidget[selectedWidget.id]?.form_id ?? null;
    }, [selectedFormId, selectedWidget, formsByWidget]);

    const getEffectiveWidgetId = useCallback((): number | null => {
        const formId = getEffectiveFormId();

        if (selectedWidget?.id) {
            log('getEffectiveWidgetId → from selectedWidget', { widgetId: selectedWidget.id });
            return selectedWidget.id;
        }

        if ((formDisplay as any)?.main_widget_id != null) {
            const wid = (formDisplay as any).main_widget_id as number;
            log('getEffectiveWidgetId → from formDisplay.main_widget_id', { widgetId: wid, formId });
            return wid;
        }

        if ((formDisplay as any)?.widget_id != null) {
            const wid = (formDisplay as any).widget_id as number;
            log('getEffectiveWidgetId → from formDisplay.widget_id', { widgetId: wid, formId });
            return wid;
        }

        if (formId != null) {
            const form = formsById[formId];

            log('getEffectiveWidgetId → checking formsById', {
                formId,
                form,
                hasWidgetId: form && 'widget_id' in form,
                hasMainWidgetId: form && 'main_widget_id' in form,
            });

            if (form) {
                if (typeof (form as any).widget_id === 'number') {
                    log('getEffectiveWidgetId → from form.widget_id', { widgetId: (form as any).widget_id });
                    return (form as any).widget_id as number;
                }

                if (typeof (form as any).main_widget_id === 'number') {
                    log('getEffectiveWidgetId → from form.main_widget_id', { widgetId: (form as any).main_widget_id });
                    return (form as any).main_widget_id as number;
                }
            }

            for (const [widStr, f] of Object.entries(formsByWidget)) {
                if (f?.form_id === formId) {
                    const wid = Number(widStr);
                    if (!Number.isNaN(wid)) {
                        log('getEffectiveWidgetId → from formsByWidget', { widgetId: wid });
                        return wid;
                    }
                }
            }
        }

        log('getEffectiveWidgetId → NOT FOUND', { formId, selectedFormId, selectedWidget });
        return null;
    }, [selectedWidget, selectedFormId, formsById, formsByWidget, formDisplay, getEffectiveFormId]);

    const reloadDisplay = useCallback(async (formId: number, useFilters: boolean = false) => {
        try {
            const filters = useFilters ? activeFilters : [];

            const normalizedFilters = filters.map(f => ({
                table_column_id: f.table_column_id,
                value: String(f.value),
            }));

            log('reloadDisplay', { formId, useFilters, rawFilters: filters, normalizedFilters });

            const { data } = await api.post<FormDisplay>(
                `/display/${formId}/main`,
                normalizedFilters
            );
            setFormDisplay(data);

            if (!useFilters && setActiveFilters) {
                setActiveFilters([]);
            }
        } catch (e: any) {
            console.error('[reloadDisplay] Failed:', e);
            const detail = e?.response?.data?.detail ?? e?.message;
            console.error('[reloadDisplay] Detail:', detail);
        }
    }, [activeFilters, setFormDisplay, setActiveFilters]);

    const ensureQuery = useCallback(
        async (kind: EnsureQueryKind): Promise<{ ok: boolean; formId?: number }> => {
            const formId = getEffectiveFormId();

            log('ensureQuery → START', { kind, formId, selectedFormId, selectedWidgetId: selectedWidget?.id, preflightTableId });

            if (!formId) {
                log('ensureQuery → FAIL: no formId', {});
                return { ok: false };
            }

            const widgetId = getEffectiveWidgetId();

            log('ensureQuery → widgetId check', { widgetId, preflightTableId, willFail: !widgetId && !preflightTableId });

            if (!widgetId && !preflightTableId) {
                log('ensureQuery → FAIL: no widgetId and no preflightTableId', {});
                return { ok: false };
            }

            try {
                let tableId: number | null = preflightTableId ?? null;

                if (!tableId) {
                    const maybeTid = (selectedWidget as any)?.table_id as number | undefined;
                    if (maybeTid) tableId = maybeTid ?? null;
                }

                if (!tableId && widgetId) {
                    log('ensureQuery → fetching widget to get tableId', { widgetId });
                    const { data: widgetMeta } = await api.get<{ id: number; table_id: number }>(`/widgets/${widgetId}`);
                    tableId = widgetMeta?.table_id ?? null;
                    log('ensureQuery → got tableId from widget', { tableId });
                }

                if (!tableId) {
                    log('ensureQuery → FAIL: no tableId', {});
                    return { ok: false };
                }

                log('ensureQuery → tableId used', { kind, formId, tableId, widgetId });

                const { data: table } = await api.get<DTable>(`/tables/${tableId}`);

                const q = kind === 'insert' ? table?.insert_query : kind === 'update' ? table?.update_query : table?.delete_query;

                if (!q || !q.trim()) {
                    if (kind === 'insert') {
                        alert('❌ Для этой таблицы не настроен INSERT QUERY.\n\nЗадайте его в метаданных таблицы.');
                    } else if (kind === 'update') {
                        alert('❌ Для этой таблицы не настроен UPDATE QUERY.\n\nЗадайте его в метаданных таблицы.');
                    } else {
                        alert('❌ Для этой таблицы не настроен DELETE QUERY.\n\nЗадайте его в метаданных таблицы.');
                    }
                    return { ok: false };
                }

                log('ensureQuery → SUCCESS', { kind, formId, tableId, widgetId });
            } catch (e) {
                console.warn('[ensureQuery] Preflight check failed (non-critical):', e);
            }

            return { ok: true, formId };
        },
        [selectedWidget, preflightTableId, getEffectiveFormId, getEffectiveWidgetId, selectedFormId]
    );

    const canMatchFilters = useCallback((
        draft: Record<number, string>,
        filters: Array<{ table_column_id: number; value: string | number }>
    ): boolean => {
        if (filters.length === 0) return true;

        for (const filter of filters) {
            const draftValue = draft[filter.table_column_id];
            if (draftValue != null && draftValue !== '') {
                const filterValue = String(filter.value).toLowerCase().trim();
                const draftValueNormalized = String(draftValue).toLowerCase().trim();
                if (draftValueNormalized !== filterValue) return false;
            }
        }
        return true;
    }, []);

    const buildFiltersFromDraft = useCallback((
        draft: Record<number, string>,
        currentFilters: Array<{ table_column_id: number; value: string | number }>
    ): Array<{ table_column_id: number; value: string | number }> | null => {
        if (currentFilters.length === 0) return null;

        const newFilters: Array<{ table_column_id: number; value: string | number }> = [];

        for (const filter of currentFilters) {
            const draftValue = draft[filter.table_column_id];
            if (draftValue != null && draftValue !== '') {
                newFilters.push({ table_column_id: filter.table_column_id, value: draftValue });
            } else {
                return null;
            }
        }

        return newFilters.length > 0 ? newFilters : null;
    }, []);

    const preflightInsert = useCallback(() => ensureQuery('insert'), [ensureQuery]);
    const preflightUpdate = useCallback(() => ensureQuery('update'), [ensureQuery]);
    const preflightDelete = useCallback(() => ensureQuery('delete'), [ensureQuery]);

    // ═══════════════════════════════════════════════════════════
    // Сброс валидации
    // ═══════════════════════════════════════════════════════════
    const resetValidation = useCallback(() => {
        setShowValidationErrors(false);
        setValidationMissingFields([]);
    }, []);

    function isSameComboGroupCRUD(a: ExtCol, b: ExtCol): boolean {
        if (!a || !b) return false;
        const aWrite = (a.__write_tc_id ?? a.table_column_id) ?? null;
        const bWrite = (b.__write_tc_id ?? b.table_column_id) ?? null;
        return (
            a.type === 'combobox' &&
            b.type === 'combobox' &&
            a.widget_column_id === b.widget_column_id &&
            aWrite != null && bWrite != null && aWrite === bWrite
        );
    }

    function getWriteTcIdForComboGroupCRUD(group: ExtCol[]): number | null {
        const primary = group.find((c) => c.__is_primary_combo_input) ?? group[0];
        if (primary?.__write_tc_id != null) return primary.__write_tc_id;
        for (const g of group) {
            if (g.__write_tc_id != null) return g.__write_tc_id;
        }
        console.warn('[useMainCrud][startAdd] combobox group has no __write_tc_id', group);
        return null;
    }

    // ═══════════════════════════════════════════════════════════
    // ХЕЛПЕР: Построить маппинг table_column_id → write_tc_id
    // ═══════════════════════════════════════════════════════════
    const buildTableColumnToWriteIdMap = useCallback((): Map<number, number> => {
        const map = new Map<number, number>();

        for (let i = 0; i < flatColumnsInRenderOrder.length; ) {
            const c = flatColumnsInRenderOrder[i];

            if (c.type === 'combobox') {
                let j = i + 1;
                while (j < flatColumnsInRenderOrder.length && isSameComboGroupCRUD(c, flatColumnsInRenderOrder[j])) {
                    j += 1;
                }
                const group = flatColumnsInRenderOrder.slice(i, j);
                const writeTcId = getWriteTcIdForComboGroupCRUD(group);

                if (writeTcId != null) {
                    map.set(writeTcId, writeTcId);
                }

                for (const col of group) {
                    const originalTcId = col.__write_tc_id ?? col.table_column_id;
                    if (originalTcId != null && writeTcId != null) {
                        map.set(originalTcId, writeTcId);
                    }
                }

                i = j;
                continue;
            }

            const writeTcId = (c.__write_tc_id ?? c.table_column_id) ?? null;
            const originalTcId = c.table_column_id ?? null;

            if (originalTcId != null && writeTcId != null) {
                map.set(originalTcId, writeTcId);
            }

            i += 1;
        }

        return map;
    }, [flatColumnsInRenderOrder]);

    // ═══════════════════════════════════════════════════════════
    // ДОБАВЛЕНИЕ
    // ═══════════════════════════════════════════════════════════
    const startAdd = useCallback(async () => {
        log('startAdd → called', {
            selectedFormId,
            selectedWidgetId: selectedWidget?.id,
            preflightTableId,
            activeFilters,
        });

        const pf = await preflightInsert();
        log('startAdd → preflight result', pf);

        if (!pf.ok) {
            log('startAdd → BLOCKED by preflight', {});
            return;
        }

        setIsAdding(true);
        setEditingRowIdx(null);
        setEditStylesDraft({});
        resetValidation();

        const init: Record<number, string> = {};
        const seen = new Set<number>();
        const newAutoFilledFields = new Set<number>();

        // ═══════════════════════════════════════════════════════════
        // 1. Инициализируем все поля дефолтными значениями
        // ═══════════════════════════════════════════════════════════
        for (let i = 0; i < flatColumnsInRenderOrder.length; ) {
            const c = flatColumnsInRenderOrder[i];

            if (c.type === 'combobox') {
                let j = i + 1;
                while (j < flatColumnsInRenderOrder.length && isSameComboGroupCRUD(c, flatColumnsInRenderOrder[j])) {
                    j += 1;
                }
                const group = flatColumnsInRenderOrder.slice(i, j);
                const writeTcId = getWriteTcIdForComboGroupCRUD(group);
                if (writeTcId != null && !seen.has(writeTcId)) {
                    init[writeTcId] = '';
                    seen.add(writeTcId);
                }
                i = j;
                continue;
            }

            const writeTcId = (c.__write_tc_id ?? c.table_column_id) ?? null;
            if (writeTcId != null && !seen.has(writeTcId)) {
                // ═══════════════════════════════════════════════════════════
                // CHECKBOX: по умолчанию 'false'
                // checkboxNull: по умолчанию 'null' (поддерживает три состояния)
                // ═══════════════════════════════════════════════════════════
                const isTriStateCheckbox = c.type === 'checkboxNull';
                const isRegularCheckbox = c.type === 'checkbox' || c.type === 'bool';

                if (isTriStateCheckbox) {
                    init[writeTcId] = 'null'; // Tri-state по умолчанию null
                } else if (isRegularCheckbox) {
                    init[writeTcId] = 'false';
                } else {
                    init[writeTcId] = String(c.default ?? '');
                }
                seen.add(writeTcId);
            }
            i += 1;
        }

        // ═══════════════════════════════════════════════════════════
        // 2. Автозаполнение из activeFilters (фильтры дерева) + отслеживание
        // ═══════════════════════════════════════════════════════════
        if (activeFilters.length > 0) {
            const tableColumnToWriteId = buildTableColumnToWriteIdMap();

            log('startAdd → applying tree filters to draft', {
                activeFilters,
                tableColumnToWriteIdMap: Object.fromEntries(tableColumnToWriteId),
            });

            for (const filter of activeFilters) {
                const writeTcId = tableColumnToWriteId.get(filter.table_column_id);

                if (writeTcId != null) {
                    init[writeTcId] = String(filter.value);
                    newAutoFilledFields.add(writeTcId); // Помечаем как автозаполненное

                    log('startAdd → auto-filled from tree filter', {
                        table_column_id: filter.table_column_id,
                        writeTcId,
                        value: filter.value,
                    });
                } else {
                    log('startAdd → filter table_column_id not found in columns', {
                        table_column_id: filter.table_column_id,
                        value: filter.value,
                    });
                }
            }
        }

        log('startAdd → init draft (with tree filters applied)', init);
        log('startAdd → autoFilledFields:', Array.from(newAutoFilledFields));

        setDraft(init);
        setAutoFilledFields(newAutoFilledFields);
    }, [
        preflightInsert,
        flatColumnsInRenderOrder,
        selectedFormId,
        selectedWidget,
        preflightTableId,
        resetValidation,
        activeFilters,
        buildTableColumnToWriteIdMap,
    ]);

    const cancelAdd = useCallback(() => {
        setIsAdding(false);
        setDraft({});
        setEditStylesDraft({});
        setAutoFilledFields(new Set());
        resetValidation();
    }, [resetValidation]);

    const submitAdd = useCallback(async () => {
        // ═══════════════════════════════════════════════════════════
        // ВАЛИДАЦИЯ REQUIRED ПОЛЕЙ
        // ═══════════════════════════════════════════════════════════
        const validation = validateAddDraft(draft, flatColumnsInRenderOrder);

        if (!validation.isValid) {
            log('submitAdd → VALIDATION FAILED', {
                errors: validation.errors,
                missingFields: validation.missingFields,
            });

            setShowValidationErrors(true);
            setValidationMissingFields(validation.missingFields);
            return;
        }

        const wid = getEffectiveWidgetId();
        if (!wid) {
            log('submitAdd → BLOCKED: no widgetId', {});
            return;
        }

        const pf = await preflightInsert();
        if (!pf.ok || !pf.formId) {
            log('submitAdd → BLOCKED by preflight', pf);
            return;
        }

        setSaving(true);
        try {
            const allWriteIds: number[] = [];
            const seen = new Set<number>();

            flatColumnsInRenderOrder.forEach((c) => {
                const w = (c.__write_tc_id ?? c.table_column_id) ?? null;
                if (w != null && !seen.has(w)) {
                    seen.add(w);
                    allWriteIds.push(w);
                }
            });

            const values = allWriteIds.map((tcId) => {
                const raw = draft[tcId];
                const s = raw == null ? '' : String(raw);

                const colForTc = flatColumnsInRenderOrder.find((c) => {
                    const w = (c.__write_tc_id ?? c.table_column_id) ?? null;
                    return w === tcId;
                });

                // ═══════════════════════════════════════════════════════════
                // checkboxNull: поддерживает три состояния (true/false/null)
                // checkbox/bool: только два состояния (true/false)
                // ═══════════════════════════════════════════════════════════
                const isTriStateCheckbox = colForTc?.type === 'checkboxNull';
                const isRegularCheckbox = colForTc?.type === 'checkbox' || colForTc?.type === 'bool';

                let value: string | null;

                if (isTriStateCheckbox) {
                    // TRISTATE: может быть null
                    const normalized = s.trim().toLowerCase();
                    if (normalized === 'null' || normalized === '') {
                        value = null;
                    } else if (normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'yes' || normalized === 'да') {
                        value = 'true';
                    } else {
                        value = 'false';
                    }
                } else if (isRegularCheckbox) {
                    // Обычный checkbox: только true/false, никогда null
                    const normalized = s.trim().toLowerCase();
                    if (normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'yes' || normalized === 'да') {
                        value = 'true';
                    } else {
                        value = 'false';
                    }
                } else {
                    const normalized = normalizeValueForColumn(tcId, s, flatColumnsInRenderOrder);
                    value = normalized === '' ? null : normalized;
                }

                return { table_column_id: tcId, value };
            });

            log('submitAdd → values[]', values);

            const body = { pk: { primary_keys: {} as Record<string, string> }, values };
            const url = `/data/${pf.formId}/${wid}`;

            try {
                await api.post(url, body);
                log('✅ submitAdd → POST success');
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 403) {
                    alert('❌ У вас не хватает прав на добавление новой записи');
                    return;
                }

                if (status === 404 && String(detail).includes('Insert query not found')) {
                    alert('❌ Для этой таблицы не настроен INSERT QUERY.\n\nЗадайте его в метаданных таблицы.');
                    return;
                }
                if (status === 404) {
                    await api.post(`${url}/`, body);
                    log('✅ submitAdd → POST with trailing slash success');
                } else if (status === 422) {
                    console.error('[submitAdd] 422 от бэка', { detail, body });
                    alert(`❌ Не удалось добавить строку (422).\n\ndetail: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
                    return;
                } else {
                    throw err;
                }
            }

            const hasFilters = activeFilters.length > 0;
            let shouldResetTreeDrawer = false;

            if (!hasFilters) {
                await reloadDisplay(pf.formId, false);
                log('✅ submitAdd → no filters, full reload');
            } else {
                const matches = canMatchFilters(draft, activeFilters);

                if (matches) {
                    await reloadDisplay(pf.formId, true);
                    log('✅ submitAdd → filters kept (new record matches)');
                } else {
                    const newFilters = buildFiltersFromDraft(draft, activeFilters);

                    if (newFilters && setActiveFilters) {
                        setActiveFilters(newFilters);

                        const normalizedFilters = newFilters.map(f => ({
                            table_column_id: f.table_column_id,
                            value: String(f.value),
                        }));

                        const { data } = await api.post<FormDisplay>(`/display/${pf.formId}/main`, normalizedFilters);
                        setFormDisplay(data);

                        log('✅ submitAdd → auto-updated filters', { oldFilters: activeFilters, newFilters });
                    } else {
                        await reloadDisplay(pf.formId, false);

                        if (resetFilters) {
                            await resetFilters();
                        }

                        shouldResetTreeDrawer = true;
                        log('✅ submitAdd → filters reset (cannot auto-update)');
                    }
                }
            }

            await reloadTree();

            if (shouldResetTreeDrawer && onResetTreeDrawer) {
                onResetTreeDrawer();
                log('✅ submitAdd → TreeDrawer reset');
            }

            setIsAdding(false);
            setDraft({});
            setEditStylesDraft({});
            setAutoFilledFields(new Set());
            resetValidation();

            log('✅ submitAdd COMPLETE');
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(`❌ Не удалось добавить строку: ${status ?? ''}\n\n${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        } finally {
            setSaving(false);
        }
    }, [
        getEffectiveWidgetId,
        preflightInsert,
        draft,
        flatColumnsInRenderOrder,
        activeFilters,
        reloadDisplay,
        reloadTree,
        resetFilters,
        setActiveFilters,
        setFormDisplay,
        canMatchFilters,
        buildFiltersFromDraft,
        onResetTreeDrawer,
        resetValidation,
    ]);

    // ═══════════════════════════════════════════════════════════
    // РЕДАКТИРОВАНИЕ
    // ═══════════════════════════════════════════════════════════
    const startEdit = useCallback(
        async (rowIdx: number) => {
            log('startEdit → called', { rowIdx, selectedFormId, selectedWidgetId: selectedWidget?.id });

            const pf = await preflightUpdate();
            log('startEdit → preflight result', pf);

            if (!pf.ok) {
                log('startEdit → BLOCKED by preflight', {});
                return;
            }

            setIsAdding(false);
            setEditStylesDraft({});
            setAutoFilledFields(new Set());
            resetValidation();

            const row = formDisplay.data[rowIdx];

            const init: Record<number, string> = {};
            const comboGroups = new Map<string, { wcId: number; writeTcId: number; tokens: string[] }>();

            flatColumnsInRenderOrder.forEach((col) => {
                const writeTcId = (col.__write_tc_id ?? col.table_column_id) ?? null;
                if (writeTcId == null) return;

                const visKey = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                const idx = valueIndexByKey.get(visKey);
                const shownVal = (idx != null ? row.values[idx] : '') as string | number | null;
                const shownStr = shownVal == null ? '' : String(shownVal).trim();

                if (col.type === 'combobox') {
                    log('startEdit → collecting combobox token', {
                        columnName: col.column_name,
                        widget_column_id: col.widget_column_id,
                        table_column_id: col.table_column_id,
                        writeTcId,
                        visKey,
                        valueIndex: idx,
                        shownVal,
                        shownStr,
                        rowValuesLength: row.values.length,
                    });
                }

                if (col.type === 'combobox') {
                    const gKey = `${col.widget_column_id}:${writeTcId}`;
                    const g = comboGroups.get(gKey) ?? { wcId: col.widget_column_id, writeTcId, tokens: [] };
                    if (shownStr) g.tokens.push(shownStr);
                    comboGroups.set(gKey, g);
                } else {
                    // ═══════════════════════════════════════════════════════════
                    // checkboxNull: поддерживает три состояния (true/false/null)
                    // checkbox/bool: только два состояния (true/false)
                    // ═══════════════════════════════════════════════════════════
                    const isTriStateCheckbox = col.type === 'checkboxNull';
                    const isRegularCheckbox = col.type === 'checkbox' || col.type === 'bool';

                    if (isTriStateCheckbox) {
                        // TRISTATE: поддерживает null
                        if (shownVal === null || shownVal === undefined || shownStr === '') {
                            init[writeTcId] = 'null';
                        } else if (
                            shownStr.toLowerCase() === 'true' ||
                            shownStr === '1' ||
                            shownStr.toLowerCase() === 't' ||
                            shownStr.toLowerCase() === 'yes' ||
                            shownStr.toLowerCase() === 'да'
                        ) {
                            init[writeTcId] = 'true';
                        } else {
                            init[writeTcId] = 'false';
                        }
                    } else if (isRegularCheckbox) {
                        // Обычный checkbox: только true/false
                        if (
                            shownStr.toLowerCase() === 'true' ||
                            shownStr === '1' ||
                            shownStr.toLowerCase() === 't' ||
                            shownStr.toLowerCase() === 'yes' ||
                            shownStr.toLowerCase() === 'да'
                        ) {
                            init[writeTcId] = 'true';
                        } else {
                            init[writeTcId] = 'false';
                        }
                    } else {
                        init[writeTcId] = shownStr;
                    }
                }
            });

            const groups = Array.from(comboGroups.values());
            for (const g of groups) {
                try {
                    const options = await loadComboOptionsOnce(g.wcId, g.writeTcId);
                    const tokens = g.tokens.map((t) => t.toLowerCase());
                    const tokensOriginal = g.tokens;

                    log('startEdit → combobox mapping', {
                        wcId: g.wcId,
                        writeTcId: g.writeTcId,
                        tokens: g.tokens,
                        optionsCount: options.length,
                        firstOptions: options.slice(0, 3).map(o => ({ id: o.id, show: o.show, showHidden: o.showHidden })),
                    });

                    let foundId = '';

                    for (const o of options) {
                        if (tokensOriginal.includes(o.id) || tokensOriginal.includes(String(o.id))) {
                            foundId = o.id;
                            log('startEdit → combobox: exact match by ID in tokens', { optionId: o.id, tokens: tokensOriginal });
                            break;
                        }

                        if (o.show.includes(o.id) && tokensOriginal.some(t => t === o.id)) {
                            foundId = o.id;
                            log('startEdit → combobox: exact match by ID in show', { optionId: o.id, show: o.show });
                            break;
                        }
                    }

                    if (!foundId) {
                        let bestScore = 0;
                        const candidates: Array<{ id: string; score: number; exactMatch: boolean }> = [];

                        for (const o of options) {
                            const hay = [...o.show, ...o.showHidden].map((x) => x.toLowerCase());
                            const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);

                            const hayJoined = hay.join(' ');
                            const tokensJoined = tokens.join(' ');
                            const exactMatch = hayJoined.includes(tokensJoined) || tokens.every(t => hay.includes(t));

                            if (score > 0) {
                                candidates.push({ id: o.id, score, exactMatch });
                            }

                            if (score > bestScore) {
                                bestScore = score;
                            }
                        }

                        candidates.sort((a, b) => {
                            if (a.exactMatch !== b.exactMatch) return a.exactMatch ? -1 : 1;
                            return b.score - a.score;
                        });

                        const topCandidates = candidates.filter(c => c.score === bestScore);

                        if (candidates.length > 0) {
                            foundId = candidates[0].id;

                            if (topCandidates.length > 1) {
                                log('startEdit → combobox: multiple matches, picked best', {
                                    picked: foundId,
                                    topCandidates,
                                    allCandidates: candidates,
                                });
                            }
                        }
                    }

                    init[g.writeTcId] = foundId || init[g.writeTcId] || '';

                    log('startEdit → combobox result', {
                        writeTcId: g.writeTcId,
                        tokens: g.tokens,
                        foundId,
                        finalValue: init[g.writeTcId],
                    });
                } catch (e) {
                    log('startEdit → combobox ERROR', { wcId: g.wcId, writeTcId: g.writeTcId, error: e });
                    init[g.writeTcId] = init[g.writeTcId] ?? '';
                }
            }

            log('startEdit → init editDraft', { rowIdx, init });
            setEditingRowIdx(rowIdx);
            setEditDraft(init);
        },
        [preflightUpdate, formDisplay.data, flatColumnsInRenderOrder, valueIndexByKey, selectedFormId, selectedWidget, resetValidation]
    );

    const cancelEdit = useCallback(() => {
        setEditingRowIdx(null);
        setEditDraft({});
        setEditSaving(false);
        setEditStylesDraft({});
        setAutoFilledFields(new Set());
        resetValidation();
    }, [resetValidation]);

    const submitEdit = useCallback(async () => {
        if (editingRowIdx == null) return;

        const row = formDisplay.data[editingRowIdx];

        // ═══════════════════════════════════════════════════════════
        // ВАЛИДАЦИЯ REQUIRED ПОЛЕЙ
        // ═══════════════════════════════════════════════════════════
        const validation = validateEditDraft(editDraft, row, flatColumnsInRenderOrder, valueIndexByKey);

        if (!validation.isValid) {
            log('submitEdit → VALIDATION FAILED', {
                errors: validation.errors,
                missingFields: validation.missingFields,
            });

            setShowValidationErrors(true);
            setValidationMissingFields(validation.missingFields);
            return;
        }

        const wid = getEffectiveWidgetId();
        if (!wid) {
            log('submitEdit → BLOCKED: no widgetId', {});
            return;
        }

        const pf = await preflightUpdate();
        if (!pf.ok || !pf.formId) {
            log('submitEdit → BLOCKED by preflight', pf);
            return;
        }

        setEditSaving(true);
        try {
            const pkObj = Object.fromEntries(
                Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
            );

            const getSendingValue = (tcId: number, raw: unknown): string | null => {
                const s = raw == null ? '' : String(raw).trim();

                const colForTc = flatColumnsInRenderOrder.find((c) => {
                    const w = (c.__write_tc_id ?? c.table_column_id) ?? null;
                    return w === tcId;
                });

                // ═══════════════════════════════════════════════════════════
                // checkboxNull: поддерживает три состояния (true/false/null)
                // checkbox/bool: только два состояния (true/false)
                // ═══════════════════════════════════════════════════════════
                const isTriStateCheckbox = colForTc?.type === 'checkboxNull';
                const isRegularCheckbox = colForTc?.type === 'checkbox' || colForTc?.type === 'bool';

                if (isTriStateCheckbox) {
                    // TRISTATE: может быть null
                    const normalized = s.toLowerCase();
                    if (normalized === 'null' || normalized === '') {
                        return null;
                    } else if (normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'yes' || normalized === 'да') {
                        return 'true';
                    } else {
                        return 'false';
                    }
                }

                if (isRegularCheckbox) {
                    // Обычный checkbox: только true/false, никогда null
                    const normalized = s.toLowerCase();
                    if (normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'yes' || normalized === 'да') {
                        return 'true';
                    } else {
                        return 'false';
                    }
                }

                if (s === '') return null;

                const normalized = normalizeValueForColumn(tcId, s, flatColumnsInRenderOrder);
                return normalized === '' ? null : normalized;
            };

            const entries = Object.entries(editDraft);

            const values: Array<{ table_column_id: number; value: string | null }> = entries.map(
                ([tcIdStr, v]) => {
                    const tcId = Number(tcIdStr);
                    return {
                        table_column_id: tcId,
                        value: getSendingValue(tcId, v),
                    };
                }
            );

            if (
                stylesColumnMeta?.exists &&
                stylesColumnMeta.valueIndex != null &&
                Object.keys(editStylesDraft).length > 0
            ) {
                const stylesColumn = formDisplay.columns.find((c) => c.type === 'styles');
                const stylesTcId = stylesColumn?.table_column_id;

                if (stylesTcId) {
                    const currentStylesJson = row.values[stylesColumnMeta.valueIndex];
                    const currentStyles: Record<string, CellStyles> =
                        currentStylesJson && typeof currentStylesJson === 'object'
                            ? { ...(currentStylesJson as Record<string, CellStyles>) }
                            : {};

                    const columnNameToTableColumnName = stylesColumnMeta.columnNameToTableColumnName;

                    Object.entries(editStylesDraft).forEach(([columnName, style]) => {
                        const tableColumnName = columnNameToTableColumnName?.get(columnName) ?? columnName;

                        if (style === null) {
                            delete currentStyles[tableColumnName];
                        } else {
                            currentStyles[tableColumnName] = style;
                        }
                    });

                    const stylesValue = Object.keys(currentStyles).length > 0 ? JSON.stringify(currentStyles) : null;

                    values.push({ table_column_id: stylesTcId, value: stylesValue });
                }
            }

            const body = { pk: { primary_keys: pkObj }, values };
            const url = `/data/${pf.formId}/${wid}`;

            log('submitEdit → request', { url, body });

            try {
                await api.patch(url, body);
                log('✅ submitEdit → PATCH success');
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 403) {
                    alert('❌ У вас не хватает прав на редактирование этой записи');
                    return;
                }

                if (status === 404 && String(detail).includes('Update query not found')) {
                    alert('❌ Для этой таблицы не настроен UPDATE QUERY.\n\nЗадайте его в метаданных таблицы.');
                    return;
                }
                if (status === 404) {
                    await api.patch(`${url}/`, body);
                    log('✅ submitEdit → PATCH with trailing slash success');
                } else {
                    throw err;
                }
            }

            await reloadDisplay(pf.formId, true);
            await reloadTree();

            setIsAdding(false);
            setDraft({});
            setEditStylesDraft({});
            setAutoFilledFields(new Set());
            resetValidation();
            cancelEdit();

            log('✅ submitEdit COMPLETE');
        } finally {
            setEditSaving(false);
        }
    }, [
        editingRowIdx,
        getEffectiveWidgetId,
        preflightUpdate,
        formDisplay.data,
        formDisplay.columns,
        editDraft,
        editStylesDraft,
        stylesColumnMeta,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        reloadDisplay,
        reloadTree,
        cancelEdit,
        resetValidation,
    ]);

    // ═══════════════════════════════════════════════════════════
    // УДАЛЕНИЕ
    // ═══════════════════════════════════════════════════════════
    const deleteRow = useCallback(
        async (rowIdx: number) => {
            log('deleteRow → called', { rowIdx, selectedFormId, selectedWidgetId: selectedWidget?.id });

            const wid = getEffectiveWidgetId();
            if (!wid) {
                log('deleteRow → BLOCKED: no widgetId', {});
                return;
            }

            const pf = await preflightDelete();
            log('deleteRow → preflight result', pf);

            if (!pf.ok || !pf.formId) {
                log('deleteRow → BLOCKED by preflight', {});
                return;
            }

            const row = formDisplay.data[rowIdx];
            const rowKey = pkToKey(row.primary_keys);
            setSelectedKey((prev) => (prev === rowKey ? null : prev));

            const pkObj = Object.fromEntries(
                Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
            );

            setDeletingRowIdx(rowIdx);
            try {
                const body = { primary_keys: pkObj };
                const url = `/data/${pf.formId}/${wid}`;

                try {
                    await api.delete(url, { data: body });
                    log('✅ deleteRow → DELETE success');
                } catch (err: any) {
                    const status = err?.response?.status;
                    const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                    if (status === 404 && String(detail).includes('Delete query not found')) {
                        alert('❌ Для этой таблицы не настроен DELETE QUERY.\n\nЗадайте его в метаданных таблицы.');
                        return;
                    }
                    if (status === 404) {
                        await api.delete(`${url}/`, { data: body });
                        log('✅ deleteRow → DELETE with trailing slash success');
                    } else {
                        throw err;
                    }
                }

                await reloadDisplay(pf.formId, true);

                try {
                    await reloadTree();
                } catch {}

                if (pkToKey(lastPrimary) === rowKey) {
                    setLastPrimary({});
                    setSubDisplay(null);
                }

                log('✅ deleteRow COMPLETE');
            } finally {
                setDeletingRowIdx(null);
            }
        },
        [
            getEffectiveWidgetId,
            preflightDelete,
            formDisplay.data,
            pkToKey,
            reloadDisplay,
            lastPrimary,
            setSubDisplay,
            setSelectedKey,
            reloadTree,
            setLastPrimary,
            selectedFormId,
            selectedWidget,
        ]
    );

    return {
        isAdding,
        draft,
        saving,
        editingRowIdx,
        editDraft,
        editSaving,
        deletingRowIdx,
        startAdd,
        cancelAdd,
        submitAdd,
        startEdit,
        cancelEdit,
        submitEdit,
        deleteRow,
        setDraft,
        setEditDraft,
        editStylesDraft,
        setEditStylesDraft,
        // Валидация
        showValidationErrors,
        setShowValidationErrors,
        validationMissingFields,
        setValidationMissingFields,
        resetValidation,
        // NEW: Автозаполненные поля
        autoFilledFields,
        clearAutoFilledField,
    };
}