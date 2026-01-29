import { useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { SubDisplay, DTable, Widget, FormDisplay } from '@/shared/hooks/useWorkSpaces';
import type { HeaderModelItem } from '@/components/Form/formTable/FormTable';
import { isEditableValue } from '@/shared/utils/cellFormat';
import { useHeaderPlan } from '@/components/Form/formTable/hooks/useHeaderPlan';
import { loadComboOptionsOnce } from '@/components/Form/mainTable/InputCell';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import { validateEditDraft } from '@/shared/utils/requiredValidation/requiredValidation';
import {
    isSameComboGroup,
    getWriteTcIdForComboGroup,
    groupComboColumns,
    parseCheckboxFromDisplay,
    normalizeCheckboxValue,
} from '@/shared/utils/comboGroupUtils';

export type UseSubWormTableDeps = {
    subDisplay: SubDisplay | null;
    formId: number | null;
    currentWidgetId?: number;
    currentOrder: number | null;
    subHeaderGroups?: HeaderModelItem[];
    handleTabClick: (order: number) => void;
    setSubDisplay?: React.Dispatch<React.SetStateAction<SubDisplay | null>>;
    editingRowIdx: number | null;
    setEditingRowIdx: React.Dispatch<React.SetStateAction<number | null>>;
    editDraft: Record<number, string>;
    setEditDraft: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    editSaving: boolean;
    setEditSaving: React.Dispatch<React.SetStateAction<boolean>>;
    isAddingSub: boolean;
    setIsAddingSub: React.Dispatch<React.SetStateAction<boolean>>;
    draftSub: Record<number, string>;
    setDraftSub: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    showSubValidationErrors?: boolean;
    setShowSubValidationErrors?: React.Dispatch<React.SetStateAction<boolean>>;
    setSubValidationMissingFields?: React.Dispatch<React.SetStateAction<string[]>>;
    resetSubValidation?: () => void;
};

const SYNTHETIC_MIN = -1_000_000;
const isSyntheticComboboxId = (tcId: number): boolean => tcId <= SYNTHETIC_MIN;

export function useSubWormTable({
                                    subDisplay, formId, currentWidgetId, currentOrder, subHeaderGroups, handleTabClick,
                                    editingRowIdx, setEditingRowIdx, editDraft, setEditDraft, editSaving, setEditSaving,
                                    isAddingSub, setIsAddingSub, draftSub, setDraftSub,
                                    showSubValidationErrors, setShowSubValidationErrors, setSubValidationMissingFields, resetSubValidation,
                                }: UseSubWormTableDeps) {
    const [deletingRowIdx, setDeletingRowIdx] = useState<number | null>(null);
    const [showSubHeaders, setShowSubHeaders] = useState(false);
    const [tabs, setTabs] = useState<SubDisplay['sub_widgets'] | null>(null);
    const [displayedWidgetOrder, setDisplayedWidgetOrder] = useState<number | null>(null);

    const hasTabs = !!tabs?.length;
    const safe = (v?: string | null) => (v && v.trim() ? v.trim() : '—');

    useEffect(() => {
        if (subDisplay?.sub_widgets?.length) {
            setTabs(subDisplay.sub_widgets);
            setDisplayedWidgetOrder(subDisplay.displayed_widget?.widget_order ?? null);
        }
    }, [subDisplay]);

    const pseudoFormDisplay = useMemo(() => subDisplay ? { columns: subDisplay.columns } as unknown as FormDisplay : null, [subDisplay]);
    const { headerPlan: baseHeaderPlan } = useHeaderPlan(pseudoFormDisplay);

    const headerPlan = useMemo(() => {
        if (!baseHeaderPlan) return [];
        if (!subHeaderGroups?.length) return baseHeaderPlan;
        const byId = new Map(baseHeaderPlan.map((g) => [g.id, g]));
        return subHeaderGroups.map((g) => {
            const base = byId.get(g.id);
            let cols = [...(base?.cols ?? [])];
            if (g.refIds?.length) {
                const pos = new Map<number, number>();
                g.refIds.forEach((id, i) => pos.set(id, i));
                cols.sort((a, b) => (pos.get(a.table_column_id!) ?? Infinity) - (pos.get(b.table_column_id!) ?? Infinity));
            }
            const labels = (g.labels ?? []).slice(0, cols.length);
            while (labels.length < cols.length) labels.push('—');
            return { id: g.id, title: safe(g.title ?? base?.title ?? ''), labels: labels.map(safe), cols };
        });
    }, [baseHeaderPlan, subHeaderGroups]);

    const flatColumnsInRenderOrder = useMemo(() => headerPlan.flatMap((g) => g.cols), [headerPlan]);
    const subColumnsAsExtCol = useMemo(() => (subDisplay?.columns ?? []) as ExtCol[], [subDisplay?.columns]);

    const subColumnsById = useMemo(() => {
        const map = new Map<number, SubDisplay['columns'][number]>();
        (subDisplay?.columns ?? []).forEach((c) => { if (c.table_column_id != null) map.set(c.table_column_id as number, c); });
        return map;
    }, [subDisplay?.columns]);

    const valueIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        (subDisplay?.columns ?? []).forEach((c, i) => {
            const syntheticTcId = c.type === 'combobox' && c.combobox_column_id != null && c.table_column_id != null
                ? -1_000_000 - Number(c.combobox_column_id) : c.table_column_id ?? -1;
            map.set(`${c.widget_column_id}:${syntheticTcId}`, i);
        });
        return map;
    }, [subDisplay?.columns]);

    const preflightUpdate = async (): Promise<{ ok: boolean }> => {
        if (!currentWidgetId) return { ok: false };
        try {
            const { data: widget } = await api.get<Widget>(`/widgets/${currentWidgetId}`);
            const { data: table } = await api.get<DTable>(`/tables/${widget.table_id}`);
            if (!table?.update_query?.trim()) { alert('Для таблицы саб-виджета не настроен UPDATE QUERY.'); return { ok: false }; }
        } catch (e) { console.warn('preflight (sub/update) failed:', e); }
        return { ok: true };
    };

    const preflightDelete = async (): Promise<{ ok: boolean }> => {
        if (!currentWidgetId) return { ok: false };
        try {
            const { data: widget } = await api.get<Widget>(`/widgets/${currentWidgetId}`);
            const { data: table } = await api.get<DTable>(`/tables/${widget.table_id}`);
            if (!table?.delete_query?.trim()) { alert('Для таблицы саб-виджета не настроен DELETE QUERY.'); return { ok: false }; }
        } catch (e) { console.warn('preflight (sub/delete) failed:', e); }
        return { ok: true };
    };

    const startEdit = async (rowIdx: number) => {
        if (!formId || !currentWidgetId || !subDisplay) return;
        const pf = await preflightUpdate();
        if (!pf.ok) return;
        setIsAddingSub(false);
        resetSubValidation?.();

        const row = subDisplay.data[rowIdx];
        const init: Record<number, string> = {};

        // ═══════════════════════════════════════════════════════════
        // ИСПРАВЛЕНО: Группируем combobox колонки как в MainTable
        // ═══════════════════════════════════════════════════════════
        const comboGroups = groupComboColumns(flatColumnsInRenderOrder);
        const processedWriteTcIds = new Set<number>();

        // Сначала обрабатываем НЕ-combobox колонки
        for (const col of flatColumnsInRenderOrder) {
            if (col.type === 'rls') continue;
            if (col.type === 'combobox') continue; // combobox обработаем отдельно

            const writeTcId = (col as any).__write_tc_id ?? col.table_column_id ?? null;
            if (writeTcId == null || isSyntheticComboboxId(writeTcId)) continue;
            if (processedWriteTcIds.has(writeTcId)) continue;

            const syntheticTcId = col.table_column_id ?? -1;
            const key = `${col.widget_column_id}:${syntheticTcId}`;
            const idx = valueIndexByKey.get(key);
            const val = idx != null ? row.values[idx] : '';
            const shownStr = val == null ? '' : String(val).trim();

            const isTriState = col.type === 'checkboxNull';
            const isCheckbox = col.type === 'checkbox' || col.type === 'bool';

            if (isTriState || isCheckbox) {
                init[writeTcId] = parseCheckboxFromDisplay(val, isTriState);
            } else if (isEditableValue(val)) {
                init[writeTcId] = shownStr;
            }

            processedWriteTcIds.add(writeTcId);
        }

        // Теперь обрабатываем combobox группы — собираем токены для каждой группы
        const comboGroupsWithTokens: Array<{ wcId: number; writeTcId: number; tokens: string[] }> = [];

        comboGroups.forEach((group, _groupKey) => {
            if (processedWriteTcIds.has(group.writeTcId)) return;

            const tokens: string[] = [];

            // Собираем отображаемые значения из ВСЕХ колонок группы
            for (const col of group.columns) {
                const syntheticTcId = col.combobox_column_id != null && col.table_column_id != null
                    ? -1_000_000 - Number(col.combobox_column_id)
                    : col.table_column_id ?? -1;

                const key = `${col.widget_column_id}:${syntheticTcId}`;
                const idx = valueIndexByKey.get(key);
                const val = idx != null ? row.values[idx] : '';
                const shownStr = val == null ? '' : String(val).trim();

                if (shownStr) tokens.push(shownStr);
            }

            comboGroupsWithTokens.push({
                wcId: group.wcId,
                writeTcId: group.writeTcId,
                tokens,
            });

            processedWriteTcIds.add(group.writeTcId);
        });

        // БАТЧИНГ: загружаем ВСЕ combobox опции ПАРАЛЛЕЛЬНО
        if (comboGroupsWithTokens.length > 0) {
            type ComboOption = { id: string; show: string[]; showHidden: string[] };
            const optionsResults = await Promise.all(
                comboGroupsWithTokens.map(g => loadComboOptionsOnce(g.wcId, g.writeTcId).catch((): ComboOption[] => []))
            );

            comboGroupsWithTokens.forEach((g, i) => {
                const options = optionsResults[i];
                const tokens = g.tokens.map((t) => t.toLowerCase());
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
                        const hay = [...o.show, ...o.showHidden].map((x) => x.toLowerCase());
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
    };

    const cancelEdit = () => { setEditingRowIdx(null); setEditDraft({}); setEditSaving(false); resetSubValidation?.(); };

    const submitEdit = async () => {
        if (editingRowIdx == null || !formId || !currentWidgetId || !subDisplay) return;
        const row = subDisplay.data[editingRowIdx];
        const validation = validateEditDraft(editDraft, row, subColumnsAsExtCol, valueIndexByKey);
        if (!validation.isValid) { setShowSubValidationErrors?.(true); setSubValidationMissingFields?.(validation.missingFields); return; }
        const pf = await preflightUpdate();
        if (!pf.ok) return;

        setEditSaving(true);
        try {
            const values = Object.entries(editDraft)
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
                    const s = value == null ? '' : String(value).trim();
                    const isTriState = (col as any)?.type === 'checkboxNull';
                    const isCheckbox = (col as any)?.type === 'checkbox' || (col as any)?.type === 'bool';

                    if (isTriState || isCheckbox) {
                        return { table_column_id: tcId, value: normalizeCheckboxValue(s, isTriState) };
                    }
                    return { table_column_id: tcId, value: s === '' ? null : s };
                });

            const body = { pk: { primary_keys: Object.fromEntries(Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])) }, values };
            const url = `/data/${formId}/${currentWidgetId}`;

            try {
                await api.patch(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 403) { alert('У вас не хватает прав на редактирование записи'); return; }
                if (status === 404 && String(detail).includes('Update query not found')) { alert('Для саб-формы не настроен UPDATE QUERY.'); return; }
                throw err;
            }

            if (currentOrder != null) handleTabClick(currentOrder);
            cancelEdit();
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(`Не удалось обновить строку: ${status ?? ''} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        } finally {
            setEditSaving(false);
        }
    };

    const deleteRow = async (rowIdx: number) => {
        if (!formId || !currentWidgetId || !subDisplay) return;
        const pf = await preflightDelete();
        if (!pf.ok) return;
        const row = subDisplay.data[rowIdx];
        const pkObj = Object.fromEntries(Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)]));
        const pkLabel = Object.entries(pkObj).map(([k, v]) => `${k}=${v}`).join(', ');
        if (!window.confirm(`Удалить запись (${pkLabel})?`)) return;

        setDeletingRowIdx(rowIdx);
        try {
            const body = { primary_keys: pkObj };
            const url = `/data/${formId}/${currentWidgetId}`;
            try {
                await api.delete(url, { data: body });
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 404 && String(detail).includes('Delete query not found')) { alert('Для саб-формы не настроен DELETE QUERY.'); return; }
                throw err;
            }
            if (currentOrder != null) handleTabClick(currentOrder);
            if (editingRowIdx === rowIdx) cancelEdit();
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(`Не удалось удалить строку: ${status ?? ''} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        } finally {
            setDeletingRowIdx(null);
        }
    };

    return {
        deletingRowIdx, showSubHeaders, setShowSubHeaders, hasTabs, safe,
        headerPlan, flatColumnsInRenderOrder, valueIndexByKey,
        tabs, displayedWidgetOrder,
        startEdit, cancelEdit, submitEdit, deleteRow,
        isAddingSub, setIsAddingSub, draftSub, setDraftSub,
        editingRowIdx, setEditingRowIdx, editDraft, setEditDraft, editSaving, setEditSaving,
    };
}