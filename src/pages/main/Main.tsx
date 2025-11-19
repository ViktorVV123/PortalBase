import React, { useEffect, useMemo, useState, useCallback } from 'react';
import * as styles from './Main.module.scss';

import { useWorkSpaces } from '@/shared/hooks/useWorkSpaces';
import { TopComponent } from '@/components/topComponent/TopComponent';
import { SetOfTables } from '@/components/setOfTables/SetOfTables';
import { useMainSelection } from '@/pages/main/hook/useMainSelection';
import { useMainModals } from '@/pages/main/hook/useMainModals';
import { ModalHost } from '@/components/modals/modalHost/ModalHost';
import {api} from "@/services/api";

export const Main = () => {
    const [navOpen, setNavOpen] = useState(false);
    const [wsHover, setWsHover] = useState<number | null>(null);
    const [tblHover, setTblHover] = useState<number | null>(null);

    // 🔹 флаг "показывать список форм"
    const [forceFormList, setForceFormList] = useState(false);

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

    useEffect(() => {
        loadWorkSpaces();
        loadWidgetForms();
        loadConnections();
    }, [loadWorkSpaces, loadWidgetForms, loadConnections]);

    const selection = useMainSelection({
        loadColumns,
        loadWidgetsForTable,
        loadColumnsWidget,
        loadFormDisplay,
        loadFormTree,
        fetchWidgetAndTable,
        formsByWidget,
    });

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

    const selectedWs = useMemo(
        () =>
            selectedTable
                ? workSpaces.find((w) => w.id === selectedTable.workspace_id) ?? null
                : null,
        [selectedTable, workSpaces]
    );

    /** 🔹 открыть форму из списка (SideNav) — тут же выключаем режим списка */
    const openFormWithPreload = useCallback(
        async (widgetId: number, formId: number) => {
            type ApiWidget = { id: number; table_id: number };
            type ApiTable = { id: number; workspace_id: number; name: string };

            try {
                const { data: widget } = await api.get<ApiWidget>(`/widgets/${widgetId}`);
                const { data: table } = await api.get<ApiTable>(`/tables/${widget.table_id}`);

                await loadTables(table.workspace_id, true);
                await loadWidgetsForTable(table.id, true);

                selection.handleSelectTable(table as any);
                selection.setSelectedWidget({ ...(selection.selectedWidget ?? {}), id: widget.id } as any);
                selection.handleSelectForm(formId);
                await loadFormTree(formId);
            } catch (e) {
                console.warn('openFormWithPreload error:', e);
            } finally {
                setForceFormList(false); // ← выходим из режима списка
            }
        },
        [loadTables, loadWidgetsForTable, selection, loadFormTree]
    );

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

        // 🔹 клик по логотипу → вернуть к списку форм
        onLogoClick: () => {
            setForceFormList(true);
            selection.clearFormSelection();
            selection.setSelectedWidget(null);
            setFormDisplay(null);
            setSubDisplay(null);
        },
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

        // SideNav
        openFormWithPreload,
        forceFormList,
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
