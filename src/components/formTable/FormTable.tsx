
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {
    FormDisplay,
    SubDisplay,
    WidgetForm,
    FormTreeColumn,
    Widget,
    DTable
} from '@/shared/hooks/useWorkSpaces';
import {api} from '@/services/api';
import {SubWormTable} from '@/components/formTable/SubFormTable';
import {TreeFormTable} from '@/components/formTable/TreeFormTable';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import {Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, ThemeProvider} from '@mui/material';
import {dark} from '@/shared/themeUI/themeModal/ThemeModalUI';
import {useFuzzyRows} from '@/shared/hooks/useFuzzySearch';
import {useDebounced} from '@/shared/hooks/useDebounced';
import {TableToolbar} from '@/components/tableToolbar/TableToolbar';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';

/** Модель шапки из WidgetColumnsOfTable */
export type HeaderModelItem = {
    id: number;          // widget_column_id
    title: string;       // заголовок группы (alias/fallback)
    labels: string[];    // подписи для каждой reference в группе (ref_alias / name)
    visible?: boolean;   // видимость группы (WC.visible)
    /** порядок reference внутри группы по table_column_id (опц.) */
    refIds?: number[];
};

type Props = {
    formDisplay: FormDisplay;
    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;
    formsByWidget: Record<number, WidgetForm>;
    selectedWidget: Widget | null;
    selectedFormId: number | null;
    subDisplay: SubDisplay | null;
    subLoading: boolean;
    subError: string | null;
    formTrees: Record<number, FormTreeColumn[]>;
    loadFilteredFormDisplay: (formId: number, filter: { table_column_id: number; value: string | number }) => Promise<void>;
    subHeaderGroups: HeaderModelItem[];
    setFormDisplay: (value: FormDisplay | null) => void;
    setSubDisplay: (value: SubDisplay | null) => void;
    headerGroups?: HeaderModelItem[];           // живая модель шапки
    formsById: Record<number, WidgetForm>;
};

export const FormTable: React.FC<Props> = ({
                                               formDisplay,
                                               selectedWidget,
                                               selectedFormId,
                                               subDisplay,
                                               subLoading,
                                               subError,
                                               formsByWidget,
                                               loadSubDisplay,
                                               formTrees,
                                               loadFilteredFormDisplay,
                                               setFormDisplay,
                                               setSubDisplay,
                                               headerGroups,
                                               subHeaderGroups,
                                               formsById
                                           }) => {
    /** ────────────────────────────── локальные стейты ────────────────────────────── */
    const [lastPrimary, setLastPrimary] = useState<Record<string, unknown>>({});
    const [activeSubOrder, setActiveSubOrder] = useState<number>(0);

    const [activeFilters, setActiveFilters] = useState<{ table_column_id: number; value: string | number }[]>([]);
    const [nestedTrees, setNestedTrees] = useState<Record<string, FormTreeColumn[]>>({});
    const [activeExpandedKey, setActiveExpandedKey] = useState<string | null>(null);

    // добавление в main
    const [isAdding, setIsAdding] = useState(false);
    const [draft, setDraft] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);

    // редактирование main
    const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);
    const [editDraft, setEditDraft] = useState<Record<number, string>>({});
    const [editSaving, setEditSaving] = useState(false);

    // удаление main
    const [deletingRowIdx, setDeletingRowIdx] = useState<number | null>(null);

    // поиск
    const [q, setQ] = useState('');
    const dq = useDebounced(q, 250);

    // sub-вставка/редактирование
    const [savingSub, setSavingSub] = useState(false);
    const [editingRowIdxSub, setEditingRowIdxSub] = useState<number | null>(null);
    const [editDraftSub, setEditDraftSub] = useState<Record<number, string>>({});
    const [editSavingSub, setEditSavingSub] = useState(false);
    const [isAddingSub, setIsAddingSub] = useState(false);
    const [draftSub, setDraftSub] = useState<Record<number, string>>({});
    const [showSubHeaders, setShowSubHeaders] = useState(false);

    const [drill, setDrill] = useState<{ open: boolean; formId: number | null; loading: boolean; display: FormDisplay | null; error?: string }>(
        { open: false, formId: null, loading: false, display: null }
    );


    const openDrill = useCallback(async (formId: number) => {
        setDrill({ open: true, formId, loading: true, display: null });
        try {
            const { data } = await api.post<FormDisplay>(`/display/${formId}/main`, []); // без фильтров
            setDrill({ open: true, formId, loading: false, display: data });
        } catch (e: any) {
            const msg = e?.response?.data ?? e?.message ?? 'Не удалось загрузить форму';
            setDrill({ open: true, formId, loading: false, display: null, error: String(msg) });
        }
    }, []);

    const closeDrill = useCallback(() => {
        setDrill({ open: false, formId: null, loading: false, display: null });
    }, []);

    /** ────────────────────────────── форма и саб-настройки ───────────────────────── */
        // «база» из пропсов
    const baseForm: WidgetForm | null =
            selectedFormId != null ? (formsById[selectedFormId] ?? null)
                : (selectedWidget ? (formsByWidget[selectedWidget.id] ?? null) : null);

    // локальный override после мутаций формы
    const [overrideForm, setOverrideForm] = useState<WidgetForm | null>(null);

    // итоговая форма
    const currentForm: WidgetForm | null = overrideForm ?? baseForm;

    // сбрасываем override при смене выбранной формы
    useEffect(() => {
        setOverrideForm(null);
    }, [selectedFormId]);

    // map "widget_order → sub_widget_id"
    const subWidgetIdByOrder = useMemo(() => {
        const map: Record<number, number> = {};
        currentForm?.sub_widgets.forEach(sw => {
            map[sw.widget_order] = sw.sub_widget_id;
        });
        return map;
    }, [currentForm]);

    // formId для сабов (приоритет конкретной выбранной форме)
    const formIdForSub = selectedFormId ?? currentForm?.form_id ?? null;

    // доступные порядки саб-виджетов
    const availableOrders = useMemo(
        () => (currentForm?.sub_widgets ?? []).map(sw => sw.widget_order).sort((a, b) => a - b),
        [currentForm]
    );

    // валидируем активный порядок при смене формы/наборов
    useEffect(() => {
        setActiveSubOrder(prev => availableOrders.includes(prev) ? prev : (availableOrders[0] ?? 0));
        setSubDisplay(null);
    }, [availableOrders, setSubDisplay]);

    const getEffectiveOrder = useCallback(
        () => (availableOrders.includes(activeSubOrder) ? activeSubOrder : (availableOrders[0] ?? 0)),
        [activeSubOrder, availableOrders]
    );
    const currentOrder = getEffectiveOrder();
    const currentWidgetId = currentOrder != null ? subWidgetIdByOrder[currentOrder] : undefined;

    /** ────────────────────────────── дерево значений ─────────────────────────────── */
    const tree = selectedFormId ? formTrees[selectedFormId] : null;
    const [liveTree, setLiveTree] = useState<FormTreeColumn[] | null>(null);

    useEffect(() => {
        setLiveTree(tree ?? null);
    }, [tree, selectedFormId]);

    const reloadTree = useCallback(async () => {
        const formId = selectedFormId ?? currentForm?.form_id ?? null;
        if (!formId) return;
        try {
            const {data} = await api.post<FormTreeColumn[] | FormTreeColumn>(`/display/${formId}/tree`);
            const normalized = Array.isArray(data) ? data : [data];
            setLiveTree(normalized);
        } catch (e) {
            console.warn('Не удалось обновить справочники (tree):', e);
        }
    }, [selectedFormId, currentForm]);

    /** ────────────────────────────── утилиты/геттеры ─────────────────────────────── */
    const pkToKey = useCallback((pk: Record<string, unknown>) =>
            Object.keys(pk).sort().map(k => `${k}:${String(pk[k])}`).join('|'),
        []
    );

    const getEffectiveFormId = useCallback((): number | null => {
        if (!selectedWidget) return null;
        const wf = formsByWidget[selectedWidget.id];
        return wf?.form_id ?? selectedFormId ?? null;
    }, [selectedWidget, formsByWidget, selectedFormId]);

    /** ────────────────────────────── построение шапки ────────────────────────────── */
    const sortedColumns = useMemo(
        () => [...formDisplay.columns].sort((a, b) => a.column_order - b.column_order),
        [formDisplay.columns]
    );

    const byWcId = useMemo(() => {
        const map: Record<number, typeof sortedColumns> = {};
        for (const col of sortedColumns) {
            (map[col.widget_column_id] ||= []).push(col);
        }
        return map;
    }, [sortedColumns]);

    const headerPlan = useMemo(() => {
        // Фолбэк: если нет headerGroups — группируем, как раньше
        if (!headerGroups || headerGroups.length === 0) {
            const groups: { id: number; title: string; labels: string[]; cols: typeof sortedColumns }[] = [];
            let i = 0;
            while (i < sortedColumns.length) {
                const name = sortedColumns[i].column_name;
                const wcId = sortedColumns[i].widget_column_id;
                const cols: typeof sortedColumns = [];
                while (
                    i < sortedColumns.length &&
                    sortedColumns[i].column_name === name &&
                    sortedColumns[i].widget_column_id === wcId
                    ) {
                    cols.push(sortedColumns[i]);
                    i++;
                }
                groups.push({ id: wcId, title: name, labels: cols.map(() => '—'), cols });
            }
            return groups;
        }

        // Нормальный путь: строим группы на основе живой модели шапки
        const visibleGroups = headerGroups.filter(g => g.visible !== false);

        const planned: { id: number; title: string; labels: string[]; cols: typeof sortedColumns }[] = [];

        for (const g of visibleGroups) {
            const allCols = (byWcId[g.id] ?? []).slice();

            // если есть refIds — оставляем только те колонки, что перечислены (видимые), и сортируем по refIds
            let cols = allCols;
            let labels: string[] = [];

            if (g.refIds && g.refIds.length > 0) {
                const pos = new Map<number, number>();
                g.refIds.forEach((id, i) => pos.set(id, i));

                // 1) фильтр по видимым refs (refIds)
                cols = allCols.filter(c => c.table_column_id != null && pos.has(c.table_column_id!));

                // если после фильтра ничего не осталось — пропускаем группу
                if (cols.length === 0) continue;

                // 2) сортировка по порядку refIds
                cols.sort(
                    (a, b) =>
                        (pos.get(a.table_column_id!) ?? Number.MAX_SAFE_INTEGER) -
                        (pos.get(b.table_column_id!) ?? Number.MAX_SAFE_INTEGER)
                );

                // 3) подставляем подписи из g.labels, строго синхронно выбранным cols
                const allLabels = g.labels ?? [];
                labels = cols.map(c => {
                    const li = pos.get(c.table_column_id!)!;
                    return allLabels[li] ?? '—';
                });
            } else {
                // Нет явного списка refIds — берём все колонки группы как есть
                if (cols.length === 0) continue;
                labels = (g.labels ?? []).slice(0, cols.length);
                while (labels.length < cols.length) labels.push('—');
            }

            planned.push({ id: g.id, title: g.title, labels, cols });
        }

        return planned;
    }, [headerGroups, byWcId, sortedColumns]);


    const flatColumnsInRenderOrder = useMemo(
        () => headerPlan.flatMap(g => g.cols),
        [headerPlan]
    );

    type DisplayColumn = typeof formDisplay.columns[number];
    const isColReadOnly = useCallback((col: DisplayColumn): boolean => {
        const anyCol = col as any;

        const explicit =
            anyCol?.readonly === true ||
            anyCol?.read_only === true ||
            anyCol?.is_readonly === true ||
            anyCol?.meta?.readonly === true;

        const implicit =
            anyCol?.primary === true || // PK
            anyCol?.increment === true; // автоинкремент

        return !!(explicit || implicit);
    }, []);

    /**
     * множество редактируемых table_column_id
     * используйте его, чтобы:
     *  - не показывать инпуты для readonly полей
     *  - не класть такие поля в draft/editDraft
     *  - фильтровать values перед submit
     */
    const editableColumnIds = useMemo(() => {
        const set = new Set<number>();
        for (const c of flatColumnsInRenderOrder) {
            if (c.table_column_id != null && !isColReadOnly(c)) {
                set.add(c.table_column_id);
            }
        }
        return set;
    }, [flatColumnsInRenderOrder, isColReadOnly]);

    // индекс значений: "wcId:tcId" → index в row.values
    const valueIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        formDisplay.columns.forEach((c, i) => {
            const k = `${c.widget_column_id}:${c.table_column_id ?? -1}`;
            map.set(k, i);
        });
        return map;
    }, [formDisplay.columns]);

    /** ────────────────────────────── поиск/фильтрация ────────────────────────────── */
    const showSearch = !!currentForm?.search_bar;

    const {filtered} = useFuzzyRows(
        formDisplay,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        dq,
        {threshold: 0.35, distance: 120}
    );

    useEffect(() => {
        if (!showSearch && q) setQ('');
    }, [showSearch, q]);

    /** ─────────────────────── префлайты (insert/update/delete) ───────────────────── */
    const preflightInsert = useCallback(async (): Promise<{ ok: boolean; formId?: number }> => {
        if (!selectedWidget) return {ok: false};

        const wf = formsByWidget[selectedWidget.id];
        const insertFormId = wf?.form_id ?? selectedFormId;
        if (!insertFormId) {
            alert('Не найден form_id для вставки: у виджета нет связанной формы');
            return {ok: false};
        }
        try {
            const {data: table} = await api.get<DTable>(`/tables/${selectedWidget.table_id}`);
            if (!table?.insert_query || !table.insert_query.trim()) {
                alert('Для этой таблицы не настроен INSERT QUERY. Задайте его в метаданных таблицы.');
                return {ok: false};
            }
        } catch (e) {
            console.warn('Не удалось проверить insert_query у таблицы:', e);
        }
        return {ok: true, formId: insertFormId};
    }, [selectedWidget, formsByWidget, selectedFormId]);

    const preflightUpdate = useCallback(async (): Promise<{ ok: boolean; formId?: number }> => {
        if (!selectedWidget) return {ok: false};
        const formId = getEffectiveFormId();
        if (!formId) {
            alert('Не найден form_id для обновления');
            return {ok: false};
        }
        try {
            const {data: table} = await api.get<DTable>(`/tables/${selectedWidget.table_id}`);
            if (!table?.update_query || !table.update_query.trim()) {
                alert('Для этой таблицы не настроен UPDATE QUERY. Задайте его в метаданных таблицы.');
                return {ok: false};
            }
        } catch (e) {
            console.warn('Не удалось проверить update_query у таблицы:', e);
        }
        return {ok: true, formId};
    }, [selectedWidget, getEffectiveFormId]);

    const preflightDelete = useCallback(async (): Promise<{ ok: boolean; formId?: number }> => {
        if (!selectedWidget) return {ok: false};
        const wf = formsByWidget[selectedWidget.id];
        const formId = wf?.form_id ?? selectedFormId ?? null;
        if (!formId) {
            alert('Не найден form_id для удаления');
            return {ok: false};
        }
        try {
            const {data: table} = await api.get<DTable>(`/tables/${selectedWidget.table_id}`);
            if (!table?.delete_query || !table.delete_query.trim()) {
                alert('Для этой таблицы не настроен DELETE QUERY. Задайте его в метаданных таблицы.');
                return {ok: false};
            }
        } catch (e) {
            console.warn('Не удалось проверить delete_query у таблицы:', e);
        }
        return {ok: true, formId};
    }, [selectedWidget, formsByWidget, selectedFormId]);

    /** ────────────────────────────── main: CRUD handlers ─────────────────────────── */
    const startAdd = useCallback(async () => {
        const pf = await preflightInsert();
        if (!pf.ok) return;
        setIsAdding(true);
        const init: Record<number, string> = {};
        flatColumnsInRenderOrder.forEach(c => {
            if (c.table_column_id != null && !isColReadOnly(c)) init[c.table_column_id] = '';
        });
        setDraft(init);
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
            const values = Object.entries(draft)
                .filter(([, v]) => v !== '' && v !== undefined && v !== null)
                .map(([table_column_id, value]) => ({ table_column_id: Number(table_column_id), value: String(value) }));

            const body = { pk: {}, values };
            const url = `/data/${pf.formId}/${selectedWidget.id}`;

            try {
                await api.post(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 404 && String(detail).includes('Insert query not found')) {
                    alert('Для этой формы/таблицы не настроен INSERT QUERY. Задайте его в метаданных таблицы и повторите.');
                    return;
                }
                if (status === 404) {
                    await api.post(`${url}/`, body);
                } else {
                    throw err;
                }
            }

            const {data} = await api.post<FormDisplay>(`/display/${pf.formId}/main`, activeFilters);
            setFormDisplay(data);

            await reloadTree();
            setNestedTrees({});
            setActiveExpandedKey(null);

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

    const startEdit = useCallback(async (rowIdx: number) => {
        const pf = await preflightUpdate();
        if (!pf.ok) return;
        setIsAdding(false);

        const row = formDisplay.data[rowIdx];
        const init: Record<number, string> = {};
        flatColumnsInRenderOrder.forEach(col => {
            const k = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
            const idx = valueIndexByKey.get(k);
            const val = idx != null ? row.values[idx] : '';
            if (col.table_column_id != null && !isColReadOnly(col)) {
                init[col.table_column_id] = (val ?? '').toString();
            }
        });
        setEditingRowIdx(rowIdx);
        setEditDraft(init);
    }, [preflightUpdate, formDisplay.data, flatColumnsInRenderOrder, valueIndexByKey]);

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
                .map(([table_column_id, value]) => ({ table_column_id: Number(table_column_id), value: String(value) }));

            const body = {
                pk: { primary_keys: Object.fromEntries(Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])) },
                values,
            };

            const url = `/data/${pf.formId}/${selectedWidget.id}`;
            try {
                await api.patch(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 404 && String(detail).includes('Update query not found')) {
                    alert('Для этой формы/таблицы не настроен UPDATE QUERY. Задайте его и повторите.');
                    return;
                }
                if (status === 404) {
                    await api.patch(`${url}/`, body);
                } else {
                    throw err;
                }
            }

            const {data} = await api.post<FormDisplay>(`/display/${pf.formId}/main`, activeFilters);
            setFormDisplay(data);

            await reloadTree();
            setNestedTrees({});
            setActiveExpandedKey(null);

            setIsAdding(false);
            setDraft({});
            cancelEdit();
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(`Не удалось обновить строку: ${status ?? ''} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        } finally {
            setEditSaving(false);
        }
    }, [editingRowIdx, selectedWidget, preflightUpdate, formDisplay.data, editDraft, activeFilters, setFormDisplay, reloadTree, cancelEdit]);

    const deleteRow = useCallback(async (rowIdx: number) => {
        if (!selectedWidget) return;
        const pf = await preflightDelete();
        if (!pf.ok || !pf.formId) return;

        const row = formDisplay.data[rowIdx];
        if (selectedKey && selectedKey === pkToKey(row.primary_keys)) {
            setSelectedKey(null);
        }
        const pkObj = Object.fromEntries(Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)]));
        const pkLabel = Object.entries(pkObj).map(([k, v]) => `${k}=${v}`).join(', ');
        if (!window.confirm(`Удалить запись (${pkLabel})?`)) return;

        setDeletingRowIdx(rowIdx);
        try {
            const body = { primary_keys: pkObj };
            const url = `/data/${pf.formId}/${selectedWidget.id}`;

            try {
                await api.delete(url, { data: body }); // axios delete body
                await reloadTree();
                setNestedTrees({});
                setActiveExpandedKey(null);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 404 && String(detail).includes('Delete query not found')) {
                    alert('Для этой формы/таблицы не настроен DELETE QUERY. Задайте его и повторите.');
                    return;
                }
                if (status === 404) {
                    await api.delete(`${url}/`, { data: body });
                } else {
                    throw err;
                }
            }

            const {data} = await api.post<FormDisplay>(`/display/${pf.formId}/main`, activeFilters);
            setFormDisplay(data);

            if (JSON.stringify(lastPrimary) === JSON.stringify(row.primary_keys)) {
                setLastPrimary({});
                setSubDisplay(null);
            }
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(`Не удалось удалить строку: ${status ?? ''} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        } finally {
            setDeletingRowIdx(null);
        }
    }, [selectedWidget, preflightDelete, formDisplay.data, pkToKey, reloadTree, activeFilters, setFormDisplay, lastPrimary, setSubDisplay]);

    /** ────────────────────────────── main→sub и фильтры ─────────────────────────── */
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    const handleRowClick = useCallback((rowPk: Record<string, unknown>) => {
        if (!formIdForSub) return;
        setLastPrimary(rowPk);
        setSelectedKey(pkToKey(rowPk));
        loadSubDisplay(formIdForSub, getEffectiveOrder(), rowPk);
    }, [formIdForSub, pkToKey, loadSubDisplay, getEffectiveOrder]);

    const handleTabClick = useCallback((order: number) => {
        const next = availableOrders.includes(order) ? order : (availableOrders[0] ?? 0);
        if (next === activeSubOrder) return;
        setActiveSubOrder(next);
        if (!formIdForSub || Object.keys(lastPrimary).length === 0) return;
        loadSubDisplay(formIdForSub, next, lastPrimary);
    }, [availableOrders, activeSubOrder, formIdForSub, lastPrimary, loadSubDisplay]);

    const handleResetFilters = useCallback(async () => {
        if (!selectedFormId || !selectedWidget) return;
        setActiveFilters([]);
        setActiveExpandedKey(null);
        setSelectedKey(null);
        setLastPrimary({});
        setSubDisplay(null);
        setActiveSubOrder(availableOrders[0] ?? 0);

        try {
            const {data} = await api.post<FormDisplay>(`/display/${selectedFormId}/main`, []);
            setFormDisplay(data);
            await reloadTree();
        } catch (e) {
            console.warn('❌ Ошибка при сбросе фильтров:', e);
        }
    }, [selectedFormId, selectedWidget, availableOrders, setSubDisplay, setFormDisplay, reloadTree]);

    /** ────────────────────────────── sub-вставка helpers ────────────────────────── */
    const cancelAddSub = useCallback(() => {
        setIsAddingSub(false);
        setDraftSub({});
    }, []);

    const startAddSub = useCallback(async () => {
        if (!formIdForSub || !currentWidgetId) {
            alert('Нет formId или sub_widget_id для вставки');
            return;
        }
        try {
            const {data: widget} = await api.get<Widget>(`/widgets/${currentWidgetId}`);
            const {data: table} = await api.get<DTable>(`/tables/${widget.table_id}`);
            if (!table?.insert_query || !table.insert_query.trim()) {
                alert('Для таблицы саб-виджета не настроен INSERT QUERY.');
                return;
            }
        } catch (e) {
            console.warn('preflight (sub/insert) failed:', e);
        }

        setIsAddingSub(true);
        const init: Record<number, string> = {};
        flatColumnsInRenderOrder.forEach(c => {
            if (c.table_column_id != null) init[c.table_column_id] = '';
        });
        setDraftSub(init);
    }, [formIdForSub, currentWidgetId, flatColumnsInRenderOrder]);

    const submitAddSub = useCallback(async () => {
        if (!formIdForSub || !currentWidgetId) return;
        setSavingSub(true);
        try {
            const values = Object.entries(draftSub)
                .filter(([, v]) => v !== '' && v !== undefined && v !== null)
                .map(([table_column_id, value]) => ({ table_column_id: Number(table_column_id), value: String(value) }));

            const body = { pk: {}, values };
            const url = `/data/${formIdForSub}/${currentWidgetId}`;

            try {
                await api.post(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 404 && String(detail).includes('Insert query not found')) {
                    alert('Для саб-формы не настроен INSERT QUERY. Задайте его и повторите.');
                    return;
                }
                if (status === 404) {
                    await api.post(`${url}/`, body);
                } else {
                    throw err;
                }
            }

            if (currentOrder != null) handleTabClick(currentOrder);
            setIsAddingSub(false);
            setDraftSub({});
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(`Не удалось добавить строку: ${status ?? ''} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        } finally {
            setSavingSub(false);
        }
    }, [formIdForSub, currentWidgetId, draftSub, currentOrder, handleTabClick]);

    /** ────────────────────────────── реакции на мутацию формы ───────────────────── */
    useEffect(() => {
        if (!selectedFormId) return;
        let aborted = false;

        const onFormMutated = async (e: any) => {
            const eventFormId = e?.detail?.formId;
            if (eventFormId !== selectedFormId) return;

            try {
                const {data} = await api.get<WidgetForm>(`/forms/${eventFormId}`);
                if (!aborted) setOverrideForm(data);

                try {
                    const treeRes = await api.post<FormTreeColumn[] | FormTreeColumn>(`/display/${eventFormId}/tree`);
                    const normalized = Array.isArray(treeRes.data) ? treeRes.data : [treeRes.data];
                    setLiveTree(normalized);
                } catch (err) {
                    console.warn('Не удалось обновить tree после мутации формы:', err);
                }

                const orders = (data?.sub_widgets ?? []).map(sw => sw.widget_order).sort((a, b) => a - b);
                setActiveSubOrder(prev => orders.includes(prev) ? prev : (orders[0] ?? 0));
                setSubDisplay(null);
            } catch (err) {
                console.warn('Не удалось получить свежую форму:', err);
            }
        };

        window.addEventListener('portal:form-mutated', onFormMutated as any);
        return () => {
            aborted = true;
            window.removeEventListener('portal:form-mutated', onFormMutated as any);
        };
    }, [selectedFormId, setSubDisplay]);

    /** ───────────────────────────────────── UI ───────────────────────────────────── */
    return (
        <ThemeProvider theme={dark}>
            <div className={s.contentRow}>
                {/* LEFT: TREE */}
                <TreeFormTable
                    tree={liveTree}
                    widgetForm={currentForm}
                    activeExpandedKey={activeExpandedKey}
                    nestedTrees={nestedTrees}
                    handleResetFilters={handleResetFilters}
                    handleNestedValueClick={async (table_column_id, value) => {
                        if (!selectedFormId) return;
                        const newFilter = {table_column_id, value};
                        const filters = [
                            ...activeFilters.filter(f => f.table_column_id !== table_column_id),
                            newFilter
                        ];
                        try {
                            const {data} = await api.post<FormDisplay>(`/display/${selectedFormId}/main`, filters);
                            setFormDisplay(data);
                            setActiveFilters(filters);
                            setSubDisplay(null);
                        } catch (e) {
                            console.warn('❌ Ошибка nested фильтра:', e);
                        }
                    }}
                    handleTreeValueClick={async (table_column_id, value) => {
                        if (!selectedFormId) return;
                        const filters = [{table_column_id, value}];
                        try {
                            const {data: mainData} = await api.post<FormDisplay>(`/display/${selectedFormId}/main`, filters);
                            setFormDisplay(mainData);
                            setActiveFilters(filters);
                            setSubDisplay(null);

                            const {data} = await api.post<FormTreeColumn[] | FormTreeColumn>(
                                `/display/${selectedFormId}/tree`,
                                filters
                            );
                            const normalized = Array.isArray(data) ? data : [data];
                            const key = `${table_column_id}-${value}`;
                            setNestedTrees(prev => ({...prev, [key]: normalized}));
                            setActiveExpandedKey(key);
                        } catch (e) {
                            console.warn('❌ Ошибка handleTreeValueClick:', e);
                        }
                    }}
                />

                {/* RIGHT: MAIN + SUB */}
                <div className={s.mainCol}>
                    <TableToolbar
                        isAddingSub={isAddingSub}
                        cancelAddSub={cancelAddSub}
                        savingSub={savingSub}
                        startAddSub={startAddSub}
                        submitAddSub={submitAddSub}
                        isAdding={isAdding}
                        showSubActions={!!subDisplay && Object.keys(lastPrimary).length > 0}
                        selectedFormId={selectedFormId}
                        selectedWidget={selectedWidget}
                        saving={saving}
                        startAdd={startAdd}
                        submitAdd={submitAdd}
                        cancelAdd={cancelAdd}
                        showSearch={showSearch}
                        value={q}
                        onChange={setQ}
                        onResetFilters={handleResetFilters}
                        collapsedWidth={160}
                        expandedWidth={420}
                    />

                    <div className={s.tableScroll}>
                        <table className={s.tbl}>
                            <thead>
                            <tr>
                                {headerPlan.map(g => (
                                    <th key={`g-top-${g.id}`} colSpan={g.cols.length || 1}>{g.title} </th>

                                ))}

                                <th
                                    rowSpan={showSubHeaders ? 1 : 2}
                                    style={{ textAlign: 'center', verticalAlign: 'middle'}}
                                >
                                    <div
                                        type="button"
                                        onClick={() => setShowSubHeaders(v => !v)}
                                        aria-label={showSubHeaders ? 'Скрыть подзаголовки' : 'Показать подзаголовки'}
                                        aria-expanded={showSubHeaders}
                                        title={showSubHeaders ? 'Скрыть подзаголовки' : 'Показать подзаголовки'}

                                    >
                                        {showSubHeaders ? <ArrowDropUpIcon />  : <ArrowDropDownIcon/>}
                                    </div>

                                </th>

                            </tr>
                            {showSubHeaders && (
                                <tr>
                                    {headerPlan.map(g =>
                                        g.labels.slice(0, g.cols.length).map((label, idx) => (
                                            <th key={`g-sub-${g.id}-${idx}`}>{label}</th>
                                        ))
                                    )}
                                    <th/>
                                </tr>
                            )}
                            </thead>

                            <tbody>
                            {isAdding && (
                                <tr>
                                    {flatColumnsInRenderOrder.map(col => {
                                        const tcId = col.table_column_id;
                                        const ro = isColReadOnly(col);

                                        return (
                                            <td key={`add-wc${col.widget_column_id}-tc${tcId}`}
                                                style={{textAlign: 'center'}}>
                                                {ro || tcId == null ? (
                                                    // readonly: просто тире/плейсхолдер
                                                    <span style={{ opacity: 0.6 }}>—</span>
                                                ) : (
                                                    <TextField
                                                        size="small"
                                                        value={draft[tcId] ?? ''}
                                                        onChange={e => setDraft(prev => ({ ...prev, [tcId]: e.target.value }))}
                                                        placeholder={col.placeholder ?? col.column_name}
                                                    />
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td />
                                </tr>
                            )}

                            {filtered.map(({row, idx: rowIdx}) => {
                                const isEditing = editingRowIdx === rowIdx;
                                const rowKey = pkToKey(row.primary_keys);

                                return (
                                    <tr
                                        key={rowIdx}
                                        className={selectedKey === rowKey ? s.selectedRow : undefined}
                                        aria-selected={selectedKey === rowKey || undefined}
                                        onClick={() => {
                                            if (isEditing) return;
                                            const pkObj = Object.fromEntries(Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)]));
                                            handleRowClick(pkObj);
                                        }}
                                    >
                                        {flatColumnsInRenderOrder.map(col => {
                                            const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                                            const idx = valueIndexByKey.get(key);
                                            const val = idx != null ? row.values[idx] : '';

                                            if (isEditing) {
                                                return (
                                                    <td key={`edit-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`} style={{ textAlign: 'center' }}>
                                                        <TextField
                                                            size="small"
                                                            value={editDraft[col.table_column_id] ?? ''}
                                                            onChange={e => setEditDraft(prev => ({ ...prev, [col.table_column_id]: e.target.value }))}
                                                            onClick={e => e.stopPropagation()}
                                                            placeholder={col.placeholder ?? col.column_name}
                                                        />
                                                    </td>
                                                );
                                            }

                                            const clickable = col.form_id != null; // ← признак “есть связанная форма”
                                            return (
                                                <td key={`r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}>
                                                    {clickable ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); openDrill(col.form_id!); }}
                                                            style={{
                                                                padding: 0,
                                                                border: 'none',
                                                                background: 'none',
                                                                cursor: 'pointer',
                                                                textDecoration: 'underline',
                                                                color: 'var(--link, #66b0ff)'
                                                            }}
                                                            title={`Открыть форму #${col.form_id}`}
                                                        >
                                                            {val}
                                                        </button>
                                                    ) : (
                                                        <>{val}</>
                                                    )}
                                                </td>
                                            );
                                        })}


                                        <td style={{textAlign: 'center', whiteSpace: 'nowrap'}}>
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); submitEdit(); }}
                                                        disabled={editSaving}
                                                    >
                                                        {editSaving ? 'Сохр...' : '✓'}
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                                                        disabled={editSaving}
                                                        style={{marginLeft: 8}}
                                                    >
                                                        х
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                          <span
                              style={{display: 'inline-flex', cursor: 'pointer', marginRight: 10}}
                              onClick={(e) => { e.stopPropagation(); startEdit(rowIdx); }}
                              title="Редактировать"
                          >
                            <EditIcon className={s.actionIcon}/>
                          </span>
                                                    <span
                                                        style={{
                                                            display: 'inline-flex',
                                                            cursor: deletingRowIdx === rowIdx ? 'progress' : 'pointer',
                                                            opacity: deletingRowIdx === rowIdx ? 0.6 : 1
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (deletingRowIdx == null) deleteRow(rowIdx);
                                                        }}
                                                        title="Удалить"
                                                    >
                            <DeleteIcon className={s.actionIcon}/>
                          </span>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>

                    <SubWormTable
                        setEditSaving={setEditSavingSub}
                        editDraft={editDraftSub}
                        editingRowIdx={editingRowIdxSub}
                        setEditDraft={setEditDraftSub}
                        setEditingRowIdx={setEditingRowIdxSub}
                        editSaving={editSavingSub}
                        draftSub={draftSub}
                        setDraftSub={setDraftSub}
                        isAddingSub={isAddingSub}
                        setIsAddingSub={setIsAddingSub}
                        currentOrder={currentOrder}
                        currentWidgetId={currentWidgetId}
                        subHeaderGroups={subHeaderGroups}
                        selectedFormId={selectedFormId}
                        selectedWidget={selectedWidget}
                        formId={formIdForSub}
                        subWidgetIdByOrder={subWidgetIdByOrder}
                        subLoading={subLoading}
                        subError={subError}
                        subDisplay={subDisplay}
                        handleTabClick={handleTabClick}
                    />
                </div>
            </div>


            <Dialog open={drill.open} onClose={closeDrill} fullWidth maxWidth="lg">
                <DialogTitle>Форма #{drill.formId}</DialogTitle>
                <DialogContent dividers>
                    {drill.loading && <div style={{ opacity: 0.7, padding: 12 }}>Загрузка…</div>}
                    {!!drill.error && <div style={{ color: '#f66', padding: 12 }}>Ошибка: {drill.error}</div>}

                    {drill.display && (
                        <div className={s.tableScroll}>
                            <table className={s.tbl}>
                                <thead>
                                <tr>
                                    {drill.display.columns.map((c, i) => (
                                        <th key={`d-col-${i}`}>{c.ref_column_name ?? c.column_name}</th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody>
                                {drill.display.data.map((r, ri) => (
                                    <tr key={`d-row-${ri}`}>
                                        {drill.display.columns.map((c, ci) => (
                                            <td key={`d-cell-${ri}-${ci}`}>
                                                {r.values[ci] ?? ''}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDrill}>Закрыть</Button>
                </DialogActions>
            </Dialog>


        </ThemeProvider>
    );
};