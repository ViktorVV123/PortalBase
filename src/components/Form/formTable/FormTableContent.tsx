// src/components/Form/formTable/FormTableContent.tsx

import React, { useCallback, useEffect, useMemo } from 'react';
import * as s from '@/components/Form/formTable/FormTable.module.scss';
import { api } from '@/services/api';

import type { FormDisplay, FormTreeColumn, WidgetForm } from '@/shared/hooks/useWorkSpaces';

import { useFormContext } from '@/components/Form/context';
import { TableToolbar } from '@/components/table/tableToolbar/TableToolbar';
import { MainTableWithContext } from '@/components/Form/mainTable/MainTableWithContext';
import { SubFormWithContext } from '@/components/Form/subForm/SubFormWithContext';
import { DrillDialogWithContext } from '@/components/Form/drillDialog/DrillDialogWithContext';
import { TreeDrawer } from '@/components/Form/treeForm/TreeDrawer';

type Props = {
    liveTree: FormTreeColumn[] | null;
    setLiveTree: React.Dispatch<React.SetStateAction<FormTreeColumn[] | null>>;
    currentForm: WidgetForm | null;
};

export const FormTableContent: React.FC<Props> = ({
                                                      liveTree,
                                                      setLiveTree,
                                                      currentForm,
                                                  }) => {
    const ctx = useFormContext();

    const {
        config,
        data,
        loading,
        selection,
        mainAdding,
        subAdding,
        drill,
        filters,
        search,
        treeDrawer,
        // Actions
        startAdd,
        cancelAdd,
        submitAdd,
        resetFilters,
        handleTreeValueClick,
        handleNestedValueClick,
        openDrill,
        closeDrill,
        setFormDisplay,
        comboReloadToken,
        triggerComboReload,
        // Tree Drawer
        toggleTreeDrawer,
        closeTreeDrawer,
        resetTreeDrawer,
        setExpandedKeys,
        setChildrenCache,
        // Sub
        startAddSub,
        cancelAddSub,
        submitAddSub,
    } = ctx;

    const { selectedFormId, selectedWidget } = config;
    const { formDisplay, subDisplay } = data;
    const { subLoading, subError } = loading;
    const { lastPrimary, activeSubOrder } = selection;
    const { isOpen: isTreeOpen, expandedKeys, childrenCache } = treeDrawer;

    // ═══════════════════════════════════════════════════════════
    // SUB WIDGETS
    // ═══════════════════════════════════════════════════════════

    const hasSubWidgets = !!(currentForm?.sub_widgets && currentForm.sub_widgets.length > 0);

    const hasSelectedRow = Object.keys(lastPrimary).length > 0;
    const shouldShowSubSection =
        hasSubWidgets &&
        hasSelectedRow &&
        (subLoading || !!subDisplay || !!subError);

    // ═══════════════════════════════════════════════════════════
    // TREE
    // ═══════════════════════════════════════════════════════════

    const reloadTreeLocal = useCallback(async () => {
        const fid = selectedFormId ?? currentForm?.form_id ?? null;
        if (!fid) return;
        try {
            const { data } = await api.post<FormTreeColumn[] | FormTreeColumn>(
                `/display/${fid}/tree`
            );
            const normalized = Array.isArray(data) ? data : [data];

            const hasValidTree =
                normalized.length > 0 && normalized.some((t) => t.values && t.values.length > 0);

            setLiveTree(hasValidTree ? normalized : null);
        } catch (e: any) {
            if (e?.response?.status === 404) {
                setLiveTree(null);
            } else {
                console.warn('Не удалось обновить дерево:', e);
            }
        }
    }, [selectedFormId, currentForm, setLiveTree]);

    // ═══════════════════════════════════════════════════════════
    // СЛУШАЕМ МУТАЦИИ ФОРМЫ (из ModalEditForm)
    // ═══════════════════════════════════════════════════════════

    useEffect(() => {
        const handleFormMutated = async (e: CustomEvent<{ formId: number }>) => {
            const mutatedFormId = e.detail?.formId;
            const currentFid = selectedFormId ?? currentForm?.form_id;

            if (mutatedFormId && mutatedFormId === currentFid) {
                console.debug('[FormTableContent] Form mutated, reloading tree...', mutatedFormId);
                await reloadTreeLocal();
            }
        };

        window.addEventListener('portal:form-mutated', handleFormMutated as EventListener);

        return () => {
            window.removeEventListener('portal:form-mutated', handleFormMutated as EventListener);
        };
    }, [selectedFormId, currentForm?.form_id, reloadTreeLocal]);

    // ═══════════════════════════════════════════════════════════
    // RESET FILTERS (локальная версия с liveTree)
    // ═══════════════════════════════════════════════════════════

    const handleResetFilters = useCallback(async () => {
        await resetFilters();
        await reloadTreeLocal();
        // resetTreeDrawer вызывается внутри resetFilters в контексте
    }, [resetFilters, reloadTreeLocal]);

    // ═══════════════════════════════════════════════════════════
    // DRILL HANDLERS
    // ═══════════════════════════════════════════════════════════

    const handleOpenDrill = useCallback(
        (
            fid?: number | null,
            meta?: {
                originColumnType?: 'combobox' | null;
                primary?: Record<string, unknown>;
                openedFromEdit?: boolean;
                targetWriteTcId?: number;
            }
        ) => {
            if (!fid) return;
            openDrill(fid, meta);
        },
        [openDrill]
    );

    const handlePickFromDrill = useCallback(
        (payload: { row: FormDisplay['data'][number]; primary: Record<string, unknown> }) => {
            if (drill.targetWriteTcId == null) return;

            const pkValues = Object.values(payload.primary ?? {});
            const nextId = pkValues.length ? String(pkValues[0]) : '';

            ctx.setEditDraft((prev) => ({
                ...prev,
                [drill.targetWriteTcId!]: nextId,
            }));

            triggerComboReload();
            closeDrill();
        },
        [drill.targetWriteTcId, ctx.setEditDraft, triggerComboReload, closeDrill]
    );

    const handleSyncParentMain = useCallback(async () => {
        const fid = selectedFormId ?? currentForm?.form_id ?? null;
        if (!fid) return;

        try {
            const { data } = await api.post<FormDisplay | FormDisplay[]>(
                `/display/${fid}/main`,
                filters.activeFilters
            );
            const next = Array.isArray(data) ? data[0] : data;
            if (next) setFormDisplay(next);
        } catch (e) {
            console.warn('[FormTableContent] onSyncParentMain failed:', e);
        }
    }, [selectedFormId, currentForm, filters.activeFilters, setFormDisplay]);

    // ═══════════════════════════════════════════════════════════
    // FILTER MAIN FROM TREE
    // ═══════════════════════════════════════════════════════════

    const handleFilterMain = useCallback(
        async (filters: Array<{ table_column_id: number; value: string | number }>) => {
            if (!selectedFormId) return;

            try {
                const { data } = await api.post<FormDisplay>(
                    `/display/${selectedFormId}/main`,
                    filters.map((f) => ({ ...f, value: String(f.value) }))
                );
                setFormDisplay(data);

                ctx.setActiveFilters(filters);
                ctx.setSelectedKey(null);
                ctx.setLastPrimary({});
                ctx.setSubDisplay(null);
            } catch (e) {
                console.warn('[FormTableContent] handleFilterMain failed:', e);
            }
        },
        [selectedFormId, setFormDisplay, ctx]
    );

    return (
        <>
            <TreeDrawer
                isOpen={isTreeOpen}
                onToggle={toggleTreeDrawer}
                onClose={closeTreeDrawer}
                tree={liveTree}
                selectedFormId={selectedFormId}
                handleTreeValueClick={handleTreeValueClick}
                handleNestedValueClick={handleNestedValueClick}
                onFilterMain={handleFilterMain}
                expandedKeys={expandedKeys}
                setExpandedKeys={setExpandedKeys}
                childrenCache={childrenCache}
                setChildrenCache={setChildrenCache}
                onResetFilters={handleResetFilters}
            />

            {/* RIGHT: TOOLBAR + MAIN + SUB */}
            <div className={s.formLayoutFullWidth}>
                <section className={s.rightPane}>
                    <div className={s.toolbarPane}>
                        <TableToolbar
                            showSubActions={!!subDisplay && Object.keys(lastPrimary).length > 0}
                            cancelAddSub={cancelAddSub}
                            startAddSub={startAddSub}
                            isAddingSub={subAdding.isAddingSub}
                            submitAddSub={submitAddSub}
                            savingSub={subAdding.savingSub}
                            isAdding={mainAdding.isAdding}
                            selectedFormId={selectedFormId}
                            selectedWidget={selectedWidget}
                            saving={mainAdding.saving}
                            startAdd={startAdd}
                            submitAdd={submitAdd}
                            cancelAdd={cancelAdd}
                            showSearch={search.showSearch}
                            value={search.q}
                            onChange={search.setQ}
                            onResetFilters={handleResetFilters}
                            collapsedWidth={160}
                            expandedWidth={420}
                        />
                    </div>

                    {/* MAIN TABLE */}
                    <div className={s.mainPane}>
                        <div className={s.mainTableScroll}>
                            <MainTableWithContext
                                onOpenDrill={handleOpenDrill}
                                comboReloadToken={comboReloadToken}
                            />
                        </div>
                    </div>

                    {/* SUB TABLE */}
                    {shouldShowSubSection && (
                        <div className={s.subPane}>
                            <SubFormWithContext
                                onOpenDrill={handleOpenDrill}
                                comboReloadToken={comboReloadToken}
                                cancelAdd={cancelAddSub!}
                                startAdd={startAddSub!}
                                submitAdd={submitAddSub!}
                                saving={subAdding.savingSub}
                                selectedWidget={selectedWidget}
                                buttonClassName={s.iconBtn}
                            />
                        </div>
                    )}
                </section>
            </div>

            {/* DRILL DIALOG */}
            <DrillDialogWithContext
                onSyncParentMain={handleSyncParentMain}
                onPickFromDrill={drill.disableNestedDrill ? handlePickFromDrill : undefined}
                onComboboxChanged={triggerComboReload}
            />
        </>
    );
};