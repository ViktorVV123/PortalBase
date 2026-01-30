// src/components/Form/context/FormContext.tsx

import React, { createContext, useContext } from 'react';
import type {
    FormDisplay, SubDisplay, WidgetForm, Widget, FormTreeColumn, Column, PaginationState,
} from '@/shared/hooks/useWorkSpaces';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import type { CellStyles } from '@/components/Form/mainTable/CellStylePopover';
import type { StylesColumnMeta } from '@/components/Form/formTable/hooks/useHeaderPlan';

export type DrillOpenMeta = {
    originColumnType?: 'combobox' | null;
    primary?: Record<string, unknown>;
    openedFromEdit?: boolean;
    targetWriteTcId?: number;
};

export type SelectionState = { selectedKey: string | null; lastPrimary: Record<string, unknown>; activeSubOrder: number; };
export type EditingState = { editingRowIdx: number | null; editDraft: Record<number, string>; editSaving: boolean; editStylesDraft?: Record<string, CellStyles | null>; };
export type AddingState = { isAdding: boolean; draft: Record<number, string>; saving: boolean; };
export type DrillState = { open: boolean; formId: number | null; comboboxMode: boolean; disableNestedDrill: boolean; initialPrimary?: Record<string, unknown>; targetWriteTcId?: number | null; };
export type TreeDrawerState = { isOpen: boolean; expandedKeys: Set<string>; childrenCache: Record<string, FormTreeColumn[]>; };
export type FormConfig = { selectedFormId: number | null; selectedWidget: Widget | null; currentForm: WidgetForm | null; formsById: Record<number, WidgetForm>; formsByWidget: Record<number, WidgetForm>; };
export type FormData = { formDisplay: FormDisplay | null; subDisplay: SubDisplay | null; formTrees: Record<number, FormTreeColumn[]>; columns: Column[]; };
export type LoadingStates = { formLoading: boolean; formError: string | null; subLoading: boolean; subError: string | null; };
export type HeaderPlanData = {
    headerPlan: Array<{ id: number; title: string; labels: string[]; cols: ExtCol[]; }>;
    flatColumnsInRenderOrder: ExtCol[];
    valueIndexByKey: Map<string, number>;
    isColReadOnly: (c: ExtCol) => boolean;
    stylesColumnMeta: StylesColumnMeta;
};

export type FormContextValue = {
    config: FormConfig;
    data: FormData;
    setFormDisplay: (v: FormDisplay | null) => void;
    setSubDisplay: (v: SubDisplay | null) => void;
    headerPlan: HeaderPlanData;
    loading: LoadingStates;

    // Pagination (с infinite scroll)
    pagination: PaginationState;
    goToPage: (page: number) => Promise<void>;
    loadMoreRows: () => Promise<void>;

    selection: SelectionState;
    setSelectedKey: (key: string | null) => void;
    setLastPrimary: (pk: Record<string, unknown>) => void;
    setActiveSubOrder: (order: number) => void;
    pkToKey: (pk: Record<string, unknown>) => string;

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

    showValidationErrors: boolean;
    setShowValidationErrors: React.Dispatch<React.SetStateAction<boolean>>;
    validationMissingFields: string[];
    setValidationMissingFields: React.Dispatch<React.SetStateAction<string[]>>;
    resetValidation: () => void;

    subAdding: { isAddingSub: boolean; draftSub: Record<number, string>; savingSub: boolean; };
    subEditing: EditingState;
    startAddSub: () => Promise<void>;
    cancelAddSub: () => void;
    submitAddSub: () => Promise<void>;
    setDraftSub: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    setSubEditDraft: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    setSubEditingRowIdx: React.Dispatch<React.SetStateAction<number | null>>;

    showSubValidationErrors: boolean;
    setShowSubValidationErrors: React.Dispatch<React.SetStateAction<boolean>>;
    subValidationMissingFields: string[];
    setSubValidationMissingFields: React.Dispatch<React.SetStateAction<string[]>>;
    resetSubValidation: () => void;

    drill: DrillState;
    openDrill: (formId: number | null, meta?: DrillOpenMeta) => void;
    closeDrill: () => void;

    treeDrawer: TreeDrawerState;
    openTreeDrawer: () => void;
    closeTreeDrawer: () => void;
    toggleTreeDrawer: () => void;
    resetTreeDrawer: () => void;
    setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
    setChildrenCache: React.Dispatch<React.SetStateAction<Record<string, FormTreeColumn[]>>>;

    filters: { activeFilters: Array<{ table_column_id: number; value: string | number }>; nestedTrees: Record<string, FormTreeColumn[]>; activeExpandedKey: string | null; };
    setActiveFilters: React.Dispatch<React.SetStateAction<Array<{ table_column_id: number; value: string | number }>>>;
    setNestedTrees: React.Dispatch<React.SetStateAction<Record<string, FormTreeColumn[]>>>;
    setActiveExpandedKey: React.Dispatch<React.SetStateAction<string | null>>;
    resetFilters: () => Promise<void>;
    handleTreeValueClick: (table_column_id: number, value: string | number) => Promise<void>;
    handleNestedValueClick: (table_column_id: number, value: string | number) => Promise<void>;

    search: { showSearch: boolean; q: string; setQ: (v: string) => void; filteredRows: Array<{ row: FormDisplay['data'][number]; idx: number }>; };

    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;
    loadFilteredFormDisplay: (formId: number, filter: { table_column_id: number; value: string | number }) => Promise<void>;
    reloadTree: () => Promise<void>;
    comboReloadToken: number;
    triggerComboReload: () => void;
};

const FormContext = createContext<FormContextValue | null>(null);

export function useFormContext(): FormContextValue {
    const ctx = useContext(FormContext);
    if (!ctx) throw new Error('useFormContext must be used within FormProvider');
    return ctx;
}

export function useFormConfig() { return useFormContext().config; }
export function useFormData() { const { data, setFormDisplay, setSubDisplay } = useFormContext(); return { ...data, setFormDisplay, setSubDisplay }; }

export function useMainCrudContext() {
    const ctx = useFormContext();
    return {
        adding: ctx.mainAdding, editing: ctx.mainEditing, deletingRowIdx: ctx.deletingRowIdx,
        startAdd: ctx.startAdd, cancelAdd: ctx.cancelAdd, submitAdd: ctx.submitAdd,
        startEdit: ctx.startEdit, cancelEdit: ctx.cancelEdit, submitEdit: ctx.submitEdit,
        deleteRow: ctx.deleteRow, setDraft: ctx.setDraft, setEditDraft: ctx.setEditDraft, setEditStylesDraft: ctx.setEditStylesDraft,
        showValidationErrors: ctx.showValidationErrors, setShowValidationErrors: ctx.setShowValidationErrors,
        validationMissingFields: ctx.validationMissingFields, setValidationMissingFields: ctx.setValidationMissingFields, resetValidation: ctx.resetValidation,
    };
}

export function useSubCrudContext() {
    const ctx = useFormContext();
    return {
        adding: ctx.subAdding, editing: ctx.subEditing,
        startAddSub: ctx.startAddSub, cancelAddSub: ctx.cancelAddSub, submitAddSub: ctx.submitAddSub,
        setDraftSub: ctx.setDraftSub, setEditDraft: ctx.setSubEditDraft, setEditingRowIdx: ctx.setSubEditingRowIdx,
        showSubValidationErrors: ctx.showSubValidationErrors, setShowSubValidationErrors: ctx.setShowSubValidationErrors,
        subValidationMissingFields: ctx.subValidationMissingFields, setSubValidationMissingFields: ctx.setSubValidationMissingFields, resetSubValidation: ctx.resetSubValidation,
    };
}

export function useDrillContext() { const { drill, openDrill, closeDrill } = useFormContext(); return { drill, openDrill, closeDrill }; }
export function usePaginationContext() { const { pagination, goToPage, loadMoreRows } = useFormContext(); return { pagination, goToPage, loadMoreRows }; }
export function useSelectionContext() {
    const ctx = useFormContext();
    return { ...ctx.selection, setSelectedKey: ctx.setSelectedKey, setLastPrimary: ctx.setLastPrimary, setActiveSubOrder: ctx.setActiveSubOrder, pkToKey: ctx.pkToKey };
}

export { FormContext };