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

    // ───────── Добавление ─────────
    const startAdd = useCallback(async () => {
        const pf = await preflightInsert();
        if (!pf.ok) return;

        setIsAdding(true);
        setEditingRowIdx(null);

        const init: Record<number, string> = {};
        const editableList: Array<{ writeTcId: number; col: string | undefined; type: string | undefined }> = [];

        flatColumnsInRenderOrder.forEach((c) => {
            const writeTcId = (c.__write_tc_id ?? c.table_column_id) ?? null;
            if (writeTcId != null && !isColReadOnly(c)) {
                init[writeTcId] = '';
                editableList.push({ writeTcId, col: c.column_name, type: (c as any).type });
            }
        });

        log('startAdd → editable fields', editableList);
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

        const entries = Object.entries(draft).filter(([, v]) => v !== '' && v != null);
        const values = entries.map(([tcIdStr, v]) => ({
            table_column_id: Number(tcIdStr),
            value: String(v), // для combobox тут ID из primary[0]
        }));

        log('submitAdd → draft', draft);
        log('submitAdd → values[]', values);

        if (values.length === 0) {
            alert('Нет данных для вставки: заполни хотя бы одно редактируемое поле.');
            return;
        }

        setSaving(true);
        try {
            const body = {
                pk: { primary_keys: {} as Record<string, string> },
                values,
            };
            const url = `/data/${pf.formId}/${selectedWidget.id}`;
            log('submitAdd → request', { url, body });

            try {
                await api.post(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                console.warn('[CRUD][submitAdd] POST failed', { status, detail, url });

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
    }, [selectedWidget, preflightInsert, draft, activeFilters, setFormDisplay, reloadTree]);

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
                if (writeTcId == null || isColReadOnly(col)) return;

                const visKey = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                const idx = valueIndexByKey.get(visKey);
                const shownVal = (idx != null ? row.values[idx] : '') as string | number | null;
                const shownStr = shownVal == null ? '' : String(shownVal).trim();

                if (col.type === 'combobox') {
                    const gKey = `${col.widget_column_id}:${writeTcId}`;
                    const g = comboGroups.get(gKey) ?? { wcId: col.widget_column_id, writeTcId, tokens: [] };
                    if (shownStr) g.tokens.push(shownStr);
                    comboGroups.set(gKey, g);
                    // init[writeTcId] заполним ниже после сопоставления
                } else {
                    init[writeTcId] = shownStr;
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

            // 0) подготовка утилит для логов
            const pkObj = Object.fromEntries(
                Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
            );
            const pkToString = (pk: Record<string, unknown>) =>
                Object.keys(pk).sort().map(k => `${k}:${String(pk[k])}`).join('|');

            // 1) вычисляем values из editDraft
            const nonEmptyEntries = Object.entries(editDraft).filter(([, v]) => v !== '' && v != null);
            const values = nonEmptyEntries.map(([tcIdStr, v]) => ({
                table_column_id: Number(tcIdStr),
                value: String(v), // для combobox здесь ID из primary[0]
            }));

            // 2) строим body+url
            const body = {
                pk: { primary_keys: pkObj as Record<string, string> },
                values,
            };
            const url = `/data/${pf.formId}/${selectedWidget.id}`;

            // 3) соберём «до/после» по редактируемым колонкам (для сравнения)
            type BeforeAfter = {
                widget_column_id: number;
                write_tc_id: number;
                shown_before: string;
                sending_value?: string; // то, что уйдёт на бек
            };

            const beforeAfter: BeforeAfter[] = [];
            // пройдём по всем колонкам, для которых есть editDraft (write_tc_id)
            for (const [tcIdStr] of nonEmptyEntries) {
                const writeTcId = Number(tcIdStr);

                // найдём визуальную (синтетическую) колонку(и), которая(ые) отображают этот writeTcId
                const related = flatColumnsInRenderOrder.filter(c => {
                    const w = (c.__write_tc_id ?? c.table_column_id) ?? null;
                    return w === writeTcId;
                });

                // возьмём первую подходящую визуальную колонку для "before"
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

            // 4) ГРУППОВЫЕ ЛОГИ
            // eslint-disable-next-line no-console
            console.groupCollapsed('[CRUD][submitEdit]');
            // eslint-disable-next-line no-console
            console.log('PK:', pkObj, 'pkKey:', pkToString(pkObj));
            // eslint-disable-next-line no-console
            console.log('editDraft (raw):', editDraft);
            // eslint-disable-next-line no-console
            console.log('non-empty entries:', nonEmptyEntries);
            // eslint-disable-next-line no-console
            console.log('values[] (will be sent):', values);
            // eslint-disable-next-line no-console
            console.log('request:', { url, body });
            // eslint-disable-next-line no-console
            console.log('BEFORE (shown) & SENDING values by write_tc_id:', beforeAfter);
            // eslint-disable-next-line no-console
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

            // eslint-disable-next-line no-console
            console.groupCollapsed('[CRUD][submitEdit] PATCH response');
            // eslint-disable-next-line no-console
            console.log(patchRespData);
            // eslint-disable-next-line no-console
            console.groupEnd();

            // 6) Релоад main и постфактум сравнение «до/после»
            const { data: newDisplay } = await api.post<FormDisplay>(`/display/${pf.formId}/main`, activeFilters);

            // найти обновлённую строку по PK
            const findRowByPk = (fd: FormDisplay, pk: Record<string, unknown>) => {
                const key = (obj: Record<string, unknown>) => Object.keys(obj).sort().map(k => `${k}:${String(obj[k])}`).join('|');
                const target = key(pk);
                for (let i = 0; i < fd.data.length; i += 1) {
                    const k = key(fd.data[i].primary_keys as Record<string, unknown>);
                    if (k === target) return fd.data[i];
                }
                return null;
            };

            const updatedRow = findRowByPk(newDisplay, pkObj);

            // соберём "после" для тех же write_tc_id
            const after: Array<BeforeAfter & { shown_after: string }> = [];
            if (updatedRow) {
                beforeAfter.forEach((ba) => {
                    // снова пытаемся взять любую визуальную колонку, связанную с write_tc_id
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

            // eslint-disable-next-line no-console
            console.groupCollapsed('[CRUD][submitEdit] AFTER reload');
            // eslint-disable-next-line no-console
            console.log('new display row:', updatedRow);
            // eslint-disable-next-line no-console
            console.table(after);
            // eslint-disable-next-line no-console
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
        isColReadOnly,
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
