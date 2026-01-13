// useMainCrud.ts
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
    /** Маппинг table_column_name → column_name (для чтения стилей) */
    tableColumnNameMap: Map<string, string>;
    /** Маппинг column_name → table_column_name (для записи стилей) */
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
    /** Мета для колонки стилей */
    stylesColumnMeta?: StylesColumnMeta;
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
                            }: UseMainCrudDeps) {
    const [isAdding, setIsAdding] = useState(false);
    const [draft, setDraft] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);

    const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<Record<number, string>>({});
    const [editSaving, setEditSaving] = useState(false);

    const [deletingRowIdx, setDeletingRowIdx] = useState<number | null>(null);

    // ← NEW: draft для стилей ячеек (ключи — column_name)
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
                        alert('Для этой таблицы не настроен INSERT QUERY. Задайте его в метаданных таблицы.');
                    } else if (kind === 'update') {
                        alert('Для этой таблицы не настроен UPDATE QUERY. Задайте его в метаданных таблицы.');
                    } else {
                        alert('Для этой таблицы не настроен DELETE QUERY. Задайте его в метаданных таблицы.');
                    }
                    return { ok: false };
                }
            } catch {
                // префлайт не критичен
            }

            return { ok: true, formId };
        },
        [selectedWidget, preflightTableId, getEffectiveFormId, getEffectiveWidgetId]
    );

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

    // ───────── Добавление ─────────
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

            log('submitAdd → allWriteIds', allWriteIds);
            log('submitAdd → values[] (with null for empty combobox)', values);

            const body = { pk: { primary_keys: {} as Record<string, string> }, values };
            const url = `/data/${pf.formId}/${wid}`;
            log('submitAdd → request', { url, body });

            try {
                await api.post(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 403) {
                    console.warn('[submitEdit] 403 Forbidden', { url, body, detail });
                    alert('У вас не хватает прав на добавление новой записи');
                    return;
                }

                if (status === 404 && String(detail).includes('Insert query not found')) {
                    alert('Для этой таблицы не настроен INSERT QUERY. Задайте его в метаданных таблицы.');
                    return;
                }
                if (status === 404) {
                    await api.post(`${url}/`, body);
                } else if (status === 422) {
                    console.error('[submitAdd] 422 от бэка', { detail, body });
                    alert(
                        `Не удалось добавить строку (422).\n` +
                        `detail: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
                    );
                    return;
                } else {
                    throw err;
                }
            }

            const { data } = await api.post<FormDisplay>(`/display/${pf.formId}/main`, activeFilters);
            setFormDisplay(data);
            await reloadTree();

            setIsAdding(false);
            setDraft({});
            setEditStylesDraft({});
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(
                `Не удалось добавить строку: ${status ?? ''} ${
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
        activeFilters,
        setFormDisplay,
        reloadTree,
        flatColumnsInRenderOrder,
    ]);

    // ───────── Редактирование ─────────
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
            for (let i = 0; i < groups.length; i += 1) {
                const g = groups[i];
                try {
                    const options = await loadComboOptionsOnce(g.wcId, g.writeTcId);

                    const tokens: string[] = g.tokens.map((t: string) => t.toLowerCase());

                    let bestId: string | null = null;
                    let bestScore = 0;
                    let bestCount = 0;

                    for (let j = 0; j < options.length; j += 1) {
                        const o = options[j];
                        const hay: string[] = o.showHidden.map((x: string) => x.toLowerCase());
                        const score = tokens.reduce(
                            (acc: number, t: string) => acc + (hay.includes(t) ? 1 : 0),
                            0
                        );
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

            log('startEdit → init editDraft (с авто-map combobox)', { rowIdx, init });
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
            const pkToString = (pk: Record<string, unknown>) =>
                Object.keys(pk)
                    .sort()
                    .map((k) => `${k}:${String(pk[k])}`)
                    .join('|');

            const getSendingValue = (raw: unknown): string | null => {
                const s = raw == null ? '' : String(raw).trim();
                return s === '' ? null : s;
            };

            const entries = Object.entries(editDraft);

            const values: Array<{ table_column_id: number; value: string | null }> = entries.map(
                ([tcIdStr, v]) => {
                    const tcId = Number(tcIdStr);
                    return {
                        table_column_id: tcId,
                        value: getSendingValue(v),
                    };
                }
            );

            // ═══════════════════════════════════════════════════════════
            // NEW: Добавляем стили в values, если есть изменения
            // ═══════════════════════════════════════════════════════════
            if (
                stylesColumnMeta?.exists &&
                stylesColumnMeta.valueIndex != null &&
                Object.keys(editStylesDraft).length > 0
            ) {
                const stylesValueIndex = stylesColumnMeta.valueIndex;

                // Находим колонку стилей для получения table_column_id
                const stylesColumn = formDisplay.columns.find((c) => c.type === 'styles');
                const stylesTcId = stylesColumn?.table_column_id;

                if (stylesTcId) {
                    // Текущие стили из строки (ключи — table_column_name)
                    const currentStylesJson = row.values[stylesValueIndex];
                    const currentStyles: Record<string, CellStyles> =
                        currentStylesJson &&
                        typeof currentStylesJson === 'object' &&
                        !Array.isArray(currentStylesJson)
                            ? { ...(currentStylesJson as Record<string, CellStyles>) }
                            : {};

                    // Мержим с draft, конвертируя column_name → table_column_name
                    const columnNameToTableColumnName = stylesColumnMeta.columnNameToTableColumnName;

                    Object.entries(editStylesDraft).forEach(([columnName, style]) => {
                        // Конвертируем column_name ("Комментарий") → table_column_name ("description")
                        const tableColumnName = columnNameToTableColumnName?.get(columnName) ?? columnName;

                        if (style === null) {
                            delete currentStyles[tableColumnName];
                        } else {
                            currentStyles[tableColumnName] = style;
                        }
                    });

                    // Добавляем в values
                    const stylesValue =
                        Object.keys(currentStyles).length > 0 ? JSON.stringify(currentStyles) : null;

                    log('submitEdit → styles update', {
                        stylesTcId,
                        editStylesDraft,
                        columnNameToTableColumnName: columnNameToTableColumnName ? Object.fromEntries(columnNameToTableColumnName) : null,
                        currentStyles,
                        stylesValue,
                    });

                    values.push({
                        table_column_id: stylesTcId,
                        value: stylesValue,
                    });
                }
            }
            // ═══════════════════════════════════════════════════════════

            const body = {
                pk: { primary_keys: pkObj as Record<string, string> },
                values,
            };
            const url = `/data/${pf.formId}/${wid}`;

            type BeforeAfter = {
                widget_column_id: number;
                write_tc_id: number;
                shown_before: string;
                sending_value?: string | null;
            };

            const beforeAfter: BeforeAfter[] = [];
            for (const [tcIdStr] of entries) {
                const writeTcId = Number(tcIdStr);

                const related = flatColumnsInRenderOrder.filter((c) => {
                    const w = (c.__write_tc_id ?? c.table_column_id) ?? null;
                    return w === writeTcId;
                });

                const col = related[0];
                if (col) {
                    const visKey = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                    const idx = valueIndexByKey.get(visKey);
                    const shownVal = (idx != null ? row.values[idx] : '') as string | number | null;
                    beforeAfter.push({
                        widget_column_id: col.widget_column_id,
                        write_tc_id: writeTcId,
                        shown_before: shownVal == null ? '' : String(shownVal),
                        sending_value: getSendingValue(editDraft[writeTcId]),
                    });
                } else {
                    beforeAfter.push({
                        widget_column_id: -1,
                        write_tc_id: writeTcId,
                        shown_before: '',
                        sending_value: String(editDraft[writeTcId] ?? ''),
                    });
                }
            }

            console.groupCollapsed('[CRUD][submitEdit]');
            console.log('PK:', pkObj, 'pkKey:', pkToString(pkObj));
            console.log('editDraft (raw):', editDraft);
            console.log('editStylesDraft:', editStylesDraft);
            console.log('entries (to send):', entries);
            console.log('values[] (will be sent):', values);
            console.log('request:', { url, body });
            console.log('BEFORE (shown) & SENDING values by write_tc_id:', beforeAfter);
            console.groupEnd();

            let patchRespData: unknown = null;
            try {
                const resp = await api.patch(url, body);
                patchRespData = resp?.data ?? null;
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 403) {
                    console.warn('[submitEdit] 403 Forbidden', { url, body, detail });
                    alert('У вас не хватает прав на редактирование этой записи');
                    return;
                }

                if (status === 404 && String(detail).includes('Update query not found')) {
                    alert(
                        'Для этой таблицы не настроен UPDATE QUERY. Задайте его в метаданных таблицы.'
                    );
                    return;
                }
                if (status === 404) {
                    const resp = await api.patch(`${url}/`, body);
                    patchRespData = resp?.data ?? null;
                } else {
                    throw err;
                }
            }

            console.groupCollapsed('[CRUD][submitEdit] PATCH response');
            console.log(patchRespData);
            console.groupEnd();

            const { data: newDisplay } = await api.post<FormDisplay>(
                `/display/${pf.formId}/main`,
                activeFilters
            );

            const findRowByPk = (fd: FormDisplay, pk: Record<string, unknown>) => {
                const key = (obj: Record<string, unknown>) =>
                    Object.keys(obj)
                        .sort()
                        .map((k) => `${k}:${String(obj[k])}`)
                        .join('|');
                const target = key(pk);
                for (let i = 0; i < fd.data.length; i += 1) {
                    const k = key(fd.data[i].primary_keys as Record<string, unknown>);
                    if (k === target) return fd.data[i];
                }
                return null;
            };

            const updatedRow = findRowByPk(newDisplay, pkObj);

            const after: Array<BeforeAfter & { shown_after: string }> = [];
            if (updatedRow) {
                beforeAfter.forEach((ba) => {
                    const related = flatColumnsInRenderOrder.filter((c) => {
                        const w = (c.__write_tc_id ?? c.table_column_id) ?? null;
                        return w === ba.write_tc_id;
                    });
                    const col = related[0];
                    if (col) {
                        const visKey = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                        const idx = valueIndexByKey.get(visKey);
                        const shownVal = (idx != null ? updatedRow.values[idx] : '') as
                            | string
                            | number
                            | null;
                        after.push({
                            ...ba,
                            shown_after: shownVal == null ? '' : String(shownVal),
                        });
                    } else {
                        after.push({ ...ba, shown_after: '(col not found)' });
                    }
                });
            }

            console.groupCollapsed('[CRUD][submitEdit] AFTER reload');
            console.log('new display row:', updatedRow);
            console.table(after);
            console.groupEnd();

            setFormDisplay(newDisplay);
            await reloadTree();

            setIsAdding(false);
            setDraft({});
            setEditStylesDraft({});
            cancelEdit();
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
        activeFilters,
        setFormDisplay,
        reloadTree,
        cancelEdit,
        flatColumnsInRenderOrder,
        valueIndexByKey,
    ]);

    // ───────── Удаление ─────────
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
                } catch (err: any) {
                    const status = err?.response?.status;
                    const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                    if (status === 404 && String(detail).includes('Delete query not found')) {
                        alert(
                            'Для этой таблицы не настроен DELETE QUERY. Задайте его в метаданных таблицы.'
                        );
                        return;
                    }
                    if (status === 404) {
                        await api.delete(`${url}/`, { data: body });
                    } else {
                        throw err;
                    }
                }

                const { data } = await api.post<FormDisplay>(
                    `/display/${pf.formId}/main`,
                    activeFilters
                );
                setFormDisplay(data);

                try {
                    await reloadTree();
                } catch {}

                if (pkToKey(lastPrimary) === rowKey) {
                    setLastPrimary({});
                    setSubDisplay(null);
                }
            } finally {
                setDeletingRowIdx(null);
            }
        },
        [
            getEffectiveWidgetId,
            preflightDelete,
            formDisplay.data,
            pkToKey,
            activeFilters,
            setFormDisplay,
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
        // ← NEW: экспортируем стили
        editStylesDraft,
        setEditStylesDraft,
    };
}