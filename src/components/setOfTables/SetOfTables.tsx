import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
} from '@/components/WidgetColumnsOfTable/WidgetColumnsOfTable';
import {buildHeaderGroupsFromWidgetColumns, HeaderGroup} from '@/shared/utils/headerGroups';
import {api} from '@/services/api';
import {Breadcrumb, Crumb} from "@/shared/ui/Breadcrumb";
import {useHeaderGroupsFromWidgetColumns} from "@/components/setOfTables/hooks/useHeaderGroupsFromWidgetColumns";
import {useSubHeaderGroups} from "@/components/setOfTables/hooks/useSubHeaderGroups";

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
    formName: string;
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

/** ─────────────────────── Вспомогательные хуки ─────────────────────── */
function useCurrentForm(
    selectedFormId: number | null,
    selectedWidget: Widget | null,
    formsById: Record<number, WidgetForm>,
    formsByWidget: Record<number, WidgetForm>,
) {
    return useMemo<WidgetForm | null>(() => {
        if (selectedFormId != null) return formsById[selectedFormId] ?? null;
        if (selectedWidget) return formsByWidget[selectedWidget.id] ?? null;
        return null;
    }, [selectedFormId, selectedWidget, formsById, formsByWidget]);
}

function useSubWidgetIdByOrder(currentForm: WidgetForm | null) {
    return useMemo<Record<number, number>>(() => {
        const map: Record<number, number> = {};
        currentForm?.sub_widgets?.forEach((sw) => { map[sw.widget_order] = sw.sub_widget_id; });
        return map;
    }, [currentForm]);
}



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
        formsByWidget, formsById, formName, loadFilteredFormDisplay,
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

    // текущая форма и суб-виджет
    const currentForm = useCurrentForm(selectedFormId, selectedWidget, formsById, formsByWidget);
    const subIdByOrder = useSubWidgetIdByOrder(currentForm);
    const currentSubOrder = subDisplay?.displayed_widget?.widget_order ?? null;
    const currentSubWidgetId = currentSubOrder != null ? subIdByOrder[currentSubOrder] : null;

    // группы заголовков: основная форма и саб-форма
    const headerGroups = useHeaderGroupsFromWidgetColumns(widgetColumns, referencesMap, liveRefsForHeader);

    const getColumnsByWidgetId = useCallback(
        (id: number) =>
            api.get<WidgetColumn[]>(`/widgets/${id}/columns`).then(r => r.data),
        []
    );


    const subHeaderGroups = useSubHeaderGroups(
        currentSubWidgetId,
        fetchReferences,      // уже стабильная ссылка из пропсов/хука
        getColumnsByWidgetId, // теперь тоже стабильная
    );

    // хэндлеры навигации
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
    const formTitle = useMemo(() => (
        selectedFormId != null ? (formsById[selectedFormId]?.name ?? `Форма #${selectedFormId}`) : null
    ), [formsById, selectedFormId]);
    const subTitle = useMemo(() => subDisplay?.displayed_widget?.name ?? null, [subDisplay?.displayed_widget?.name]);

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

    // быстрые гварды
    if (loading) return <p>Загрузка…</p>;
    if (error) return <p className={s.error}>{error}</p>;

    return (
        <div className={s.wrapper}>

            <Breadcrumb items={items} className={s.headRow} />

            {/* PRIORITY 1: FORM */}
            {selectedFormId ? (
                formLoading ? <p>Загрузка формы…</p>
                    : formError ? <p className={s.error}>{formError}</p>
                        : formDisplay ? (
                            <FormTable
                                formsById={formsById}
                                subHeaderGroups={subHeaderGroups || undefined}
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
                wColsLoading ? <p>Загрузка виджета…</p>
                    : wColsError ? <p className={s.error}>{wColsError}</p>
                        : (
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

            {/* PRIORITY 3: TABLE COLUMNS */}
            {!selectedFormId && !selectedWidget && (
                columns.length === 0 ? (
                    <p>Нет столбцов</p>
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
