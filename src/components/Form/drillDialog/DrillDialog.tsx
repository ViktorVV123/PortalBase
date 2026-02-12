// DrillDialog.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Button, Dialog, DialogActions, DialogContent, DialogTitle} from '@mui/material';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {api} from '@/services/api';

import {TableToolbar} from '@/components/table/tableToolbar/TableToolbar';
import {TreeFormTable} from '@/components/Form/treeForm/TreeFormTable';
import {MainTable} from '@/components/Form/mainTable/MainTable';
import {SubWormTable} from '@/components/Form/subForm/SubFormTable';

import {useHeaderPlan} from '@/components/Form/formTable/hooks/useHeaderPlan';
import {useFiltersTree} from '@/components/Form/formTable/hooks/useFiltersTree';
import {useSubNav} from '@/components/Form/subForm/hook/useSubNav';
import {useFormSearch} from '@/components/search/hook/useFormSearch';
import {useSubCrud} from '@/components/Form/subForm/hook/useSubCrud';
import {useTreeHandlers} from '@/components/Form/treeForm/hooks/useTreeHandlers';
import {useMainCrud} from '@/components/Form/mainTable/hook/useMainCrud';

import type {FormDisplay, SubDisplay, WidgetForm, FormTreeColumn} from '@/shared/hooks/useWorkSpaces';

/** тот же RowView, что и в MainTable */
type RowView = { row: FormDisplay['data'][number]; idx: number };

type Props = {
    open: boolean;
    formId: number | null;
    display?: FormDisplay | null;
    formsById: Record<number, WidgetForm>;
    onClose: () => void;
    onSyncParentMain?: () => void;
    /** Режим модалки фиксируем на момент клика (combobox | только main) */
    comboboxMode: boolean;
    disableNestedDrill?: boolean;

    /** Нужен только id; в модалке всё равно переключаемся на форму/виджет из стека */
    selectedWidget: { id: number } | null;

    formsByWidget: Record<number, { form_id: number }>;

    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;

    /** PK строки, по которой открыли модалку (для подсветки/сабов) */
    initialPrimary?: Record<string, unknown>;

    comboReloadToken: number;
    /** Выбор строки в режиме disableNestedDrill (редактирование combobox в MainTable) */
    onPickFromDrill?: (payload: {
        row: FormDisplay['data'][number];
        primary: Record<string, unknown>;
    }) => void;
    onComboboxChanged?: () => void;
};

const safe = (v?: string | null) => (v?.trim() ? v.trim() : '—');

function compareByPrimaryRow(
    a: FormDisplay['data'][number],
    b: FormDisplay['data'][number],
): number {
    const aPk = a.primary_keys ?? {};
    const bPk = b.primary_keys ?? {};

    const aKeys = Object.keys(aPk);
    const bKeys = Object.keys(bPk);

    if (aKeys.length === 1 && bKeys.length === 1 && aKeys[0] === bKeys[0]) {
        const key = aKeys[0];
        const av = aPk[key] as unknown;
        const bv = bPk[key] as unknown;

        if (typeof av === 'number' && typeof bv === 'number') {
            return av - bv;
        }

        const sa = String(av);
        const sb = String(bv);
        return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
    }

    const sa = JSON.stringify(aPk);
    const sb = JSON.stringify(bPk);
    return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
}

export const DrillDialog: React.FC<Props> = ({
                                                 open,
                                                 formId,
                                                 display,
                                                 formsById,
                                                 onClose,
                                                 comboboxMode,
                                                 selectedWidget,
                                                 formsByWidget,
                                                 loadSubDisplay,
                                                 disableNestedDrill,
                                                 initialPrimary,
                                                 onSyncParentMain,
                                                 onPickFromDrill,
                                                 onComboboxChanged,
                                                 comboReloadToken,
                                             }) => {
    if (!open || !formId) return null;

    const [hasCrudChanges, setHasCrudChanges] = useState(false);

    useEffect(() => {
        if (open) {
            setHasCrudChanges(false);
        }
    }, [open, formId]);

    const [formStack, setFormStack] = useState<number[]>([formId]);
    const currentFormId = formStack[formStack.length - 1] ?? null;

    useEffect(() => {
        if (open && formId) setFormStack([formId]);
    }, [open, formId]);

    const pushForm = useCallback((fid: number) => {
        if (!fid) return;
        setFormStack(prev => (prev[prev.length - 1] === fid ? prev : [...prev, fid]));
    }, []);

    const popForm = useCallback(() => {
        setFormStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
    }, []);

    const currentForm: WidgetForm | null = useMemo(
        () => (currentFormId ? (formsById[currentFormId] ?? null) : null),
        [currentFormId, formsById]
    );

    const [isComboboxMode] = useState<boolean>(!!comboboxMode);

    const hasSubWidgets = (currentForm?.sub_widgets?.length ?? 0) > 0;
    const hasTreeFields = (currentForm?.tree_fields?.length ?? 0) > 0;

    const showMainActions = true;
    const effectiveComboboxMode = isComboboxMode && (hasSubWidgets || hasTreeFields);

    const [localDisplay, setLocalDisplay] = useState<FormDisplay | null>(
        display && formId === currentFormId ? display : null
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const lastLoadedRef = useRef<number | null>(null);
    const inflightRef = useRef<boolean>(false);

    const setDisplayBoth = useCallback((v: FormDisplay) => {
        setLocalDisplay(v);
    }, []);

    const fetchMain = useCallback(async (fid: number) => {
        if (!fid) return;
        if (inflightRef.current) return;
        if (lastLoadedRef.current === fid && localDisplay) return;

        inflightRef.current = true;
        setLoading(true);
        setError(null);
        try {
            const {data} = await api.post<FormDisplay | FormDisplay[]>(`/display/${fid}/main`);
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
        if (display && formId === currentFormId) {
            setLocalDisplay(display);
            lastLoadedRef.current = currentFormId;
            return;
        }
        fetchMain(currentFormId).catch(() => {});
    }, [currentFormId, display, formId, fetchMain]);

    const widFromMap = useMemo<number | null>(() => {
        if (!currentFormId) return null;
        const pair = Object.entries(formsByWidget).find(([, v]) => v?.form_id === currentFormId);
        return pair ? Number(pair[0]) : null;
    }, [formsByWidget, currentFormId]);

    const widFromDisplay = useMemo<number | null>(() => {
        const dw: any = (localDisplay as any)?.displayed_widget;
        const wid = (dw?.id ?? dw?.widget_id ?? null);
        return typeof wid === 'number' ? wid : null;
    }, [localDisplay]);

    const [resolvedWidgetId, setResolvedWidgetId] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        const candidate = widFromMap ?? widFromDisplay ?? selectedWidget?.id ?? null;
        if (candidate) {
            setResolvedWidgetId(candidate);
            return;
        }
        if (!currentFormId) {
            setResolvedWidgetId(null);
            return;
        }
        (async () => {
            try {
                const {data} = await api.get<{ id: number; widget_id: number }>(`/forms/${currentFormId}`);
                if (!cancelled) setResolvedWidgetId(data?.widget_id ?? null);
            } catch {
                if (!cancelled) setResolvedWidgetId(null);
            }
        })();
        return () => { cancelled = true; };
    }, [currentFormId, widFromMap, widFromDisplay, selectedWidget?.id]);

    const [resolvedTableId, setResolvedTableId] = useState<number | null>(null);
    const [resolvingTable, setResolvingTable] = useState<boolean>(false);
    const [resolveErr, setResolveErr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setResolvedTableId(null);
        setResolveErr(null);

        if (!resolvedWidgetId) return;

        setResolvingTable(true);
        api.get<{ id: number; table_id: number }>(`/widgets/${resolvedWidgetId}`)
            .then(({data}) => {
                if (cancelled) return;
                const tid = data?.table_id ?? null;
                setResolvedTableId(tid);
            })
            .catch((e: any) => {
                if (cancelled) return;
                setResolveErr(String(e?.message ?? 'Не удалось получить table_id'));
                setResolvedTableId(null);
            })
            .finally(() => {
                if (!cancelled) setResolvingTable(false);
            });

        return () => { cancelled = true; };
    }, [resolvedWidgetId]);

    const [subDisplay, setSubDisplay] = useState<SubDisplay | null>(null);

    const fetchSub = useCallback(
        async (fid: number, order: number, primary?: Record<string, unknown>) => {
            if (!fid) return;

            const params = new URLSearchParams({sub_widget_order: String(order)});
            const body =
                primary && Object.keys(primary).length
                    ? {primary_keys: Object.fromEntries(Object.entries(primary).map(([k, v]) => [k, String(v)]))}
                    : {};

            const {data} = await api.post<SubDisplay>(`/display/${fid}/sub?${params}`, body);
            setSubDisplay(data);
        }, []
    );

    const [liveTree, setLiveTree] = useState<FormTreeColumn[] | null>(null);

    const fetchTree = useCallback(async (fid: number) => {
        const {data} = await api.post<FormTreeColumn[] | FormTreeColumn>(`/display/${fid}/tree`);
        setLiveTree(Array.isArray(data) ? data : [data]);
    }, []);

    const reloadTree = useCallback(async () => {
        if (!currentFormId || !effectiveComboboxMode || !hasTreeFields) return;
        try {
            await fetchTree(currentFormId);
        } catch {}
    }, [currentFormId, effectiveComboboxMode, hasTreeFields, fetchTree]);

    useEffect(() => {
        if (currentFormId && effectiveComboboxMode && hasTreeFields) {
            fetchTree(currentFormId).catch(() => {});
        } else {
            setLiveTree(null);
        }
    }, [currentFormId, effectiveComboboxMode, hasTreeFields, fetchTree]);

    const {headerPlan, flatColumnsInRenderOrder, valueIndexByKey, isColReadOnly} = useHeaderPlan(
        localDisplay ?? ({columns: [], data: [], displayed_widget: {name: '', description: ''}} as FormDisplay)
    );

    const {
        activeFilters, setActiveFilters,
        nestedTrees, setNestedTrees,
        activeExpandedKey, setActiveExpandedKey,
        resetFiltersHard,
    } = useFiltersTree(currentFormId, setLocalDisplay);

    const {handleNestedValueClick, handleTreeValueClick} = useTreeHandlers({
        selectedFormId: currentFormId,
        activeFilters,
        setActiveFilters,
        setNestedTrees,
        setActiveExpandedKey,
        setFormDisplay: setLocalDisplay,
        setSubDisplay,
    });

    const availableOrders = useMemo<number[]>(
        () => (currentForm?.sub_widgets ?? []).map(sw => sw.widget_order).sort((a, b) => a - b),
        [currentForm]
    );

    const {
        lastPrimary, setLastPrimary,
        selectedKey, setSelectedKey,
        activeSubOrder, setActiveSubOrder,
        pkToKey, handleRowClick,
    } = useSubNav({
        formIdForSub: currentFormId,
        availableOrders,
        loadSubDisplay: (fid, order, primary) => {
            if (!effectiveComboboxMode || !hasSubWidgets || !fid) return;
            return fetchSub(fid, order, primary);
        },
    });

    useEffect(() => {
        setActiveSubOrder(prev => (availableOrders.includes(prev) ? prev : (availableOrders[0] ?? 0)));
    }, [availableOrders, setActiveSubOrder]);

    useEffect(() => {
        if (!effectiveComboboxMode || !currentFormId) return;
        const hasPrimary = initialPrimary && Object.keys(initialPrimary).length > 0;
        if (!hasPrimary) return;
        setLastPrimary(initialPrimary!);
        setSelectedKey(pkToKey(initialPrimary!));
    }, [effectiveComboboxMode, currentFormId, initialPrimary, pkToKey, setLastPrimary, setSelectedKey]);

    const {showSearch, q, setQ, filteredRows} = useFormSearch(
        localDisplay ?? ({columns: [], data: [], displayed_widget: {name: '', description: ''}} as FormDisplay),
        flatColumnsInRenderOrder,
        valueIndexByKey,
        currentForm?.search_bar,
        { debounceMs: 250 },
        // Callback для серверного поиска
        useCallback(async (searchPattern: string) => {
            if (!currentFormId) return;
            try {
                const params = new URLSearchParams({
                    limit: '80',
                    page: '1',
                });
                if (searchPattern.trim()) {
                    params.set('search_pattern', searchPattern.trim());
                }

                const body = activeFilters.length
                    ? activeFilters.map(f => ({ ...f, value: String(f.value) }))
                    : [];

                const { data } = await api.post<FormDisplay>(
                    `/display/${currentFormId}/main?${params}`,
                    body
                );
                setLocalDisplay(data);
            } catch (e) {
                console.warn('[DrillDialog] server search failed:', e);
            }
        }, [currentFormId, activeFilters])
    );

    const selectedWidgetForPreflight = useMemo(() => {
        return resolvedWidgetId ? ({id: resolvedWidgetId} as any) : null;
    }, [resolvedWidgetId]);

    const {
        isAdding, draft, saving,
        editingRowIdx, editDraft, editSaving,
        deletingRowIdx,
        startAdd, cancelAdd, submitAdd,
        startEdit, cancelEdit, submitEdit,
        deleteRow,
        setDraft, setEditDraft,
    } = useMainCrud({
        formDisplay: (localDisplay ?? ({
            columns: [],
            data: [],
            displayed_widget: {name: '', description: ''}
        } as FormDisplay)),
        selectedWidget: selectedWidgetForPreflight,
        selectedFormId: currentFormId,
        formsByWidget: formsByWidget as any,
        formsById,
        activeFilters,
        setFormDisplay: setDisplayBoth,
        reloadTree,
        isColReadOnly,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        setSubDisplay,
        pkToKey,
        lastPrimary,
        setLastPrimary,
        setSelectedKey,
        preflightTableId: resolvedTableId,
    });

    useEffect(() => {
        cancelEdit();
        cancelAdd();
        setDraft({});
    }, [currentFormId, cancelEdit, cancelAdd, setDraft]);

    const submitAddWithMark = useCallback(async () => {
        try {
            await submitAdd();
            setHasCrudChanges(true);
        } catch (e) {}
    }, [submitAdd]);

    const submitEditWithMark = useCallback(async () => {
        try {
            await submitEdit();
            setHasCrudChanges(true);
        } catch (e) {}
    }, [submitEdit]);

    const deleteRowWithMark = useCallback(async (rowIdx: number) => {
        try {
            await deleteRow(rowIdx);
            setHasCrudChanges(true);
        } catch (e) {}
    }, [deleteRow]);

    const {
        isAddingSub, setIsAddingSub, draftSub, setDraftSub,
        savingSub, startAddSub, cancelAddSub, submitAddSub,
    } = useSubCrud({
        formIdForSub: effectiveComboboxMode && hasSubWidgets ? currentFormId : null,
        currentWidgetId: effectiveComboboxMode && hasSubWidgets
            ? ((availableOrders.includes(activeSubOrder)
                    ? currentForm?.sub_widgets?.find(sw => sw.widget_order === activeSubOrder)?.sub_widget_id
                    : currentForm?.sub_widgets?.[0]?.sub_widget_id
            ) ?? undefined)
            : undefined,
        currentOrder: effectiveComboboxMode && hasSubWidgets
            ? (availableOrders.includes(activeSubOrder) ? activeSubOrder : (availableOrders[0] ?? 0))
            : 0,
        loadSubDisplay: (fid, order, primary) => {
            if (!effectiveComboboxMode || !hasSubWidgets || !fid) return;
            return fetchSub(fid, order, primary);
        },
        lastPrimary,
        subDisplay,
    });

    const handleOpenDrill = useCallback((
        nextId?: number | null,
        meta?: { originColumnType?: 'combobox' | null; primary?: Record<string, unknown> }
    ) => {
        if (!nextId) return;

        pushForm(nextId);
        setActiveFilters([]);
        setActiveExpandedKey(null);
        setSelectedKey(null);
        setLastPrimary({});
        setSubDisplay(null);
        lastLoadedRef.current = null;
        setLocalDisplay(null);
    }, [pushForm, setActiveFilters, setActiveExpandedKey, setSelectedKey, setLastPrimary]);

    const startAddSafe = useCallback(() => {
        if (!localDisplay) return;
        if (!resolvedWidgetId) return;
        if (!resolvedTableId) return;
        startAdd();
    }, [localDisplay, resolvedWidgetId, resolvedTableId, startAdd]);

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
            if (effectiveComboboxMode && hasTreeFields) {
                await reloadTree();
            }
        } catch {}
    }, [
        currentFormId,
        availableOrders,
        effectiveComboboxMode,
        hasTreeFields,
        setActiveExpandedKey,
        setSelectedKey,
        setLastPrimary,
        setSubDisplay,
        setActiveSubOrder,
        resetFiltersHard,
        reloadTree,
        setActiveFilters,
    ]);

    if (!currentFormId) return null;

    const enableSub = effectiveComboboxMode && hasSubWidgets && !disableNestedDrill;

    const handleRowClickForSelect = useCallback((view: RowView) => {
        if (!disableNestedDrill) {
            handleRowClick(view);
            return;
        }

        if (!onPickFromDrill) return;

        const raw: any = view.row;
        const primary: Record<string, unknown> =
            raw && typeof raw === 'object' && raw.primary_keys
                ? raw.primary_keys
                : {};

        onPickFromDrill({ row: view.row, primary });
        onClose();
    }, [disableNestedDrill, handleRowClick, onPickFromDrill, onClose]);

    const handleClose = useCallback(async () => {
        if (hasCrudChanges) {
            if (onSyncParentMain) {
                try {
                    await onSyncParentMain();
                } catch (e) {
                    console.warn('[DrillDialog] onSyncParentMain failed on close', e);
                }
            }

            if (onComboboxChanged) {
                onComboboxChanged();
            }
        }

        onClose();
    }, [hasCrudChanges, onSyncParentMain, onComboboxChanged, onClose]);

    const sortedFilteredRows = useMemo<RowView[]>(() => {
        if (!filteredRows || !filteredRows.length) return filteredRows;
        return [...filteredRows].sort((a, b) => compareByPrimaryRow(a.row, b.row));
    }, [filteredRows]);

    const [treeExpandedKeys, setTreeExpandedKeys] = useState<Set<string>>(new Set());
    const [treeChildrenCache, setTreeChildrenCache] = useState<Record<string, FormTreeColumn[]>>({});

    useEffect(() => {
        setTreeExpandedKeys(new Set());
        setTreeChildrenCache({});
    }, [currentFormId]);

    // ═══════════════════════════════════════════════════════════
    // СТИЛИ ДЛЯ ДИАЛОГА — используем CSS переменные темы
    // ═══════════════════════════════════════════════════════════
    const dialogPaperSx = {
        backgroundColor: 'var(--theme-background)',
        color: 'var(--theme-text-primary)',
        '& .MuiDialogTitle-root': {
            backgroundColor: 'var(--theme-surface)',
            color: 'var(--theme-text-primary)',
            borderBottom: '1px solid var(--theme-border)',
        },
        '& .MuiDialogContent-root': {
            backgroundColor: 'var(--theme-background)',
            color: 'var(--theme-text-primary)',
        },
        '& .MuiDialogActions-root': {
            backgroundColor: 'var(--theme-surface)',
            borderTop: '1px solid var(--theme-border)',
        },
        '& .MuiButton-root': {
            color: 'var(--theme-primary)',
        },
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xl"
            PaperProps={{ sx: dialogPaperSx }}
        >
            <DialogTitle sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {formStack.length > 1 && (
                    <Button size="small" onClick={popForm}>Назад</Button>
                )}
                <span>
                    Форма #{currentFormId} {localDisplay ? `— ${safe(localDisplay.displayed_widget?.name)}` : ''}
                </span>
                {!effectiveComboboxMode && !hasSubWidgets && !hasTreeFields && (
                    <span style={{marginLeft: 8, opacity: .7}}>(только Main)</span>
                )}
            </DialogTitle>

            <DialogContent dividers>
                {loading && <div style={{opacity: 0.7, padding: 12}}>Загрузка…</div>}
                {!!error && <div style={{color: 'var(--theme-error)', padding: 12}}>Ошибка: {error}</div>}

                {(resolvedWidgetId || resolvedTableId) && (
                    <div style={{opacity: 0.7, padding: '4px 12px', fontSize: 12, color: 'var(--theme-text-secondary)'}}>
                        Виджет: #{resolvedWidgetId ?? '—'} ·
                        Таблица: {resolvingTable ? '…' : (resolvedTableId ?? '—')}
                        {!!resolveErr && <span style={{color: 'var(--theme-error)'}}> · {resolveErr}</span>}
                    </div>
                )}

                {!localDisplay ? (
                    <div style={{opacity: 0.7, padding: 12}}>Готовлю данные…</div>
                ) : (
                    <div className={s.contentRow}>
                        {effectiveComboboxMode && hasTreeFields && (
                            <TreeFormTable
                                tree={liveTree}
                                selectedFormId={currentFormId}
                                handleNestedValueClick={handleNestedValueClick}
                                handleTreeValueClick={handleTreeValueClick}
                                expandedKeys={treeExpandedKeys}
                                setExpandedKeys={setTreeExpandedKeys}
                                childrenCache={treeChildrenCache}
                                setChildrenCache={setTreeChildrenCache}
                                onFilterMain={async (filters) => {
                                    if (!currentFormId) return;
                                    try {
                                        const { data } = await api.post<FormDisplay>(
                                            `/display/${currentFormId}/main`,
                                            filters.map((f) => ({ ...f, value: String(f.value) }))
                                        );
                                        setLocalDisplay(data);
                                        setActiveFilters(filters);
                                        setSelectedKey(null);
                                        setLastPrimary({});
                                        setSubDisplay(null);
                                    } catch (e) {
                                        console.warn('[DrillDialog] onFilterMain failed:', e);
                                    }
                                }}
                            />
                        )}

                        <div className={s.mainCol}>
                            <TableToolbar
                                showMainActions={showMainActions}
                                showSubActions={
                                    effectiveComboboxMode &&
                                    hasSubWidgets &&
                                    !!subDisplay &&
                                    Object.keys(lastPrimary).length > 0
                                }
                                cancelAddSub={cancelAddSub}
                                startAddSub={startAddSub}
                                isAddingSub={effectiveComboboxMode && hasSubWidgets ? isAddingSub : false}
                                submitAddSub={submitAddSub}
                                savingSub={effectiveComboboxMode && hasSubWidgets ? savingSub : false}
                                isAdding={isAdding}
                                selectedFormId={currentFormId}
                                selectedWidget={selectedWidgetForPreflight}
                                saving={saving}
                                showSearch={showSearch}
                                value={q}
                                onChange={setQ}
                                onResetFilters={handleResetFilters}
                                collapsedWidth={160}
                                expandedWidth={420}
                                startAdd={startAddSafe}
                                submitAdd={submitAddWithMark}
                                cancelAdd={cancelAdd}
                            />

                            <MainTable
                                formId={currentFormId}
                                headerPlan={headerPlan as any}
                                showSubHeaders={effectiveComboboxMode && hasSubWidgets ? showSubHeaders : false}
                                onToggleSubHeaders={() =>
                                    effectiveComboboxMode && hasSubWidgets && setShowSubHeaders(v => !v)
                                }
                                onOpenDrill={disableNestedDrill ? undefined : handleOpenDrill}
                                isAdding={isAdding}
                                draft={draft}
                                onDraftChange={(tcId, v) => setDraft(prev => ({...prev, [tcId]: v}))}
                                flatColumnsInRenderOrder={flatColumnsInRenderOrder}
                                isColReadOnly={isColReadOnly}
                                placeholderFor={(c) => c.placeholder ?? c.column_name}
                                filteredRows={sortedFilteredRows}
                                valueIndexByKey={valueIndexByKey}
                                selectedKey={selectedKey}
                                pkToKey={pkToKey}
                                editingRowIdx={editingRowIdx}
                                editDraft={editDraft}
                                onEditDraftChange={(tcId, v) => setEditDraft(prev => ({...prev, [tcId]: v}))}
                                editSaving={editSaving}
                                onRowClick={disableNestedDrill ? handleRowClickForSelect : handleRowClick}
                                onStartEdit={startEdit}
                                comboReloadToken={0}
                                onSubmitEdit={submitEditWithMark}
                                onCancelEdit={cancelEdit}
                                onDeleteRow={deleteRowWithMark}
                                deletingRowIdx={deletingRowIdx}
                            />

                            {enableSub && (
                                <SubWormTable
                                    comboReloadToken={comboReloadToken}
                                    onOpenDrill={disableNestedDrill ? undefined : handleOpenDrill}
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
                                    currentOrder={
                                        availableOrders.includes(activeSubOrder)
                                            ? activeSubOrder
                                            : (availableOrders[0] ?? 0)
                                    }
                                    currentWidgetId={
                                        (availableOrders.includes(activeSubOrder)
                                                ? currentForm?.sub_widgets?.find(sw => sw.widget_order === activeSubOrder)?.sub_widget_id
                                                : currentForm?.sub_widgets?.[0]?.sub_widget_id
                                        ) ?? undefined
                                    }
                                    subHeaderGroups={undefined}
                                    formId={currentFormId}
                                    subLoading={false}
                                    subError={null as any}
                                    subDisplay={subDisplay}
                                    handleTabClick={(order) => {
                                        setActiveSubOrder(order);
                                        if (
                                            effectiveComboboxMode &&
                                            hasSubWidgets &&
                                            currentFormId &&
                                            Object.keys(lastPrimary).length
                                        ) {
                                            fetchSub(currentFormId, order, lastPrimary);
                                        } else {
                                            setSubDisplay(null);
                                        }
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
};