import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {
    FormDisplay,
    SubDisplay,
    WidgetForm,
    FormTreeColumn,
    Widget,
} from '@/shared/hooks/useWorkSpaces';
import { api } from '@/services/api';

import { ThemeProvider } from '@mui/material';
import { dark } from '@/shared/themeUI/themeModal/ThemeModalUI';
import { TableToolbar } from '@/components/table/tableToolbar/TableToolbar';

import { useMainCrud } from '@/components/Form/mainTable/hook/useMainCrud';
import { useFiltersTree } from '@/components/Form/formTable/hooks/useFiltersTree';
import { TreeFormTable } from '@/components/Form/treeForm/TreeFormTable';
import { MainTable } from '@/components/Form/mainTable/MainTable';
import { SubWormTable } from '@/components/Form/subForm/SubFormTable';
import { DrillDialog } from '@/components/Form/drillDialog/DrillDialog';
import { useHeaderPlan } from '@/components/Form/formTable/hooks/useHeaderPlan';
import { useSubCrud } from '@/components/Form/subForm/hook/useSubCrud';
import { useSubNav } from '@/components/Form/subForm/hook/useSubNav';
import { useFormSearch } from '@/components/Form/formTable/hooks/useFormSearch';
import { useTreeHandlers } from '@/components/Form/treeForm/hooks/useTreeHandlers';

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
    loadFilteredFormDisplay: (formId: number, filter: {
        table_column_id: number;
        value: string | number;
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
    const [drillDisableNested, setDrillDisableNested] = useState(false);
    /** в какой write_tc_id надо записать выбранный PK из DrillDialog */
    const [drillTargetWriteTcId, setDrillTargetWriteTcId] = useState<number | null>(null);

    const [comboReloadToken, setComboReloadToken] = useState(0);
    const [liveTree, setLiveTree] = useState<FormTreeColumn[] | null>(null);

    /** ───────── форма/сабы ───────── */
    const baseForm: WidgetForm | null = useMemo(() => {
        if (selectedFormId != null) return formsById[selectedFormId] ?? null;
        if (selectedWidget) return formsByWidget[selectedWidget.id] ?? null;
        return null;
    }, [selectedFormId, selectedWidget, formsById, formsByWidget]);

    const [overrideForm, setOverrideForm] = useState<WidgetForm | null>(null);
    const currentForm: WidgetForm | null = overrideForm ?? baseForm;

    // ВАЖНО: если меняется выбранная форма или виджет сверху — сбрасываем override,
    // чтобы не тянуть за собой старую форму в другой контекст.
    useEffect(() => {
        setOverrideForm(null);
    }, [selectedFormId, selectedWidget?.id]);

    const subWidgetIdByOrder = useMemo(() => {
        const map: Record<number, number> = {};
        currentForm?.sub_widgets?.forEach((sw) => {
            map[sw.widget_order] = sw.sub_widget_id;
        });
        return map;
    }, [currentForm]);

    const hasSubWidgets = !!(currentForm?.sub_widgets && currentForm.sub_widgets.length > 0);
    const formIdForSub = selectedFormId ?? currentForm?.form_id ?? null;
    // Саб-блок показываем только, когда:
    // 1) у формы вообще есть сабы
    // 2) и уже пошла работа с сабом (загрузка / данные / ошибка)
    const shouldShowSubSection =
        hasSubWidgets && (subLoading || !!subDisplay || !!subError);

    const availableOrders = useMemo(
        () => (currentForm?.sub_widgets ?? [])
            .map((sw) => sw.widget_order)
            .sort((a, b) => a - b),
        [currentForm],
    );

    const {
        lastPrimary,
        setLastPrimary,
        selectedKey,
        setSelectedKey,
        activeSubOrder,
        setActiveSubOrder,
        pkToKey,
        handleRowClick,
        handleTabClick,
    } = useSubNav({ formIdForSub, availableOrders, loadSubDisplay });

    // если набор вкладок поменялся — аккуратно переезжаем на первый order и чистим саб
    useEffect(() => {
        setActiveSubOrder((prev) => (
            availableOrders.includes(prev) ? prev : (availableOrders[0] ?? 0)
        ));
        setSubDisplay(null);
    }, [availableOrders, setSubDisplay, setActiveSubOrder]);

    const currentOrder = useMemo(
        () => (availableOrders.includes(activeSubOrder) ? activeSubOrder : (availableOrders[0] ?? 0)),
        [activeSubOrder, availableOrders],
    );

    const currentWidgetId = currentOrder != null ? subWidgetIdByOrder[currentOrder] : undefined;

    /** ───────── дерево ───────── */
    const tree = selectedFormId ? formTrees[selectedFormId] : null;


    useEffect(() => {
        setLiveTree(tree ?? null);
    }, [tree, selectedFormId]);

    const reloadTree = useCallback(async () => {
        const fid = selectedFormId ?? currentForm?.form_id ?? null;
        if (!fid) return;
        try {
            const { data } = await api.post<FormTreeColumn[] | FormTreeColumn>(`/display/${fid}/tree`);
            setLiveTree(Array.isArray(data) ? data : [data]);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('Не удалось обновить справочники (tree):', e);
        }
    }, [selectedFormId, currentForm]);

    /** ───────── шапка/план ───────── */
    const {
        headerPlan,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        isColReadOnly,
    } = useHeaderPlan(formDisplay);

    /** ───────── фильтры/дерево ───────── */
    const {
        activeFilters,
        setActiveFilters,
        nestedTrees,
        setNestedTrees,
        activeExpandedKey,
        setActiveExpandedKey,
        resetFiltersHard,
    } = useFiltersTree(selectedFormId, (v) => setFormDisplay(v));

    const {
        handleNestedValueClick,
        handleTreeValueClick,
    } = useTreeHandlers({
        selectedFormId,
        activeFilters,
        setActiveFilters,
        setNestedTrees,
        setActiveExpandedKey,
        setFormDisplay,
        setSubDisplay,
    });

    const handleResetFilters = useCallback(async () => {
        if (!selectedFormId) return;

        // Сброс только того, что относится к выбору строки / сабам.
        setSelectedKey(null);
        setLastPrimary({});
        setSubDisplay(null);
        setActiveSubOrder(availableOrders[0] ?? 0);

        try {
            // Фильтры/дерево/activeFilters/expanded внутри себя чистит useFiltersTree.resetFiltersHard
            await resetFiltersHard();
            await reloadTree();
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('❌ Ошибка при сбросе фильтров:', e);
        }
    }, [
        selectedFormId,
        availableOrders,
        setSubDisplay,
        resetFiltersHard,
        reloadTree,
        setSelectedKey,
        setLastPrimary,
        setActiveSubOrder,
    ]);

    /** ───────── CRUD main ───────── */
    const {
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
    } = useMainCrud({
        formDisplay,
        selectedWidget,
        selectedFormId,
        formsByWidget,
        formsById,
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
    const {
        showSearch,
        q,
        setQ,
        filteredRows,
    } = useFormSearch(
        formDisplay,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        currentForm?.search_bar,
        { threshold: 0.35, distance: 120, debounceMs: 250 },
    );

    /** ───────── SUB CRUD ───────── */
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

    /** ───────── Открытие DRILL из MainTable ───────── */
    const handleOpenDrillFromMain = useCallback((
        fid?: number | null,
        meta?: {
            originColumnType?: 'combobox' | null;
            primary?: Record<string, unknown>;
            openedFromEdit?: boolean;
            targetWriteTcId?: number;
        },
    ) => {
        if (!fid) return;
        setDrillFormId(fid);
        setDrillComboboxMode(meta?.originColumnType === 'combobox');
        setDrillInitialPrimary(meta?.primary || undefined);
        setDrillDisableNested(!!meta?.openedFromEdit);
        setDrillTargetWriteTcId(meta?.targetWriteTcId ?? null);
        setDrillOpen(true);
    }, []);

    /** очистка при закрытии модалки */
    useEffect(() => {
        if (!drillOpen) {
            setDrillComboboxMode(false);
            setDrillInitialPrimary(undefined);
            setDrillDisableNested(false);
            setDrillTargetWriteTcId(null);
        }
    }, [drillOpen]);

    /** ───────── Приём выбранной строки из DrillDialog ───────── */
    const handlePickFromDrill = useCallback((
        { primary }: { row: FormDisplay['data'][number]; primary: Record<string, unknown> },
    ) => {
        if (drillTargetWriteTcId == null) return;

        const pkValues = Object.values(primary ?? {});
        const nextId = pkValues.length ? String(pkValues[0]) : '';

        setEditDraft((prev) => ({
            ...prev,
            [drillTargetWriteTcId]: nextId,
        }));

        // сигналим, что нужно перезагрузить combobox-опции
        setComboReloadToken((v) => v + 1);
    }, [drillTargetWriteTcId, setEditDraft]);

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
                        onToggleSubHeaders={() => setShowSubHeaders((v) => !v)}
                        onOpenDrill={handleOpenDrillFromMain}
                        isAdding={isAdding}
                        draft={draft}
                        onDraftChange={(tcId, v) => setDraft((prev) => ({ ...prev, [tcId]: v }))}
                        flatColumnsInRenderOrder={flatColumnsInRenderOrder}
                        isColReadOnly={isColReadOnly}
                        placeholderFor={(c) => c.placeholder ?? c.column_name}
                        filteredRows={filteredRows}
                        valueIndexByKey={valueIndexByKey}
                        selectedKey={selectedKey}
                        pkToKey={pkToKey}
                        editingRowIdx={editingRowIdx}
                        editDraft={editDraft}
                        onEditDraftChange={(tcId, v) => setEditDraft((prev) => ({ ...prev, [tcId]: v }))}
                        onSubmitEdit={submitEdit}
                        onCancelEdit={cancelEdit}
                        editSaving={editSaving}
                        onRowClick={handleRowClick}
                        onStartEdit={startEdit}
                        onDeleteRow={deleteRow}
                        deletingRowIdx={deletingRowIdx}
                        comboReloadToken={comboReloadToken}
                    />

                    {shouldShowSubSection && (
                        <SubWormTable
                            onOpenDrill={handleOpenDrillFromMain}
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
                            comboReloadToken={comboReloadToken}
                        />
                    )}
                </div>
            </div>

            {/* DRILL-модалка */}
            <DrillDialog
                onSyncParentMain={async () => {
                    const fid = selectedFormId ?? currentForm?.form_id ?? null;
                    if (!fid) return;

                    try {
                        const { data } = await api.post<FormDisplay | FormDisplay[]>(`/display/${fid}/main`, activeFilters);
                        const next = Array.isArray(data) ? data[0] : data;
                        if (next) setFormDisplay(next);
                    } catch (e) {
                        // eslint-disable-next-line no-console
                        console.warn('[formTable] onSyncParentMain failed:', e);
                    }
                }}
                open={drillOpen}
                onClose={() => setDrillOpen(false)}
                formId={drillFormId}
                formsById={formsById}
                disableNestedDrill={drillDisableNested}
                comboboxMode={drillComboboxMode}
                selectedWidget={selectedWidget ? { id: selectedWidget.id } : null}
                formsByWidget={formsByWidget}
                loadSubDisplay={loadSubDisplay}
                initialPrimary={drillInitialPrimary}
                onPickFromDrill={drillDisableNested ? handlePickFromDrill : undefined}
                onComboboxChanged={() => setComboReloadToken((v) => v + 1)}
                comboReloadToken={comboReloadToken}
            />
        </ThemeProvider>
    );
};
