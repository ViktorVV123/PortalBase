// src/components/setOfTables/SetOfTables.tsx

import React, { useState } from 'react';
import * as s from './SetOfTables.module.scss';

import type {
    Column,
    DTable,
    FormDisplay,
    FormTreeColumn,
    SubDisplay,
    Widget,
    WidgetColumn,
    WidgetForm,
    ReferenceItem,
    PaginationState,
} from '@/shared/hooks/useWorkSpaces';

import { FormTable } from '@/components/Form/formTable/FormTable';
import { TableColumn } from '@/components/table/tableColumn/TableColumn';
import {
    WcReference,
    WidgetColumnsOfTable,
} from '@/components/WidgetColumnsOfTable/WidgetColumnTable/WidgetColumnsOfTable';
import { useHeaderPreviewFromWc } from '@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useHeaderPreviewFromWc';
import { CenteredLoader } from '@/shared/ui/CenteredLoader';

// ─────────────────────────────────────────────────────────────
// ТИПЫ ПРОПСОВ (сгруппированы для читаемости)
// ─────────────────────────────────────────────────────────────

/** Пропсы для работы с таблицей */
type TableProps = {
    columns: Column[];
    selectedTable: DTable | null;
    deleteColumnTable: (id: number) => void;
    updateTableColumn: (id: number, p: Partial<Omit<Column, 'id'>>) => void;
    updateTableMeta: (id: number, patch: Partial<DTable>) => void;
    publishTable: (id: number) => void;
    loadColumns: (table: DTable) => void;
    tablesByWs: Record<number, DTable[]>;
};

/** Пропсы для работы с виджетом */
type WidgetProps = {
    widgetColumns: WidgetColumn[];
    selectedWidget: Widget | null;
    wColsLoading: boolean;
    wColsError: string | null;
    handleClearWidget: () => void;
    handleSelectWidget: (widget: Widget | null) => void;
    setSelectedWidget: React.Dispatch<React.SetStateAction<Widget | null>>;
    setWidgetsByTable: React.Dispatch<React.SetStateAction<Record<number, Widget[]>>>;
    deleteColumnWidget: (id: number) => void;
    updateWidgetColumn: (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => Promise<void> | void;
    loadColumnsWidget: (widgetId: number) => void;
    updateWidgetMeta: (id: number, patch: Partial<Widget>) => Promise<Widget>;
    addWidgetColumn: (payload: {
        widget_id: number;
        alias: string;
        default: string;
        placeholder: string;
        visible: boolean;
        type: string;
        column_order: number;
    }) => Promise<WidgetColumn>;
};

/** Пропсы для работы с references */
type ReferenceProps = {
    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: Partial<Pick<ReferenceItem,
            'ref_column_order' | 'width' | 'type' | 'ref_alias' | 'default' | 'placeholder' | 'visible' | 'readonly'
        >>
    ) => Promise<ReferenceItem>;
    fetchReferences: (widgetColumnId: number) => Promise<WcReference[]>;
    deleteReference: (widgetColumnId: number, tableColumnId: number) => Promise<void>;
};

/** Пропсы для работы с формой */
type FormProps = {
    selectedFormId: number | null;
    clearFormSelection: () => void;
    formDisplay: FormDisplay | null;
    formLoading: boolean;
    formError: string | null;
    formsByWidget: Record<number, WidgetForm>;
    formsById: Record<number, WidgetForm>;
    formTrees: Record<number, FormTreeColumn[]>;
    loadFilteredFormDisplay: (
        formId: number,
        filter: { table_column_id: number; value: string | number },
        page?: number,
        searchPattern?: string
    ) => Promise<void>;
    setFormDisplay: (value: FormDisplay | null) => void;
    // ═══════════════════════════════════════════════════════════
    // НОВОЕ: loadFormDisplay для серверного поиска
    // ═══════════════════════════════════════════════════════════
    loadFormDisplay: (formId: number, page?: number, searchPattern?: string) => Promise<void>;
};

/** Пропсы для пагинации (с infinite scroll) */
type PaginationProps = {
    pagination: PaginationState;
    goToPage: (
        formId: number,
        page: number,
        filters?: Array<{ table_column_id: number; value: string | number }>,
        searchPattern?: string
    ) => Promise<void>;
    loadMoreRows: (
        formId: number,
        filters?: Array<{ table_column_id: number; value: string | number }>,
        searchPattern?: string
    ) => Promise<void>;
};

/** Пропсы для работы с sub-виджетом */
type SubProps = {
    loadSubDisplay: (
        formId: number,
        subOrder: number,
        primary: Record<string, unknown>
    ) => void;
    subDisplay: SubDisplay | null;
    subLoading: boolean;
    subError: string | null;
    setSubDisplay: (value: SubDisplay | null) => void;
};

/** Общие пропсы */
type CommonProps = {
    tableName: string;
    workspaceName: string;
    loading: boolean;
    error: string | null;
    loadWidgetForms: () => Promise<void> | void;
};

/** Полный тип пропсов */
type Props = TableProps & WidgetProps & ReferenceProps & FormProps & PaginationProps & SubProps & CommonProps;

// ─────────────────────────────────────────────────────────────
// КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────

export const SetOfTables: React.FC<Props> = (props) => {
    const {
        // Table
        columns,
        selectedTable,
        deleteColumnTable,
        updateTableColumn,
        updateTableMeta,
        publishTable,
        loadColumns,

        // Widget
        widgetColumns,
        selectedWidget,
        wColsLoading,
        wColsError,
        setSelectedWidget,
        setWidgetsByTable,
        deleteColumnWidget,
        updateWidgetColumn,
        loadColumnsWidget,
        updateWidgetMeta,
        addWidgetColumn,

        // References
        fetchReferences,
        updateReference,
        deleteReference,

        // Form
        selectedFormId,
        formDisplay,
        formLoading,
        formError,
        formsByWidget,
        formsById,
        formTrees,
        loadFilteredFormDisplay,
        setFormDisplay,
        loadFormDisplay,

        // Pagination (с infinite scroll)
        pagination,
        goToPage,
        loadMoreRows,

        // Sub
        loadSubDisplay,
        subDisplay,
        subLoading,
        subError,
        setSubDisplay,

        // Common
        loadWidgetForms,
    } = props;

    // ═══════════════════════════════════════════════════════════
    // LOCAL STATE (только для WidgetColumnsOfTable)
    // ═══════════════════════════════════════════════════════════

    const [referencesMap, setReferencesMap] = useState<Record<number, WcReference[]>>({});
    const [liveRefsForHeader, setLiveRefsForHeader] = useState<Record<number, WcReference[]> | null>(null);

    const workspaceId = selectedTable?.workspace_id ?? null;

    const headerGroups = useHeaderPreviewFromWc(
        widgetColumns,
        referencesMap,
        liveRefsForHeader ?? undefined
    );

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    return (
        <div className={s.wrapper}>
            {/* ════════════════════════════════════════════════════
                PRIORITY 1: FORM
            ════════════════════════════════════════════════════ */}
            {selectedFormId && (
                <>
                    {formLoading && !formDisplay ? (
                        <div className={s.loaderArea}>
                            <CenteredLoader label="Загружаем форму…" />
                        </div>
                    ) : formError ? (
                        <p className={s.error}>{formError}</p>
                    ) : formDisplay ? (
                        <FormTable
                            formsById={formsById}
                            formTrees={formTrees}
                            selectedFormId={selectedFormId}
                            subDisplay={subDisplay}
                            subError={subError}
                            subLoading={subLoading}
                            selectedWidget={selectedWidget}
                            formsByWidget={formsByWidget}
                            loadFilteredFormDisplay={loadFilteredFormDisplay}
                            setFormDisplay={setFormDisplay}
                            setSubDisplay={setSubDisplay}
                            loadSubDisplay={loadSubDisplay}
                            formDisplay={formDisplay}
                            loadFormDisplay={loadFormDisplay}
                            // Pagination (с infinite scroll)
                            pagination={pagination}
                            goToPage={goToPage}
                            loadMoreRows={loadMoreRows}
                        />
                    ) : null}
                </>
            )}

            {/* ════════════════════════════════════════════════════
                PRIORITY 2: WIDGET
            ════════════════════════════════════════════════════ */}
            {!selectedFormId && selectedWidget && (
                <>
                    {wColsLoading ? (
                        <div className={s.loaderArea}>
                            <CenteredLoader label="Загружаем виджет…" />
                        </div>
                    ) : wColsError ? (
                        <p className={s.error}>{wColsError}</p>
                    ) : (
                        <WidgetColumnsOfTable
                            workspaceId={workspaceId}
                            loadWidgetForms={loadWidgetForms}
                            formsById={formsById}
                            headerGroups={headerGroups}
                            referencesMap={referencesMap}
                            setLiveRefsForHeader={setLiveRefsForHeader}
                            setReferencesMap={setReferencesMap}
                            updateReference={updateReference}
                            updateWidgetColumn={updateWidgetColumn}
                            addWidgetColumn={addWidgetColumn}
                            deleteReference={deleteReference}
                            fetchReferences={fetchReferences}
                            updateWidgetMeta={updateWidgetMeta}
                            setWidgetsByTable={setWidgetsByTable}
                            setSelectedWidget={setSelectedWidget}
                            columns={columns}
                            updateTableColumn={updateTableColumn}
                            deleteColumnTable={deleteColumnTable}
                            deleteColumnWidget={deleteColumnWidget}
                            widgetColumns={widgetColumns}
                            loadColumnsWidget={loadColumnsWidget}
                            selectedWidget={selectedWidget}
                        />
                    )}
                </>
            )}

            {/* ════════════════════════════════════════════════════
                PRIORITY 3: TABLE COLUMNS
            ════════════════════════════════════════════════════ */}
            {!selectedFormId && !selectedWidget && (
                <>
                    {columns.length === 0 ? (
                        <p>Выберите форму</p>
                    ) : (
                        selectedTable && (
                            <TableColumn
                                publishTable={publishTable}
                                selectedTable={selectedTable}
                                updateTableMeta={updateTableMeta}
                                columns={columns}
                                tableId={selectedTable.id}
                                deleteColumnTable={deleteColumnTable}
                                updateTableColumn={updateTableColumn}
                                onCreated={() => selectedTable && loadColumns(selectedTable)}
                            />
                        )
                    )}
                </>
            )}
        </div>
    );
};