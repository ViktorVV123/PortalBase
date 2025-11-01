import React, {useCallback, useEffect, useMemo, useState} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {
    FormDisplay, SubDisplay, WidgetForm, FormTreeColumn, Widget,
} from '@/shared/hooks/useWorkSpaces';
import {api} from '@/services/api';

import {ThemeProvider} from '@mui/material';
import {dark} from '@/shared/themeUI/themeModal/ThemeModalUI';
import {TableToolbar} from '@/components/tableToolbar/TableToolbar';
// ⛔️ удалено: import {useDrillDialog} from '@/components/formTable/hooks/useDrillDialog';
import {useMainCrud} from '@/components/formTable/hooks/useMainCrud';
import {useFiltersTree} from '@/components/formTable/hooks/useFiltersTree';
import {TreeFormTable} from '@/components/formTable/treeForm/TreeFormTable';
import {MainTable} from '@/components/formTable/parts/MainTable';
import {SubWormTable} from '@/components/formTable/subForm/SubFormTable';
import {DrillDialog} from '@/components/formTable/parts/DrillDialog';
import {useHeaderPlan} from '@/components/formTable/hooks/useHeaderPlan';
import {useSubCrud} from '@/components/formTable/hooks/useSubCrud';
import {useSubNav} from '@/components/formTable/hooks/useSubNav';
import {useFormSearch} from '@/components/formTable/hooks/useFormSearch';
import {useTreeHandlers} from '@/components/formTable/hooks/useTreeHandlers';

export type HeaderModelItem = {
    id: number;
    title: string;
    labels: string[];
    visible?: boolean;
    refIds?: number[];
    span: number;
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
    subHeaderGroups?: HeaderModelItem[];
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
                                               subHeaderGroups,
                                               formsById,
                                           }) => {
    /** ───────── UI локальные состояния ───────── */
    const [showSubHeaders, setShowSubHeaders] = useState(false);
    const [editingRowIdxSub, setEditingRowIdxSub] = useState<number | null>(null);
    const [editDraftSub, setEditDraftSub] = useState<Record<number, string>>({});
    const [editSavingSub, setEditSavingSub] = useState(false);

    /** ───────── DRILL-модалка: локальное управление ───────── */
    const [drillOpen, setDrillOpen] = useState(false);
    const [drillFormId, setDrillFormId] = useState<number | null>(null);
    const [drillComboboxMode, setDrillComboboxMode] = useState(false);
    const [drillInitialPrimary, setDrillInitialPrimary] = useState<Record<string, unknown> | undefined>(undefined);

    /** ───────── форма/сабы ───────── */
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

    const {
        lastPrimary, setLastPrimary,
        selectedKey, setSelectedKey,
        activeSubOrder, setActiveSubOrder,
        pkToKey, handleRowClick, handleTabClick,
    } = useSubNav({ formIdForSub, availableOrders, loadSubDisplay });

    useEffect(() => {
        setActiveSubOrder(prev => availableOrders.includes(prev) ? prev : (availableOrders[0] ?? 0));
        setSubDisplay(null);
    }, [availableOrders, setSubDisplay, setActiveSubOrder]);

    const currentOrder = useMemo(
        () => (availableOrders.includes(activeSubOrder) ? activeSubOrder : (availableOrders[0] ?? 0)),
        [activeSubOrder, availableOrders]
    );
    const currentWidgetId = currentOrder != null ? subWidgetIdByOrder[currentOrder] : undefined;

    /** ───────── дерево ───────── */
    const tree = selectedFormId ? formTrees[selectedFormId] : null;
    const [liveTree, setLiveTree] = useState<FormTreeColumn[] | null>(null);
    useEffect(() => { setLiveTree(tree ?? null); }, [tree, selectedFormId]);

    const reloadTree = useCallback(async () => {
        const fid = selectedFormId ?? currentForm?.form_id ?? null;
        if (!fid) return;
        try {
            const {data} = await api.post<FormTreeColumn[] | FormTreeColumn>(`/display/${fid}/tree`);
            setLiveTree(Array.isArray(data) ? data : [data]);
        } catch (e) {
            console.warn('Не удалось обновить справочники (tree):', e);
        }
    }, [selectedFormId, currentForm]);

    /** ───────── шапка/план ───────── */
    const { headerPlan, flatColumnsInRenderOrder, valueIndexByKey, isColReadOnly } = useHeaderPlan(formDisplay);

    /** ───────── фильтры/дерево ───────── */
    const {
        activeFilters, setActiveFilters,
        nestedTrees, setNestedTrees,
        activeExpandedKey, setActiveExpandedKey,
        resetFiltersHard,
    } = useFiltersTree(selectedFormId, (v) => setFormDisplay(v));

    const { handleNestedValueClick, handleTreeValueClick } = useTreeHandlers({
        selectedFormId,
        activeFilters,
        setActiveFilters,
        setNestedTrees,
        setActiveExpandedKey,
        setFormDisplay,
        setSubDisplay,
    });

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
    }, [selectedFormId, selectedWidget, availableOrders, setSubDisplay, resetFiltersHard, reloadTree, setActiveFilters, setActiveExpandedKey, setSelectedKey, setLastPrimary, setActiveSubOrder]);

    /** ───────── CRUD main ───────── */
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

    /** ───────── Поиск ───────── */
    const { showSearch, q, setQ, filteredRows } = useFormSearch(
        formDisplay,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        currentForm?.search_bar,
        { threshold: 0.35, distance: 120, debounceMs: 250 }
    );

    /** ───────── SUB CRUD ───────── */
    const {
        isAddingSub, setIsAddingSub, draftSub, setDraftSub, savingSub,
        startAddSub, cancelAddSub, submitAddSub,
    } = useSubCrud({
        formIdForSub,
        currentWidgetId,
        currentOrder,
        loadSubDisplay,
        lastPrimary,
        subDisplay,
    });

    /** ───────── Открытие DRILL из MainTable ───────── */
    const handleOpenDrillFromMain = useCallback(
        (fid?: number | null, meta?: { originColumnType?: 'combobox' | null; primary?: Record<string, unknown> }) => {
            if (!fid) return;
            setDrillFormId(fid);
            setDrillComboboxMode(meta?.originColumnType === 'combobox'); // фиксируем режим на момент клика
            setDrillInitialPrimary(meta?.primary || undefined);          // сохраняем PK (для сабов)
            setDrillOpen(true);
        },
        []
    );

    /** очистка при закрытии модалки */
    useEffect(() => {
        if (!drillOpen) {
            setDrillComboboxMode(false);
            setDrillInitialPrimary(undefined);
        }
    }, [drillOpen]);

    /** ───────── UI ───────── */
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
                    handleNestedValueClick={handleNestedValueClick}
                    handleTreeValueClick={handleTreeValueClick}
                />

                {/* RIGHT: MAIN + SUB */}
                <div className={s.mainCol}>
                    <TableToolbar
                        showSubActions={!!subDisplay && Object.keys(lastPrimary).length > 0}
                        cancelAddSub={cancelAddSub}
                        startAddSub={startAddSub}
                        isAddingSub={isAddingSub}
                        submitAddSub={submitAddSub}
                        savingSub={savingSub}
                        isAdding={isAdding}
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

                    <MainTable
                        headerPlan={headerPlan as any}
                        showSubHeaders={showSubHeaders}
                        onToggleSubHeaders={() => setShowSubHeaders(v => !v)}
                        onOpenDrill={handleOpenDrillFromMain}
                        isAdding={isAdding}
                        draft={draft}
                        onDraftChange={(tcId, v) => setDraft(prev => ({ ...prev, [tcId]: v }))}
                        flatColumnsInRenderOrder={flatColumnsInRenderOrder}
                        isColReadOnly={isColReadOnly}
                        placeholderFor={(c) => c.placeholder ?? c.column_name}
                        filteredRows={filteredRows}
                        valueIndexByKey={valueIndexByKey}
                        selectedKey={selectedKey}
                        pkToKey={pkToKey}
                        editingRowIdx={editingRowIdx}
                        editDraft={editDraft}
                        onEditDraftChange={(tcId, v) => setEditDraft(prev => ({ ...prev, [tcId]: v }))}
                        onSubmitEdit={submitEdit}
                        onCancelEdit={cancelEdit}
                        editSaving={editSaving}
                        onRowClick={handleRowClick}
                        onStartEdit={startEdit}
                        onDeleteRow={deleteRow}
                        deletingRowIdx={deletingRowIdx}
                    />

                    <SubWormTable
                        editingRowIdx={editingRowIdxSub}
                        setEditingRowIdx={setEditingRowIdxSub}
                        editDraft={editDraftSub}
                        setEditDraft={setEditDraftSub}
                        editSaving={editSavingSub}
                        setEditSaving={setEditSavingSub}
                        isAddingSub={isAddingSub}
                        setIsAddingSub={setIsAddingSub}
                        draftSub={draftSub}
                        setDraftSub={setDraftSub}
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

            {/* DRILL-модалка: без useDrillDialog, управляем локально */}
            <DrillDialog

                onSyncParentMain={async (fid) => {
                    try {
                        const { data } = await api.post<FormDisplay | FormDisplay[]>(`/display/${fid}/main`, activeFilters);
                        const next = Array.isArray(data) ? data[0] : data;
                        if (next) setFormDisplay(next);
                    } catch (e) {
                        console.warn('[FormTable] onSyncParentMain failed:', e);
                    }
                }}
                open={drillOpen}
                onClose={() => setDrillOpen(false)}
                formId={drillFormId}
                /* display не передаём — модалка сама загрузит main для formId */
                formsById={formsById}
                comboboxMode={drillComboboxMode}                            // фиксированный режим
                selectedWidget={selectedWidget ? { id: selectedWidget.id } : null}
                formsByWidget={formsByWidget}
                loadSubDisplay={loadSubDisplay}
                initialPrimary={drillInitialPrimary}
            />
        </ThemeProvider>
    );
};
