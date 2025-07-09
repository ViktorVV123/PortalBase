import React, {useEffect, useState} from 'react';
import {DTable, useWorkSpaces, Widget} from '@/shared/hooks/useWorkSpaces';

import * as styles from './Main.module.scss'
import {SideNav} from "@/components/sideNav/SideNav";
import {TableColumn} from "@/components/tableColumn/TableColumn";
import {TopComponent} from "@/components/topComponent/TopComponent";
import {ModalAddWorkspace} from "@/components/modals/modalAddWorkspace/ModalAddWorkspace";
import {useLoadConnections} from "@/shared/hooks/useLoadConnections";
import {ModalAddConnection} from "@/components/modals/modalAddConnection/ModalAddConnection";


export const Main = () => {

    const [navOpen, setNavOpen] = useState(false);
    const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
    const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
    const [wsHover, setWsHover] = useState<number | null>(null);
    const [tblHover, setTblHover] = useState<number | null>(null);
    const [showConnForm , setShowConnForm ] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);

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
        widgetColumns, wColsLoading, wColsError, loadColumnsWidget, formsByWidget,
        loadWidgetForms,
        loadFormDisplay, formDisplay, formError, formLoading,
        loadSubDisplay,subDisplay,subLoading,subError
    } = useWorkSpaces();

    const {connections,loadConnections} = useLoadConnections()


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



   /* if (loading) return <p>Загрузка…</p>;
    if (error) return <p style={{color: 'red'}}>{error}</p>;*/

    return (
        <div className={styles.layout}>
            <SideNav open={navOpen} toggle={() => setNavOpen(o => !o)} changeStatusModal={()=>setShowCreateForm(true)} />
            <div className={styles.container}>
                <TopComponent formsByWidget={formsByWidget} setWsHover={setWsHover} tblHover={tblHover}
                              setTblHover={setTblHover} wsHover={wsHover}
                              handleSelectTable={handleSelectTable} widgetsByTable={widgetsByTable}
                              handleSelectWidget={handleSelectWidget} workSpaces={workSpaces} tablesByWs={tablesByWs}
                              loadTables={loadTables} loadWidgetsForTable={loadWidgetsForTable}
                              handleSelectForm={handleSelectForm}

                />
                <TableColumn columns={columns}
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

                />
            </div>

            {showConnForm && (
                <ModalAddConnection open={showConnForm}
                    /* ← добавили */
                    onSuccess={() => { setShowConnForm(false); loadConnections(); }}
                    onCancel ={() =>  setShowConnForm(false)}
                />
            )}

            {/* ——— WORKSPACE ——— */}
            {showCreateForm && (
                <ModalAddWorkspace
                    open={showCreateForm}                  /* ✔ правильный флаг */
                    setShowConnForm={setShowConnForm}
                    connections={connections}
                    onSuccess={() => { setShowCreateForm(false); loadWorkSpaces(); }}
                    onCancel ={() =>  setShowCreateForm(false)}
                />
            )}



        </div>

    );
};
