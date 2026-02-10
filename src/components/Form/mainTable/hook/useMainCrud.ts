// useMainCrud.ts — с батчингом combobox, валидацией required полей и автозаполнением
import { useCallback, useState, useRef, useEffect } from 'react';
import { api } from '@/services/api';
import type { DTable, FormDisplay, Widget, WidgetForm } from '@/shared/hooks/useWorkSpaces';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import { loadComboOptionsOnce, normalizeValueForColumn } from '@/components/Form/mainTable/InputCell';
import type { CellStyles } from '@/components/Form/mainTable/CellStylePopover';
import {
    validateAddDraft,
    validateEditDraft,
} from '@/shared/utils/requiredValidation/requiredValidation';

const DEBUG_MAINCRUD = true; // ← ВКЛЮЧЕНО для отладки
const log = (label: string, payload?: unknown) => {
    if (!DEBUG_MAINCRUD) return;
    console.groupCollapsed(`[CRUD] ${label}`);
    if (payload !== undefined) console.log(payload);
    console.groupEnd();
};

type EnsureQueryKind = 'insert' | 'update' | 'delete';

export type StylesColumnMeta = {
    exists: boolean;
    valueIndex: number | null;
    tableColumnNameMap: Map<string, string>;
    columnNameToTableColumnName: Map<string, string>;
} | null;

/** Кэш метаданных таблицы — загружается один раз при открытии формы */
export type TableMetaCache = {
    tableId: number;
    hasInsertQuery: boolean;
    hasUpdateQuery: boolean;
    hasDeleteQuery: boolean;
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
    /** @deprecated Используй tableMetaCache */
    preflightTableId?: number | null;
    /** NEW: Кэш метаданных таблицы (tableId + флаги queries) */
    tableMetaCache?: TableMetaCache;
    stylesColumnMeta?: StylesColumnMeta;
    resetFilters?: () => Promise<void>;
    setActiveFilters?: React.Dispatch<React.SetStateAction<Array<{ table_column_id: number; value: string | number }>>>;
    onResetTreeDrawer?: () => void;
};

// ═══════════════════════════════════════════════════════════
// УТИЛИТЫ для нормализации checkbox (вынесено для DRY)
// ═══════════════════════════════════════════════════════════
function normalizeCheckboxValue(value: string, isTriState: boolean): string | null {
    const s = value.trim().toLowerCase();
    const isTrue = ['true', '1', 't', 'yes', 'да'].includes(s);

    if (isTriState) {
        if (s === 'null' || s === '') return null;
        return isTrue ? 'true' : 'false';
    }
    return isTrue ? 'true' : 'false';
}

function parseCheckboxFromDisplay(value: unknown, isTriState: boolean): string {
    const s = value == null ? '' : String(value).trim().toLowerCase();
    const isTrue = ['true', '1', 't', 'yes', 'да'].includes(s);

    if (isTriState) {
        if (value === null || value === undefined || s === '') return 'null';
        return isTrue ? 'true' : 'false';
    }
    return isTrue ? 'true' : 'false';
}

export function useMainCrud({
                                formDisplay, selectedWidget, selectedFormId, formsByWidget, activeFilters,
                                setFormDisplay, reloadTree, isColReadOnly, flatColumnsInRenderOrder,
                                valueIndexByKey, setSubDisplay, pkToKey, lastPrimary, setLastPrimary,
                                formsById, setSelectedKey, preflightTableId, tableMetaCache, stylesColumnMeta,
                                resetFilters, setActiveFilters, onResetTreeDrawer,
                            }: UseMainCrudDeps) {
    const [isAdding, setIsAdding] = useState(false);
    const [draft, setDraft] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);
    const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<Record<number, string>>({});
    const [editSaving, setEditSaving] = useState(false);
    const [deletingRowIdx, setDeletingRowIdx] = useState<number | null>(null);
    const [editStylesDraft, setEditStylesDraft] = useState<Record<string, CellStyles | null>>({});
    const [showValidationErrors, setShowValidationErrors] = useState(false);
    const [validationMissingFields, setValidationMissingFields] = useState<string[]>([]);
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
        if (selectedWidget?.id) return selectedWidget.id;
        if ((formDisplay as any)?.main_widget_id != null) return (formDisplay as any).main_widget_id;
        if ((formDisplay as any)?.widget_id != null) return (formDisplay as any).widget_id;

        if (formId != null) {
            const form = formsById[formId];
            if (form) {
                if (typeof (form as any).widget_id === 'number') return (form as any).widget_id;
                if (typeof (form as any).main_widget_id === 'number') return (form as any).main_widget_id;
            }
            for (const [widStr, f] of Object.entries(formsByWidget)) {
                if (f?.form_id === formId) {
                    const wid = Number(widStr);
                    if (!Number.isNaN(wid)) return wid;
                }
            }
        }
        return null;
    }, [selectedWidget, selectedFormId, formsById, formsByWidget, formDisplay, getEffectiveFormId]);

    const reloadDisplay = useCallback(async (formId: number, useFilters: boolean = false) => {
        if (unmountedRef.current) return;

        try {
            const filters = useFilters ? activeFilters : [];
            const normalizedFilters = filters.map(f => ({
                table_column_id: f.table_column_id,
                value: String(f.value),
            }));
            const { data } = await api.post<FormDisplay>(`/display/${formId}/main`, normalizedFilters);

            if (unmountedRef.current) return;

            setFormDisplay(data);
            if (!useFilters && setActiveFilters) setActiveFilters([]);
        } catch (e: any) {
            if (unmountedRef.current) return;
            console.error('[reloadDisplay] Failed:', e);
        }
    }, [activeFilters, setFormDisplay, setActiveFilters]);

    const ensureQuery = useCallback(async (kind: EnsureQueryKind): Promise<{ ok: boolean; formId?: number }> => {
        const formId = getEffectiveFormId();
        if (!formId) return { ok: false };

        const widgetId = getEffectiveWidgetId();
        if (!widgetId && !preflightTableId && !tableMetaCache) return { ok: false };

        // ═══════════════════════════════════════════════════════════
        // ОПТИМИЗАЦИЯ: Используем кэш вместо API запросов
        // ═══════════════════════════════════════════════════════════
        if (tableMetaCache) {
            const hasQuery = kind === 'insert'
                ? tableMetaCache.hasInsertQuery
                : kind === 'update'
                    ? tableMetaCache.hasUpdateQuery
                    : tableMetaCache.hasDeleteQuery;

            if (!hasQuery) {
                const msg = kind === 'insert' ? 'INSERT' : kind === 'update' ? 'UPDATE' : 'DELETE';
                alert(`❌ Для этой таблицы не настроен ${msg} QUERY.\n\nЗадайте его в метаданных таблицы.`);
                return { ok: false };
            }
            return { ok: true, formId };
        }

        // Fallback: если кэша нет — делаем запросы (для обратной совместимости)
        try {
            let tableId: number | null = preflightTableId ?? null;
            if (!tableId) {
                const maybeTid = (selectedWidget as any)?.table_id;
                if (maybeTid) tableId = maybeTid;
            }
            if (!tableId && widgetId) {
                const { data: widgetMeta } = await api.get<{ id: number; table_id: number }>(`/widgets/${widgetId}`);
                tableId = widgetMeta?.table_id ?? null;
            }
            if (!tableId) return { ok: false };

            const { data: table } = await api.get<DTable>(`/tables/${tableId}`);
            const q = kind === 'insert' ? table?.insert_query : kind === 'update' ? table?.update_query : table?.delete_query;

            if (!q || !q.trim()) {
                const msg = kind === 'insert' ? 'INSERT' : kind === 'update' ? 'UPDATE' : 'DELETE';
                alert(`❌ Для этой таблицы не настроен ${msg} QUERY.\n\nЗадайте его в метаданных таблицы.`);
                return { ok: false };
            }
        } catch (e) {
            console.warn('[ensureQuery] Preflight check failed:', e);
        }
        return { ok: true, formId };
    }, [selectedWidget, preflightTableId, tableMetaCache, getEffectiveFormId, getEffectiveWidgetId]);

    const canMatchFilters = useCallback((draft: Record<number, string>, filters: Array<{ table_column_id: number; value: string | number }>): boolean => {
        if (filters.length === 0) return true;
        for (const filter of filters) {
            const draftValue = draft[filter.table_column_id];
            if (draftValue != null && draftValue !== '') {
                if (String(draftValue).toLowerCase().trim() !== String(filter.value).toLowerCase().trim()) return false;
            }
        }
        return true;
    }, []);

    const buildFiltersFromDraft = useCallback((draft: Record<number, string>, currentFilters: Array<{ table_column_id: number; value: string | number }>): Array<{ table_column_id: number; value: string | number }> | null => {
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

    const resetValidation = useCallback(() => {
        setShowValidationErrors(false);
        setValidationMissingFields([]);
    }, []);

    // ═══════════════════════════════════════════════════════════
    // COMBOBOX HELPERS
    // ═══════════════════════════════════════════════════════════

    function isSameComboGroup(a: ExtCol, b: ExtCol): boolean {
        if (!a || !b) return false;
        const aWrite = (a.__write_tc_id ?? a.table_column_id) ?? null;
        const bWrite = (b.__write_tc_id ?? b.table_column_id) ?? null;
        return a.type === 'combobox' && b.type === 'combobox' &&
            a.widget_column_id === b.widget_column_id &&
            aWrite != null && bWrite != null && aWrite === bWrite;
    }

    function getWriteTcIdForComboGroup(group: ExtCol[]): number | null {
        const primary = group.find((c) => c.__is_primary_combo_input) ?? group[0];
        if (primary?.__write_tc_id != null) return primary.__write_tc_id;
        for (const g of group) {
            if (g.__write_tc_id != null) return g.__write_tc_id;
        }
        return null;
    }

    const buildTableColumnToWriteIdMap = useCallback((): Map<number, number> => {
        const map = new Map<number, number>();
        for (let i = 0; i < flatColumnsInRenderOrder.length; ) {
            const c = flatColumnsInRenderOrder[i];
            if (c.type === 'combobox') {
                let j = i + 1;
                while (j < flatColumnsInRenderOrder.length && isSameComboGroup(c, flatColumnsInRenderOrder[j])) j++;
                const group = flatColumnsInRenderOrder.slice(i, j);
                const writeTcId = getWriteTcIdForComboGroup(group);
                if (writeTcId != null) {
                    map.set(writeTcId, writeTcId);
                    for (const col of group) {
                        const originalTcId = col.__write_tc_id ?? col.table_column_id;
                        if (originalTcId != null) map.set(originalTcId, writeTcId);
                    }
                }
                i = j;
                continue;
            }
            const writeTcId = (c.__write_tc_id ?? c.table_column_id) ?? null;
            const originalTcId = c.table_column_id ?? null;
            if (originalTcId != null && writeTcId != null) map.set(originalTcId, writeTcId);
            i++;
        }
        return map;
    }, [flatColumnsInRenderOrder]);

    // ═══════════════════════════════════════════════════════════
    // ДОБАВЛЕНИЕ
    // ═══════════════════════════════════════════════════════════

    const startAdd = useCallback(async () => {
        const pf = await preflightInsert();
        if (!pf.ok) return;

        // ═══════════════════════════════════════════════════════════
        // DEBUG: Логируем activeFilters чтобы понять откуда берётся значение
        // ═══════════════════════════════════════════════════════════
        log('startAdd called', {
            activeFilters,
            selectedFormId,
            flatColumnsCount: flatColumnsInRenderOrder.length,
        });

        setIsAdding(true);
        setEditingRowIdx(null);
        setEditStylesDraft({});
        resetValidation();

        const init: Record<number, string> = {};
        const seen = new Set<number>();
        const newAutoFilledFields = new Set<number>();

        for (let i = 0; i < flatColumnsInRenderOrder.length; ) {
            const c = flatColumnsInRenderOrder[i];
            if (c.type === 'combobox') {
                let j = i + 1;
                while (j < flatColumnsInRenderOrder.length && isSameComboGroup(c, flatColumnsInRenderOrder[j])) j++;
                const group = flatColumnsInRenderOrder.slice(i, j);
                const writeTcId = getWriteTcIdForComboGroup(group);
                if (writeTcId != null && !seen.has(writeTcId)) {
                    init[writeTcId] = '';
                    seen.add(writeTcId);
                }
                i = j;
                continue;
            }
            const writeTcId = (c.__write_tc_id ?? c.table_column_id) ?? null;
            if (writeTcId != null && !seen.has(writeTcId)) {
                const isTriState = c.type === 'checkboxNull';
                const isCheckbox = c.type === 'checkbox' || c.type === 'bool';
                if (isTriState) init[writeTcId] = 'null';
                else if (isCheckbox) init[writeTcId] = 'false';
                else init[writeTcId] = String(c.default ?? '');
                seen.add(writeTcId);
            }
            i++;
        }

        // ═══════════════════════════════════════════════════════════
        // АВТОЗАПОЛНЕНИЕ из activeFilters (фильтры дерева)
        // ═══════════════════════════════════════════════════════════
        if (activeFilters.length > 0) {
            log('Applying activeFilters to draft', activeFilters);

            const tableColumnToWriteId = buildTableColumnToWriteIdMap();
            for (const filter of activeFilters) {
                const writeTcId = tableColumnToWriteId.get(filter.table_column_id);
                if (writeTcId != null) {
                    log('Auto-filling field', {
                        table_column_id: filter.table_column_id,
                        writeTcId,
                        value: filter.value,
                    });
                    init[writeTcId] = String(filter.value);
                    newAutoFilledFields.add(writeTcId);
                }
            }
        }

        log('Final init draft', init);

        setDraft(init);
        setAutoFilledFields(newAutoFilledFields);
    }, [preflightInsert, flatColumnsInRenderOrder, resetValidation, activeFilters, selectedFormId, buildTableColumnToWriteIdMap]);

    const cancelAdd = useCallback(() => {
        setIsAdding(false);
        setDraft({});
        setEditStylesDraft({});
        setAutoFilledFields(new Set());
        resetValidation();
    }, [resetValidation]);

    const submitAdd = useCallback(async () => {
        if (unmountedRef.current) return;

        const validation = validateAddDraft(draft, flatColumnsInRenderOrder);
        if (!validation.isValid) {
            setShowValidationErrors(true);
            setValidationMissingFields(validation.missingFields);
            return;
        }

        const wid = getEffectiveWidgetId();
        if (!wid) return;

        const pf = await preflightInsert();
        if (!pf.ok || !pf.formId) return;

        if (unmountedRef.current) return;

        setSaving(true);
        try {
            const allWriteIds: number[] = [];
            const seen = new Set<number>();
            flatColumnsInRenderOrder.forEach((c) => {
                const w = (c.__write_tc_id ?? c.table_column_id) ?? null;
                if (w != null && !seen.has(w)) { seen.add(w); allWriteIds.push(w); }
            });

            const values = allWriteIds.map((tcId) => {
                const raw = draft[tcId];
                const s = raw == null ? '' : String(raw);
                const colForTc = flatColumnsInRenderOrder.find((c) => ((c.__write_tc_id ?? c.table_column_id) ?? null) === tcId);
                const isTriState = colForTc?.type === 'checkboxNull';
                const isCheckbox = colForTc?.type === 'checkbox' || colForTc?.type === 'bool';

                let value: string | null;
                if (isTriState || isCheckbox) {
                    value = normalizeCheckboxValue(s, !!isTriState);
                } else {
                    const normalized = normalizeValueForColumn(tcId, s, flatColumnsInRenderOrder);
                    value = normalized === '' ? null : normalized;
                }
                return { table_column_id: tcId, value };
            });

            const body = { pk: { primary_keys: {} as Record<string, string> }, values };
            const url = `/data/${pf.formId}/${wid}`;

            try {
                await api.post(url, body);
            } catch (err: any) {
                if (unmountedRef.current) return;
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 403) { alert('❌ У вас не хватает прав на добавление новой записи'); return; }
                if (status === 404 && String(detail).includes('Insert query not found')) {
                    alert('❌ Для этой таблицы не настроен INSERT QUERY.'); return;
                }
                if (status === 422) {
                    alert(`❌ Не удалось добавить строку (422).\n\n${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
                    return;
                }
                throw err;
            }

            if (unmountedRef.current) return;

            const hasFilters = activeFilters.length > 0;
            let shouldResetTreeDrawer = false;

            if (!hasFilters) {
                await reloadDisplay(pf.formId, false);
            } else {
                const matches = canMatchFilters(draft, activeFilters);
                if (matches) {
                    await reloadDisplay(pf.formId, true);
                } else {
                    const newFilters = buildFiltersFromDraft(draft, activeFilters);
                    if (newFilters && setActiveFilters) {
                        if (unmountedRef.current) return;
                        setActiveFilters(newFilters);
                        const normalizedFilters = newFilters.map(f => ({ table_column_id: f.table_column_id, value: String(f.value) }));
                        const { data } = await api.post<FormDisplay>(`/display/${pf.formId}/main`, normalizedFilters);
                        if (unmountedRef.current) return;
                        setFormDisplay(data);
                    } else {
                        await reloadDisplay(pf.formId, false);
                        if (resetFilters) await resetFilters();
                        shouldResetTreeDrawer = true;
                    }
                }
            }

            if (unmountedRef.current) return;

            await reloadTree();

            if (unmountedRef.current) return;

            if (shouldResetTreeDrawer && onResetTreeDrawer) onResetTreeDrawer();

            setIsAdding(false);
            setDraft({});
            setEditStylesDraft({});
            setAutoFilledFields(new Set());
            resetValidation();
        } catch (e: any) {
            if (unmountedRef.current) return;
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(`❌ Не удалось добавить строку: ${status ?? ''}\n\n${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        } finally {
            if (!unmountedRef.current) {
                setSaving(false);
            }
        }
    }, [getEffectiveWidgetId, preflightInsert, draft, flatColumnsInRenderOrder, activeFilters, reloadDisplay, reloadTree, resetFilters, setActiveFilters, setFormDisplay, canMatchFilters, buildFiltersFromDraft, onResetTreeDrawer, resetValidation]);

    // ═══════════════════════════════════════════════════════════
    // РЕДАКТИРОВАНИЕ (с БАТЧИНГОМ combobox запросов)
    // ═══════════════════════════════════════════════════════════

    const startEdit = useCallback(async (rowIdx: number) => {
        if (unmountedRef.current) return;

        const pf = await preflightUpdate();
        if (!pf.ok) return;

        if (unmountedRef.current) return;

        setIsAdding(false);
        setEditStylesDraft({});
        setAutoFilledFields(new Set());
        resetValidation();

        const row = formDisplay.data[rowIdx];
        const init: Record<number, string> = {};
        const comboGroups: Array<{ wcId: number; writeTcId: number; tokens: string[] }> = [];
        const comboGroupsMap = new Map<string, { wcId: number; writeTcId: number; tokens: string[] }>();

        // Первый проход: собираем все данные и combobox группы
        flatColumnsInRenderOrder.forEach((col) => {
            const writeTcId = (col.__write_tc_id ?? col.table_column_id) ?? null;
            if (writeTcId == null) return;

            const visKey = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
            const idx = valueIndexByKey.get(visKey);
            const shownVal = (idx != null ? row.values[idx] : '') as string | number | null;
            const shownStr = shownVal == null ? '' : String(shownVal).trim();

            if (col.type === 'combobox') {
                const gKey = `${col.widget_column_id}:${writeTcId}`;
                let g = comboGroupsMap.get(gKey);
                if (!g) {
                    g = { wcId: col.widget_column_id, writeTcId, tokens: [] };
                    comboGroupsMap.set(gKey, g);
                    comboGroups.push(g);
                }
                if (shownStr) g.tokens.push(shownStr);
            } else {
                const isTriState = col.type === 'checkboxNull';
                const isCheckbox = col.type === 'checkbox' || col.type === 'bool';
                if (isTriState || isCheckbox) {
                    init[writeTcId] = parseCheckboxFromDisplay(shownVal, isTriState);
                } else {
                    init[writeTcId] = shownStr;
                }
            }
        });

        // ═══════════════════════════════════════════════════════════
        // БАТЧИНГ: загружаем ВСЕ combobox опции ПАРАЛЛЕЛЬНО
        // ═══════════════════════════════════════════════════════════
        if (comboGroups.length > 0) {
            type ComboOption = { id: string; show: string[]; showHidden: string[] };
            const optionsResults = await Promise.all(
                comboGroups.map(g =>
                    loadComboOptionsOnce(g.wcId, g.writeTcId).catch((): ComboOption[] => [])
                )
            );

            if (unmountedRef.current) return;

            // Обрабатываем результаты
            comboGroups.forEach((g, i) => {
                const options = optionsResults[i];
                const tokens = g.tokens.map(t => t.toLowerCase());
                const tokensOriginal = g.tokens;

                let foundId = '';

                // Сначала ищем точное совпадение по ID
                for (const o of options) {
                    if (tokensOriginal.includes(o.id) || tokensOriginal.includes(String(o.id))) {
                        foundId = o.id;
                        break;
                    }
                }

                // Если не нашли — ищем по show/showHidden
                if (!foundId) {
                    let bestScore = 0;
                    const candidates: Array<{ id: string; score: number; exactMatch: boolean }> = [];

                    for (const o of options) {
                        const hay = [...o.show, ...o.showHidden].map(x => x.toLowerCase());
                        const score = tokens.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
                        const exactMatch = tokens.every(t => hay.includes(t));

                        if (score > 0) candidates.push({ id: o.id, score, exactMatch });
                        if (score > bestScore) bestScore = score;
                    }

                    candidates.sort((a, b) => {
                        if (a.exactMatch !== b.exactMatch) return a.exactMatch ? -1 : 1;
                        return b.score - a.score;
                    });

                    if (candidates.length > 0) foundId = candidates[0].id;
                }

                init[g.writeTcId] = foundId || '';
            });
        }

        setEditingRowIdx(rowIdx);
        setEditDraft(init);
    }, [preflightUpdate, formDisplay.data, flatColumnsInRenderOrder, valueIndexByKey, resetValidation]);

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
        if (unmountedRef.current) return;

        const row = formDisplay.data[editingRowIdx];
        const validation = validateEditDraft(editDraft, row, flatColumnsInRenderOrder, valueIndexByKey);

        if (!validation.isValid) {
            setShowValidationErrors(true);
            setValidationMissingFields(validation.missingFields);
            return;
        }

        const wid = getEffectiveWidgetId();
        if (!wid) return;

        const pf = await preflightUpdate();
        if (!pf.ok || !pf.formId) return;

        if (unmountedRef.current) return;

        setEditSaving(true);
        try {
            const pkObj = Object.fromEntries(
                Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
            );

            const values: Array<{ table_column_id: number; value: string | null }> = Object.entries(editDraft).map(([tcIdStr, v]) => {
                const tcId = Number(tcIdStr);
                const s = v == null ? '' : String(v).trim();
                const colForTc = flatColumnsInRenderOrder.find((c) => ((c.__write_tc_id ?? c.table_column_id) ?? null) === tcId);
                const isTriState = colForTc?.type === 'checkboxNull';
                const isCheckbox = colForTc?.type === 'checkbox' || colForTc?.type === 'bool';

                if (isTriState || isCheckbox) {
                    return { table_column_id: tcId, value: normalizeCheckboxValue(s, !!isTriState) };
                }
                if (s === '') return { table_column_id: tcId, value: null };
                const normalized = normalizeValueForColumn(tcId, s, flatColumnsInRenderOrder);
                return { table_column_id: tcId, value: normalized === '' ? null : normalized };
            });

            // Добавляем стили если есть
            if (stylesColumnMeta?.exists && stylesColumnMeta.valueIndex != null && Object.keys(editStylesDraft).length > 0) {
                const stylesColumn = formDisplay.columns.find((c) => c.type === 'styles');
                const stylesTcId = stylesColumn?.table_column_id;
                if (stylesTcId) {
                    const currentStylesJson = row.values[stylesColumnMeta.valueIndex];
                    const currentStyles: Record<string, CellStyles> = currentStylesJson && typeof currentStylesJson === 'object'
                        ? { ...(currentStylesJson as Record<string, CellStyles>) } : {};
                    const columnNameToTableColumnName = stylesColumnMeta.columnNameToTableColumnName;

                    Object.entries(editStylesDraft).forEach(([columnName, style]) => {
                        const tableColumnName = columnNameToTableColumnName?.get(columnName) ?? columnName;
                        if (style === null) delete currentStyles[tableColumnName];
                        else currentStyles[tableColumnName] = style;
                    });

                    const stylesValue = Object.keys(currentStyles).length > 0 ? JSON.stringify(currentStyles) : null;
                    values.push({ table_column_id: stylesTcId, value: stylesValue });
                }
            }

            const body = { pk: { primary_keys: pkObj }, values };
            const url = `/data/${pf.formId}/${wid}`;

            try {
                await api.patch(url, body);
            } catch (err: any) {
                if (unmountedRef.current) return;
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 403) { alert('❌ У вас не хватает прав на редактирование этой записи'); return; }
                if (status === 404 && String(detail).includes('Update query not found')) {
                    alert('❌ Для этой таблицы не настроен UPDATE QUERY.'); return;
                }
                throw err;
            }

            if (unmountedRef.current) return;

            await reloadDisplay(pf.formId, true);
            await reloadTree();

            if (unmountedRef.current) return;

            setIsAdding(false);
            setDraft({});
            setEditStylesDraft({});
            setAutoFilledFields(new Set());
            resetValidation();
            cancelEdit();
        } finally {
            if (!unmountedRef.current) {
                setEditSaving(false);
            }
        }
    }, [editingRowIdx, getEffectiveWidgetId, preflightUpdate, formDisplay.data, formDisplay.columns, editDraft, editStylesDraft, stylesColumnMeta, flatColumnsInRenderOrder, valueIndexByKey, reloadDisplay, reloadTree, cancelEdit, resetValidation]);

    // ═══════════════════════════════════════════════════════════
    // УДАЛЕНИЕ
    // ═══════════════════════════════════════════════════════════

    const deleteRow = useCallback(async (rowIdx: number) => {
        if (unmountedRef.current) return;

        const wid = getEffectiveWidgetId();
        if (!wid) return;

        const pf = await preflightDelete();
        if (!pf.ok || !pf.formId) return;

        if (unmountedRef.current) return;

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
                if (unmountedRef.current) return;
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 404 && String(detail).includes('Delete query not found')) {
                    alert('❌ Для этой таблицы не настроен DELETE QUERY.'); return;
                }
                throw err;
            }

            if (unmountedRef.current) return;

            await reloadDisplay(pf.formId, true);
            try { await reloadTree(); } catch {}

            if (unmountedRef.current) return;

            if (pkToKey(lastPrimary) === rowKey) {
                setLastPrimary({});
                setSubDisplay(null);
            }
        } finally {
            if (!unmountedRef.current) {
                setDeletingRowIdx(null);
            }
        }
    }, [getEffectiveWidgetId, preflightDelete, formDisplay.data, pkToKey, reloadDisplay, lastPrimary, setSubDisplay, setSelectedKey, reloadTree, setLastPrimary]);

    return {
        isAdding, draft, saving, editingRowIdx, editDraft, editSaving, deletingRowIdx,
        startAdd, cancelAdd, submitAdd, startEdit, cancelEdit, submitEdit, deleteRow,
        setDraft, setEditDraft, editStylesDraft, setEditStylesDraft,
        showValidationErrors, setShowValidationErrors, validationMissingFields, setValidationMissingFields, resetValidation,
        autoFilledFields, clearAutoFilledField,
    };
}