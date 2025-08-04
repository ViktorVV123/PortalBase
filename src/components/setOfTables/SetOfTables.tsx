import React from 'react';
import * as s from './SetOfTables.module.scss';
import {
    Column, DTable,
    FormDisplay, FormTreeColumn,
    SubDisplay,
    Widget,
    WidgetColumn,
    WidgetForm
} from '@/shared/hooks/useWorkSpaces';
import {FormTable} from "@/components/formTable/FormTable";
import {TableColumn} from "@/components/tableColumn/TableColumn";
import {WidgetColumnsOfTable} from '@/components/WidgetColumnsOfTable/WidgetColumnsOfTable'
import {TableListView} from "@/components/tableColumn/TableListView";

type Props = {
    columns: Column[];
    tableName: string;
    workspaceName: string;
    loading: boolean;
    error: string | null;

    /* widget */
    widgetColumns: WidgetColumn[];
    wColsLoading: boolean;
    wColsError: string | null;
    selectedWidget: Widget | null;
    handleClearWidget: () => void;
    handleSelectWidget: (widget: Widget | null) => void;   // ← добавили
    /* form */
    selectedFormId: number | null;
    formDisplay: FormDisplay
    formLoading: boolean;
    formError: string | null;
    formName: string;

    loadSubDisplay: (
        formId: number,
        subOrder: number,
        primary: Record<string, unknown>
    ) => void;
    subDisplay: SubDisplay | null;
    subLoading: boolean;
    subError: string | null;
    formsByWidget: Record<number, WidgetForm>;   // нужен order
    openForm: (widgetId: number, formId: number) => void;
    deleteColumnTable: (id: number) => void;
    deleteColumnWidget: (id: number) => void;
    updateTableColumn: (id: number, p: Partial<Omit<Column, 'id'>>) => void;
    updateWidgetColumn: (id: number,
                         patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>) => void;
    addReference: (widgetColId: number, tblColId: number, payload: {
        width: number;
        visible: boolean;
        primary: boolean;
    }) => Promise<void>;
    loadColumnsWidget: (widgetId: number) => void;
    formTrees: Record<number, FormTreeColumn[]>
    loadFilteredFormDisplay: (formId: number, filter: {
        table_column_id: number;
        value: string | number
    }) => Promise<void>;
    setFormDisplay: (value: FormDisplay | null) => void
    setSubDisplay: (value: SubDisplay | null) => void;
    selectedTable: DTable | null;
    updateTableMeta: (id: number, patch: Partial<DTable>) => void;
    setSelectedWidget:any
    setWidgetsByTable: React.Dispatch<React.SetStateAction<Record<number, Widget[]>>>


};

export const SetOfTables: React.FC<Props> = ({
                                                 /* базовые */
                                                 columns,
                                                 setWidgetsByTable,
                                                 tableName,
                                                 workspaceName,
                                                 loading,
                                                 error,
                                                 /* widget */
                                                 widgetColumns,
                                                 wColsLoading,
                                                 wColsError,
                                                 selectedWidget,
                                                 handleClearWidget,
                                                 /* form */
                                                 selectedFormId,
                                                 formDisplay,
                                                 formLoading,
                                                 formError,
                                                 formName,
                                                 subDisplay,
                                                 subLoading,
                                                 subError,
                                                 formsByWidget,
                                                 loadSubDisplay,
                                                 deleteColumnTable,
                                                 deleteColumnWidget,
                                                 updateTableColumn,
                                                 updateWidgetColumn,
                                                 addReference,
                                                 loadColumnsWidget,
                                                 formTrees,
                                                 loadFilteredFormDisplay,
                                                 setFormDisplay,
                                                 setSubDisplay,
                                                 selectedTable,
                                                 updateTableMeta,
                                                 setSelectedWidget
                                             }) => {



    if (loading) return <p>Загрузка…</p>;
    if (error) return <p className={s.error}>{error}</p>;

    /* =====  UI  ===== */
    return (
        <div className={s.wrapper}>
            {/* ─── breadcrumb ─── */}
            <div className={s.headRow}>
                <div className={s.breadcrumb}>
                    {workspaceName} <span className={s.arrow}>→</span>

                    {selectedWidget ? (
                        <>
                            <span onClick={handleClearWidget}>{tableName}</span>
                            <span className={s.arrow}>→</span>
                            {selectedFormId ? (
                                <span onClick={() => handleClearWidget()}>
       {selectedWidget.name}
                                         </span>
                            ) : (
                                <span>{selectedWidget.name}</span>
                            )}


                            {formName && (
                                <>
                                    <span className={s.arrow}>→</span>
                                    <span>{formName}</span>
                                </>
                            )}
                        </>
                    ) : (
                        <span>{tableName}</span>
                    )}
                </div>
            </div>

            {/* ─── PRIORITY 1 : FORM ─── */}
            {selectedFormId ? (
                    formLoading ? (
                        <p>Загрузка формы…</p>
                    ) : formError ? (
                        <p className={s.error}>{formError}</p>
                    ) : formDisplay ? (
                        <FormTable setSubDisplay={setSubDisplay} formTrees={formTrees} selectedFormId={selectedFormId}
                                   subDisplay={subDisplay} subError={subError} subLoading={subLoading}
                                   selectedWidget={selectedWidget} formsByWidget={formsByWidget}
                                   loadFilteredFormDisplay={loadFilteredFormDisplay} setFormDisplay={setFormDisplay}
                                   loadSubDisplay={loadSubDisplay} formDisplay={formDisplay}/>
                    ) : null
                )

                /* ─── PRIORITY 2 : WIDGET ─── */
                : selectedWidget ? (
                        wColsLoading ? (
                            <p>Загрузка виджета…</p>
                        ) : wColsError ? (
                            <p className={s.error}>{wColsError}</p>
                        ) : (
                            <WidgetColumnsOfTable setWidgetsByTable={setWidgetsByTable} setSelectedWidget={setSelectedWidget} columns={columns}
                                                  updateTableColumn={updateTableColumn}
                                                  deleteColumnTable={deleteColumnTable} deleteColumnWidget={deleteColumnWidget} addReference={addReference}
                                                  updateWidgetColumn={updateWidgetColumn} widgetColumns={widgetColumns}
                                                  loadColumnsWidget={loadColumnsWidget} selectedWidget={selectedWidget}/>
                        )
                    )

                    /* ─── PRIORITY 3 : TABLE COLUMNS ─── */
                    : (
                        columns.length === 0
                            ? <p>Нет выбранных форм</p>
                            : (
                                <div>
                                    <TableListView selectedTable={selectedTable} updateTableMeta={updateTableMeta}/>
                                    <TableColumn

                                        updateTableColumn={updateTableColumn}
                                        columns={columns}
                                        deleteColumnTable={deleteColumnTable}/>
                                </div>
                            )
                    )}


        </div>
    );
};
