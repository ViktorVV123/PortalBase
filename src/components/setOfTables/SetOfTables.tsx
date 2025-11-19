import React, {useCallback, useMemo, useState} from 'react';
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
import {FormTable} from '@/components/formTable/FormTable';
import {TableColumn} from '@/components/tableColumn/TableColumn';
import {
    WcReference,
    WidgetColumnsOfTable,
} from '@/components/WidgetColumnsOfTable/WidgetColumnTable/WidgetColumnsOfTable';
import {Breadcrumb, Crumb} from "@/shared/ui/Breadcrumb";
import { SideNav } from '@/components/sideNav/SideNav';

import {useHeaderPreviewFromWc} from "@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useHeaderPreviewFromWc";

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
    handleSelectWidget: (widget: Widget | null) => void;
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
    formsByWidget: Record<number, WidgetForm>;
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

    // для SideNav
    openFormWithPreload: (widgetId: number, formId: number) => Promise<void>;
    forceFormList: boolean;
};

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
        // SideNav
        openFormWithPreload,
        forceFormList,
    } = props;

    const [referencesMap, setReferencesMap] = useState<Record<number, WcReference[]>>({});
    const [liveRefsForHeader, setLiveRefsForHeader] = useState<Record<number, WcReference[]> | null>(null);

    const headerGroups = useHeaderPreviewFromWc(
        widgetColumns,
        referencesMap,
        liveRefsForHeader ?? undefined
    );

    const goToTable = useCallback(() => {
        setSubDisplay(null);
        setFormDisplay(null);
        handleClearWidget();
    }, [handleClearWidget, setFormDisplay, setSubDisplay]);

    const goToWidget = useCallback(() => {
        if (!selectedWidget) return;
        clearFormSelection();
        setSubDisplay(null);
        setFormDisplay(null);
        loadColumnsWidget(selectedWidget.id);
    }, [clearFormSelection, loadColumnsWidget, selectedWidget, setFormDisplay, setSubDisplay]);

    const widgetTitle = useMemo(() => selectedWidget?.name ?? null, [selectedWidget]);
    const formTitle = useMemo(
        () =>
            selectedFormId != null
                ? (formsById[selectedFormId]?.name ?? `Форма #${selectedFormId}`)
                : null,
        [formsById, selectedFormId]
    );
    const subTitle = useMemo(
        () => subDisplay?.displayed_widget?.name ?? null,
        [subDisplay?.displayed_widget?.name]
    );

    const items = useMemo<Crumb[]>(() => {
        const arr: Crumb[] = [{ label: workspaceName }];
        if (selectedWidget) {
            arr.push({ label: tableName, onClick: goToTable });
            arr.push({ label: widgetTitle ?? 'Виджет', onClick: goToWidget });
            if (formTitle) arr.push({ label: formTitle, active: !subTitle });
            if (subTitle) arr.push({ label: subTitle, active: true });
        } else {
            arr.push({ label: tableName, active: true });
        }
        return arr;
    }, [workspaceName, tableName, selectedWidget, widgetTitle, formTitle, subTitle, goToTable, goToWidget]);

    if (loading && !selectedFormId && !selectedWidget && !selectedTable) {
        return <p>тест…</p>;
    }

    if (error) return <p className={s.error}>{error}</p>;


    const hasForms = Object.values(formsById).length > 0;

    // 🔹 режим выбора формы:
    // либо автоматически (ничего не выбрано),
    // либо принудительно по клику на логотип (forceFormList)
    const isFormSelectionStage =
        forceFormList ||
        (!selectedFormId && !selectedWidget && !selectedTable && hasForms);

    return (
        <div className={s.wrapper}>
            {/* SideNav показывается ТОЛЬКО в режиме выбора формы */}
            {isFormSelectionStage && (
                <SideNav
                    forms={Object.values(formsById)}
                    openForm={openFormWithPreload}
                />
            )}

            {/* крошки скрываем, пока просто выбираем форму из списка */}
            {!isFormSelectionStage && (
                <Breadcrumb items={items} className={s.headRow} />
            )}

            {/* FORM */}
            {selectedFormId ? (
                formLoading ? (
                    <p>Загрузка формы…</p>
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

            {/* WIDGET */}
            {!selectedFormId && selectedWidget && !isFormSelectionStage && (
                wColsLoading ? (
                    <p>Загрузка виджета…</p>
                ) : wColsError ? (
                    <p className={s.error}>{wColsError}</p>
                ) : (
                    <WidgetColumnsOfTable
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

            {/* TABLE COLUMNS */}
            {!selectedFormId && !selectedWidget && selectedTable && !isFormSelectionStage && (
                <div>
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
                </div>
            )}
        </div>
    );
};