// общие типы

// src/shared/hooks/stores/types.ts

/**
 * Общие типы для доменных хуков
 */

// ─────────────────────────────────────────────────────────────
// Базовые сущности
// ─────────────────────────────────────────────────────────────

export interface DTable {
    id: number;
    workspace_id: number;
    name: string;
    description: string;
    published: boolean;
    select_query?: string;
    insert_query?: string;
    update_query?: string;
    delete_query: string;
}

export interface Column {
    id: number;
    table_id: number;
    name: string;
    description: string | null;
    datatype: string;
    required: boolean;
    length: number | null | string;
    precision: number | null | string;
    primary: boolean;
    increment: boolean;
    datetime: number | null | string | boolean;
}

export interface Widget {
    id: number;
    table_id: number;
    name: string;
    description: string | null;
    published: boolean;
}

export interface WidgetColumn {
    widget_id: number;
    alias: string | null;
    column_order: number;
    id: number;
    reference: ReferenceItem[];
}

export interface ReferenceItem {
    ref_column_order: number;
    ref_alias: string | null;
    combobox: any;
    form: any;
    placeholder: string | null;
    width: number;
    type: string | null;
    default: string | null;
    visible: boolean;
    readonly: boolean;
    table_column: {
        table_id: number;
        name: string;
        datatype: string;
        precision: number | null;
        increment: boolean;
        id: number;
        description: string | null;
        length: number | null;
        primary: boolean;
        required: boolean;
    };
}

export interface WidgetForm {
    main_widget_id: number;
    name: string;
    search_bar: boolean;
    group: string;
    description: string | null;
    path?: string | null;
    form_id: number;
    sub_widgets: {
        widget_order: number;
        sub_widget_id: number;
        form_id: number;
        where_conditional: string | null;
        delete_sub_query: string;
    }[];
    tree_fields: {
        column_order: number;
        table_column_id: number;
    }[];
    workspace: {
        connection_id: number;
        group: string | null;
        description: string | null;
        id: number;
        name: string;
    };
}

export interface Connection {
    id: number;
    name: string;
    description?: string | null;
    conn_type?: string;
    conn_str?: string;
    url?: {
        drivername?: string;
        username?: string;
        password?: string;
        host?: string;
        port?: number;
        database?: string;
        query?: Record<string, string>;
    };
    connection?: {
        name?: string;
        description?: string;
    };
}

// ─────────────────────────────────────────────────────────────
// Form Display типы
// ─────────────────────────────────────────────────────────────

export interface FormColumn {
    column_order: number;
    ref_column_order: number | null;
    combobox_column_order: number | null;
    column_name: string;
    ref_column_name: string | null;
    combobox_alias: string | null;
    widget_column_id: number;
    table_column_id: number | null;
    combobox_column_id: number | null;
    form_id: number | null;
    readonly: boolean | null;
    required: boolean;
    visible: boolean;
    width: number;
    placeholder: string | null;
    type: string | null | boolean;
    default: string | null;
    published?: boolean;
    primary?: boolean;
    increment?: boolean;
    read_only?: boolean;
    is_readonly?: boolean;
    meta?: { readonly?: boolean; [k: string]: unknown };
}

export interface FormRow {
    primary_keys: Record<string, number | string>;
    values: (string | number | null)[];
}

export interface DisplayedWidget {
    name: string;
    description: string | null;
    /** Общее количество строк (для пагинации) */
    total?: number;
    page:number
}

export interface FormDisplay {
    displayed_widget: DisplayedWidget;
    columns: FormColumn[];
    data: FormRow[];
}

export interface SubDisplayedWidget {
    widget_order: number;
    name: string;
    description: string | null;
}

export interface SubFormColumn {
    column_order: number;
    column_name: string;
    placeholder: string | null;
    type: string | null;
    default: string | null;
    published: boolean;
    required: boolean;
    width: number;
    widget_column_id: number;
    table_column_id: number;
    combobox_column_id: number;
}

export interface SubFormRow {
    primary_keys: Record<string, number | string>;
    values: (number | string | null)[];
}

export interface SubDisplay {
    sub_widgets: SubDisplayedWidget[];
    displayed_widget: SubDisplayedWidget;
    columns: SubFormColumn[];
    data: SubFormRow[];
}

export type FormTreeColumn = {
    table_column_id: number;
    name: string;
    sort: string | null;
    values: (string | number | null)[];
    display_values?: (string | number | null)[];
};

// ─────────────────────────────────────────────────────────────
// Payload типы для API
// ─────────────────────────────────────────────────────────────

export type NewFormPayload = {
    main_widget_id: number;
    name: string;
    description?: string | null;
    path?: string | null;
};

export type NewSubWidgetItem = {
    widget_order: number;
    where_conditional?: string | null;
    sub_widget_id: number;
};

export type NewTreeFieldItem = {
    column_order: number;
    table_column_id: number;
};

export type AddFormRequest = {
    form: NewFormPayload;
    sub_widgets_lst?: NewSubWidgetItem[];
    tree_fields_lst?: NewTreeFieldItem[];
};

export type RefPatch = Partial<{
    ref_column_order: number;
    width: number;
    type: string | null;
    ref_alias: string | null;
    default: string | null;
    placeholder: string | null;
    visible: boolean;
    readonly: boolean;
}>;

// ─────────────────────────────────────────────────────────────
// Статусы загрузки
// ─────────────────────────────────────────────────────────────

export type LoadStatus = 'idle' | 'loading' | 'loaded' | 'forbidden' | 'error';

// ─────────────────────────────────────────────────────────────
// Общий интерфейс для store-хуков
// ─────────────────────────────────────────────────────────────

export interface StoreState {
    loading: boolean;
    error: string | null;
}