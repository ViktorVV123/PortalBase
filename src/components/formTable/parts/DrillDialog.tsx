// DrillDialog.tsx
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    ThemeProvider
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
    FormDisplay,
    SubDisplay,
    WidgetForm,
    FormTreeColumn
} from '@/shared/hooks/useWorkSpaces';

type Props = {
    open: boolean;
    formId: number | null;
    display?: FormDisplay | null;
    formsById: Record<number, WidgetForm>;
    onClose: () => void;
};

const safe = (v?: string | null) => (v?.trim() ? v.trim() : '—');

export const DrillDialog: React.FC<Props> = ({
                                                 open,
                                                 formId,
                                                 display,
                                                 formsById,
                                                 onClose
                                             }) => {
    /** ─── стек форм (drill) ─── */
    const [formStack, setFormStack] = useState<number[]>(() => (formId ? [formId] : []));
    const currentFormId = formStack.length ? formStack[formStack.length - 1] : null;

    useEffect((): void => {
        if (open) setFormStack(formId ? [formId] : []);
        else setFormStack([]);
    }, [open, formId]);

    const pushForm = useCallback((fid: number): void => {
        setFormStack(prev => (prev[prev.length - 1] === fid ? prev : [...prev, fid]));
    }, []);
    const popForm = useCallback((): void => {
        setFormStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
    }, []);

    /** ─── метаданные формы ─── */
    const currentForm: WidgetForm | null = useMemo(
        () => (currentFormId ? (formsById[currentFormId] ?? null) : null),
        [currentFormId, formsById]
    );

    /** ─── локальный main display ─── */
    const [localDisplay, setLocalDisplay] = useState<FormDisplay | null>(display ?? null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMain = useCallback(async (fid: number): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const {data} = await api.post<FormDisplay | FormDisplay[]>(`/display/${fid}/main`);
            setLocalDisplay(Array.isArray(data) ? data[0] : data);
        } catch (e: any) {
            setError(String(e?.message ?? e));
            setLocalDisplay(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect((): void => {
        if (!open) return;
        if (!currentFormId) {
            setLocalDisplay(null);
            return;
        }
        if (display && currentFormId === formId) setLocalDisplay(display);
        else { // @ts-ignore
            fetchMain(currentFormId).catch(() => void 0);
        }
    }, [open, currentFormId, fetchMain, display, formId]);

    /** ─── TREE (живой) ─── */
    const [liveTree, setLiveTree] = useState<FormTreeColumn[] | null>(null);
    const fetchTree = useCallback(async (fid: number): Promise<void> => {
        const {data} = await api.post<FormTreeColumn[] | FormTreeColumn>(`/display/${fid}/tree`);
        setLiveTree(Array.isArray(data) ? data : [data]);
    }, []);
    useEffect((): void => {
        if (open && currentFormId) fetchTree(currentFormId).catch(e => console.warn('tree (modal) load:', e));
        else setLiveTree(null);
    }, [open, currentFormId, fetchTree]);

    const reloadTree = useCallback(async (): Promise<void> => {
        if (!currentFormId) return;
        try { await fetchTree(currentFormId); } catch { /* noop */ }
    }, [currentFormId, fetchTree]);

    /** ─── subDisplay ДОЛЖЕН БЫТЬ ОБЪЯВЛЕН ДО useMainCrud ─── */
    const [subDisplay, setSubDisplay] = useState<SubDisplay | null>(null);

    /** ─── header/plan ─── */
    const {
        headerPlan,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        isColReadOnly,
    } = useHeaderPlan(
        localDisplay ?? ({columns: [], data: [], displayed_widget: {name: '', description: ''}} as FormDisplay)
    );

    /** ─── фильтры/дерево ─── */
    const {
        activeFilters, setActiveFilters,
        nestedTrees, setNestedTrees,
        activeExpandedKey, setActiveExpandedKey,
        resetFiltersHard,
    } = useFiltersTree(currentFormId, setLocalDisplay);

    /** ─── доступные вкладки сабов ─── */
    const availableOrders = useMemo<number[]>(
        () => (currentForm?.sub_widgets ?? []).map(sw => sw.widget_order).sort((a, b) => a - b),
        [currentForm]
    );

    /** ─── навигация/primary для сабов ─── */
    const {
        lastPrimary, setLastPrimary,
        selectedKey, setSelectedKey,
        activeSubOrder, setActiveSubOrder,
        pkToKey,
        handleRowClick,
    } = useSubNav({
        formIdForSub: currentFormId,
        availableOrders,
        loadSubDisplay: async () => { /* фактическую загрузку делаем ниже */ },
    });

    useEffect((): void => {
        setActiveSubOrder(prev => availableOrders.includes(prev) ? prev : (availableOrders[0] ?? 0));
    }, [availableOrders, setActiveSubOrder]);

    /** ─── поиск ─── */
    const { showSearch, q, setQ, filteredRows } = useFormSearch(
        localDisplay ?? ({columns: [], data: [], displayed_widget: {name: '', description: ''}} as FormDisplay),
        flatColumnsInRenderOrder,
        valueIndexByKey,
        currentForm?.search_bar,
        { threshold: 0.35, distance: 120, debounceMs: 250 }
    );

    /** ─── handlers дерева ─── */
    const { handleNestedValueClick, handleTreeValueClick } = useTreeHandlers({
        selectedFormId: currentFormId,
        activeFilters,
        setActiveFilters,
        setNestedTrees,
        setActiveExpandedKey,
        setFormDisplay: setLocalDisplay,
        setSubDisplay, // можно сразу чистить/обновлять суб-таблицу
    });

    const handleResetFilters = useCallback(async (): Promise<void> => {
        if (!currentFormId) return;
        setActiveFilters([]);
        setActiveExpandedKey(null);
        setSelectedKey(null);
        setLastPrimary({} as Record<string, unknown>);
        setSubDisplay(null);
        setActiveSubOrder(availableOrders[0] ?? 0);
        try {
            await resetFiltersHard();
            await reloadTree();
        } catch (e) {
            console.warn('reset filters (modal) failed:', e);
        }
    }, [
        currentFormId, availableOrders, setActiveExpandedKey, setSelectedKey,
        setLastPrimary, setSubDisplay, setActiveSubOrder, resetFiltersHard, reloadTree, setActiveFilters
    ]);

    /** ─── прокси для сигнатуры useMainCrud (ожидает строго FormDisplay) ─── */
    const assignFormDisplay = useCallback((v: FormDisplay): void => {
        setLocalDisplay(v);
    }, []);

    /** ─── CRUD main ─── */
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
        selectedWidget: null,
        selectedFormId: currentFormId,
        formsByWidget: {} as Record<number, { form_id: number }>,   // ← привели к ожидаемому типу
        activeFilters,
        setFormDisplay: assignFormDisplay,                           // (v: FormDisplay) => void
        reloadTree,
        isColReadOnly,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        setSubDisplay: () => setSubDisplay(null),                    // (v: null) => void
        pkToKey,
        lastPrimary,
        setLastPrimary,
        setSelectedKey,                                              // ← ДОБАВИЛИ! из useSubNav
    });


    /** ─── SUB CRUD ─── */
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
        formIdForSub: currentFormId,
        currentWidgetId:
            (availableOrders.includes(activeSubOrder)
                ? currentForm?.sub_widgets?.find(sw => sw.widget_order === activeSubOrder)?.sub_widget_id
                : currentForm?.sub_widgets?.[0]?.sub_widget_id) ?? undefined,
        currentOrder: availableOrders.includes(activeSubOrder) ? activeSubOrder : (availableOrders[0] ?? 0),
        loadSubDisplay: async (fid, subOrder, primary): Promise<void> => {
            if (!fid) return;
            const payload =
                primary && Object.keys(primary).length
                    ? { primary_keys: primary, sub_widget_order: subOrder }
                    : { sub_widget_order: subOrder };
            const {data} = await api.post<SubDisplay>(`/display/${fid}/sub`, payload);
            setSubDisplay(data);
        },
        lastPrimary,
        subDisplay,
    });

    const onSubTabClick = useCallback(async (order: number): Promise<void> => {
        setActiveSubOrder(order);
        if (currentFormId && Object.keys(lastPrimary).length) {
            const {data} = await api.post<SubDisplay>(`/display/${currentFormId}/sub`, {
                primary_keys: lastPrimary,
                sub_widget_order: order
            });
            setSubDisplay(data);
        } else {
            setSubDisplay(null);
        }
    }, [currentFormId, lastPrimary, setActiveSubOrder]);

    /** ─── drill внутри модалки ─── */
    const handleOpenDrill = useCallback((nextId?: number | null): void => {
        if (!nextId) return;
        pushForm(nextId);
        setActiveFilters([]);
        setActiveExpandedKey(null);
        setSelectedKey(null);
        setLastPrimary({} as Record<string, unknown>);
        setSubDisplay(null);
    }, [pushForm, setActiveFilters, setActiveExpandedKey, setSelectedKey, setLastPrimary]);

    /** ─── UI ─── */
    const [showSubHeaders, setShowSubHeaders] = useState(false);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
            <DialogTitle style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                {formStack.length > 1 && (
                    <Button size="small" onClick={popForm}>Назад</Button>
                )}
                Форма #{currentFormId ?? '—'} {localDisplay ? `— ${safe(localDisplay.displayed_widget?.name)}` : ''}
            </DialogTitle>

            <DialogContent dividers>
                <ThemeProvider theme={dark}>
                    {loading && <div style={{opacity: 0.7, padding: 12}}>Загрузка…</div>}
                    {!!error && <div style={{color: '#f66', padding: 12}}>Ошибка: {error}</div>}

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
                                selectedFormId={currentFormId}
                                selectedWidget={null}
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

                                onOpenDrill={handleOpenDrill}
                            />

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
                                handleTabClick={onSubTabClick}
                            />
                        </div>
                    </div>
                </ThemeProvider>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
};
