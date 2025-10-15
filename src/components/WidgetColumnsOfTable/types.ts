import {WidgetColumn, Column} from '@/shared/hooks/useWorkSpaces';

export type RefItem = WidgetColumn['reference'][number];

export type RefPatch = Partial<
    Pick<RefItem, 'ref_column_order'|'width'|'type'|'ref_alias'|'default'|'placeholder'|'visible'|'readonly'>
> & { form_id?: number | null };

export type FormOption = { id: number | null; name: string };
export type ColumnOption = { id: number; name: string; datatype: string; disabled: boolean };

export type EditState = {
    open: boolean;
    wcId: number | null;
    tableColumnId: number | null;
    ref_alias: string;
    ref_type: string;
    ref_width: number;
    ref_order: number;
    ref_default: string;
    ref_placeholder: string;
    ref_visible: boolean;
    ref_readOnly: boolean;
};

export type AddDlgState = {
    open: boolean;
    wcId: number | null;
    table_column_id: number | null;
    width: number;
    ref_column_order: number;
    type: string;
    ref_alias: string;
    default: string;
    placeholder: string;
    visible: boolean;
    readonly: boolean;
    form_id: number | null;
};

export type Props = {
    widgetColumns: WidgetColumn[];
    referencesMap: Record<number, RefItem[]>;
    handleDeleteReference: (wcId: number, tblColId: number) => void;
    updateWidgetColumn: (id: number, patch: Partial<Omit<WidgetColumn,'id'|'widget_id'|'reference'>>) => Promise<void> | void;
    updateReference: (widgetColumnId: number, tableColumnId: number, patch: RefPatch) => Promise<RefItem>;
    refreshReferences?: (wcId: number) => Promise<void> | void;
    onRefsChange?: (refsMap: Record<number, RefItem[]>) => void;
    deleteColumnWidget: (id: number) => void;
    formsById: Record<number, { form_id: number; name: string }>;
    loadWidgetForms: () => Promise<void> | void;
    allColumns: Column[];
};
