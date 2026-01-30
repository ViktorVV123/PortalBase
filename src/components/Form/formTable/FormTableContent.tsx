// src/components/Form/formTable/FormTableContent.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as s from '@/components/Form/formTable/FormTable.module.scss';
import { api } from '@/services/api';

import type { FormDisplay, FormTreeColumn, WidgetForm } from '@/shared/hooks/useWorkSpaces';

import { useFormContext } from '@/components/Form/context';
import { TableToolbar } from '@/components/table/tableToolbar/TableToolbar';
import { MainTableWithContext } from '@/components/Form/mainTable/MainTableWithContext';
import { SubFormWithContext } from '@/components/Form/subForm/SubFormWithContext';
import { DrillDialogWithContext } from '@/components/Form/drillDialog/DrillDialogWithContext';
import { TreeDrawer } from '@/components/Form/treeForm/TreeDrawer';
import { LoadMoreIndicator } from '@/components/Form/mainTable/LoadMoreIndicator';

type Props = {
    liveTree: FormTreeColumn[] | null;
    setLiveTree: React.Dispatch<React.SetStateAction<FormTreeColumn[] | null>>;
    currentForm: WidgetForm | null;
};

export const FormTableContent: React.FC<Props> = ({ liveTree, setLiveTree, currentForm }) => {
    const ctx = useFormContext();
    const {
        config, data, loading, selection, mainAdding, subAdding, drill, filters, search, treeDrawer,
        pagination, loadMoreRows,
        startAdd, cancelAdd, submitAdd, resetFilters, handleTreeValueClick, handleNestedValueClick,
        openDrill, closeDrill, setFormDisplay, comboReloadToken, triggerComboReload,
        toggleTreeDrawer, closeTreeDrawer, resetTreeDrawer, setExpandedKeys, setChildrenCache,
        startAddSub, cancelAddSub, submitAddSub,
    } = ctx;

    const { selectedFormId, selectedWidget } = config;
    const { formDisplay, subDisplay } = data;
    const { subLoading, subError } = loading;
    const { lastPrimary } = selection;
    const { isOpen: isTreeOpen, expandedKeys, childrenCache } = treeDrawer;

    // ═══════════════════════════════════════════════════════════
    // INFINITE SCROLL
    // ═══════════════════════════════════════════════════════════
    const mainScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = mainScrollRef.current;
        if (!el) return;

        const handleScroll = () => {
            if (pagination.isLoadingMore || !pagination.hasMore) return;

            const { scrollTop, scrollHeight, clientHeight } = el;
            const distanceToBottom = scrollHeight - scrollTop - clientHeight;

            // Загружаем когда до конца осталось менее 300px
            if (distanceToBottom < 300) {
                loadMoreRows();
            }
        };

        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, [pagination.isLoadingMore, pagination.hasMore, loadMoreRows]);

    // ═══════════════════════════════════════════════════════════
    // KEYBOARD NAVIGATION
    // ═══════════════════════════════════════════════════════════

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const active = document.activeElement;
            const isInput = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.tagName === 'SELECT' || active?.getAttribute('contenteditable') === 'true';
            if (isInput) return;

            const container = mainScrollRef.current;
            if (!container) return;

            const step = e.ctrlKey || e.metaKey ? 300 : 100;
            let handled = false;

            switch (e.key) {
                case 'ArrowLeft': container.scrollLeft -= step; handled = true; break;
                case 'ArrowRight': container.scrollLeft += step; handled = true; break;
                case 'ArrowUp': container.scrollTop -= step; handled = true; break;
                case 'ArrowDown': container.scrollTop += step; handled = true; break;
                case 'Home':
                    if (e.ctrlKey || e.metaKey) { container.scrollTop = 0; container.scrollLeft = 0; }
                    else container.scrollLeft = 0;
                    handled = true; break;
                case 'End':
                    if (e.ctrlKey || e.metaKey) { container.scrollTop = container.scrollHeight; container.scrollLeft = container.scrollWidth; }
                    else container.scrollLeft = container.scrollWidth;
                    handled = true; break;
                case 'PageUp': container.scrollTop -= container.clientHeight * 0.8; handled = true; break;
                case 'PageDown': container.scrollTop += container.clientHeight * 0.8; handled = true; break;
            }

            if (handled) e.preventDefault();
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // ═══════════════════════════════════════════════════════════
    // SUB WIDGETS
    // ═══════════════════════════════════════════════════════════

    const hasSubWidgets = !!(currentForm?.sub_widgets && currentForm.sub_widgets.length > 0);
    const hasSelectedRow = Object.keys(lastPrimary).length > 0;
    const shouldShowSubSection = hasSubWidgets && hasSelectedRow && (subLoading || !!subDisplay || !!subError);

    // ═══════════════════════════════════════════════════════════
    // TREE
    // ═══════════════════════════════════════════════════════════

    const reloadTreeLocal = useCallback(async () => {
        const fid = selectedFormId ?? currentForm?.form_id ?? null;
        if (!fid) return;
        try {
            const { data } = await api.post<FormTreeColumn[] | FormTreeColumn>(`/display/${fid}/tree`);
            const normalized = Array.isArray(data) ? data : [data];
            const hasValidTree = normalized.length > 0 && normalized.some(t => t.values && t.values.length > 0);
            setLiveTree(hasValidTree ? normalized : null);
        } catch (e: any) {
            if (e?.response?.status === 404) setLiveTree(null);
        }
    }, [selectedFormId, currentForm, setLiveTree]);

    useEffect(() => {
        const handleFormMutated = async (e: CustomEvent<{ formId: number }>) => {
            if (e.detail?.formId === (selectedFormId ?? currentForm?.form_id)) await reloadTreeLocal();
        };
        window.addEventListener('portal:form-mutated', handleFormMutated as EventListener);
        return () => window.removeEventListener('portal:form-mutated', handleFormMutated as EventListener);
    }, [selectedFormId, currentForm?.form_id, reloadTreeLocal]);

    const handleResetFilters = useCallback(async () => {
        await resetFilters();
        await reloadTreeLocal();
    }, [resetFilters, reloadTreeLocal]);

    // ═══════════════════════════════════════════════════════════
    // DRILL HANDLERS
    // ═══════════════════════════════════════════════════════════

    const handleOpenDrill = useCallback((fid?: number | null, meta?: any) => {
        if (fid) openDrill(fid, meta);
    }, [openDrill]);

    const handleSyncParentMain = useCallback(async () => {
        const fid = selectedFormId ?? currentForm?.form_id ?? null;
        if (!fid) return;
        try {
            const { data } = await api.post<FormDisplay | FormDisplay[]>(`/display/${fid}/main`, filters.activeFilters);
            const next = Array.isArray(data) ? data[0] : data;
            if (next) setFormDisplay(next);
        } catch {}
    }, [selectedFormId, currentForm, filters.activeFilters, setFormDisplay]);

    const handleFilterMain = useCallback(async (filterList: Array<{ table_column_id: number; value: string | number }>) => {
        if (!selectedFormId) return;
        try {
            const { data } = await api.post<FormDisplay>(`/display/${selectedFormId}/main`, filterList.map(f => ({ ...f, value: String(f.value) })));
            setFormDisplay(data);
            ctx.setActiveFilters(filterList);
            ctx.setSelectedKey(null);
            ctx.setLastPrimary({});
            ctx.setSubDisplay(null);
        } catch {}
    }, [selectedFormId, setFormDisplay, ctx]);

    return (
        <>
            <TreeDrawer
                isOpen={isTreeOpen} onToggle={toggleTreeDrawer} onClose={closeTreeDrawer}
                tree={liveTree} selectedFormId={selectedFormId}
                handleTreeValueClick={handleTreeValueClick} handleNestedValueClick={handleNestedValueClick}
                onFilterMain={handleFilterMain}
                expandedKeys={expandedKeys} setExpandedKeys={setExpandedKeys}
                childrenCache={childrenCache} setChildrenCache={setChildrenCache}
                onResetFilters={handleResetFilters}
            />

            <div className={s.formLayoutFullWidth}>
                <section className={s.rightPane}>
                    <div className={s.toolbarPane}>
                        <TableToolbar
                            showSubActions={!!subDisplay && Object.keys(lastPrimary).length > 0}
                            cancelAddSub={cancelAddSub} startAddSub={startAddSub}
                            isAddingSub={subAdding.isAddingSub} submitAddSub={submitAddSub}
                            savingSub={subAdding.savingSub} isAdding={mainAdding.isAdding}
                            selectedFormId={selectedFormId} selectedWidget={selectedWidget}
                            saving={mainAdding.saving} startAdd={startAdd} submitAdd={submitAdd} cancelAdd={cancelAdd}
                            showSearch={search.showSearch} value={search.q} onChange={search.setQ}
                            onResetFilters={handleResetFilters} collapsedWidth={160} expandedWidth={420}
                        />
                    </div>

                    {/* MAIN TABLE */}
                    <div className={s.mainPane}>
                        <div ref={mainScrollRef} className={s.mainTableScroll}>
                            <MainTableWithContext
                                onOpenDrill={handleOpenDrill}
                                comboReloadToken={comboReloadToken}
                            />

                            {/* Индикатор загрузки внизу таблицы */}
                            <LoadMoreIndicator
                                isLoading={pagination.isLoadingMore}
                                hasMore={pagination.hasMore}
                                loadedCount={formDisplay?.data?.length ?? 0}
                                totalCount={pagination.totalRows}
                            />
                        </div>
                    </div>

                    {/* SUB TABLE */}
                    {shouldShowSubSection && (
                        <div className={s.subPane}>
                            <SubFormWithContext
                                onOpenDrill={handleOpenDrill} comboReloadToken={comboReloadToken}
                                cancelAdd={cancelAddSub!} startAdd={startAddSub!} submitAdd={submitAddSub!}
                                saving={subAdding.savingSub} selectedWidget={selectedWidget} buttonClassName={s.iconBtn}
                            />
                        </div>
                    )}
                </section>
            </div>

            <DrillDialogWithContext onSyncParentMain={handleSyncParentMain} onComboboxChanged={triggerComboReload} />
        </>
    );
};