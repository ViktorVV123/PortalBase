// useMainCrud.ts — ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ
import { useCallback, useState } from 'react';
import { api } from '@/services/api';
import type { DTable, FormDisplay, Widget, WidgetForm } from '@/shared/hooks/useWorkSpaces';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import { loadComboOptionsOnce, normalizeValueForColumn } from '@/components/Form/mainTable/InputCell';
import type { CellStyles } from '@/components/Form/mainTable/CellStylePopover';

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
    /** Callback для сброса TreeDrawer при сбросе фильтров */
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

    const getEffectiveFormId = useCallback((): number | null => {
        if (selectedFormId != null) return selectedFormId;
        if (!selectedWidget) return null;
        return formsByWidget[selectedWidget.id]?.form_id ?? null;
    }, [selectedFormId, selectedWidget, formsByWidget]);

    const getEffectiveWidgetId = useCallback((): number | null => {
        if (selectedWidget?.id) return selectedWidget.id;

        if (selectedFormId != null) {
            const form = formsById[selectedFormId];
            if (form && typeof (form as any).widget_id === 'number') {
                return (form as any).widget_id as number;
            }

            for (const [widStr, f] of Object.entries(formsByWidget)) {
                if (f?.form_id === selectedFormId) {
                    const wid = Number(widStr);
                    if (!Number.isNaN(wid)) return wid;
                }
            }
        }

        return null;
    }, [selectedWidget, selectedFormId, formsById, formsByWidget]);

    // ═══════════════════════════════════════════════════════════
    // HELPER: Reload display with proper filter conversion
    // ═══════════════════════════════════════════════════════════
    const reloadDisplay = useCallback(async (formId: number, useFilters: boolean = false) => {
        try {
            const filters = useFilters ? activeFilters : [];

            const normalizedFilters = filters.map(f => ({
                table_column_id: f.table_column_id,
                value: String(f.value),
            }));

            log('reloadDisplay', {
                formId,
                useFilters,
                rawFilters: filters,
                normalizedFilters
            });

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
            if (!formId) return { ok: false };

            const widgetId = getEffectiveWidgetId();
            if (!widgetId && !preflightTableId) return { ok: false };

            try {
                let tableId: number | null = preflightTableId ?? null;

                if (!tableId) {
                    const maybeTid = (selectedWidget as any)?.table_id as number | undefined;
                    if (maybeTid) tableId = maybeTid ?? null;
                }

                if (!tableId && widgetId) {
                    const { data: widgetMeta } = await api.get<{ id: number; table_id: number }>(
                        `/widgets/${widgetId}`
                    );
                    tableId = widgetMeta?.table_id ?? null;
                }

                if (!tableId) return { ok: false };

                log('ensureQuery → tableId used', { kind, formId, tableId, widgetId });

                const { data: table } = await api.get<DTable>(`/tables/${tableId}`);

                const q =
                    kind === 'insert'
                        ? table?.insert_query
                        : kind === 'update'
                            ? table?.update_query
                            : table?.delete_query;

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
            } catch (e) {
                console.warn('[ensureQuery] Preflight check failed (non-critical):', e);
            }

            return { ok: true, formId };
        },
        [selectedWidget, preflightTableId, getEffectiveFormId, getEffectiveWidgetId]
    );

    // ═══════════════════════════════════════════════════════════
    // HELPER: Can new record match current filters?
    // ═══════════════════════════════════════════════════════════
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

                if (draftValueNormalized !== filterValue) {
                    return false;
                }
            }
        }

        return true;
    }, []);

    // ═══════════════════════════════════════════════════════════
    // HELPER: Build new filters from draft
    // ═══════════════════════════════════════════════════════════
    const buildFiltersFromDraft = useCallback((
        draft: Record<number, string>,
        currentFilters: Array<{ table_column_id: number; value: string | number }>
    ): Array<{ table_column_id: number; value: string | number }> | null => {
        if (currentFilters.length === 0) return null;

        const newFilters: Array<{ table_column_id: number; value: string | number }> = [];

        for (const filter of currentFilters) {
            const draftValue = draft[filter.table_column_id];

            if (draftValue != null && draftValue !== '') {
                newFilters.push({
                    table_column_id: filter.table_column_id,
                    value: draftValue,
                });
            } else {
                return null;
            }
        }

        return newFilters.length > 0 ? newFilters : null;
    }, []);

    const preflightInsert = useCallback(() => ensureQuery('insert'), [ensureQuery]);
    const preflightUpdate = useCallback(() => ensureQuery('update'), [ensureQuery]);
    const preflightDelete = useCallback(() => ensureQuery('delete'), [ensureQuery]);

    function isSameComboGroupCRUD(a: ExtCol, b: ExtCol): boolean {
        if (!a || !b) return false;
        const aWrite = (a.__write_tc_id ?? a.table_column_id) ?? null;
        const bWrite = (b.__write_tc_id ?? b.table_column_id) ?? null;
        return (
            a.type === 'combobox' &&
            b.type === 'combobox' &&
            a.widget_column_id === b.widget_column_id &&
            aWrite != null &&
            bWrite != null &&
            aWrite === bWrite
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
    // ДОБАВЛЕНИЕ
    // ═══════════════════════════════════════════════════════════
    const startAdd = useCallback(async () => {
        const pf = await preflightInsert();
        if (!pf.ok) return;

        setIsAdding(true);
        setEditingRowIdx(null);
        setEditStylesDraft({});

        const init: Record<number, string> = {};
        const seen = new Set<number>();

        for (let i = 0; i < flatColumnsInRenderOrder.length; ) {
            const c = flatColumnsInRenderOrder[i];

            if (c.type === 'combobox') {
                let j = i + 1;
                while (
                    j < flatColumnsInRenderOrder.length &&
                    isSameComboGroupCRUD(c, flatColumnsInRenderOrder[j])
                    ) {
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
                init[writeTcId] = String(c.default ?? '');
                seen.add(writeTcId);
            }
            i += 1;
        }

        log('startAdd → init draft (unique write ids)', init);
        setDraft(init);
    }, [preflightInsert, flatColumnsInRenderOrder]);

    const cancelAdd = useCallback(() => {
        setIsAdding(false);
        setDraft({});
        setEditStylesDraft({});
    }, []);

    const submitAdd = useCallback(async () => {
        const wid = getEffectiveWidgetId();
        if (!wid) return;

        const pf = await preflightInsert();
        if (!pf.ok || !pf.formId) return;

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

                const isCheckboxCol = colForTc?.type === 'checkbox' || colForTc?.type === 'bool';

                let value: string | null;

                if (isCheckboxCol) {
                    const normalized = s.trim();
                    value = normalized === '' ? 'false' : normalized;
                } else {
                    const normalized = normalizeValueForColumn(tcId, s, flatColumnsInRenderOrder);
                    value = normalized === '' ? null : normalized;
                }

                return {
                    table_column_id: tcId,
                    value,
                };
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
                    alert(
                        `❌ Не удалось добавить строку (422).\n\n` +
                        `detail: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
                    );
                    return;
                } else {
                    throw err;
                }
            }

            // ═══════════════════════════════════════════════════════════
            // УМНАЯ ЛОГИКА ФИЛЬТРОВ
            // ═══════════════════════════════════════════════════════════

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

                        const { data } = await api.post<FormDisplay>(
                            `/display/${pf.formId}/main`,
                            normalizedFilters
                        );
                        setFormDisplay(data);

                        log('✅ submitAdd → auto-updated filters', {
                            oldFilters: activeFilters,
                            newFilters
                        });
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

            // ← Сбрасываем TreeDrawer только если фильтры были сброшены
            if (shouldResetTreeDrawer && onResetTreeDrawer) {
                onResetTreeDrawer();
                log('✅ submitAdd → TreeDrawer reset');
            }

            setIsAdding(false);
            setDraft({});
            setEditStylesDraft({});

            log('✅ submitAdd COMPLETE');
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(
                `❌ Не удалось добавить строку: ${status ?? ''}\n\n${
                    typeof msg === 'string' ? msg : JSON.stringify(msg)
                }`
            );
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
    ]);

    // ═══════════════════════════════════════════════════════════
    // РЕДАКТИРОВАНИЕ
    // ═══════════════════════════════════════════════════════════
    const startEdit = useCallback(
        async (rowIdx: number) => {
            const pf = await preflightUpdate();
            if (!pf.ok) return;

            setIsAdding(false);
            setEditStylesDraft({});

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
                    const gKey = `${col.widget_column_id}:${writeTcId}`;
                    const g = comboGroups.get(gKey) ?? {
                        wcId: col.widget_column_id,
                        writeTcId,
                        tokens: [],
                    };
                    if (shownStr) g.tokens.push(shownStr);
                    comboGroups.set(gKey, g);
                } else {
                    init[writeTcId] = shownStr;
                }
            });

            const groups = Array.from(comboGroups.values());
            for (const g of groups) {
                try {
                    const options = await loadComboOptionsOnce(g.wcId, g.writeTcId);
                    const tokens = g.tokens.map((t) => t.toLowerCase());

                    let bestId: string | null = null;
                    let bestScore = 0;
                    let bestCount = 0;

                    for (const o of options) {
                        const hay = o.showHidden.map((x) => x.toLowerCase());
                        const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
                        if (score > bestScore) {
                            bestScore = score;
                            bestCount = 1;
                            bestId = o.id;
                        } else if (score === bestScore && score > 0) {
                            bestCount += 1;
                        }
                    }

                    init[g.writeTcId] =
                        bestScore > 0 && bestCount === 1 && bestId ? bestId : init[g.writeTcId] ?? '';
                } catch {
                    init[g.writeTcId] = init[g.writeTcId] ?? '';
                }
            }

            log('startEdit → init editDraft', { rowIdx, init });
            setEditingRowIdx(rowIdx);
            setEditDraft(init);
        },
        [preflightUpdate, formDisplay.data, flatColumnsInRenderOrder, valueIndexByKey]
    );

    const cancelEdit = useCallback(() => {
        setEditingRowIdx(null);
        setEditDraft({});
        setEditSaving(false);
        setEditStylesDraft({});
    }, []);

    const submitEdit = useCallback(async () => {
        if (editingRowIdx == null) return;

        const wid = getEffectiveWidgetId();
        if (!wid) return;

        const pf = await preflightUpdate();
        if (!pf.ok || !pf.formId) return;

        setEditSaving(true);
        try {
            const row = formDisplay.data[editingRowIdx];

            const pkObj = Object.fromEntries(
                Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
            );

            const getSendingValue = (raw: unknown): string | null => {
                const s = raw == null ? '' : String(raw).trim();
                return s === '' ? null : s;
            };

            const entries = Object.entries(editDraft);

            const values: Array<{ table_column_id: number; value: string | null }> = entries.map(
                ([tcIdStr, v]) => ({
                    table_column_id: Number(tcIdStr),
                    value: getSendingValue(v),
                })
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

                    const stylesValue =
                        Object.keys(currentStyles).length > 0 ? JSON.stringify(currentStyles) : null;

                    values.push({
                        table_column_id: stylesTcId,
                        value: stylesValue,
                    });
                }
            }

            const body = {
                pk: { primary_keys: pkObj },
                values,
            };
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
        reloadDisplay,
        reloadTree,
        cancelEdit,
    ]);

    // ═══════════════════════════════════════════════════════════
    // УДАЛЕНИЕ
    // ═══════════════════════════════════════════════════════════
    const deleteRow = useCallback(
        async (rowIdx: number) => {
            const wid = getEffectiveWidgetId();
            if (!wid) return;

            const pf = await preflightDelete();
            if (!pf.ok || !pf.formId) return;

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
    };
}