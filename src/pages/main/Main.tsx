import React, { useEffect, useMemo, useState } from 'react';
import * as styles from './Main.module.scss';

import { useWorkSpaces } from '@/shared/hooks/useWorkSpaces';

import { TopComponent } from '@/components/topComponent/TopComponent';
import { SetOfTables } from '@/components/setOfTables/SetOfTables';
import { useMainSelection } from '@/pages/main/hook/useMainSelection';
import { useMainModals } from '@/pages/main/hook/useMainModals';
import { ModalHost } from '@/components/modals/modalHost/ModalHost';
import {CenteredLoader} from "@/shared/ui/CenteredLoader";

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

    // первичная загрузка (один эффект вместо трёх — меньше шумных ре-рендеров)
    useEffect(() => {
        loadWorkSpaces();
        loadWidgetForms();
        loadConnections();
    }, [loadWorkSpaces, loadWidgetForms, loadConnections]);

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
        () =>
            selectedTable
                ? workSpaces.find((w) => w.id === selectedTable.workspace_id) ?? null
                : null,
        [selectedTable, workSpaces]
    );

    // группировка пропсов для читабельности (контракты компонент не меняю)
    const topProps = {
        setEditFormOpen: modals.setEditFormOpen,
        setFormToEdit: modals.setFormToEdit,
        formsById,
        addForm,
        deleteForm,
        loadWorkSpaces,
        deleteWorkspace,
        formsByWidget,
        setWsHover,
        tblHover,
        setTblHover,
        wsHover,
        handleSelectTable: selection.handleSelectTable,
        widgetsByTable,
        handleSelectWidget: selection.handleSelectWidget,
        workSpaces,
        tablesByWs,
        loadTables,
        loadWidgetsForTable,
        handleSelectForm: selection.handleSelectForm,
        setShowCreateTable: modals.setShowCreateTable,
        setCreateTblWs: modals.setCreateTblWs,
        setShowCreateWidget: modals.setShowCreateWidget,
        setCreateWidgetTable: modals.setCreateWidgetTable,
        deleteTable,
        changeStatusModal: () => modals.setShowCreateForm(true),
        navOpen,
        setNavOpen,
        deleteWidget,
        loadFormTree,
        setShowCreateFormModal: modals.setShowCreateFormModal,
        setCreateFormWidget: modals.setCreateFormWidget,
        formsListByWidget,
    };

    const setOfTablesProps = {
        loadWidgetForms,
        clearFormSelection: selection.clearFormSelection,
        updateReference,
        publishTable,
        tablesByWs,
        addWidgetColumn,
        setWidgetsByTable,
        setSelectedWidget: selection.setSelectedWidget,
        columns,
        formDisplay,
        tableName: selectedTable?.name ?? '',
        loading,
        workspaceName: selectedWs?.name ?? '',
        error,
        widgetColumns,
        wColsLoading,
        wColsError,
        handleSelectWidget: selection.handleSelectWidget,
        selectedWidget: selection.selectedWidget,
        handleClearWidget: selection.handleClearWidget,
        selectedFormId: selection.selectedFormId,
        formLoading,
        formError,
        loadSubDisplay,
        subDisplay,
        subLoading,
        subError,
        formsByWidget,
        openForm: selection.openForm,
        deleteColumnTable,
        deleteColumnWidget,
        updateTableColumn,
        updateWidgetColumn,
        loadColumnsWidget,
        formTrees,
        loadFilteredFormDisplay,
        setFormDisplay,
        setSubDisplay,
        selectedTable,
        updateTableMeta,
        fetchReferences,
        deleteReference,
        updateWidgetMeta,
        formsById,
        loadColumns,
    };

    const modalHostProps = {
        modals,
        connections,
        deleteConnection,
        reloadWidgetForms,
        deleteTreeFieldFromForm,
        deleteSubWidgetFromForm,
    };


    return (
        <div className={styles.layout}>
            {/* глобальный лоадер на стартовую загрузку */}
            {loading && !selectedTable && !selection.selectedWidget && !selection.selectedFormId && (
                <CenteredLoader fullScreen label="Загружаем рабочее пространство…"/>
            )}

            <div className={styles.container}>
                <div>
                    <TopComponent {...topProps} />
                </div>

                <SetOfTables {...setOfTablesProps} />
            </div>

            <ModalHost {...modalHostProps} />
        </div>
    );
};
