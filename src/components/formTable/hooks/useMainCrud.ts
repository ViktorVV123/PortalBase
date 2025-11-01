// useMainCrud.ts
import { useCallback, useState } from 'react';
import { api } from '@/services/api';
import type { DTable, FormDisplay, Widget } from '@/shared/hooks/useWorkSpaces';

const DEBUG_MAINCRUD = true;
const log = (label: string, payload?: unknown) => {
    if (!DEBUG_MAINCRUD) return;
    // eslint-disable-next-line no-console
    console.groupCollapsed(`[CRUD] ${label}`);
    if (payload !== undefined) {
        // eslint-disable-next-line no-console
        console.log(payload);
    }
    // eslint-disable-next-line no-console
    console.groupEnd();
};

type EnsureQueryKind = 'insert' | 'update' | 'delete';

// Синхронно с MainTable/useHeaderPlan
type ExtCol = FormDisplay['columns'][number] & {
    __write_tc_id?: number;
    __is_primary_combo_input?: boolean;
};

export type UseMainCrudDeps = {
    formDisplay: FormDisplay;
    selectedWidget: Widget | null;
    selectedFormId: number | null;
    formsByWidget: Record<number, { form_id: number }>;
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
};

type ComboColumnMeta = { ref_column_order: number; width: number; combobox_alias: string | null };
type ComboResp = {
    columns: ComboColumnMeta[];
    data: Array<{ primary: (string | number)[]; show: (string | number)[]; show_hidden: (string | number)[] }>;
};
type ComboOption = {
    id: string;           // primary[0] как строка
    show: string[];       // короткая подпись
    showHidden: string[]; // полная подпись
};

// кэш по ключу wcId:writeTcId
const comboCache = new Map<string, ComboOption[]>();

async function loadComboOptions(widgetColumnId: number, writeTcId: number): Promise<ComboOption[]> {
    const key = `${widgetColumnId}:${writeTcId}`;
    const cached = comboCache.get(key);
    if (cached) return cached;
    const { data } = await api.get<ComboResp>(`/display/combobox/${widgetColumnId}/${writeTcId}`);
    const options: ComboOption[] = data.data.map(r => ({
        id: String(r.primary?.[0] ?? ''),
        show: (r.show ?? []).map(v => String(v)),
        showHidden: (r.show_hidden ?? []).map(v => String(v)),
    }));
    comboCache.set(key, options);
    return options;
}

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
                                preflightTableId,
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
            if (!selectedWidget && !preflightTableId) return { ok: false };

            const formId = getEffectiveFormId();
            if (!formId) return { ok: false };

            try {
                let tableId: number | null = preflightTableId ?? null;

                if (!tableId) {
                    const maybeTid = (selectedWidget as any)?.table_id as number | undefined;
                    if (maybeTid) tableId = maybeTid ?? null;
                }

                if (!tableId) {
                    const wid = selectedWidget?.id;
                    if (!wid) return { ok: false };
                    const { data: widgetMeta } = await api.get<{ id: number; table_id: number }>(`/widgets/${wid}`);
                    tableId = widgetMeta?.table_id ?? null;
                }

                if (!tableId) return { ok: false };

                // 👇 лог — какой tableId реально использован
                log('ensureQuery → tableId used', { kind, formId, tableId });

                const { data: table } = await api.get<DTable>(`/tables/${tableId}`);

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
                // префлайт — не критичен
            }

            return { ok: true, formId };
        },
        [selectedWidget, preflightTableId, getEffectiveFormId] // 👈 ДОБАВИЛИ preflightTableId
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
        const primary = group.find(c => c.__is_primary_combo_input) ?? group[0];
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

        const init: Record<number, string> = {};
        const seen = new Set<number>();

        // Идём как в рендере: слева-направо, склеиваем combobox в группы, кладём ОДИН write-id на группу
        for (let i = 0; i < flatColumnsInRenderOrder.length; ) {
            const c = flatColumnsInRenderOrder[i];

            if (c.type === 'combobox') {
                let j = i + 1;
                while (j < flatColumnsInRenderOrder.length && isSameComboGroupCRUD(c, flatColumnsInRenderOrder[j])) j += 1;
                const group = flatColumnsInRenderOrder.slice(i, j);
                const writeTcId = getWriteTcIdForComboGroupCRUD(group);
                if (writeTcId != null && !seen.has(writeTcId)) {
                    // Для добавления по умолчанию пусто — пользователь выберет
                    init[writeTcId] = '';
                    seen.add(writeTcId);
                }
                i = j;
                continue;
            }

            // Обычная колонка
            const writeTcId = (c.__write_tc_id ?? c.table_column_id) ?? null;
            if (writeTcId != null && !seen.has(writeTcId)) {
                init[writeTcId] = String(c.default ?? '');
                seen.add(writeTcId);
            }
            i += 1;
        }

        log('startAdd → init draft (unique write ids)', init);
        setDraft(init);
        setIsAdding(true);
        setEditingRowIdx(null);
    }, [preflightInsert, flatColumnsInRenderOrder]);


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
            // 1) Собираем список ВСЕХ write_tc_id из плоских колонок (уникально)
            const allWriteIds: number[] = [];
            const seen = new Set<number>();
            flatColumnsInRenderOrder.forEach((c) => {
                const w = (c.__write_tc_id ?? c.table_column_id) ?? null;
                if (w != null && !seen.has(w)) { seen.add(w); allWriteIds.push(w); }
            });

            // 2) Формируем values без фильтра: пустые строки тоже отправляем
            const values = allWriteIds.map((tcId) => ({
                table_column_id: tcId,
                value: String(draft[tcId] ?? ''), // бек сам применит default, если надо
            }));

            log('submitAdd → allWriteIds', allWriteIds);
            log('submitAdd → values[] (no filter)', values);

            const body = { pk: { primary_keys: {} as Record<string, string> }, values };
            const url = `/data/${pf.formId}/${selectedWidget.id}`;
            log('submitAdd → request', { url, body });

            try {
                await api.post(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 404 && String(detail).includes('Insert query not found')) {
                    alert('Для этой таблицы не настроен INSERT QUERY. Задайте его в метаданных таблицы.');
                    return;
                }
                if (status === 404) {
                    await api.post(`${url}/`, body);
                } else if (status === 422) {
                    alert('Не удалось добавить строку (422). Проверь тело: { pk: { primary_keys: {} }, values: [...] }');
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

            const row = formDisplay.data[rowIdx];

            // 1) Сбор исходных значений и групп combobox
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
                    const g = comboGroups.get(gKey) ?? { wcId: col.widget_column_id, writeTcId, tokens: [] };
                    if (shownStr) g.tokens.push(shownStr);
                    comboGroups.set(gKey, g);
                    // init для combobox будет выставлен ниже после маппинга на id
                } else {
                    init[writeTcId] = shownStr; // даже если read-only → кладём текущее видимое значение
                }
            });

            // 2) Для каждой combobox-группы подтягиваем опции и пытаемся сопоставить по tokens
            //    Стратегия: ищем опцию, у которой show_hidden содержит максимум из tokens.
            //    Если ровно один кандидат с максимальным score (>0) — берём его id.
            const groups = Array.from(comboGroups.values()); // массив, чтобы не было проблем с TS2802
            for (let i = 0; i < groups.length; i += 1) {
                const g = groups[i];
                try {
                    const options = await loadComboOptions(g.wcId, g.writeTcId);

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

                    // если сопоставилось однозначно — авто-проставим ID, иначе оставим пусто (пусть выберут явно)
                    init[g.writeTcId] = (bestScore > 0 && bestCount === 1 && bestId) ? bestId : (init[g.writeTcId] ?? '');
                } catch {
                    init[g.writeTcId] = init[g.writeTcId] ?? '';
                }
            }

            log('startEdit → init editDraft (с авто-map combobox)', { rowIdx, init });
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

            // 0) PK утилиты
            const pkObj = Object.fromEntries(
                Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
            );
            const pkToString = (pk: Record<string, unknown>) =>
                Object.keys(pk).sort().map(k => `${k}:${String(pk[k])}`).join('|');

            // 1) считаем значения для отправки из editDraft (включая read-only/visible:false)
            const hasDefault = new Set<number>();
            flatColumnsInRenderOrder.forEach((c) => {
                const w = (c.__write_tc_id ?? c.table_column_id) ?? null;
                if (w != null && c.default != null) hasDefault.add(w);
            });

            const entries = Object.entries(editDraft).filter(([tcIdStr, v]) => {
                if (v != null && String(v) !== '') return true;
                const tcId = Number(tcIdStr);
                return hasDefault.has(tcId); // даже пустое — если колонка имеет default
            });

            const values = entries.map(([tcIdStr, v]) => ({
                table_column_id: Number(tcIdStr),
                value: String(v ?? ''),
            }));

            // 2) body + url
            const body = {
                pk: { primary_keys: pkObj as Record<string, string> },
                values,
            };
            const url = `/data/${pf.formId}/${selectedWidget.id}`;

            // 3) before/after лог по тем write_tc_id, которые реально отправляем (entries)
            type BeforeAfter = {
                widget_column_id: number;
                write_tc_id: number;
                shown_before: string;
                sending_value?: string;
            };

            const beforeAfter: BeforeAfter[] = [];
            for (const [tcIdStr] of entries) {
                const writeTcId = Number(tcIdStr);

                const related = flatColumnsInRenderOrder.filter(c => {
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
                        sending_value: String(editDraft[writeTcId] ?? ''),
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

            // 4) Логи
            console.groupCollapsed('[CRUD][submitEdit]');
            console.log('PK:', pkObj, 'pkKey:', pkToString(pkObj));
            console.log('editDraft (raw):', editDraft);
            console.log('entries (to send):', entries);
            console.log('values[] (will be sent):', values);
            console.log('request:', { url, body });
            console.log('BEFORE (shown) & SENDING values by write_tc_id:', beforeAfter);
            console.groupEnd();

            // 5) PATCH
            let patchRespData: unknown = null;
            try {
                const resp = await api.patch(url, body);
                patchRespData = resp?.data ?? null;
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 404 && String(detail).includes('Update query not found')) {
                    alert('Для этой таблицы не настроен UPDATE QUERY. Задайте его в метаданных таблицы.');
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

            // 6) Релоад main + сравнение after
            const { data: newDisplay } = await api.post<FormDisplay>(`/display/${pf.formId}/main`, activeFilters);

            const findRowByPk = (fd: FormDisplay, pk: Record<string, unknown>) => {
                const key = (obj: Record<string, unknown>) =>
                    Object.keys(obj).sort().map(k => `${k}:${String(obj[k])}`).join('|');
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
                    const related = flatColumnsInRenderOrder.filter(c => {
                        const w = (c.__write_tc_id ?? c.table_column_id) ?? null;
                        return w === ba.write_tc_id;
                    });
                    const col = related[0];
                    if (col) {
                        const visKey = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                        const idx = valueIndexByKey.get(visKey);
                        const shownVal = (idx != null ? updatedRow.values[idx] : '') as string | number | null;
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
        valueIndexByKey,
        isColReadOnly, // остаётся в deps как и раньше
    ]);


    // ───────── Удаление ─────────
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

                // ✅ ВАЖНО: обновляем дерево после удаления
                try { await reloadTree(); } catch {}

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
            reloadTree,         // не забудь в зависимостях
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
    };
}
