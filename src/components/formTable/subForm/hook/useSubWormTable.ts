import {useEffect, useMemo, useState} from 'react';
import {api} from '@/services/api';
import type {SubDisplay, DTable, Widget, FormDisplay} from '@/shared/hooks/useWorkSpaces';
import type {HeaderModelItem} from '@/components/formTable/FormTable';
import {isEditableValue} from '@/shared/utils/cellFormat';
import {useHeaderPlan} from '@/components/formTable/hooks/useHeaderPlan';

export type UseSubWormTableDeps = {
    subDisplay: SubDisplay | null;
    formId: number | null;
    currentWidgetId?: number;
    currentOrder: number | null;
    subHeaderGroups?: HeaderModelItem[];
    handleTabClick: (order: number) => void;
    setSubDisplay: React.Dispatch<React.SetStateAction<SubDisplay | null>>;
    // внешнее управление состояниями редактирования/добавления — чтобы можно было шарить между экранами
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
};

export function useSubWormTable({
                                    subDisplay,
                                    formId,
                                    currentWidgetId,
                                    currentOrder,
                                    subHeaderGroups,
                                    handleTabClick,

                                    editingRowIdx,
                                    setEditingRowIdx,
                                    editDraft,
                                    setEditDraft,
                                    editSaving,
                                    setEditSaving,
                                    isAddingSub,
                                    setIsAddingSub,
                                    draftSub,
                                    setDraftSub,
                                    setSubDisplay,
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
            setDisplayedWidgetOrder(
                subDisplay.displayed_widget?.widget_order ?? null,
            );
        }
    }, [subDisplay]);

    // ——— подготовка колонок и шапки через useHeaderPlan ———
    const pseudoFormDisplay = useMemo(() => {
        if (!subDisplay) return null;
        return {columns: subDisplay.columns} as unknown as FormDisplay;
    }, [subDisplay]);

    const {headerPlan: baseHeaderPlan, flatColumnsInRenderOrder: baseFlat} =
        useHeaderPlan(pseudoFormDisplay);

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
                cols.sort((a, b) => {
                    const ai = pos.get(a.table_column_id!) ?? Number.MAX_SAFE_INTEGER;
                    const bi = pos.get(b.table_column_id!) ?? Number.MAX_SAFE_INTEGER;
                    return ai - bi;
                });
            }

            const labels = (g.labels ?? []).slice(0, cols.length);
            while (labels.length < cols.length) labels.push('—');

            return {
                id: g.id,
                title: safe(g.title ?? base?.title ?? ''),
                labels: labels.map(safe),
                cols,
            };
        });
    }, [baseHeaderPlan, subHeaderGroups]);

    const flatColumnsInRenderOrder = useMemo(
        () => headerPlan.flatMap((g) => g.cols),
        [headerPlan]
    );

    // корректный valueIndexByKey для row.values
    const valueIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        (subDisplay?.columns ?? []).forEach((c, i) => {
            const syntheticTcId =
                c.type === 'combobox' &&
                c.combobox_column_id != null &&
                c.table_column_id != null
                    ? -1_000_000 - Number(c.combobox_column_id)
                    : c.table_column_id ?? -1;
            map.set(`${c.widget_column_id}:${syntheticTcId}`, i);
        });
        return map;
    }, [subDisplay?.columns]);

    // ——— префлайты ———
    const preflightUpdate = async (): Promise<{ ok: boolean }> => {
        if (!currentWidgetId) return {ok: false};
        try {
            const {data: widget} = await api.get<Widget>(`/widgets/${currentWidgetId}`);
            const {data: table} = await api.get<DTable>(`/tables/${widget.table_id}`);
            if (!table?.update_query?.trim()) {
                alert('Для таблицы саб-виджета не настроен UPDATE QUERY.');
                return {ok: false};
            }
        } catch (e) {
            console.warn('preflight (sub/update) failed:', e);
        }
        return {ok: true};
    };

    const preflightDelete = async (): Promise<{ ok: boolean }> => {
        if (!currentWidgetId) return {ok: false};
        try {
            const {data: widget} = await api.get<Widget>(`/widgets/${currentWidgetId}`);
            const {data: table} = await api.get<DTable>(`/tables/${widget.table_id}`);
            if (!table?.delete_query?.trim()) {
                alert('Для таблицы саб-виджета не настроен DELETE QUERY.');
                return {ok: false};
            }
        } catch (e) {
            console.warn('preflight (sub/delete) failed:', e);
        }
        return {ok: true};
    };

    // ——— редактирование ———
    const startEdit = async (rowIdx: number) => {
        if (!formId || !currentWidgetId || !subDisplay) return;
        const pf = await preflightUpdate();
        if (!pf.ok) return;

        setIsAddingSub(false);

        const row = subDisplay.data[rowIdx];
        const init: Record<number, string> = {};
        flatColumnsInRenderOrder.forEach((col) => {
            const syntheticTcId =
                col.type === 'combobox' &&
                col.combobox_column_id != null &&
                col.table_column_id != null
                    ? -1_000_000 - Number(col.combobox_column_id)
                    : col.table_column_id ?? -1;
            const key = `${col.widget_column_id}:${syntheticTcId}`;
            const idx = valueIndexByKey.get(key);
            const val = idx != null ? row.values[idx] : '';
            if (col.table_column_id != null && isEditableValue(val)) {
                init[col.table_column_id] = String(val ?? '');
            }
        });

        setEditingRowIdx(rowIdx);
        setEditDraft(init);
    };

    const cancelEdit = () => {
        setEditingRowIdx(null);
        setEditDraft({});
        setEditSaving(false);
    };

    const submitEdit = async () => {
        if (editingRowIdx == null || !formId || !currentWidgetId || !subDisplay) return;
        const pf = await preflightUpdate();
        if (!pf.ok) return;

        setEditSaving(true);
        try {
            const row = subDisplay.data[editingRowIdx];
            const values = Object.entries(editDraft).map(([table_column_id, value]) => {
                const s = value == null ? '' : String(value).trim();
                return {
                    table_column_id: Number(table_column_id),
                    value: s === '' ? null : s, // пустое → null
                };
            });

            const body = {
                pk: {
                    primary_keys: Object.fromEntries(
                        Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
                    ),
                },
                values,
            };

            const url = `/data/${formId}/${currentWidgetId}`;
            try {
                await api.patch(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 403) {
                    console.warn('[submitEdit] 403 Forbidden', { url, body, detail });
                    alert('У вас не хватает прав на редактирование записи');
                    return; // не валим дальше, не делаем reload
                }
                if (status === 404 && String(detail).includes('Update query not found')) {
                    alert('Для саб-формы не настроен UPDATE QUERY. Задайте его и повторите.');
                    return;
                }
                if (status === 404) {
                    await api.patch(`${url}/`, body);
                } else {
                    throw err;
                }
            }

            if (currentOrder != null) handleTabClick(currentOrder);
            cancelEdit();
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(
                `Не удалось обновить строку: ${status ?? ''} ${
                    typeof msg === 'string' ? msg : JSON.stringify(msg)
                }`
            );
        } finally {
            setEditSaving(false);
        }
    };

    // ——— удаление ———
    const deleteRow = async (rowIdx: number) => {
        if (!formId || !currentWidgetId || !subDisplay) return;
        const pf = await preflightDelete();
        if (!pf.ok) return;

        const row = subDisplay.data[rowIdx];
        const pkObj = Object.fromEntries(
            Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
        );
        const pkLabel = Object.entries(pkObj)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');

        if (!window.confirm(`Удалить запись (${pkLabel})?`)) return;

        setDeletingRowIdx(rowIdx);
        try {
            const body = {primary_keys: pkObj};
            const url = `/data/${formId}/${currentWidgetId}`;

            try {
                await api.delete(url, {data: body});
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 404 && String(detail).includes('Delete query not found')) {
                    alert('Для саб-формы не настроен DELETE QUERY. Задайте его и повторите.');
                    return;
                }
                if (status === 404) {
                    await api.delete(`${url}/`, {data: body});
                } else {
                    throw err;
                }
            }

            if (currentOrder != null) handleTabClick(currentOrder);
            if (editingRowIdx === rowIdx) cancelEdit();
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(
                `Не удалось удалить строку: ${status ?? ''} ${
                    typeof msg === 'string' ? msg : JSON.stringify(msg)
                }`
            );
        } finally {
            setDeletingRowIdx(null);
        }
    };

    return {
        // состояние
        deletingRowIdx,
        setDeletingRowIdx,
        showSubHeaders,
        setShowSubHeaders,
        hasTabs,
        safe,

        // план шапки/колонки/индексы значений
        headerPlan,
        flatColumnsInRenderOrder,
        valueIndexByKey,


        tabs,
        displayedWidgetOrder,

        // действия
        startEdit,
        cancelEdit,
        submitEdit,
        deleteRow,

        // проброс для UI добавления (как и было)
        isAddingSub,
        setIsAddingSub,
        draftSub,
        setDraftSub,

        // проброс редактирования
        editingRowIdx,
        setEditingRowIdx,
        editDraft,
        setEditDraft,
        editSaving,
        setEditSaving,
    };
}
