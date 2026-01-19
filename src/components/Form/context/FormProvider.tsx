// src/components/Form/context/FormProvider.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FormContext, FormContextValue, DrillState, DrillOpenMeta, TreeDrawerState } from './FormContext';

import type {
    FormDisplay,
    SubDisplay,
    WidgetForm,
    Widget,
    FormTreeColumn,
    Column,
} from '@/shared/hooks/useWorkSpaces';

import { useHeaderPlan } from '@/components/Form/formTable/hooks/useHeaderPlan';
import { useFiltersTree } from '@/components/Form/formTable/hooks/useFiltersTree';
import { useTreeHandlers } from '@/components/Form/treeForm/hooks/useTreeHandlers';
import { useSubNav } from '@/components/Form/subForm/hook/useSubNav';
import { useFormSearch } from '@/components/search/hook/useFormSearch';
import { useMainCrud } from '@/components/Form/mainTable/hook/useMainCrud';
import { useSubCrud } from '@/components/Form/subForm/hook/useSubCrud';
import { api } from '@/services/api';

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────

export type FormProviderProps = {
    children: React.ReactNode;

    // Конфигурация
    selectedFormId: number | null;
    selectedWidget: Widget | null;
    formsById: Record<number, WidgetForm>;
    formsByWidget: Record<number, WidgetForm>;
    columns: Column[];

    // Данные (управляются снаружи или внутри)
    formDisplay: FormDisplay | null;
    setFormDisplay: (v: FormDisplay | null) => void;
    subDisplay: SubDisplay | null;
    setSubDisplay: (v: SubDisplay | null) => void;
    formTrees: Record<number, FormTreeColumn[]>;

    // Загрузка
    formLoading: boolean;
    formError: string | null;
    subLoading: boolean;
    subError: string | null;

    // Внешние actions
    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;
    loadFilteredFormDisplay: (formId: number, filter: { table_column_id: number; value: string | number }) => Promise<void>;
    loadFormTree: (formId: number) => Promise<void>;
};

// ─────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────

export const FormProvider: React.FC<FormProviderProps> = ({
                                                              children,
                                                              selectedFormId,
                                                              selectedWidget,
                                                              formsById,
                                                              formsByWidget,
                                                              columns,
                                                              formDisplay,
                                                              setFormDisplay,
                                                              subDisplay,
                                                              setSubDisplay,
                                                              formTrees,
                                                              formLoading,
                                                              formError,
                                                              subLoading,
                                                              subError,
                                                              loadSubDisplay,
                                                              loadFilteredFormDisplay,
                                                              loadFormTree,
                                                          }) => {
    // ═══════════════════════════════════════════════════════════
    // CURRENT FORM
    // ═══════════════════════════════════════════════════════════

    const currentForm = useMemo<WidgetForm | null>(() => {
        if (selectedFormId != null) return formsById[selectedFormId] ?? null;
        if (selectedWidget) return formsByWidget[selectedWidget.id] ?? null;
        return null;
    }, [selectedFormId, selectedWidget, formsById, formsByWidget]);

    // ═══════════════════════════════════════════════════════════
    // HEADER PLAN
    // ═══════════════════════════════════════════════════════════

    const {
        headerPlan,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        isColReadOnly,
        stylesColumnMeta,
    } = useHeaderPlan(formDisplay);

    // ═══════════════════════════════════════════════════════════
    // TREE DRAWER STATE
    // ═══════════════════════════════════════════════════════════

    const [isTreeOpen, setIsTreeOpen] = useState(false);
    const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
    const [childrenCache, setChildrenCache] = useState<Record<string, FormTreeColumn[]>>({});

    const openTreeDrawer = useCallback(() => {
        setIsTreeOpen(true);
    }, []);

    const closeTreeDrawer = useCallback(() => {
        setIsTreeOpen(false);
    }, []);

    const toggleTreeDrawer = useCallback(() => {
        setIsTreeOpen((prev) => !prev);
    }, []);

    const resetTreeDrawer = useCallback(() => {
        setIsTreeOpen(false);
        setExpandedKeys(new Set());
        setChildrenCache({});
    }, []);

    // Закрываем drawer при смене формы
    useEffect(() => {
        resetTreeDrawer();
    }, [selectedFormId, resetTreeDrawer]);

    // ═══════════════════════════════════════════════════════════
    // FILTERS / TREE
    // ═══════════════════════════════════════════════════════════

    const {
        activeFilters,
        setActiveFilters,
        nestedTrees,
        setNestedTrees,
        activeExpandedKey,
        setActiveExpandedKey,
        resetFiltersHard,
    } = useFiltersTree(selectedFormId, setFormDisplay);

    const { handleNestedValueClick, handleTreeValueClick } = useTreeHandlers({
        selectedFormId,
        activeFilters,
        setActiveFilters,
        setNestedTrees,
        setActiveExpandedKey,
        setFormDisplay,
        setSubDisplay,
    });

    // ═══════════════════════════════════════════════════════════
    // SUB NAVIGATION
    // ═══════════════════════════════════════════════════════════

    const availableOrders = useMemo(
        () =>
            (currentForm?.sub_widgets ?? [])
                .map((sw) => sw.widget_order)
                .sort((a, b) => a - b),
        [currentForm]
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
    } = useSubNav({
        formIdForSub: selectedFormId,
        availableOrders,
        loadSubDisplay,
    });

    // ═══════════════════════════════════════════════════════════
    // SEARCH
    // ═══════════════════════════════════════════════════════════

    const { showSearch, q, setQ, filteredRows } = useFormSearch(
        formDisplay!,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        currentForm?.search_bar,
        { debounceMs: 250 }
    );

    // ═══════════════════════════════════════════════════════════
    // RELOAD TREE
    // ═══════════════════════════════════════════════════════════

    const reloadTree = useCallback(async () => {
        const fid = selectedFormId ?? currentForm?.form_id ?? null;
        if (!fid) return;
        try {
            await loadFormTree(fid);
        } catch (e) {
            console.warn('Не удалось обновить дерево:', e);
        }
    }, [selectedFormId, currentForm, loadFormTree]);

    // ═══════════════════════════════════════════════════════════
    // MAIN CRUD
    // ═══════════════════════════════════════════════════════════

    const mainCrud = useMainCrud({
        formDisplay: formDisplay!,
        selectedWidget,
        selectedFormId,
        formsByWidget,
        formsById,
        activeFilters,
        setFormDisplay,
        reloadTree,
        isColReadOnly,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        setSubDisplay,
        pkToKey,
        lastPrimary,
        setLastPrimary,
        setSelectedKey,
        stylesColumnMeta,
        resetFilters: async () => {
            await resetFiltersHard();
            await reloadTree();
        },
        setActiveFilters,
        onResetTreeDrawer: resetTreeDrawer,
    });

    // ═══════════════════════════════════════════════════════════
    // SUB CRUD
    // ═══════════════════════════════════════════════════════════

    const subWidgetIdByOrder = useMemo(() => {
        const map: Record<number, number> = {};
        currentForm?.sub_widgets?.forEach((sw) => {
            map[sw.widget_order] = sw.sub_widget_id;
        });
        return map;
    }, [currentForm]);

    const currentWidgetId = activeSubOrder != null ? subWidgetIdByOrder[activeSubOrder] : undefined;

    const subCrud = useSubCrud({
        formIdForSub: selectedFormId,
        currentWidgetId,
        currentOrder: activeSubOrder,
        loadSubDisplay,
        lastPrimary,
        subDisplay,
    });

    // Sub editing (отдельно, т.к. useSubCrud не содержит edit)
    const [subEditingRowIdx, setSubEditingRowIdx] = useState<number | null>(null);
    const [subEditDraft, setSubEditDraft] = useState<Record<number, string>>({});
    const [subEditSaving, setSubEditSaving] = useState(false);

    // ═══════════════════════════════════════════════════════════
    // DRILL DIALOG
    // ═══════════════════════════════════════════════════════════

    const [drill, setDrill] = useState<DrillState>({
        open: false,
        formId: null,
        comboboxMode: false,
        disableNestedDrill: false,
        initialPrimary: undefined,
        targetWriteTcId: null,
    });

    const [comboReloadToken, setComboReloadToken] = useState(0);

    const openDrill = useCallback((formId: number | null, meta?: DrillOpenMeta) => {
        if (!formId) return;

        setDrill({
            open: true,
            formId,
            comboboxMode: meta?.originColumnType === 'combobox',
            disableNestedDrill: !!meta?.openedFromEdit,
            initialPrimary: meta?.primary,
            targetWriteTcId: meta?.targetWriteTcId ?? null,
        });
    }, []);

    const closeDrill = useCallback(() => {
        setDrill((prev) => ({
            ...prev,
            open: false,
        }));
    }, []);

    const triggerComboReload = useCallback(() => {
        setComboReloadToken((v) => v + 1);
    }, []);

    // ═══════════════════════════════════════════════════════════
    // RESET FILTERS
    // ═══════════════════════════════════════════════════════════

    const resetFilters = useCallback(async () => {
        if (!selectedFormId) return;

        setSelectedKey(null);
        setLastPrimary({});
        setSubDisplay(null);
        setActiveSubOrder(availableOrders[0] ?? 0);

        try {
            await resetFiltersHard();
            await reloadTree();
            resetTreeDrawer();
        } catch (e) {
            console.warn('Ошибка при сбросе фильтров:', e);
        }
    }, [
        selectedFormId,
        availableOrders,
        setSubDisplay,
        resetFiltersHard,
        reloadTree,
        resetTreeDrawer,
        setSelectedKey,
        setLastPrimary,
        setActiveSubOrder,
    ]);

    // ═══════════════════════════════════════════════════════════
    // TREE DRAWER STATE OBJECT
    // ═══════════════════════════════════════════════════════════

    const treeDrawerState = useMemo<TreeDrawerState>(() => ({
        isOpen: isTreeOpen,
        expandedKeys,
        childrenCache,
    }), [isTreeOpen, expandedKeys, childrenCache]);

    // ═══════════════════════════════════════════════════════════
    // CONTEXT VALUE
    // ═══════════════════════════════════════════════════════════

    const value = useMemo<FormContextValue>(
        () => ({
            // Config
            config: {
                selectedFormId,
                selectedWidget,
                currentForm,
                formsById,
                formsByWidget,
            },

            // Data
            data: {
                formDisplay,
                subDisplay,
                formTrees,
                columns,
            },
            setFormDisplay,
            setSubDisplay,

            // Header Plan
            headerPlan: {
                headerPlan,
                flatColumnsInRenderOrder,
                valueIndexByKey,
                isColReadOnly,
                stylesColumnMeta,
            },

            // Loading
            loading: {
                formLoading,
                formError,
                subLoading,
                subError,
            },

            // Selection
            selection: {
                selectedKey,
                lastPrimary,
                activeSubOrder,
            },
            setSelectedKey,
            setLastPrimary,
            setActiveSubOrder,
            pkToKey,

            // Main CRUD
            mainAdding: {
                isAdding: mainCrud.isAdding,
                draft: mainCrud.draft,
                saving: mainCrud.saving,
            },
            mainEditing: {
                editingRowIdx: mainCrud.editingRowIdx,
                editDraft: mainCrud.editDraft,
                editSaving: mainCrud.editSaving,
                editStylesDraft: mainCrud.editStylesDraft,
            },
            deletingRowIdx: mainCrud.deletingRowIdx,
            startAdd: mainCrud.startAdd,
            cancelAdd: mainCrud.cancelAdd,
            submitAdd: mainCrud.submitAdd,
            startEdit: mainCrud.startEdit,
            cancelEdit: mainCrud.cancelEdit,
            submitEdit: mainCrud.submitEdit,
            deleteRow: mainCrud.deleteRow,
            setDraft: mainCrud.setDraft,
            setEditDraft: mainCrud.setEditDraft,
            setEditStylesDraft: mainCrud.setEditStylesDraft,

            // Валидация Main required полей
            showValidationErrors: mainCrud.showValidationErrors,
            setShowValidationErrors: mainCrud.setShowValidationErrors,
            validationMissingFields: mainCrud.validationMissingFields,
            setValidationMissingFields: mainCrud.setValidationMissingFields,
            resetValidation: mainCrud.resetValidation,

            // Sub CRUD
            subAdding: {
                isAddingSub: subCrud.isAddingSub,
                draftSub: subCrud.draftSub,
                savingSub: subCrud.savingSub,
            },
            subEditing: {
                editingRowIdx: subEditingRowIdx,
                editDraft: subEditDraft,
                editSaving: subEditSaving,
            },
            startAddSub: subCrud.startAddSub,
            cancelAddSub: subCrud.cancelAddSub,
            submitAddSub: subCrud.submitAddSub,
            setDraftSub: subCrud.setDraftSub,
            setSubEditDraft: setSubEditDraft,
            setSubEditingRowIdx: setSubEditingRowIdx,

            // Валидация Sub required полей
            showSubValidationErrors: subCrud.showSubValidationErrors,
            setShowSubValidationErrors: subCrud.setShowSubValidationErrors,
            subValidationMissingFields: subCrud.subValidationMissingFields,
            setSubValidationMissingFields: subCrud.setSubValidationMissingFields,
            resetSubValidation: subCrud.resetSubValidation,

            // Drill
            drill,
            openDrill,
            closeDrill,

            // Tree Drawer
            treeDrawer: treeDrawerState,
            openTreeDrawer,
            closeTreeDrawer,
            toggleTreeDrawer,
            resetTreeDrawer,
            setExpandedKeys,
            setChildrenCache,

            // Filters
            filters: {
                activeFilters,
                nestedTrees,
                activeExpandedKey,
            },
            setActiveFilters,
            setNestedTrees,
            setActiveExpandedKey,
            resetFilters,
            handleTreeValueClick,
            handleNestedValueClick,

            // Search
            search: {
                showSearch,
                q,
                setQ,
                filteredRows,
            },

            // Utils
            loadSubDisplay,
            loadFilteredFormDisplay,
            reloadTree,

            // Combobox reload
            comboReloadToken,
            triggerComboReload,
        }),
        [
            selectedFormId,
            selectedWidget,
            currentForm,
            formsById,
            formsByWidget,
            formDisplay,
            subDisplay,
            formTrees,
            columns,
            setFormDisplay,
            setSubDisplay,
            headerPlan,
            flatColumnsInRenderOrder,
            valueIndexByKey,
            isColReadOnly,
            stylesColumnMeta,
            formLoading,
            formError,
            subLoading,
            subError,
            selectedKey,
            lastPrimary,
            activeSubOrder,
            setSelectedKey,
            setLastPrimary,
            setActiveSubOrder,
            pkToKey,
            mainCrud,
            subCrud,
            subEditingRowIdx,
            subEditDraft,
            subEditSaving,
            drill,
            openDrill,
            closeDrill,
            treeDrawerState,
            openTreeDrawer,
            closeTreeDrawer,
            toggleTreeDrawer,
            resetTreeDrawer,
            setExpandedKeys,
            setChildrenCache,
            activeFilters,
            nestedTrees,
            activeExpandedKey,
            setActiveFilters,
            setNestedTrees,
            setActiveExpandedKey,
            resetFilters,
            handleTreeValueClick,
            handleNestedValueClick,
            showSearch,
            q,
            setQ,
            filteredRows,
            loadSubDisplay,
            loadFilteredFormDisplay,
            reloadTree,
            comboReloadToken,
            triggerComboReload,
        ]
    );

    // ═══════════════════════════════════════════════════════════
    // СБРОС ПРИ СМЕНЕ ФОРМЫ
    // ═══════════════════════════════════════════════════════════

    useEffect(() => {
        // Сбрасываем выбор строки
        setSelectedKey(null);
        setLastPrimary({});

        // Сбрасываем sub display
        setSubDisplay(null);

        // Сбрасываем sub editing
        setSubEditingRowIdx(null);
        setSubEditDraft({});
        setSubEditSaving(false);

        // Сбрасываем активный order на первый доступный
        const firstOrder =
            (currentForm?.sub_widgets ?? [])
                .map((sw) => sw.widget_order)
                .sort((a, b) => a - b)[0] ?? 0;
        setActiveSubOrder(firstOrder);
    }, [selectedFormId]);

    return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};