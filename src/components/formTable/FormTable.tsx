import React, {useCallback, useEffect, useMemo, useState} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {
    FormDisplay,
    SubDisplay,
    WidgetForm,
    FormTreeColumn,
    Widget,
} from '@/shared/hooks/useWorkSpaces';
import {api} from '@/services/api';


import {ThemeProvider} from '@mui/material';
import {dark} from '@/shared/themeUI/themeModal/ThemeModalUI';
import {TableToolbar} from '@/components/tableToolbar/TableToolbar';
import {useDrillDialog} from '@/components/formTable/hooks/useDrillDialog';
import {useMainCrud} from '@/components/formTable/hooks/useMainCrud';
import {useFiltersTree} from '@/components/formTable/hooks/useFiltersTree';
import {TreeFormTable} from "@/components/formTable/treeForm/TreeFormTable";
import {MainTable} from "@/components/formTable/parts/MainTable";
import {SubWormTable} from "@/components/formTable/subForm/SubFormTable";
import {DrillDialog} from "@/components/formTable/parts/DrillDialog";
import {useHeaderPlan} from "@/components/formTable/hooks/useHeaderPlan";
import {useSubCrud} from "@/components/formTable/hooks/useSubCrud";
import {useSubNav} from "@/components/formTable/hooks/useSubNav";
import {useFormSearch} from "@/components/formTable/hooks/useFormSearch";
import {useTreeHandlers} from "@/components/formTable/hooks/useTreeHandlers";


/** Модель шапки (совместима с твоей) */
export type HeaderModelItem = {
    id: number;         // widget_column_id
    title: string;      // заголовок группы (alias/fallback)
    labels: string[];   // подписи для каждой reference
    visible?: boolean;  // WC.visible
    refIds?: number[];  // порядок table_column_id
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
    loadFilteredFormDisplay: (formId: number, filter: {
        table_column_id: number;
        value: string | number
    }) => Promise<void>;
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
                                               headerGroups,
                                               subHeaderGroups,
                                               formsById,
                                           }) => {
    /** ─────────── локальные состояния ─────────── */

    const [showSubHeaders, setShowSubHeaders] = useState(false);
    const [editingRowIdxSub, setEditingRowIdxSub] = useState<number | null>(null);
    const [editDraftSub, setEditDraftSub] = useState<Record<number, string>>({});
    const [editSavingSub, setEditSavingSub] = useState(false);
    const [clickMode, setClickMode] = useState<boolean | null>(null);


    /** ─────────── форма/сабы ─────────── */
    const baseForm: WidgetForm | null = useMemo(() => {
        if (selectedFormId != null) return formsById[selectedFormId] ?? null;
        if (selectedWidget) return formsByWidget[selectedWidget.id] ?? null;
        return null;
    }, [selectedFormId, selectedWidget, formsById, formsByWidget]);

    const [overrideForm, setOverrideForm] = useState<WidgetForm | null>(null);
    const currentForm: WidgetForm | null = overrideForm ?? baseForm;

    useEffect(() => {
        setOverrideForm(null);
    }, [selectedFormId]);

    const subWidgetIdByOrder = useMemo(() => {
        const map: Record<number, number> = {};
        currentForm?.sub_widgets?.forEach(sw => {
            map[sw.widget_order] = sw.sub_widget_id;
        });
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

    const {
        lastPrimary, setLastPrimary,
        selectedKey, setSelectedKey,
        activeSubOrder, setActiveSubOrder,
        pkToKey,
        handleRowClick,
        handleTabClick,
    } = useSubNav({
        formIdForSub,
        availableOrders,
        loadSubDisplay,
    });

    const currentOrder = useMemo(
        () => (availableOrders.includes(activeSubOrder) ? activeSubOrder : (availableOrders[0] ?? 0)),
        [activeSubOrder, availableOrders]
    );
    const currentWidgetId = currentOrder != null ? subWidgetIdByOrder[currentOrder] : undefined;
    /** ─────────── дерево значений (живое) ─────────── */
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
            setLiveTree(Array.isArray(data) ? data : [data]);
        } catch (e) {
            console.warn('Не удалось обновить справочники (tree):', e);
        }
    }, [selectedFormId, currentForm]);

    /** ─────────── построение шапки/колонок ─────────── */

    const {
        headerPlan,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        isColReadOnly,
    } = useHeaderPlan(formDisplay); // headerGroups теперь не влияет

    /** ─────────── фильтры/дерево (хук) ─────────── */
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
    }, [
        selectedFormId, selectedWidget, availableOrders,
        setSubDisplay, resetFiltersHard, reloadTree
    ]);

    /** ─────────── drill dialog (хук) ─────────── */
    const {open, formId, loading, display, error, closeDialog, openDialog} = ((() => {
        const d = useDrillDialog();
        return {
            open: d.open,
            formId: d.formId,
            loading: d.loading,
            display: d.display,
            error: d.error,
            closeDialog: d.closeDialog,
            openDialog: d.openDialog,
        };
    })());


    useEffect(() => {
        // аккуратно, display может быть null вначале
        const cols = display?.columns ?? [];
        const types = cols.map((c, i) => ({ i, table_column_id: c.table_column_id, type: c?.type }));
        // eslint-disable-next-line no-console
        console.groupCollapsed('%c[FormTable] display snapshot', 'color: #0aa');
        console.log({ open, formId, loading, error });
        console.log('columns.length:', cols.length);
        console.table(types);
        console.groupEnd();
    }, [display, open, formId, loading, error]);





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


    const { showSearch, q, setQ, filteredRows } = useFormSearch(
        formDisplay,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        currentForm?.search_bar,
        { threshold: 0.35, distance: 120, debounceMs: 250 } // опционально
    );

    const {
        isAddingSub,
        setIsAddingSub,
        draftSub,
        setDraftSub,
        savingSub,
        startAddSub,
        cancelAddSub,
        submitAddSub,
    } = useSubCrud({
        formIdForSub,
        currentWidgetId,
        currentOrder,
        loadSubDisplay,
        lastPrimary,
        subDisplay,
    });


    // внутри компонента FormTable, рядом с useHeaderPlan / до рендера
    const isComboboxRoot = useMemo(
        () => (formDisplay?.columns ?? []).some(c => c?.type === 'combobox'),
        [formDisplay]
    );

    const handleOpenDrillFromMain = useCallback(
        (fid?: number | null, meta?: { originColumnType?: 'combobox' | null }) => {
            const isCombo = meta?.originColumnType === 'combobox';
            setClickMode(isCombo);
            console.log('[FormTable] openDrill', { fid, originColumnType: meta?.originColumnType, isCombo });
            openDialog(fid);
        },
        [openDialog]
    );

    useEffect(() => {
        if (!open) setClickMode(null);
    }, [open]);


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

            <DrillDialog
                open={open}
                formId={formId}
                isComboboxRoot={!!clickMode}
                display={display}           // это main display, который уже грузит useDrillDialog
                formsById={formsById}       // ← добавили
                onClose={closeDialog}
            />
        </ThemeProvider>
    );
};
