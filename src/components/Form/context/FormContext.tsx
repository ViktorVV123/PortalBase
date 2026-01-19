// src/components/Form/context/FormContext.tsx

import React, { createContext, useContext } from 'react';
import type {
    FormDisplay,
    SubDisplay,
    WidgetForm,
    Widget,
    FormTreeColumn,
    Column,
} from '@/shared/hooks/useWorkSpaces';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import type { CellStyles } from '@/components/Form/mainTable/CellStylePopover';
import type { StylesColumnMeta } from '@/components/Form/formTable/hooks/useHeaderPlan';

// ─────────────────────────────────────────────────────────────
// ТИПЫ
// ─────────────────────────────────────────────────────────────

/** Режим открытия drill-диалога */
export type DrillOpenMeta = {
    originColumnType?: 'combobox' | null;
    primary?: Record<string, unknown>;
    openedFromEdit?: boolean;
    targetWriteTcId?: number;
};

/** Состояние выбора строки */
export type SelectionState = {
    selectedKey: string | null;
    lastPrimary: Record<string, unknown>;
    activeSubOrder: number;
};

/** Состояние редактирования (main или sub) */
export type EditingState = {
    editingRowIdx: number | null;
    editDraft: Record<number, string>;
    editSaving: boolean;
    editStylesDraft?: Record<string, CellStyles | null>;
};

/** Состояние добавления */
export type AddingState = {
    isAdding: boolean;
    draft: Record<number, string>;
    saving: boolean;
};

/** Состояние drill-диалога */
export type DrillState = {
    open: boolean;
    formId: number | null;
    comboboxMode: boolean;
    disableNestedDrill: boolean;
    initialPrimary?: Record<string, unknown>;
    targetWriteTcId?: number | null;
};

/** Состояние TreeDrawer */
export type TreeDrawerState = {
    isOpen: boolean;
    expandedKeys: Set<string>;
    childrenCache: Record<string, FormTreeColumn[]>;
};

/** Конфигурация формы (то, что редко меняется) */
export type FormConfig = {
    selectedFormId: number | null;
    selectedWidget: Widget | null;
    currentForm: WidgetForm | null;
    formsById: Record<number, WidgetForm>;
    formsByWidget: Record<number, WidgetForm>;
};

/** Данные формы */
export type FormData = {
    formDisplay: FormDisplay | null;
    subDisplay: SubDisplay | null;
    formTrees: Record<number, FormTreeColumn[]>;
    columns: Column[];
};

/** Состояния загрузки */
export type LoadingStates = {
    formLoading: boolean;
    formError: string | null;
    subLoading: boolean;
    subError: string | null;
};

/** Header plan из useHeaderPlan */
export type HeaderPlanData = {
    headerPlan: Array<{
        id: number;
        title: string;
        labels: string[];
        cols: ExtCol[];
    }>;
    flatColumnsInRenderOrder: ExtCol[];
    valueIndexByKey: Map<string, number>;
    isColReadOnly: (c: ExtCol) => boolean;
    stylesColumnMeta: StylesColumnMeta;
};

// ─────────────────────────────────────────────────────────────
// КОНТЕКСТ
// ─────────────────────────────────────────────────────────────

export type FormContextValue = {
    // === Конфигурация ===
    config: FormConfig;

    // === Данные ===
    data: FormData;
    setFormDisplay: (v: FormDisplay | null) => void;
    setSubDisplay: (v: SubDisplay | null) => void;

    // === Header Plan ===
    headerPlan: HeaderPlanData;

    // === Загрузка ===
    loading: LoadingStates;

    // === Выбор строки / навигация ===
    selection: SelectionState;
    setSelectedKey: (key: string | null) => void;
    setLastPrimary: (pk: Record<string, unknown>) => void;
    setActiveSubOrder: (order: number) => void;
    pkToKey: (pk: Record<string, unknown>) => string;

    // === Main CRUD ===
    mainAdding: AddingState;
    mainEditing: EditingState;
    deletingRowIdx: number | null;

    startAdd: () => Promise<void>;
    cancelAdd: () => void;
    submitAdd: () => Promise<void>;
    startEdit: (rowIdx: number) => Promise<void>;
    cancelEdit: () => void;
    submitEdit: () => Promise<void>;
    deleteRow: (rowIdx: number) => Promise<void>;
    setDraft: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    setEditDraft: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    setEditStylesDraft: React.Dispatch<React.SetStateAction<Record<string, CellStyles | null>>>;

    // === Валидация Main required полей ===
    showValidationErrors: boolean;
    setShowValidationErrors: React.Dispatch<React.SetStateAction<boolean>>;
    validationMissingFields: string[];
    setValidationMissingFields: React.Dispatch<React.SetStateAction<string[]>>;
    resetValidation: () => void;

    // === Sub CRUD ===
    subAdding: {
        isAddingSub: boolean;
        draftSub: Record<number, string>;
        savingSub: boolean;
    };
    subEditing: EditingState;

    startAddSub: () => Promise<void>;
    cancelAddSub: () => void;
    submitAddSub: () => Promise<void>;
    setDraftSub: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    setSubEditDraft: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    setSubEditingRowIdx: React.Dispatch<React.SetStateAction<number | null>>;

    // === Валидация Sub required полей ===
    showSubValidationErrors: boolean;
    setShowSubValidationErrors: React.Dispatch<React.SetStateAction<boolean>>;
    subValidationMissingFields: string[];
    setSubValidationMissingFields: React.Dispatch<React.SetStateAction<string[]>>;
    resetSubValidation: () => void;

    // === Drill Dialog ===
    drill: DrillState;
    openDrill: (formId: number | null, meta?: DrillOpenMeta) => void;
    closeDrill: () => void;

    // === Tree Drawer ===
    treeDrawer: TreeDrawerState;
    openTreeDrawer: () => void;
    closeTreeDrawer: () => void;
    toggleTreeDrawer: () => void;
    resetTreeDrawer: () => void;
    setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
    setChildrenCache: React.Dispatch<React.SetStateAction<Record<string, FormTreeColumn[]>>>;

    // === Фильтры / Дерево ===
    filters: {
        activeFilters: Array<{ table_column_id: number; value: string | number }>;
        nestedTrees: Record<string, FormTreeColumn[]>;
        activeExpandedKey: string | null;
    };
    setActiveFilters: React.Dispatch<React.SetStateAction<Array<{ table_column_id: number; value: string | number }>>>;
    setNestedTrees: React.Dispatch<React.SetStateAction<Record<string, FormTreeColumn[]>>>;
    setActiveExpandedKey: React.Dispatch<React.SetStateAction<string | null>>;
    resetFilters: () => Promise<void>;
    handleTreeValueClick: (table_column_id: number, value: string | number) => Promise<void>;
    handleNestedValueClick: (table_column_id: number, value: string | number) => Promise<void>;

    // === Поиск ===
    search: {
        showSearch: boolean;
        q: string;
        setQ: (v: string) => void;
        filteredRows: Array<{ row: FormDisplay['data'][number]; idx: number }>;
    };

    // === Утилиты ===
    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;
    loadFilteredFormDisplay: (formId: number, filter: { table_column_id: number; value: string | number }) => Promise<void>;
    reloadTree: () => Promise<void>;

    // === Combobox reload (для синхронизации после CRUD в DrillDialog) ===
    comboReloadToken: number;
    triggerComboReload: () => void;
};

const FormContext = createContext<FormContextValue | null>(null);

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

export function useFormContext(): FormContextValue {
    const ctx = useContext(FormContext);
    if (!ctx) {
        throw new Error('useFormContext must be used within FormProvider');
    }
    return ctx;
}

/** Хук для доступа только к конфигурации (редко меняется) */
export function useFormConfig() {
    const { config } = useFormContext();
    return config;
}

/** Хук для доступа только к данным формы */
export function useFormData() {
    const { data, setFormDisplay, setSubDisplay } = useFormContext();
    return { ...data, setFormDisplay, setSubDisplay };
}

/** Хук для доступа только к main CRUD */
export function useMainCrudContext() {
    const ctx = useFormContext();
    return {
        adding: ctx.mainAdding,
        editing: ctx.mainEditing,
        deletingRowIdx: ctx.deletingRowIdx,
        startAdd: ctx.startAdd,
        cancelAdd: ctx.cancelAdd,
        submitAdd: ctx.submitAdd,
        startEdit: ctx.startEdit,
        cancelEdit: ctx.cancelEdit,
        submitEdit: ctx.submitEdit,
        deleteRow: ctx.deleteRow,
        setDraft: ctx.setDraft,
        setEditDraft: ctx.setEditDraft,
        setEditStylesDraft: ctx.setEditStylesDraft,
        // Валидация Main
        showValidationErrors: ctx.showValidationErrors,
        setShowValidationErrors: ctx.setShowValidationErrors,
        validationMissingFields: ctx.validationMissingFields,
        setValidationMissingFields: ctx.setValidationMissingFields,
        resetValidation: ctx.resetValidation,
    };
}

/** Хук для доступа только к sub CRUD */
export function useSubCrudContext() {
    const ctx = useFormContext();
    return {
        adding: ctx.subAdding,
        editing: ctx.subEditing,
        startAddSub: ctx.startAddSub,
        cancelAddSub: ctx.cancelAddSub,
        submitAddSub: ctx.submitAddSub,
        setDraftSub: ctx.setDraftSub,
        setEditDraft: ctx.setSubEditDraft,
        setEditingRowIdx: ctx.setSubEditingRowIdx,
        // Валидация Sub
        showSubValidationErrors: ctx.showSubValidationErrors,
        setShowSubValidationErrors: ctx.setShowSubValidationErrors,
        subValidationMissingFields: ctx.subValidationMissingFields,
        setSubValidationMissingFields: ctx.setSubValidationMissingFields,
        resetSubValidation: ctx.resetSubValidation,
    };
}

/** Хук для доступа к drill */
export function useDrillContext() {
    const { drill, openDrill, closeDrill } = useFormContext();
    return { drill, openDrill, closeDrill };
}

/** Хук для доступа к tree drawer */
export function useTreeDrawerContext() {
    const ctx = useFormContext();
    return {
        treeDrawer: ctx.treeDrawer,
        openTreeDrawer: ctx.openTreeDrawer,
        closeTreeDrawer: ctx.closeTreeDrawer,
        toggleTreeDrawer: ctx.toggleTreeDrawer,
        resetTreeDrawer: ctx.resetTreeDrawer,
        setExpandedKeys: ctx.setExpandedKeys,
        setChildrenCache: ctx.setChildrenCache,
    };
}

/** Хук для доступа к selection */
export function useSelectionContext() {
    const ctx = useFormContext();
    return {
        ...ctx.selection,
        setSelectedKey: ctx.setSelectedKey,
        setLastPrimary: ctx.setLastPrimary,
        setActiveSubOrder: ctx.setActiveSubOrder,
        pkToKey: ctx.pkToKey,
    };
}

export { FormContext };