import { useCallback, useState } from 'react';
import type { DTable, Widget, WidgetForm } from '@/shared/hooks/useWorkSpaces';
import type { WorkSpaceTypes } from '@/types/typesWorkSpaces';

type Deps = {
    // loaders / actions из useWorkSpaces и selection-хука
    loadConnections: () => void;
    loadWorkSpaces: () => void;
    loadTables: (wsId: number, force?: boolean) => Promise<DTable[]>;
    loadWidgetsForTable: (tableId: number, force?: boolean) => void;

    handleSelectTable: (t: DTable) => void;
    handleSelectWidget: (w: Widget) => void;

    reloadWidgetForms: () => Promise<void>;
    openForm: (widgetId: number, formId: number) => Promise<void>;
};

export function useMainModals({
                                  loadConnections,
                                  loadWorkSpaces,
                                  loadTables,
                                  loadWidgetsForTable,
                                  handleSelectTable,
                                  handleSelectWidget,
                                  reloadWidgetForms,
                                  openForm,
                              }: Deps) {
    // connection add
    const [showConnForm, setShowConnForm] = useState(false);

    // workspace add / edit-connection (from inside modal)
    const [showCreateForm, setShowCreateForm] = useState(false);

    // table add
    const [showCreateTable, setShowCreateTable] = useState(false);
    const [createTblWs, setCreateTblWs] = useState<WorkSpaceTypes | null>(null);

    // widget add
    const [showCreateWidget, setShowCreateWidget] = useState(false);
    const [createWidgetTable, setCreateWidgetTable] = useState<DTable | null>(null);

    // form add
    const [showCreateFormModal, setShowCreateFormModal] = useState(false);
    const [createFormWidget, setCreateFormWidget] = useState<Widget | null>(null);

    // form edit
    const [editFormOpen, setEditFormOpen] = useState(false);
    const [formToEdit, setFormToEdit] = useState<WidgetForm | null>(null);

    // connection edit
    const [editConnOpen, setEditConnOpen] = useState(false);
    const [editingConnId, setEditingConnId] = useState<number | null>(null);
    const [editingConnInitial, setEditingConnInitial] = useState<any>(null);

    // onSuccess shortcuts for modals
    const onConnAddSuccess = useCallback(() => {
        setShowConnForm(false);
        loadConnections();
    }, [loadConnections]);

    const onWorkspaceAddSuccess = useCallback(() => {
        setShowCreateForm(false);
        loadWorkSpaces();
    }, [loadWorkSpaces]);

    const onTableAddSuccess = useCallback(
        async (newTable: DTable) => {
            setShowCreateTable(false);
            await loadTables(newTable.workspace_id, true);
            handleSelectTable(newTable);
        },
        [handleSelectTable, loadTables]
    );

    const onWidgetAddSuccess = useCallback(
        async (newWidget: Widget) => {
            setShowCreateWidget(false);
            await loadWidgetsForTable(newWidget.table_id, true);
            handleSelectWidget(newWidget);
        },
        [handleSelectWidget, loadWidgetsForTable]
    );

    const onFormAddSuccess = useCallback(
        async (newForm: WidgetForm) => {
            if (!createFormWidget) return;
            setShowCreateFormModal(false);
            await reloadWidgetForms();
            await openForm(createFormWidget.id, newForm.form_id);
        },
        [createFormWidget, openForm, reloadWidgetForms]
    );

    const onConnEditSuccess = useCallback(() => {
        setEditConnOpen(false);
        setEditingConnId(null);
        setEditingConnInitial(null);
        loadConnections();
    }, [loadConnections]);

    return {
        // state для всех модалок
        showConnForm, setShowConnForm,
        showCreateForm, setShowCreateForm,
        showCreateTable, setShowCreateTable, createTblWs, setCreateTblWs,
        showCreateWidget, setShowCreateWidget, createWidgetTable, setCreateWidgetTable,
        showCreateFormModal, setShowCreateFormModal, createFormWidget, setCreateFormWidget,
        editFormOpen, setEditFormOpen, formToEdit, setFormToEdit,
        editConnOpen, setEditConnOpen, editingConnId, setEditingConnId, editingConnInitial, setEditingConnInitial,

        // success-обработчики для модалок
        onConnAddSuccess,
        onWorkspaceAddSuccess,
        onTableAddSuccess,
        onWidgetAddSuccess,
        onFormAddSuccess,
        onConnEditSuccess,
    };
}
