// DrillDialog.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    Button, Dialog, DialogActions, DialogContent, DialogTitle, ThemeProvider,
} from '@mui/material';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {dark} from '@/shared/themeUI/themeModal/ThemeModalUI';
import {api} from '@/services/api';

import {TableToolbar} from '@/components/tableToolbar/TableToolbar';
import {TreeFormTable} from '@/components/formTable/treeForm/TreeFormTable';
import {MainTable} from '@/components/formTable/parts/MainTable';
import {SubWormTable} from '@/components/formTable/subForm/SubFormTable';

import {useHeaderPlan} from '@/components/formTable/hooks/useHeaderPlan';
import {useFiltersTree} from '@/components/formTable/hooks/useFiltersTree';
import {useSubNav} from '@/components/formTable/hooks/useSubNav';
import {useFormSearch} from '@/components/formTable/hooks/useFormSearch';
import {useSubCrud} from '@/components/formTable/hooks/useSubCrud';
import {useTreeHandlers} from '@/components/formTable/hooks/useTreeHandlers';
import {useMainCrud} from '@/components/formTable/hooks/useMainCrud';

import type {
    FormDisplay, SubDisplay, WidgetForm, FormTreeColumn,
} from '@/shared/hooks/useWorkSpaces';

type Props = {
    open: boolean;
    formId: number | null;
    display?: FormDisplay | null; // можно передать initial, но не обязательно
    formsById: Record<number, WidgetForm>;
    onClose: () => void;

    /** Режим фиксируем извне на момент клика (combobox | только main) */
    comboboxMode: boolean;

    /** Для enable Add в main */
    selectedWidget: { id: number } | null;
    formsByWidget: Record<number, { form_id: number }>;

    /** Для саб-части */
    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;

    /** PK строки, по которой открыли модалку (для подсветки/сабов) */
    initialPrimary?: Record<string, unknown>;
};

const safe = (v?: string | null) => (v?.trim() ? v.trim() : '—');

export const DrillDialog: React.FC<Props> = ({
                                                 open,
                                                 formId,
                                                 display,
                                                 formsById,
                                                 onClose,
                                                 comboboxMode,
                                                 selectedWidget,
                                                 formsByWidget,
                                                 loadSubDisplay,       // не используем, но оставляем сигнатуру
                                                 initialPrimary,
                                             }) => {

    // --- guards: без open или formId не рендерим модалку вовсе
    if (!open || !formId) return null;

    /** ─── стек форм ─── */
    const [formStack, setFormStack] = useState<number[]>([formId]);
    const currentFormId = formStack[formStack.length - 1] ?? null;
    useEffect(() => { if (open && formId) setFormStack([formId]); }, [open, formId]);

    const pushForm = useCallback((fid: number) => {
        if (!fid) return;
        setFormStack(prev => (prev[prev.length - 1] === fid ? prev : [...prev, fid]));
    }, []);
    const popForm = useCallback(() => {
        setFormStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
    }, []);

    /** ─── метаданные формы ─── */
    const currentForm: WidgetForm | null = useMemo(
        () => (currentFormId ? (formsById[currentFormId] ?? null) : null),
        [currentFormId, formsById]
    );

    /** ─── режим (lock) ─── */
    const [isComboboxMode] = useState<boolean>(!!comboboxMode);

    /** ─── main display (локально) ─── */
    const [localDisplay, setLocalDisplay] = useState<FormDisplay | null>(
        display && formId === currentFormId ? display : null
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // предохранитель от повторной загрузки одного и того же fid
    const lastLoadedRef = useRef<number | null>(null);
    const inflightRef   = useRef<boolean>(false);

    const fetchMain = useCallback(async (fid: number) => {
        if (!fid) return;
        if (inflightRef.current) return;
        if (lastLoadedRef.current === fid && localDisplay) return; // уже загружали и есть данные

        inflightRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.post<FormDisplay | FormDisplay[]>(`/display/${fid}/main`);
            const d = Array.isArray(data) ? data[0] : data;
            setLocalDisplay(d ?? null);
            lastLoadedRef.current = fid;
        } catch (e: any) {
            console.error('[DrillDialog] fetchMain error:', e);
            setError(String(e?.message ?? 'Ошибка загрузки формы'));
            setLocalDisplay(null);
        } finally {
            inflightRef.current = false;
            setLoading(false);
        }
    }, [localDisplay]);

    useEffect(() => {
        if (!currentFormId) return;
        // если дали initial display и он соответствует текущей форме — используем
        if (display && formId === currentFormId) {
            setLocalDisplay(display);
            lastLoadedRef.current = currentFormId;
            return;
        }
        // иначе грузим один раз на форму
        fetchMain(currentFormId).catch(() => {});
    }, [currentFormId, display, formId, fetchMain]);

    /** ─── SUB ─── */
    const [subDisplay, setSubDisplay] = useState<SubDisplay | null>(null);

    const fetchSub = useCallback(
        async (fid: number, order: number, primary?: Record<string, unknown>) => {
            const params = new URLSearchParams({ sub_widget_order: String(order) });
            const body =
                primary && Object.keys(primary).length
                    ? { primary_keys: Object.fromEntries(Object.entries(primary).map(([k, v]) => [k, String(v)])) }
                    : {};
            const { data } = await api.post<SubDisplay>(`/display/${fid}/sub?${params}`, body);
            setSubDisplay(data);
        }, []
    );

    /** ─── TREE ─── */
    const [liveTree, setLiveTree] = useState<FormTreeColumn[] | null>(null);
    const fetchTree = useCallback(async (fid: number) => {
        const { data } = await api.post<FormTreeColumn[] | FormTreeColumn>(`/display/${fid}/tree`);
        setLiveTree(Array.isArray(data) ? data : [data]);
    }, []);
    const reloadTree = useCallback(async () => {
        if (!currentFormId || !isComboboxMode) return;
        try { await fetchTree(currentFormId); } catch {}
    }, [currentFormId, isComboboxMode, fetchTree]);

    useEffect(() => {
        if (currentFormId && isComboboxMode) {
            fetchTree(currentFormId).catch(() => {});
        } else {
            setLiveTree(null);
        }
    }, [currentFormId, isComboboxMode, fetchTree]);

    /** ─── Header/Plan ─── */
    const {
        headerPlan,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        isColReadOnly,
    } = useHeaderPlan(
        localDisplay ?? ({columns: [], data: [], displayed_widget: {name: '', description: ''}} as FormDisplay)
    );

    /** ─── Filters / Tree handlers ─── */
    const {
        activeFilters, setActiveFilters,
        nestedTrees, setNestedTrees,
        activeExpandedKey, setActiveExpandedKey,
        resetFiltersHard,
    } = useFiltersTree(currentFormId, setLocalDisplay);

    const { handleNestedValueClick, handleTreeValueClick } = useTreeHandlers({
        selectedFormId: currentFormId,
        activeFilters,
        setActiveFilters,
        setNestedTrees,
        setActiveExpandedKey,
        setFormDisplay: setLocalDisplay,
        setSubDisplay,
    });

    /** ─── Навигация/primary для сабов ─── */
    const availableOrders = useMemo<number[]>(
        () => (currentForm?.sub_widgets ?? []).map(sw => sw.widget_order).sort((a, b) => a - b),
        [currentForm]
    );

    const {
        lastPrimary, setLastPrimary,
        selectedKey, setSelectedKey,
        activeSubOrder, setActiveSubOrder,
        pkToKey,
        handleRowClick,
    } = useSubNav({
        formIdForSub: currentFormId,
        availableOrders,
        loadSubDisplay: (fid, order, primary) => {
            if (!isComboboxMode || !fid) return;
            return fetchSub(fid, order, primary);
        },
    });

    useEffect(() => {
        setActiveSubOrder(prev => (availableOrders.includes(prev) ? prev : (availableOrders[0] ?? 0)));
    }, [availableOrders, setActiveSubOrder]);

    useEffect(() => {
        if (!isComboboxMode || !currentFormId) return;
        const hasPrimary = initialPrimary && Object.keys(initialPrimary).length > 0;
        if (!hasPrimary) return;
        setLastPrimary(initialPrimary!);
        setSelectedKey(pkToKey(initialPrimary!));
    }, [isComboboxMode, currentFormId, initialPrimary, pkToKey, setLastPrimary, setSelectedKey]);

    /** ─── Поиск ─── */
    const { showSearch, q, setQ, filteredRows } = useFormSearch(
        localDisplay ?? ({columns: [], data: [], displayed_widget: {name: '', description: ''}} as FormDisplay),
        flatColumnsInRenderOrder,
        valueIndexByKey,
        currentForm?.search_bar,
        { threshold: 0.35, distance: 120, debounceMs: 250 }
    );

    /** ─── CRUD main ─── */
    const selectedWidgetForPreflight = useMemo(() => {
        const wid = (currentForm as any)?.widget_id as number | undefined;
        return wid ? ({ id: wid } as any) : null;
    }, [currentForm]);

    const {
        isAdding, draft, saving,
        editingRowIdx, editDraft, editSaving,
        deletingRowIdx,
        startAdd, cancelAdd, submitAdd,
        startEdit, cancelEdit, submitEdit,
        deleteRow,
        setDraft, setEditDraft,
    } = useMainCrud({
        formDisplay: (localDisplay ?? ({columns: [], data: [], displayed_widget: {name: '', description: ''}} as FormDisplay)),
        selectedWidget: selectedWidgetForPreflight,
        selectedFormId: currentFormId,
        formsByWidget: formsByWidget as any,
        activeFilters,
        setFormDisplay: (v) => setLocalDisplay(v),
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

    /** ─── SUB CRUD (только combobox) ─── */
    const {
        isAddingSub, setIsAddingSub, draftSub, setDraftSub,
        savingSub, startAddSub, cancelAddSub, submitAddSub,
    } = useSubCrud({
        formIdForSub: isComboboxMode ? currentFormId : null,
        currentWidgetId: isComboboxMode
            ? (
                (availableOrders.includes(activeSubOrder)
                        ? currentForm?.sub_widgets?.find(sw => sw.widget_order === activeSubOrder)?.sub_widget_id
                        : currentForm?.sub_widgets?.[0]?.sub_widget_id
                ) ?? undefined
            )
            : undefined,
        currentOrder: isComboboxMode
            ? (availableOrders.includes(activeSubOrder) ? activeSubOrder : (availableOrders[0] ?? 0))
            : 0,
        loadSubDisplay: (fid, order, primary) => {
            if (!isComboboxMode || !fid) return;
            return fetchSub(fid, order, primary);
        },
        lastPrimary,
        subDisplay,
    });

    const onSubTabClick = useCallback(async (order: number) => {
        if (!isComboboxMode) return;
        setActiveSubOrder(order);
        if (currentFormId && Object.keys(lastPrimary).length) {
            fetchSub(currentFormId, order, lastPrimary);
        } else {
            setSubDisplay(null);
        }
    }, [isComboboxMode, currentFormId, lastPrimary, fetchSub, setActiveSubOrder]);

    /** ─── Drill внутри модалки ─── */
    const handleOpenDrill = useCallback((nextId?: number | null) => {
        if (!nextId) return;
        pushForm(nextId);
        setActiveFilters([]);
        setActiveExpandedKey(null);
        setSelectedKey(null);
        setLastPrimary({});
        setSubDisplay(null);
        // сбрасываем маркер загруженной формы, чтобы новая подформа подгрузилась один раз
        lastLoadedRef.current = null;
        setLocalDisplay(null);
    }, [pushForm, setActiveFilters, setActiveExpandedKey, setSelectedKey, setLastPrimary]);

    /** ─── UI ─── */
    const [showSubHeaders, setShowSubHeaders] = useState(false);

    const handleResetFilters = useCallback(async () => {
        if (!currentFormId) return;
        setActiveFilters([]);
        setActiveExpandedKey(null);
        setSelectedKey(null);
        setLastPrimary({});
        setSubDisplay(null);
        setActiveSubOrder(availableOrders[0] ?? 0);
        try {
            await resetFiltersHard();
            if (isComboboxMode) await reloadTree();
        } catch {}
    }, [currentFormId, availableOrders, isComboboxMode, setActiveExpandedKey, setSelectedKey, setLastPrimary, setSubDisplay, setActiveSubOrder, resetFiltersHard, reloadTree, setActiveFilters]);

    if (!currentFormId) return null;

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
            <DialogTitle style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                {formStack.length > 1 && (
                    <Button size="small" onClick={popForm}>Назад</Button>
                )}
                Форма #{currentFormId} {localDisplay ? `— ${safe(localDisplay.displayed_widget?.name)}` : ''}
                {!isComboboxMode && <span style={{marginLeft: 8, opacity: .7}}>(только Main)</span>}
            </DialogTitle>

            <DialogContent dividers>
                <ThemeProvider theme={dark}>
                    {loading && <div style={{opacity: 0.7, padding: 12}}>Загрузка…</div>}
                    {!!error && <div style={{color: '#f66', padding: 12}}>Ошибка: {error}</div>}

                    {!localDisplay ? (
                        <div style={{opacity: 0.7, padding: 12}}>Готовлю данные…</div>
                    ) : (
                        <div className={s.contentRow}>
                            {isComboboxMode && (
                                <TreeFormTable
                                    tree={liveTree}
                                    widgetForm={currentForm}
                                    activeExpandedKey={activeExpandedKey}
                                    nestedTrees={nestedTrees}
                                    handleResetFilters={handleResetFilters}
                                    handleNestedValueClick={handleNestedValueClick}
                                    handleTreeValueClick={handleTreeValueClick}
                                />
                            )}

                            <div className={s.mainCol}>
                                <TableToolbar
                                    showSubActions={isComboboxMode && !!subDisplay && Object.keys(lastPrimary).length > 0}
                                    cancelAddSub={cancelAddSub}
                                    startAddSub={startAddSub}
                                    isAddingSub={isComboboxMode ? isAddingSub : false}
                                    submitAddSub={submitAddSub}
                                    savingSub={isComboboxMode ? savingSub : false}
                                    isAdding={isAdding}
                                    selectedFormId={currentFormId}
                                    selectedWidget={selectedWidget ? { id: selectedWidget.id } as any : null}
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
                                    showSubHeaders={isComboboxMode ? showSubHeaders : false}
                                    onToggleSubHeaders={() => isComboboxMode && setShowSubHeaders(v => !v)}
                                    onOpenDrill={isComboboxMode ? handleOpenDrill : undefined}
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

                                {isComboboxMode && (
                                    <SubWormTable
                                        editingRowIdx={null}
                                        setEditingRowIdx={() => {}}
                                        editDraft={{}}
                                        setEditDraft={() => {}}
                                        editSaving={false}
                                        setEditSaving={() => {}}
                                        isAddingSub={isAddingSub}
                                        setIsAddingSub={setIsAddingSub}
                                        draftSub={draftSub}
                                        setDraftSub={setDraftSub}
                                        currentOrder={availableOrders.includes(activeSubOrder) ? activeSubOrder : (availableOrders[0] ?? 0)}
                                        currentWidgetId={
                                            (availableOrders.includes(activeSubOrder)
                                                ? currentForm?.sub_widgets?.find(sw => sw.widget_order === activeSubOrder)?.sub_widget_id
                                                : currentForm?.sub_widgets?.[0]?.sub_widget_id) ?? undefined
                                        }
                                        subHeaderGroups={undefined}
                                        formId={currentFormId}
                                        subLoading={false}
                                        subError={null as any}
                                        subDisplay={subDisplay}
                                        handleTabClick={order => onSubTabClick(order)}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </ThemeProvider>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
};
