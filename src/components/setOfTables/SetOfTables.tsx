import React, {useState} from 'react';
import * as s from './SetOfTables.module.scss';
import {
    Column,
    DTable,
    FormDisplay,
    FormTreeColumn,
    SubDisplay,
    Widget,
    WidgetColumn,
    WidgetForm,
    ReferenceItem,
} from '@/shared/hooks/useWorkSpaces';
import {FormTable} from '@/components/Form/formTable/FormTable';
import {TableColumn} from '@/components/table/tableColumn/TableColumn';
import {
    WcReference,
    WidgetColumnsOfTable,
} from '@/components/WidgetColumnsOfTable/WidgetColumnTable/WidgetColumnsOfTable';

import {useHeaderPreviewFromWc} from "@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useHeaderPreviewFromWc";
import {CenteredLoader} from "@/shared/ui/CenteredLoader";

/** ─────────────────────── Пропсы ─────────────────────── */
type Props = {
    // базовые
    columns: Column[];
    tableName: string;
    workspaceName: string;
    loading: boolean;
    error: string | null;

    // references
    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: Partial<Pick<ReferenceItem,
            'ref_column_order' | 'width' | 'type' | 'ref_alias' | 'default' | 'placeholder' | 'visible' | 'readonly'
        >>
    ) => Promise<ReferenceItem>;
    fetchReferences: (widgetColumnId: number) => Promise<WcReference[]>;
    deleteReference: (widgetColumnId: number, tableColumnId: number) => Promise<void>;

    // виджет
    widgetColumns: WidgetColumn[];
    deleteColumnWidget: (id: number) => void;
    wColsLoading: boolean;
    wColsError: string | null;
    selectedWidget: Widget | null;
    handleClearWidget: () => void;
    handleSelectWidget: (widget: Widget | null) => void; // оставляем для совместимости
    setSelectedWidget: React.Dispatch<React.SetStateAction<Widget | null>>;
    setWidgetsByTable: React.Dispatch<React.SetStateAction<Record<number, Widget[]>>>;
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

    // форма
    selectedFormId: number | null;
    clearFormSelection: () => void;
    formDisplay: FormDisplay | null;
    formLoading: boolean;
    formError: string | null;
    formsByWidget: Record<number, WidgetForm>; // нужен order
    formsById: Record<number, WidgetForm>;
    formTrees: Record<number, FormTreeColumn[]>;
    loadFilteredFormDisplay: (
        formId: number,
        filter: { table_column_id: number; value: string | number }
    ) => Promise<void>;
    setFormDisplay: (value: FormDisplay | null) => void;

    // саб-виджет
    loadSubDisplay: (
        formId: number,
        subOrder: number,
        primary: Record<string, unknown>
    ) => void;
    subDisplay: SubDisplay | null;
    subLoading: boolean;
    subError: string | null;
    setSubDisplay: (value: SubDisplay | null) => void;

    // таблица
    selectedTable: DTable | null;
    deleteColumnTable: (id: number) => void;
    updateTableColumn: (id: number, p: Partial<Omit<Column, 'id'>>) => void;
    updateTableMeta: (id: number, patch: Partial<DTable>) => void;
    publishTable: (id: number) => void;
    loadColumns: (table: DTable) => void;

    // общее
    tablesByWs: Record<number, DTable[]>;
    loadWidgetForms: () => Promise<void> | void;
};

/** ─────────────────────── Основной компонент ─────────────────────── */
export const SetOfTables: React.FC<Props> = (props) => {
    const {
        // базовые
        columns, tableName, workspaceName, loading, error,
        // виджет
        widgetColumns, wColsLoading, wColsError, selectedWidget,
        handleClearWidget, loadColumnsWidget, updateWidgetColumn,
        addWidgetColumn, updateWidgetMeta, setSelectedWidget, setWidgetsByTable,
        // форма/саб
        selectedFormId, formDisplay, formLoading, formError, formTrees,
        formsByWidget, formsById, loadFilteredFormDisplay,
        loadSubDisplay, subDisplay, subLoading, subError,
        setFormDisplay, setSubDisplay,
        // references
        fetchReferences, updateReference, deleteReference,
        // таблица
        selectedTable, deleteColumnTable, deleteColumnWidget, updateTableColumn,
        updateTableMeta, publishTable, loadColumns,
        // прочее
        clearFormSelection, loadWidgetForms,
    } = props;

    // локально — только то, что реально нужно держать здесь
    const [referencesMap, setReferencesMap] = useState<Record<number, WcReference[]>>({});
    const [liveRefsForHeader, setLiveRefsForHeader] = useState<Record<number, WcReference[]> | null>(null);
    const workspaceId = selectedTable?.workspace_id ?? null;
    // группы заголовков: основная форма и саб-форма
    const headerGroups = useHeaderPreviewFromWc(widgetColumns, referencesMap, liveRefsForHeader ?? undefined);

    return (
        <div className={s.wrapper}>



            {/* PRIORITY 1: FORM */}
            {selectedFormId ? (
                formLoading ? (
                    <div className={s.loaderArea}>
                        <CenteredLoader label="Загружаем форму…" />
                    </div>
                ) : formError ? (
                    <p className={s.error}>{formError}</p>
                ) : formDisplay ? (
                            <FormTable
                                formsById={formsById}
                                headerGroups={headerGroups}
                                setSubDisplay={setSubDisplay}
                                formTrees={formTrees}
                                selectedFormId={selectedFormId}
                                subDisplay={subDisplay}
                                subError={subError}
                                subLoading={subLoading}
                                selectedWidget={selectedWidget}
                                formsByWidget={formsByWidget}
                                loadFilteredFormDisplay={loadFilteredFormDisplay}
                                setFormDisplay={setFormDisplay}
                                loadSubDisplay={loadSubDisplay}
                                formDisplay={formDisplay}
                            />
                        ) : null
            ) : null}

            {/* PRIORITY 2: WIDGET */}
            {!selectedFormId && selectedWidget && (
                wColsLoading ? (
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
                        )
            )}

            {/* PRIORITY 3: TABLE COLUMNS */}
            {!selectedFormId && !selectedWidget && (
                columns.length === 0 ? (
                    <p>Выберите форму</p>
                ) : (
                    <div>
                        {selectedTable && (
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
                        )}
                    </div>
                )
            )}
        </div>
    );
};
