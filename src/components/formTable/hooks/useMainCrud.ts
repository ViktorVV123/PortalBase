import {useCallback, useState} from 'react';
import {api} from '@/services/api';
import type {DTable, FormDisplay, Widget} from '@/shared/hooks/useWorkSpaces';

type EnsureQueryKind = 'insert' | 'update' | 'delete';

export type UseMainCrudDeps = {
    formDisplay: FormDisplay;
    selectedWidget: Widget | null;
    selectedFormId: number | null;
    formsByWidget: Record<number, { form_id: number }>;
    activeFilters: Array<{ table_column_id: number; value: string | number }>;
    setFormDisplay: (v: FormDisplay) => void;
    reloadTree: () => Promise<void>;
    isColReadOnly: (col: FormDisplay['columns'][number]) => boolean;
    flatColumnsInRenderOrder: FormDisplay['columns'];
    valueIndexByKey: Map<string, number>;
    setSubDisplay: (v: null) => void;
    pkToKey: (pk: Record<string, unknown>) => string;
    lastPrimary: Record<string, unknown>;
    setLastPrimary: (v: Record<string, unknown>) => void;
    // важно: чтобы можно было делать setSelectedKey(prev => ...):
    setSelectedKey: React.Dispatch<React.SetStateAction<string | null>>;
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
                                setSelectedKey,
                            }: UseMainCrudDeps) {
    const [isAdding, setIsAdding] = useState(false);
    const [draft, setDraft] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);

    const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<Record<number, string>>({});
    const [editSaving, setEditSaving] = useState(false);

    const [deletingRowIdx, setDeletingRowIdx] = useState<number | null>(null);

    const getEffectiveFormId = useCallback((): number | null => {
        if (selectedFormId != null) return selectedFormId;
        if (!selectedWidget) return null;
        return formsByWidget[selectedWidget.id]?.form_id ?? null;
    }, [selectedFormId, selectedWidget, formsByWidget]);

    const ensureQuery = useCallback(
        async (kind: EnsureQueryKind): Promise<{ ok: boolean; formId?: number }> => {
            if (!selectedWidget) return { ok: false };
            const formId = getEffectiveFormId();
            if (!formId) return { ok: false };

            try {
                const { data: table } = await api.get<DTable>(`/tables/${selectedWidget.table_id}`);
                const q =
                    kind === 'insert'
                        ? table?.insert_query
                        : kind === 'update'
                            ? table?.update_query
                            : table?.delete_query;

                if (!q || !q.trim()) {
                    // 🔔 требуемые алерты
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
                // мягко глотаем сетевые ошибки префлайта
            }

            return { ok: true, formId };
        },
        [selectedWidget, getEffectiveFormId]
    );

    const preflightInsert = useCallback(() => ensureQuery('insert'), [ensureQuery]);
    const preflightUpdate = useCallback(() => ensureQuery('update'), [ensureQuery]);
    const preflightDelete = useCallback(() => ensureQuery('delete'), [ensureQuery]);

    const startAdd = useCallback(async () => {
        const pf = await preflightInsert();
        if (!pf.ok) return;
        setIsAdding(true);
        setEditingRowIdx(null);
        const init: Record<number, string> = {};
        flatColumnsInRenderOrder.forEach((c) => {
            if (c.table_column_id != null && !isColReadOnly(c)) init[c.table_column_id] = '';
        });
        setDraft(init);
    }, [preflightInsert, flatColumnsInRenderOrder, isColReadOnly]);

    const cancelAdd = useCallback(() => {
        setIsAdding(false);
        setDraft({});
    }, []);

    const submitAdd = useCallback(async () => {
        if (!selectedWidget) return;
        const pf = await preflightInsert();
        if (!pf.ok || !pf.formId) return;

        setSaving(true);
        try {
            const values = Object.entries(draft)
                .filter(([, v]) => v !== '' && v !== undefined && v !== null)
                .map(([table_column_id, value]) => ({
                    table_column_id: Number(table_column_id),
                    value: String(value),
                }));

            const body = { pk: {}, values };
            const url = `/data/${pf.formId}/${selectedWidget.id}`;

            try {
                await api.post(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail =
                    err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                // 🔔 404 «Insert query not found»
                if (status === 404 && String(detail).includes('Insert query not found')) {
                    alert('Для этой таблицы не настроен INSERT QUERY. Задайте его в метаданных таблицы.');
                    return;
                }
                if (status === 404) {
                    await api.post(`${url}/`, body);
                } else {
                    throw err;
                }
            }

            const { data } = await api.post<FormDisplay>(`/display/${pf.formId}/main`, activeFilters);
            setFormDisplay(data);
            await reloadTree();
            setIsAdding(false);
            setDraft({});
        } finally {
            setSaving(false);
        }
    }, [selectedWidget, preflightInsert, draft, activeFilters, setFormDisplay, reloadTree]);

    const startEdit = useCallback(
        async (rowIdx: number) => {
            const pf = await preflightUpdate();
            if (!pf.ok) return;
            setIsAdding(false);

            const row = formDisplay.data[rowIdx];
            const init: Record<number, string> = {};
            flatColumnsInRenderOrder.forEach((col) => {
                const k = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                const idx = valueIndexByKey.get(k);
                const val = idx != null ? row.values[idx] : '';
                if (col.table_column_id != null && !isColReadOnly(col)) {
                    init[col.table_column_id] = (val ?? '').toString();
                }
            });
            setEditingRowIdx(rowIdx);
            setEditDraft(init);
        },
        [preflightUpdate, formDisplay.data, flatColumnsInRenderOrder, valueIndexByKey, isColReadOnly]
    );

    const cancelEdit = useCallback(() => {
        setEditingRowIdx(null);
        setEditDraft({});
        setEditSaving(false);
    }, []);

    const submitEdit = useCallback(async () => {
        if (editingRowIdx == null || !selectedWidget) return;
        const pf = await preflightUpdate();
        if (!pf.ok || !pf.formId) return;

        setEditSaving(true);
        try {
            const row = formDisplay.data[editingRowIdx];
            const values = Object.entries(editDraft)
                .filter(([, v]) => v !== '' && v !== undefined && v !== null)
                .map(([table_column_id, value]) => ({
                    table_column_id: Number(table_column_id),
                    value: String(value),
                }));

            const body = {
                pk: {
                    primary_keys: Object.fromEntries(
                        Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
                    ),
                },
                values,
            };

            const url = `/data/${pf.formId}/${selectedWidget.id}`;
            try {
                await api.patch(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail =
                    err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                // 🔔 404 «Update query not found»
                if (status === 404 && String(detail).includes('Update query not found')) {
                    alert('Для этой таблицы не настроен UPDATE QUERY. Задайте его в метаданных таблицы.');
                    return;
                }
                if (status === 404) {
                    await api.patch(`${url}/`, body);
                } else {
                    throw err;
                }
            }

            const { data } = await api.post<FormDisplay>(`/display/${pf.formId}/main`, activeFilters);
            setFormDisplay(data);
            await reloadTree();

            setIsAdding(false);
            setDraft({});
            cancelEdit();
        } finally {
            setEditSaving(false);
        }
    }, [
        editingRowIdx,
        selectedWidget,
        preflightUpdate,
        formDisplay.data,
        editDraft,
        activeFilters,
        setFormDisplay,
        reloadTree,
        cancelEdit,
    ]);

    const deleteRow = useCallback(
        async (rowIdx: number) => {
            if (!selectedWidget) return;
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
                const url = `/data/${pf.formId}/${selectedWidget.id}`;

                try {
                    await api.delete(url, { data: body });
                } catch (err: any) {
                    const status = err?.response?.status;
                    const detail =
                        err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                    // 🔔 404 «Delete query not found»
                    if (status === 404 && String(detail).includes('Delete query not found')) {
                        alert('Для этой таблицы не настроен DELETE QUERY. Задайте его в метаданных таблицы.');
                        return;
                    }
                    if (status === 404) {
                        await api.delete(`${url}/`, { data: body });
                    } else {
                        throw err;
                    }
                }

                const { data } = await api.post<FormDisplay>(`/display/${pf.formId}/main`, activeFilters);
                setFormDisplay(data);

                if (pkToKey(lastPrimary) === rowKey) {
                    setLastPrimary({});
                    setSubDisplay(null);
                }
            } finally {
                setDeletingRowIdx(null);
            }
        },
        [
            selectedWidget,
            preflightDelete,
            formDisplay.data,
            pkToKey,
            activeFilters,
            setFormDisplay,
            lastPrimary,
            setSubDisplay,
            setSelectedKey,
        ]
    );

    return {
        // state
        isAdding,
        draft,
        saving,
        editingRowIdx,
        editDraft,
        editSaving,
        deletingRowIdx,
        // handlers
        startAdd,
        cancelAdd,
        submitAdd,
        startEdit,
        cancelEdit,
        submitEdit,
        deleteRow,
        setDraft,
        setEditDraft,
    };
}
