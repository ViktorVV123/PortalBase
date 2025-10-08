import React, { useEffect, useMemo, useState } from 'react';
import * as styles from './Main.module.scss';

import { useWorkSpaces } from '@/shared/hooks/useWorkSpaces';


import { TopComponent } from '@/components/topComponent/TopComponent';
import { SetOfTables } from '@/components/setOfTables/SetOfTables';
import {useMainSelection} from "@/pages/main/hook/useMainSelection";
import {useMainModals} from "@/pages/main/hook/useMainModals";
import {ModalHost} from "@/components/modalHost/ModalHost";



export const Main = () => {
    const [navOpen, setNavOpen] = useState(false);
    const [wsHover, setWsHover] = useState<number | null>(null);
    const [tblHover, setTblHover] = useState<number | null>(null);

    const {
        // загрузки/кэш
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
        addForm,
        reloadWidgetForms,
        formsListByWidget,
        deleteForm,
        formsById,
        deleteTreeFieldFromForm,
        deleteSubWidgetFromForm,
    } = useWorkSpaces();

    // первичная загрузка
    useEffect(() => { loadWorkSpaces(); }, [loadWorkSpaces]);
    useEffect(() => { loadWidgetForms(); }, [loadWidgetForms]);
    useEffect(() => { loadConnections(); }, [loadConnections]);

    // выборы (вынесены)
    const selection = useMainSelection({
        loadColumns,
        loadWidgetsForTable,
        loadColumnsWidget,
        loadFormDisplay,
        loadFormTree,
        fetchWidgetAndTable,
        formsByWidget,
    });

    // модалки (вынесены)
    const modals = useMainModals({
        loadConnections,
        loadWorkSpaces,
        loadTables,
        loadWidgetsForTable,
        handleSelectTable: selection.handleSelectTable,
        handleSelectWidget: selection.handleSelectWidget,
        reloadWidgetForms,
        openForm: selection.openForm,
    });

    // выбранный workspace (для хлебных крошек/шапки)
    const selectedWs = useMemo(
        () => (selectedTable ? workSpaces.find((w) => w.id === selectedTable.workspace_id) ?? null : null),
        [selectedTable, workSpaces]
    );

    return (
        <div className={styles.layout}>
            <div className={styles.container}>
                <div>
                    <TopComponent
                        setEditFormOpen={modals.setEditFormOpen}
                        setFormToEdit={modals.setFormToEdit}
                        formsById={formsById}
                        addForm={addForm}
                        deleteForm={deleteForm}
                        loadWorkSpaces={loadWorkSpaces}
                        deleteWorkspace={deleteWorkspace}
                        formsByWidget={formsByWidget}
                        setWsHover={setWsHover}
                        tblHover={tblHover}
                        setTblHover={setTblHover}
                        wsHover={wsHover}
                        handleSelectTable={selection.handleSelectTable}
                        widgetsByTable={widgetsByTable}
                        handleSelectWidget={selection.handleSelectWidget}
                        workSpaces={workSpaces}
                        tablesByWs={tablesByWs}
                        loadTables={loadTables}
                        loadWidgetsForTable={loadWidgetsForTable}
                        handleSelectForm={selection.handleSelectForm}
                        setShowCreateTable={modals.setShowCreateTable}
                        setCreateTblWs={modals.setCreateTblWs}
                        setShowCreateWidget={modals.setShowCreateWidget}
                        setCreateWidgetTable={modals.setCreateWidgetTable}
                        deleteTable={deleteTable}
                        changeStatusModal={() => modals.setShowCreateForm(true)}
                        navOpen={navOpen}
                        setNavOpen={setNavOpen}
                        deleteWidget={deleteWidget}
                        loadFormTree={loadFormTree}
                        setShowCreateFormModal={modals.setShowCreateFormModal}
                        setCreateFormWidget={modals.setCreateFormWidget}
                        formsListByWidget={formsListByWidget}
                    />
                </div>

                <SetOfTables loadWidgetForms={loadWidgetForms}
                    clearFormSelection={selection.clearFormSelection}
                    updateReference={updateReference}
                    publishTable={publishTable}
                    tablesByWs={tablesByWs}
                    addWidgetColumn={addWidgetColumn}
                    setWidgetsByTable={setWidgetsByTable}
                    setSelectedWidget={selection.setSelectedWidget}
                    columns={columns}
                    formDisplay={formDisplay}
                    tableName={selectedTable?.name ?? ''}
                    loading={loading}
                    workspaceName={selectedWs?.name ?? ''}
                    error={error}
                    widgetColumns={widgetColumns}
                    wColsLoading={wColsLoading}
                    wColsError={wColsError}
                    handleSelectWidget={selection.handleSelectWidget}
                    selectedWidget={selection.selectedWidget}
                    handleClearWidget={selection.handleClearWidget}
                    selectedFormId={selection.selectedFormId}
                    formLoading={formLoading}
                    formError={formError}
                    formName={selection.formName}
                    loadSubDisplay={loadSubDisplay}
                    subDisplay={subDisplay}
                    subLoading={subLoading}
                    subError={subError}
                    formsByWidget={formsByWidget}
                    openForm={selection.openForm}
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
                    formsById={formsById}
                />
            </div>

            <ModalHost
                modals={modals}
                connections={connections}
                deleteConnection={deleteConnection}
                reloadWidgetForms={reloadWidgetForms}
                deleteTreeFieldFromForm={deleteTreeFieldFromForm}
                deleteSubWidgetFromForm={deleteSubWidgetFromForm}
            />

        </div>
    );
};
