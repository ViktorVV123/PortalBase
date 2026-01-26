// DrillDialog.tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Button, Dialog, DialogActions, DialogContent, DialogTitle, ThemeProvider} from '@mui/material';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {dark} from '@/shared/themeUI/themeModal/ThemeModalUI';
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

    /** Синхронизировать основной экран после CRUD в модалке */

    comboReloadToken: number;
    /** Выбор строки в режиме disableNestedDrill (редактирование combobox в MainTable) */
    onPickFromDrill?: (payload: {
        row: FormDisplay['data'][number];
        primary: Record<string, unknown>;
    }) => void;
    onComboboxChanged?: () => void;
};

const safe = (v?: string | null) => (v?.trim() ? v.trim() : '—');


/** Сравнение двух main-строк по primary_keys.
 *  Если PK один и числовой → сортируем численно.
 *  Иначе — строковое сравнение с numeric: true.
 */
function compareByPrimaryRow(
    a: FormDisplay['data'][number],
    b: FormDisplay['data'][number],
): number {
    const aPk = a.primary_keys ?? {};
    const bPk = b.primary_keys ?? {};

    const aKeys = Object.keys(aPk);
    const bKeys = Object.keys(bPk);

    // простой кейс: один и тот же числовой PK (например, id)
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

    // составной PK или разные наборы ключей — сортируем по строковому представлению
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

    // при каждом новом открытии/смене formId сбрасываем флаг
    useEffect(() => {
        if (open) {
            setHasCrudChanges(false);
        }
    }, [open, formId]);

    /** ─── стек форм ─── */
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

    /** ─── метаданные формы ─── */
    const currentForm: WidgetForm | null = useMemo(
        () => (currentFormId ? (formsById[currentFormId] ?? null) : null),
        [currentFormId, formsById]
    );

    /** ─── базовый флаг "модалка для combobox" ─── */
    const [isComboboxMode] = useState<boolean>(!!comboboxMode);

    /** ─── есть ли вообще сабы и дерево на этой форме ─── */
    const hasSubWidgets = (currentForm?.sub_widgets?.length ?? 0) > 0;
    const hasTreeFields = (currentForm?.tree_fields?.length ?? 0) > 0;

    /**
     * ═══════════════════════════════════════════════════════════
     * ИСПРАВЛЕНО: Разделяем логику для разных целей
     * ═══════════════════════════════════════════════════════════
     *
     * 1. showMainActions — ВСЕГДА true, чтобы кнопки добавления были видны
     * 2. effectiveComboboxMode — для показа дерева и сабов (требует tree_fields или sub_widgets)
     */

        // Кнопки добавления показываем ВСЕГДА в DrillDialog
    const showMainActions = true;

    // Дерево и сабы показываем только если они есть у формы
    const effectiveComboboxMode = isComboboxMode && (hasSubWidgets || hasTreeFields);

    /** ─── main display (локально) ─── */
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
        fetchMain(currentFormId).catch(() => {
        });
    }, [currentFormId, display, formId, fetchMain]);

    /** ─── wid/tid ТЕКУЩЕЙ формы ─── */
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
        return () => {
            cancelled = true;
        };
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
                console.debug('[DrillDialog] resolved wid/tid:', {wid: resolvedWidgetId, tid});
            })
            .catch((e: any) => {
                if (cancelled) return;
                setResolveErr(String(e?.message ?? 'Не удалось получить table_id'));
                setResolvedTableId(null);
            })
            .finally(() => {
                if (!cancelled) setResolvingTable(false);
            });

        return () => {
            cancelled = true;
        };
    }, [resolvedWidgetId]);

    /** ─── SUB ─── */
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

    /** ─── TREE ─── */
    const [liveTree, setLiveTree] = useState<FormTreeColumn[] | null>(null);

    const fetchTree = useCallback(async (fid: number) => {
        const {data} = await api.post<FormTreeColumn[] | FormTreeColumn>(`/display/${fid}/tree`);
        setLiveTree(Array.isArray(data) ? data : [data]);
    }, []);

    const reloadTree = useCallback(async () => {
        if (!currentFormId || !effectiveComboboxMode || !hasTreeFields) return;
        try {
            await fetchTree(currentFormId);
        } catch {
        }
    }, [currentFormId, effectiveComboboxMode, hasTreeFields, fetchTree]);

    useEffect(() => {
        if (currentFormId && effectiveComboboxMode && hasTreeFields) {
            fetchTree(currentFormId).catch(() => {
            });
        } else {
            setLiveTree(null);
        }
    }, [currentFormId, effectiveComboboxMode, hasTreeFields, fetchTree]);

    /** ─── Header/Plan ─── */
    const {headerPlan, flatColumnsInRenderOrder, valueIndexByKey, isColReadOnly} = useHeaderPlan(
        localDisplay ?? ({columns: [], data: [], displayed_widget: {name: '', description: ''}} as FormDisplay)
    );

    /** ─── Filters / Tree handlers ─── */
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

    /** ─── Навигация/primary для сабов ─── */
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

    /** ─── Поиск ─── */
    const {showSearch, q, setQ, filteredRows} = useFormSearch(
        localDisplay ?? ({columns: [], data: [], displayed_widget: {name: '', description: ''}} as FormDisplay),
        flatColumnsInRenderOrder,
        valueIndexByKey,
        currentForm?.search_bar,
        { debounceMs: 250 }
    );

    /** ─── selectedWidget для CRUD — строго текущей формы ─── */
    const selectedWidgetForPreflight = useMemo(() => {
        return resolvedWidgetId ? ({id: resolvedWidgetId} as any) : null;
    }, [resolvedWidgetId]);

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
        } catch (e) {
        }
    }, [submitAdd]);

    const submitEditWithMark = useCallback(async () => {
        try {
            await submitEdit();
            setHasCrudChanges(true);
        } catch (e) {
        }
    }, [submitEdit]);

    const deleteRowWithMark = useCallback(async (rowIdx: number) => {
        try {
            await deleteRow(rowIdx);
            setHasCrudChanges(true);
        } catch (e) {
        }
    }, [deleteRow]);

    /** ─── SUB CRUD (только при наличии sub_widgets) ─── */
    const {
        isAddingSub, setIsAddingSub, draftSub, setDraftSub,
        savingSub, startAddSub, cancelAddSub, submitAddSub,
    } = useSubCrud({
        formIdForSub: effectiveComboboxMode && hasSubWidgets ? currentFormId : null,
        currentWidgetId: effectiveComboboxMode && hasSubWidgets
            ? (
                (availableOrders.includes(activeSubOrder)
                        ? currentForm?.sub_widgets?.find(sw => sw.widget_order === activeSubOrder)?.sub_widget_id
                        : currentForm?.sub_widgets?.[0]?.sub_widget_id
                ) ?? undefined
            )
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

    /** ─── Drill внутри модалки ─── */
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

    /** ─── Безопасный старт «Добавить» ─── */
    const startAddSafe = useCallback(() => {
        if (!localDisplay) {
            console.warn('[DrillDialog] startAddSafe: no localDisplay');
            return;
        }
        if (!resolvedWidgetId) {
            console.warn('[DrillDialog] startAddSafe: no resolvedWidgetId');
            return;
        }
        if (!resolvedTableId) {
            console.warn('[DrillDialog] startAddSafe: no resolvedTableId');
            return;
        }
        startAdd();
    }, [localDisplay, resolvedWidgetId, resolvedTableId, startAdd]);

    /** ─── Сброс фильтров ─── */
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
        } catch {
        }
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

    /**
     * Специальный onRowClick для режима выбора значения (disableNestedDrill = true):
     * вместо навигации по сабам просто отдаём строку наверх и закрываем модалку.
     */
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

        onPickFromDrill({
            row: view.row,
            primary,
        });

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
    }, [hasCrudChanges, onSyncParentMain, onComboboxChanged, formId, onClose]);

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
    // DEBUG: Логируем состояние для отладки
    // ═══════════════════════════════════════════════════════════
    useEffect(() => {
        console.log('[DrillDialog] State:', {
            currentFormId,
            isComboboxMode,
            effectiveComboboxMode,
            hasSubWidgets,
            hasTreeFields,
            showMainActions,
            resolvedWidgetId,
            resolvedTableId,
            resolvingTable,
            disableNestedDrill,
            localDisplayExists: !!localDisplay,
        });
    }, [currentFormId, isComboboxMode, effectiveComboboxMode, hasSubWidgets, hasTreeFields, showMainActions, resolvedWidgetId, resolvedTableId, resolvingTable, disableNestedDrill, localDisplay]);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
            <DialogTitle style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                {formStack.length > 1 && (
                    <Button size="small" onClick={popForm}>Назад</Button>
                )}
                Форма #{currentFormId} {localDisplay ? `— ${safe(localDisplay.displayed_widget?.name)}` : ''}
                {!effectiveComboboxMode && !hasSubWidgets && !hasTreeFields && (
                    <span style={{marginLeft: 8, opacity: .7}}>(только Main)</span>
                )}
            </DialogTitle>

            <DialogContent dividers>
                <ThemeProvider theme={dark}>
                    {loading && <div style={{opacity: 0.7, padding: 12}}>Загрузка…</div>}
                    {!!error && <div style={{color: '#f66', padding: 12}}>Ошибка: {error}</div>}

                    {(resolvedWidgetId || resolvedTableId) && (
                        <div style={{opacity: 0.7, padding: '4px 12px', fontSize: 12}}>
                            Виджет: #{resolvedWidgetId ?? '—'} ·
                            Таблица: {resolvingTable ? '…' : (resolvedTableId ?? '—')}
                            {!!resolveErr && <span style={{color: '#f66'}}> · {resolveErr}</span>}
                        </div>
                    )}

                    {!localDisplay ? (
                        <div style={{opacity: 0.7, padding: 12}}>Готовлю данные…</div>
                    ) : (
                        <div className={s.contentRow}>
                            {/* дерево только если combobox-режим + реально есть tree_fields */}
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
                                {/*
                                  ═══════════════════════════════════════════════════════════
                                  ИСПРАВЛЕНО: showMainActions теперь ВСЕГДА true
                                  Кнопки добавления видны независимо от наличия tree/sub
                                  ═══════════════════════════════════════════════════════════
                                */}
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

                                {/* SubWormTable только если у формы действительно есть sub_widgets
                                   и модалка не открыта из редактирования (disableNestedDrill=false) */}
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
                </ThemeProvider>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
};