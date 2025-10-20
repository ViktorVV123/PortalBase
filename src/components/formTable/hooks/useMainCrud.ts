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
                    if (kind === 'insert') alert('Для этой таблицы не настроен INSERT QUERY. Задайте его в метаданных таблицы.');
                    else if (kind === 'update') alert('Для этой таблицы не настроен UPDATE QUERY. Задайте его в метаданных таблицы.');
                    else alert('Для этой таблицы не настроен DELETE QUERY. Задайте его в метаданных таблицы.');
                    return { ok: false };
                }
            } catch {
                // тихо игнорируем сетевые ошибки префлайта
            }

            return { ok: true, formId };
        },
        [selectedWidget, getEffectiveFormId]
    );

    const preflightInsert = useCallback(() => ensureQuery('insert'), [ensureQuery]);
    const preflightUpdate = useCallback(() => ensureQuery('update'), [ensureQuery]);
    const preflightDelete = useCallback(() => ensureQuery('delete'), [ensureQuery]);

    // ───────── Добавление ─────────
    const startAdd = useCallback(async () => {
        const pf = await preflightInsert();
        if (!pf.ok) return;

        setIsAdding(true);
        setEditingRowIdx(null);

        const init: Record<number, string> = {};
        flatColumnsInRenderOrder.forEach((c) => {
            if (c.table_column_id != null && !isColReadOnly(c)) {
                init[c.table_column_id] = '';
            }
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

        // values готовим ДО saving
        const values = Object.entries(draft)
            .filter(([, v]) => v !== '' && v !== undefined && v !== null)
            .filter(([table_column_id]) => {
                const col = flatColumnsInRenderOrder.find(
                    (c) => c.table_column_id === Number(table_column_id)
                );
                return col && !isColReadOnly(col);
            })
            .map(([table_column_id, value]) => ({
                table_column_id: Number(table_column_id),
                value: String(value),
            }));

        if (values.length === 0) {
            alert('Нет данных для вставки: заполни хотя бы одно редактируемое поле.');
            return;
        }

        setSaving(true);
        try {
            // ⚠️ ВАЖНО: pk ДОЛЖЕН быть с обёрткой primary_keys, как в Swagger!
            const body = {
                pk: { primary_keys: {} as Record<string, string> },
                values,
            };

            const url = `/data/${pf.formId}/${selectedWidget.id}`;

            try {
                await api.post(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 404 && String(detail).includes('Insert query not found')) {
                    alert('Для этой таблицы не настроен INSERT QUERY. Задайте его в метаданных таблицы.');
                    return;
                }
                // на бэке иногда различается маршрут со слэшем
                if (status === 404) {
                    await api.post(`${url}/`, body);
                } else if (status === 422) {
                    // подскажем явно, если снова будет не тот формат
                    alert('Не удалось добавить строку (422). Проверь форму тела: { pk: { primary_keys: {} }, values: [...] }');
                    return;
                } else {
                    throw err;
                }
            }

            // перезагружаем данные формы c учётом активных фильтров
            const { data } = await api.post<FormDisplay>(`/display/${pf.formId}/main`, activeFilters);
            setFormDisplay(data);
            await reloadTree();

            setIsAdding(false);
            setDraft({});
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(`Не удалось добавить строку: ${status ?? ''} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        } finally {
            setSaving(false);
        }
    }, [
        selectedWidget,
        preflightInsert,
        draft,
        flatColumnsInRenderOrder,
        isColReadOnly,
        activeFilters,
        setFormDisplay,
        reloadTree,
    ]);

    // ───────── Редактирование ─────────
    const startEdit = useCallback(
        async (rowIdx: number) => {
            const pf = await preflightUpdate();
            if (!pf.ok) return;
            setIsAdding(false);

            const row = formDisplay.data[rowIdx];
            const init: Record<number, string> = {};

            flatColumnsInRenderOrder.forEach((col) => {
                // ключ для combobox-колонок — как в SubWormTable
                const syntheticTcId =
                    col.type === 'combobox' &&
                    col.combobox_column_id != null &&
                    col.table_column_id != null
                        ? -1_000_000 - Number(col.combobox_column_id)
                        : (col.table_column_id ?? -1);

                const k = `${col.widget_column_id}:${syntheticTcId}`;
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
                .filter(([table_column_id]) => {
                    const col = flatColumnsInRenderOrder.find(
                        (c) => c.table_column_id === Number(table_column_id)
                    );
                    return col && !isColReadOnly(col);
                })
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
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

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
        flatColumnsInRenderOrder,
        isColReadOnly,
    ]);

    // ───────── Удаление ─────────
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
                    const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

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
    };
}
