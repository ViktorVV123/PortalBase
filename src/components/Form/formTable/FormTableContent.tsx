// src/components/Form/formTable/FormTableContent.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import { api } from '@/services/api';

import type { FormDisplay, FormTreeColumn, WidgetForm } from '@/shared/hooks/useWorkSpaces';

import { useFormContext } from '@/components/Form/context';
import { TableToolbar } from '@/components/table/tableToolbar/TableToolbar';
import { TreeFormTable } from '@/components/Form/treeForm/TreeFormTable';
import { MainTableWithContext } from '@/components/Form/mainTable/MainTableWithContext';
import { SubFormWithContext } from '@/components/Form/subForm/SubFormWithContext';
import { DrillDialogWithContext } from '@/components/Form/drillDialog/DrillDialogWithContext';
import * as cls from "@/components/table/tableToolbar/TableToolbar.module.scss";
import {ButtonForm} from "@/shared/buttonForm/ButtonForm";

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
        // Sub
        startAddSub,
        cancelAddSub,
        submitAddSub,
    } = ctx;

    const { selectedFormId, selectedWidget } = config;
    const { formDisplay, subDisplay } = data;
    const { subLoading, subError } = loading;
    const { lastPrimary, activeSubOrder } = selection;

    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
    const [childrenCache, setChildrenCache] = useState<Record<string, FormTreeColumn[]>>({});




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

    const hasTree = !!(liveTree && liveTree.length);

    const reloadTreeLocal = useCallback(async () => {
        const fid = selectedFormId ?? currentForm?.form_id ?? null;
        if (!fid) return;
        try {
            const { data } = await api.post<FormTreeColumn[] | FormTreeColumn>(
                `/display/${fid}/tree`
            );
            const normalized = Array.isArray(data) ? data : [data];

            // Если пустой массив или нет values — считаем что дерева нет
            const hasValidTree = normalized.length > 0 &&
                normalized.some(t => t.values && t.values.length > 0);

            setLiveTree(hasValidTree ? normalized : null);
        } catch (e: any) {
            // 404 или пустой ответ = нет дерева
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

            // Если мутировали текущую форму — перезагружаем дерево
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
        setExpandedKeys(new Set());
        setChildrenCache({});
    }, [resetFilters, reloadTreeLocal]);

    // ═══════════════════════════════════════════════════════════
    // DRILL HANDLERS
    // ═══════════════════════════════════════════════════════════

    const handleOpenDrill = useCallback((
        fid?: number | null,
        meta?: {
            originColumnType?: 'combobox' | null;
            primary?: Record<string, unknown>;
            openedFromEdit?: boolean;
            targetWriteTcId?: number;
        },
    ) => {
        if (!fid) return;
        openDrill(fid, meta);
    }, [openDrill]);

    // Обработка выбора из DrillDialog (для редактирования combobox)
    const handlePickFromDrill = useCallback((
        payload: { row: FormDisplay['data'][number]; primary: Record<string, unknown> },
    ) => {
        if (drill.targetWriteTcId == null) return;

        const pkValues = Object.values(payload.primary ?? {});
        const nextId = pkValues.length ? String(pkValues[0]) : '';

        ctx.setEditDraft((prev) => ({
            ...prev,
            [drill.targetWriteTcId!]: nextId,
        }));

        triggerComboReload();
        closeDrill();
    }, [drill.targetWriteTcId, ctx.setEditDraft, triggerComboReload, closeDrill]);

    // Синхронизация родительского main после CRUD в DrillDialog
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
    // RENDER
    // ═══════════════════════════════════════════════════════════


    // Фильтрация MainTable из дерева
    const handleFilterMain = useCallback(async (
        filters: Array<{ table_column_id: number; value: string | number }>
    ) => {
        if (!selectedFormId) return;

        try {
            const { data } = await api.post<FormDisplay>(
                `/display/${selectedFormId}/main`,
                filters.map((f) => ({ ...f, value: String(f.value) }))
            );
            setFormDisplay(data);

            // Обновляем activeFilters в контексте
            ctx.setActiveFilters(filters);

            // Сбрасываем выбор строки и sub
            ctx.setSelectedKey(null);
            ctx.setLastPrimary({});
            ctx.setSubDisplay(null);
        } catch (e) {
            console.warn('[FormTableContent] handleFilterMain failed:', e);
        }
    }, [selectedFormId, setFormDisplay, ctx]);


    return (
        <>
            <div className={s.formLayout} data-has-tree={hasTree ? 'true' : 'false'}>
                {/* LEFT: TREE */}
                {hasTree && (
                    <aside className={s.treePane}>
                        <TreeFormTable
                            expandedKeys={expandedKeys}
                            setExpandedKeys={setExpandedKeys}
                            childrenCache={childrenCache}
                            setChildrenCache={setChildrenCache}
                            tree={liveTree}
                            selectedFormId={selectedFormId}
                            handleNestedValueClick={handleNestedValueClick}
                            handleTreeValueClick={handleTreeValueClick}
                            onFilterMain={handleFilterMain}
                        />
                    </aside>
                )}

                {/* RIGHT: TOOLBAR + MAIN + SUB */}
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
                                buttonClassName={cls.iconBtn}
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