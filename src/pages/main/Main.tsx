// src/pages/main/Main.tsx

import React, { useEffect, useMemo, useState } from 'react';
import * as styles from './Main.module.scss';

import { useWorkSpaces } from '@/shared/hooks/useWorkSpaces';
import { TopComponent } from '@/components/topComponent/TopComponent';
import { SetOfTables } from '@/components/setOfTables/SetOfTables';
import { useMainSelection } from '@/pages/main/hook/useMainSelection';
import { useMainModals } from '@/pages/main/hook/useMainModals';
import { ModalHost } from '@/components/modals/modalHost/ModalHost';
import { CenteredLoader } from '@/shared/ui/CenteredLoader';

export const Main = () => {
    const [navOpen, setNavOpen] = useState(false);
    const [wsHover, setWsHover] = useState<number | null>(null);
    const [tblHover, setTblHover] = useState<number | null>(null);

    // ═══════════════════════════════════════════════════════════════════════════
    // НОВОЕ: Флаг что верхнее меню открыто (чтобы не показывать глобальный лоадер)
    // ═══════════════════════════════════════════════════════════════════════════
    const [topMenuOpen, setTopMenuOpen] = useState(false);

    const {
        // Workspaces
        loadWorkSpaces,
        workSpaces,
        deleteWorkspace,

        // Tables
        tablesByWs,
        loadTables,
        selectedTable,
        deleteTable,
        updateTableMeta,
        publishTable,

        // Columns
        columns,
        loadColumns,
        updateTableColumn,
        deleteColumnTable,

        // Widgets
        widgetsByTable,
        loadWidgetsForTable,
        deleteWidget,
        updateWidgetMeta,
        setWidgetsByTable,

        // Widget Columns
        widgetColumns,
        wColsLoading,
        wColsError,
        loadColumnsWidget,
        updateWidgetColumn,
        deleteColumnWidget,
        addWidgetColumn,

        // References
        fetchReferences,
        updateReference,
        deleteReference,

        // Forms
        formsByWidget,
        formsById,
        formsListByWidget,
        loadWidgetForms,
        reloadWidgetForms,
        addForm,
        deleteForm,
        deleteTreeFieldFromForm,
        deleteSubWidgetFromForm,

        // Form Display
        formDisplay,
        formLoading,
        formError,
        loadFormDisplay,
        loadFilteredFormDisplay,
        setFormDisplay,

        // Sub Display
        subDisplay,
        subLoading,
        subError,
        loadSubDisplay,
        setSubDisplay,

        // Form Tree
        formTrees,
        loadFormTree,

        // Connections
        connections,
        loadConnections,
        deleteConnection,

        // Misc
        fetchWidgetAndTable,
        loading,
        error,
    } = useWorkSpaces();

    // Первичная загрузка
    useEffect(() => {
        loadWorkSpaces();
        loadWidgetForms();
        loadConnections();
    }, [loadWorkSpaces, loadWidgetForms, loadConnections]);

    // Selection
    const selection = useMainSelection({
        loadColumns,
        loadWidgetsForTable,
        loadColumnsWidget,
        loadFormDisplay,
        loadFormTree,
        fetchWidgetAndTable,
        formsByWidget,
    });

    // Modals
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

    // Selected workspace
    const selectedWs = useMemo(
        () =>
            selectedTable
                ? workSpaces.find((w) => w.id === selectedTable.workspace_id) ?? null
                : null,
        [selectedTable, workSpaces]
    );

    // ═══════════════════════════════════════════════════════════
    // PROPS GROUPS
    // ═══════════════════════════════════════════════════════════

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
        loadConnections,
        connections,
        // ═══════════════════════════════════════════════════════════════════════════
        // НОВОЕ: Передаём callback для отслеживания состояния меню
        // ═══════════════════════════════════════════════════════════════════════════
        onMenuOpenChange: setTopMenuOpen,
    };

    const setOfTablesProps = {
        // Table
        columns,
        selectedTable,
        deleteColumnTable,
        updateTableColumn,
        updateTableMeta,
        publishTable,
        loadColumns,
        tablesByWs,

        // Widget
        widgetColumns,
        selectedWidget: selection.selectedWidget,
        wColsLoading,
        wColsError,
        handleClearWidget: selection.handleClearWidget,
        handleSelectWidget: selection.handleSelectWidget,
        setSelectedWidget: selection.setSelectedWidget,
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
        selectedFormId: selection.selectedFormId,
        clearFormSelection: selection.clearFormSelection,
        formDisplay,
        formLoading,
        formError,
        formsByWidget,
        formsById,
        formTrees,
        loadFilteredFormDisplay,
        setFormDisplay,

        // Sub
        loadSubDisplay,
        subDisplay,
        subLoading,
        subError,
        setSubDisplay,

        // Common
        tableName: selectedTable?.name ?? '',
        workspaceName: selectedWs?.name ?? '',
        loading,
        error,
        loadWidgetForms,
    };

    const modalHostProps = {
        modals,
        connections,
        deleteConnection,
        reloadWidgetForms,
        deleteTreeFieldFromForm,
        deleteSubWidgetFromForm,
    };

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════════════
    // ИСПРАВЛЕНО: Не показываем глобальный лоадер когда открыто верхнее меню
    // ═══════════════════════════════════════════════════════════════════════════
    const showGlobalLoader = loading
        && !selectedTable
        && !selection.selectedWidget
        && !selection.selectedFormId
        && !topMenuOpen;  // ← НОВОЕ: не показываем когда меню открыто

    return (
        <div className={styles.layout}>
            {/* Глобальный лоадер */}
            {showGlobalLoader && (
                <CenteredLoader fullScreen label="Загружаем рабочее пространство…" />
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