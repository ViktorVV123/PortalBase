import React, {useCallback, useEffect, useMemo, useState} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {
    FormDisplay,
    SubDisplay,
    WidgetForm,
    FormTreeColumn,
    Widget,
    DTable,
} from '@/shared/hooks/useWorkSpaces';
import {api} from '@/services/api';


import {ThemeProvider} from '@mui/material';
import {dark} from '@/shared/themeUI/themeModal/ThemeModalUI';
import {useFuzzyRows} from '@/shared/hooks/useFuzzySearch';
import {useDebounced} from '@/shared/hooks/useDebounced';
import {TableToolbar} from '@/components/tableToolbar/TableToolbar';

import {useDrillDialog} from '@/components/formTable/hooks/useDrillDialog';

import {useMainCrud} from '@/components/formTable/hooks/useMainCrud';
import {useFiltersTree} from '@/components/formTable/hooks/useFiltersTree';
import {TreeFormTable} from "@/components/formTable/treeForm/TreeFormTable";
import {MainTable} from "@/components/formTable/parts/MainTable";
import {SubWormTable} from "@/components/formTable/subForm/SubFormTable";
import {DrillDialog} from "@/components/formTable/parts/DrillDialog";


/** Модель шапки (совместима с твоей) */
export type HeaderModelItem = {
    id: number;         // widget_column_id
    title: string;      // заголовок группы (alias/fallback)
    labels: string[];   // подписи для каждой reference
    visible?: boolean;  // WC.visible
    refIds?: number[];  // порядок table_column_id
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
    headerGroups?: HeaderModelItem[];
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
                                               setFormDisplay,
                                               setSubDisplay,
                                               headerGroups,
                                               subHeaderGroups,
                                               formsById,
                                           }) => {
    /** ─────────── локальные состояния ─────────── */
    const [lastPrimary, setLastPrimary] = useState<Record<string, unknown>>({});
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [activeSubOrder, setActiveSubOrder] = useState<number>(0);
    const [showSubHeaders, setShowSubHeaders] = useState(false);
    const [q, setQ] = useState('');
    const dq = useDebounced(q, 250);

    /** ─────────── форма/сабы ─────────── */
    const baseForm: WidgetForm | null = useMemo(() => {
        if (selectedFormId != null) return formsById[selectedFormId] ?? null;
        if (selectedWidget) return formsByWidget[selectedWidget.id] ?? null;
        return null;
    }, [selectedFormId, selectedWidget, formsById, formsByWidget]);

    const [overrideForm, setOverrideForm] = useState<WidgetForm | null>(null);
    const currentForm: WidgetForm | null = overrideForm ?? baseForm;

    useEffect(() => { setOverrideForm(null); }, [selectedFormId]);

    const subWidgetIdByOrder = useMemo(() => {
        const map: Record<number, number> = {};
        currentForm?.sub_widgets?.forEach(sw => { map[sw.widget_order] = sw.sub_widget_id; });
        return map;
    }, [currentForm]);

    const formIdForSub = selectedFormId ?? currentForm?.form_id ?? null;

    const availableOrders = useMemo(
        () => (currentForm?.sub_widgets ?? []).map(sw => sw.widget_order).sort((a, b) => a - b),
        [currentForm]
    );

    useEffect(() => {
        setActiveSubOrder(prev => availableOrders.includes(prev) ? prev : (availableOrders[0] ?? 0));
        setSubDisplay(null);
    }, [availableOrders, setSubDisplay]);

    const currentOrder = useMemo(
        () => (availableOrders.includes(activeSubOrder) ? activeSubOrder : (availableOrders[0] ?? 0)),
        [activeSubOrder, availableOrders]
    );
    const currentWidgetId = currentOrder != null ? subWidgetIdByOrder[currentOrder] : undefined;

    /** ─────────── дерево значений (живое) ─────────── */
    const tree = selectedFormId ? formTrees[selectedFormId] : null;
    const [liveTree, setLiveTree] = useState<FormTreeColumn[] | null>(null);
    useEffect(() => { setLiveTree(tree ?? null); }, [tree, selectedFormId]);

    const reloadTree = useCallback(async () => {
        const formId = selectedFormId ?? currentForm?.form_id ?? null;
        if (!formId) return;
        try {
            const {data} = await api.post<FormTreeColumn[] | FormTreeColumn>(`/display/${formId}/tree`);
            setLiveTree(Array.isArray(data) ? data : [data]);
        } catch (e) {
            console.warn('Не удалось обновить справочники (tree):', e);
        }
    }, [selectedFormId, currentForm]);

    /** ─────────── построение шапки/колонок ─────────── */
    const safe = (v?: string | null) => (v?.trim() ? v.trim() : '—');

    const sortedColumns = useMemo(
        () => [...formDisplay.columns].sort((a, b) => a.column_order - b.column_order),
        [formDisplay.columns]
    );

    const byWcId = useMemo(() => {
        const map: Record<number, typeof sortedColumns> = {};
        for (const col of sortedColumns) (map[col.widget_column_id] ||= []).push(col);
        return map;
    }, [sortedColumns]);

    const headerPlan = useMemo(() => {
        if (!headerGroups?.length) {
            // fallback по (name, wcId) — как было
            const groups: { id: number; title: string; labels: string[]; cols: typeof sortedColumns }[] = [];
            let i = 0;
            while (i < sortedColumns.length) {
                const name = sortedColumns[i].column_name;
                const wcId = sortedColumns[i].widget_column_id;
                const cols: typeof sortedColumns = [];
                while (i < sortedColumns.length && sortedColumns[i].column_name === name && sortedColumns[i].widget_column_id === wcId) {
                    cols.push(sortedColumns[i]); i++;
                }
                groups.push({ id: wcId, title: safe(name), labels: cols.map(() => '—'), cols });
            }
            return groups;
        }

        const visibleGroups = headerGroups.filter((g) => g.visible !== false);
        const planned: { id: number; title: string; labels: string[]; cols: typeof sortedColumns }[] = [];

        for (const g of visibleGroups) {
            const allCols = (byWcId[g.id] ?? []).slice();
            let cols = allCols;
            let labels: string[] = [];

            if (g.refIds?.length) {
                // 1) строим словарь refId -> label
                const labelByRefId = new Map<number, string>();
                const total = g.refIds.length;
                for (let i = 0; i < total; i++) {
                    const refId = g.refIds[i];
                    const lblRaw = (g.labels?.[i] ?? '');
                    labelByRefId.set(refId, safe(lblRaw));
                }

                // 2) оставляем только колонки, у которых есть table_column_id и он есть в словаре
                const candidateCols = allCols.filter(c => c.table_column_id != null && labelByRefId.has(c.table_column_id!));

                // 3) сортируем колонки строго по порядку g.refIds
                const order = new Map<number, number>();
                g.refIds.forEach((id, idx) => order.set(id, idx));
                cols = candidateCols.sort((a, b) => {
                    const ai = order.get(a.table_column_id!) ?? Number.MAX_SAFE_INTEGER;
                    const bi = order.get(b.table_column_id!) ?? Number.MAX_SAFE_INTEGER;
                    return ai - bi;
                });

                if (!cols.length) continue;

                // 4) финальные labels — просто берём из словаря по конкретным col
                labels = cols.map(c => labelByRefId.get(c.table_column_id!) ?? '—');
            } else {
                // старое поведение для групп без refIds
                if (!cols.length) continue;
                labels = (g.labels ?? []).slice(0, cols.length).map(safe);
                while (labels.length < cols.length) labels.push('—');
            }

            planned.push({ id: g.id, title: safe(g.title), labels, cols });
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
        const explicit = anyCol?.readonly === true || anyCol?.read_only === true || anyCol?.is_readonly === true || anyCol?.meta?.readonly === true;
        const implicit = anyCol?.primary === true || anyCol?.increment === true;
        return !!(explicit || implicit);
    }, []);

    const valueIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        formDisplay.columns.forEach((c, i) => {
            map.set(`${c.widget_column_id}:${c.table_column_id ?? -1}`, i);
        });
        return map;
    }, [formDisplay.columns]);

    /** ─────────── поиск/фильтрация ─────────── */
    const showSearch = !!currentForm?.search_bar;
    const {filtered} = useFuzzyRows(
        formDisplay,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        dq,
        {threshold: 0.35, distance: 120}
    );
    useEffect(() => { if (!showSearch && q) setQ(''); }, [showSearch, q]);
    const filteredRows = useMemo(() => filtered, [filtered]);

    /** ─────────── фильтры/дерево (хук) ─────────── */
    const {
        activeFilters, setActiveFilters,
        nestedTrees, setNestedTrees,
        activeExpandedKey, setActiveExpandedKey,
        resetFiltersHard,
    } = useFiltersTree(selectedFormId, (v) => setFormDisplay(v));

    const handleResetFilters = useCallback(async () => {
        if (!selectedFormId || !selectedWidget) return;
        setActiveFilters([]);
        setActiveExpandedKey(null);
        setSelectedKey(null);
        setLastPrimary({});
        setSubDisplay(null);
        setActiveSubOrder(availableOrders[0] ?? 0);

        try {
            await resetFiltersHard();
            await reloadTree();
        } catch (e) {
            console.warn('❌ Ошибка при сбросе фильтров:', e);
        }
    }, [
        selectedFormId, selectedWidget, availableOrders,
        setSubDisplay, resetFiltersHard, reloadTree
    ]);

    /** ─────────── utilы/навигация ─────────── */
    const pkToKey = useCallback((pk: Record<string, unknown>) =>
            Object.keys(pk).sort().map(k => `${k}:${String(pk[k])}`).join('|')
        , []);

    const handleRowClick = useCallback((rowPk: Record<string, unknown>) => {
        if (!formIdForSub) return;
        setLastPrimary(rowPk);
        setSelectedKey(pkToKey(rowPk));
        loadSubDisplay(formIdForSub, currentOrder, rowPk);
    }, [formIdForSub, pkToKey, loadSubDisplay, currentOrder]);

    const handleTabClick = useCallback((order: number) => {
        const next = availableOrders.includes(order) ? order : (availableOrders[0] ?? 0);
        if (next === activeSubOrder) return;
        setActiveSubOrder(next);
        if (!formIdForSub || Object.keys(lastPrimary).length === 0) return;
        loadSubDisplay(formIdForSub, next, lastPrimary);
    }, [availableOrders, activeSubOrder, formIdForSub, lastPrimary, loadSubDisplay]);

    /** ─────────── drill dialog (хук) ─────────── */
    const {open, formId, loading, display, error, closeDialog, openDialog} = ((() => {
        const d = useDrillDialog();
        return {
            open: d.open, formId: d.formId, loading: d.loading, display: d.display, error: d.error, closeDialog: d.closeDialog,
            openDialog: d.openDialog,
        };
    })());

    /** ─────────── CRUD main (хук) ─────────── */
    const {
        isAdding, draft, saving,
        editingRowIdx, editDraft, editSaving,
        deletingRowIdx,
        startAdd, cancelAdd, submitAdd,
        startEdit, cancelEdit, submitEdit,
        deleteRow,
        setDraft, setEditDraft,
    } = useMainCrud({
        formDisplay,
        selectedWidget,
        selectedFormId,
        formsByWidget,
        activeFilters,
        setFormDisplay: (v) => setFormDisplay(v),
        reloadTree,
        isColReadOnly,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        setSubDisplay,
        pkToKey,
        lastPrimary,
        setLastPrimary,
        setSelectedKey,
    });

    /** ─────────── UI ─────────── */
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
                        isAddingSub={false /* sub-кнопки решает SubWormTable */}
                        cancelAddSub={() => {}}
                        savingSub={false}
                        startAddSub={() => {}}
                        submitAddSub={() => {}}

                        isAdding={isAdding}
                        showSubActions={!!subDisplay && Object.keys(lastPrimary).length > 0}
                        selectedFormId={selectedFormId}
                        selectedWidget={selectedWidget}
                        saving={saving}
                        startAdd={startAdd}
                        submitAdd={submitAdd}
                        cancelAdd={cancelAdd}
                        showSearch={!!currentForm?.search_bar}
                        value={q}
                        onChange={setQ}
                        onResetFilters={handleResetFilters}
                        collapsedWidth={160}
                        expandedWidth={420}
                    />

                    <MainTable
                        headerPlan={headerPlan as any}
                        showSubHeaders={showSubHeaders}
                        onToggleSubHeaders={() => setShowSubHeaders(v => !v)}

                        isAdding={isAdding}
                        draft={draft}
                        onDraftChange={(tcId, v) => setDraft(prev => ({...prev, [tcId]: v}))}

                        flatColumnsInRenderOrder={flatColumnsInRenderOrder}
                        isColReadOnly={isColReadOnly}
                        placeholderFor={(c) => c.placeholder ?? c.column_name}

                        filteredRows={filteredRows}
                        valueIndexByKey={valueIndexByKey}

                        selectedKey={selectedKey}
                        pkToKey={pkToKey}

                        editingRowIdx={editingRowIdx}
                        editDraft={editDraft}
                        onEditDraftChange={(tcId, v) => setEditDraft(prev => ({...prev, [tcId]: v}))}
                        onSubmitEdit={submitEdit}
                        onCancelEdit={cancelEdit}
                        editSaving={editSaving}

                        onRowClick={handleRowClick}
                        onStartEdit={startEdit}
                        onDeleteRow={deleteRow}
                        deletingRowIdx={deletingRowIdx}

                        onOpenDrill={(fid) => openDialog(fid)}
                    />

                    <SubWormTable
                        setEditSaving={() => {}}
                        editDraft={{}}
                        editingRowIdx={null}
                        setEditDraft={() => {}}
                        setEditingRowIdx={() => {}}
                        editSaving={false}
                        draftSub={{}}
                        setDraftSub={() => {}}
                        isAddingSub={false}
                        setIsAddingSub={() => {}}
                        currentOrder={currentOrder}
                        currentWidgetId={currentWidgetId}
                        subHeaderGroups={subHeaderGroups}
                        formId={formIdForSub}
                        subLoading={subLoading}
                        subError={subError}
                        subDisplay={subDisplay}
                        handleTabClick={handleTabClick}
                    />
                </div>
            </div>

            <DrillDialog
                open={open}
                formId={formId}
                loading={loading}
                error={error}
                display={display}
                onClose={closeDialog}
            />
        </ThemeProvider>
    );
};
