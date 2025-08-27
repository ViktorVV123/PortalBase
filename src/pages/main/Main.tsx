import React, {useEffect, useState} from 'react';
import {DTable, useWorkSpaces, Widget} from '@/shared/hooks/useWorkSpaces';

import * as styles from './Main.module.scss'
import {SetOfTables} from "@/components/setOfTables/SetOfTables";
import {TopComponent} from "@/components/topComponent/TopComponent";
import {ModalAddWorkspace} from "@/components/modals/modalAddWorkspace/ModalAddWorkspace";
import {ModalAddConnection} from "@/components/modals/modalAddConnection/ModalAddConnection";
import {WorkSpaceTypes} from "@/types/typesWorkSpaces";
import {ModalAddTable} from "@/components/modals/modalAddNewTable/ModalAddNewTable";
import {ModalAddWidget} from "@/components/modals/modalAddWidget/ModalAddWidget";


export const Main = () => {

    const [navOpen, setNavOpen] = useState(false);
    const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
    const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
    const [wsHover, setWsHover] = useState<number | null>(null);
    const [tblHover, setTblHover] = useState<number | null>(null);
    const [showConnForm, setShowConnForm] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showCreateTable, setShowCreateTable] = useState(false);
    const [createTblWs, setCreateTblWs] = useState<WorkSpaceTypes | null>(null)
    const [showCreateWidget, setShowCreateWidget] = useState(false);
    const [createWidgetTable, setCreateWidgetTable] = useState<DTable | null>(null);


    const {
        loadWorkSpaces,
        columns,
        loadColumns,
        selectedTable,
        workSpaces,
        tablesByWs,
        loadTables,
        loading,
        error,
        loadWidgetsForTable,
        widgetsByTable,
        widgetColumns,
        wColsLoading,
        wColsError,
        loadColumnsWidget,
        formsByWidget,
        loadWidgetForms,
        loadFormDisplay,
        formDisplay,
        formError,
        formLoading,
        loadSubDisplay,
        subDisplay,
        subLoading,
        subError,
        deleteWorkspace,
        deleteTable,
        fetchWidgetAndTable,
        deleteColumnTable,
        deleteColumnWidget,
        deleteWidget,
        updateTableColumn,
        updateWidgetColumn,
        addReference,
        loadFormTree,
        formTrees,
        loadFilteredFormDisplay,
        setFormDisplay,
        setSubDisplay,
        updateTableMeta,
        connections,
        loadConnections,
        setWidgetsByTable,
        fetchReferences,
        updateWidgetMeta,
        deleteReference,
        addWidgetColumn,
        publishTable,
        deleteConnection,
        updateReference,
    } = useWorkSpaces();

    useEffect(() => {
            loadWorkSpaces()
        },
        [loadWorkSpaces]);

    useEffect(() => {
            loadWidgetForms()
        },
        [loadWidgetForms]);

    useEffect(() => {
            loadConnections()
        },
        [loadConnections]);


//показываем путь до таблицы workspace => table
    const selectedWs = selectedTable
        ? workSpaces.find(w => w.id === selectedTable.workspace_id) ?? null
        : null;


    const handleSelectTable = (table: DTable) => {
        setSelectedWidget(null);            // сбрасываем прежний виджет
        loadColumns(table);
        setSelectedFormId(null);// столбцы таблицы
        loadWidgetsForTable(table.id);      // список виджетов
    };

    const handleSelectWidget = (w: Widget) => {
        setSelectedWidget(w);
        setSelectedFormId(null);
        loadColumnsWidget(w.id);            // столбцы виджета
    };
//для того чтобы вернуться к таблице после выбора widget
    const handleClearWidget = () => {
        setSelectedWidget(null);
        setSelectedFormId(null);   // возврат к таблице

    };


    const handleSelectForm = (formId: number) => {
        setSelectedFormId(formId);
        loadFormDisplay(formId);
    };

    // имя формы, если выбраны и widget, и form
    const formName =
        selectedWidget && selectedFormId
            ? formsByWidget[selectedWidget.id]?.name ?? ''
            : '';


    const openForm = async (widgetId: number, formId: number) => {
        const {widget, table} = await fetchWidgetAndTable(widgetId);

        /* 1. выбираем таблицу и виджет, чтоб колонки были загружены */
        handleSelectTable(table);
        handleSelectWidget(widget);

        /* 2. сама форма */
        handleSelectForm(formId);
        await loadFormTree(formId);
    };


    /* if (loading) return <p>Загрузка…</p>;
     if (error) return <p style={{color: 'red'}}>{error}</p>;*/

    return (
        <div className={styles.layout}>

            <div className={styles.container}>
                <TopComponent loadWorkSpaces={loadWorkSpaces} deleteWorkspace={deleteWorkspace}
                              formsByWidget={formsByWidget} setWsHover={setWsHover}
                              tblHover={tblHover}
                              setTblHover={setTblHover} wsHover={wsHover}
                              handleSelectTable={handleSelectTable} widgetsByTable={widgetsByTable}
                              handleSelectWidget={handleSelectWidget} workSpaces={workSpaces} tablesByWs={tablesByWs}
                              loadTables={loadTables} loadWidgetsForTable={loadWidgetsForTable}
                              handleSelectForm={handleSelectForm}
                              setShowCreateTable={setShowCreateTable}
                              setCreateTblWs={setCreateTblWs}
                              setShowCreateWidget={setShowCreateWidget}
                              setCreateWidgetTable={setCreateWidgetTable}
                              deleteTable={deleteTable}
                              changeStatusModal={() => setShowCreateForm(true)}
                              navOpen={navOpen}
                              setNavOpen={setNavOpen}
                              setShowCreateForm={setShowCreateForm}
                              deleteWidget={deleteWidget}
                              loadFormTree={loadFormTree}

                />

                <SetOfTables updateReference={updateReference} publishTable={publishTable} tablesByWs={tablesByWs}
                             addWidgetColumn={addWidgetColumn} setWidgetsByTable={setWidgetsByTable}
                             setSelectedWidget={setSelectedWidget}
                             columns={columns}
                             formDisplay={formDisplay}
                             tableName={selectedTable?.name ?? ''}
                             loading={loading}
                             workspaceName={selectedWs?.name ?? ''}
                             error={error}
                             widgetColumns={widgetColumns}
                             wColsLoading={wColsLoading}
                             wColsError={wColsError}
                             handleSelectWidget={handleSelectWidget}
                             selectedWidget={selectedWidget}
                             handleClearWidget={handleClearWidget}
                             selectedFormId={selectedFormId}
                             formLoading={formLoading}
                             formError={formError}
                             formName={formName}
                             loadSubDisplay={loadSubDisplay}
                             subDisplay={subDisplay}
                             subLoading={subLoading}
                             subError={subError}
                             formsByWidget={formsByWidget}
                             openForm={openForm}
                             deleteColumnTable={deleteColumnTable}
                             deleteColumnWidget={deleteColumnWidget}
                             updateTableColumn={updateTableColumn}
                             updateWidgetColumn={updateWidgetColumn}
                             addReference={addReference}
                             loadColumnsWidget={loadColumnsWidget}
                             formTrees={formTrees}
                             loadFilteredFormDisplay={loadFilteredFormDisplay}
                             setFormDisplay={setFormDisplay}
                             setSubDisplay={setSubDisplay}
                             selectedTable={selectedTable}
                             updateTableMeta={updateTableMeta}
                             fetchReferences={fetchReferences}
                             deleteReference={deleteReference}
                             updateWidgetMeta={updateWidgetMeta}

                />
            </div>

            {showConnForm && (
                <ModalAddConnection open={showConnForm}
                    /* ← добавили */
                                    onSuccess={() => {
                                        setShowConnForm(false);
                                        loadConnections();
                                    }}
                                    onCancel={() => setShowConnForm(false)}
                />
            )}

            {/* ——— WORKSPACE ——— */}
            {showCreateForm && (
                <ModalAddWorkspace

                    deleteConnection={deleteConnection}
                    open={showCreateForm}                  /* ✔ правильный флаг */
                    setShowConnForm={setShowConnForm}
                    connections={connections}
                    onSuccess={() => {
                        setShowCreateForm(false);
                        loadWorkSpaces();
                    }}
                    onCancel={() => setShowCreateForm(false)}
                />
            )}

            {showCreateTable && createTblWs && (
                <ModalAddTable
                    open={showCreateTable}
                    workspace={createTblWs}
                    onSuccess={async (newTable) => {
                        /* 1. закрываем модалку */
                        setShowCreateTable(false);

                        /* 2. перезагружаем список таблиц этого WS (чтобы кэш был актуален) */
                        await loadTables(newTable.workspace_id, true);

                        /* 3. и сразу выбираем только что созданную */
                        handleSelectTable(newTable);
                    }}
                    onCancel={() => setShowCreateTable(false)}
                />
            )}

            {showCreateWidget && createWidgetTable && (
                <ModalAddWidget
                    open={showCreateWidget}
                    table={createWidgetTable}
                    onSuccess={async (newWidget) => {
                        /* 1. закрываем модалку */
                        setShowCreateWidget(false);

                        /* 2. обновляем кэш виджетов таблицы */
                        await loadWidgetsForTable(newWidget.table_id, true);

                        /* 3. сразу переключаемся на созданный виджет */
                        handleSelectWidget(newWidget);
                    }}
                    onCancel={() => setShowCreateWidget(false)}
                />
            )}


        </div>

    );
};
