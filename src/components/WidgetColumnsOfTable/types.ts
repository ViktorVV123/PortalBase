import {WidgetColumn, Column} from '@/shared/hooks/useWorkSpaces';

export type ComboItem = {
    combobox_column_id?: number;  // серверный id
    id?: number;                  // на случай другого имени
    combobox_width?: number;
    combobox_column_order?: number;
    combobox_alias?: string | null;
    is_primary?: boolean;
    is_show?: boolean;
    is_show_hidden?: boolean;
};

export type RefItem = {
    width?: number | null;
    ref_column_order?: number | null;
    type?: string | null;
    ref_alias?: string | null;
    default?: string | null;
    placeholder?: string | null;
    visible?: boolean | null;
    readonly?: boolean | null;
    table_column?: {
        id: number;
        table_id: number;
        name: string;
        description?: string | null;
        datatype: string;
        length?: number | null;
        precision?: number | null;
        primary?: boolean;
        increment?: boolean;
        required?: boolean;
    } | null;
    form?: number | null;
    form_id?: number | null;

    /** NEW: combobox теперь массив */
    combobox?: ComboItem[] | null;
};


export type RefPatch = Partial<
    Pick<RefItem, 'ref_column_order'|'width'|'type'|'ref_alias'|'default'|'placeholder'|'visible'|'readonly'>
> & { form_id?: number | null };

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
    ref_datatype: string | null;
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
    onRefsChange?: any;
    deleteColumnWidget: (id: number) => void;
    formsById: Record<number, { form_id: number; name: string }>;
    loadWidgetForms: () => Promise<void> | void;
    allColumns: Column[];
};
