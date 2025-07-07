// src/pages/pageNotVisible/PageNotVisible.tsx
import React from 'react';
import { MenuTableWidget } from '@/components/menuTableWidget/MenuTableWidget';
import { TablesRow }       from '@/components/TablesRow/TablesRow';
import { ModalAddConnection } from '@/components/modals/modalAddConnection/ModalAddConnection';
import { ModalAddWorkspace }  from '@/components/modals/modalAddWorkspace/ModalAddWorkspace';
import Widget              from '@/components/widget/Widget';
import {useWorkspaceContext} from "@/shared/context/WorkspaceContext";


type Props = {
    view: 'table' | 'widget';
    swapTableWidget: (v: number) => void;

    /* ↓ всё, что НЕ относится к WorkspaceContext */
    widgets: any;
    addReference: any;
    selectedWidgetId: number | null;
    handleWidgetSelect: (id: number) => void;
    handleTableSelect: (id: number | null) => void;
    loadColumns: (id: number) => void;

    /* модалки */
    showConnForm: boolean;
    setShowConnForm: React.Dispatch<React.SetStateAction<boolean>>;
    showCreateForm: boolean;
    setShowCreateForm: React.Dispatch<React.SetStateAction<boolean>>;

    /* внешние данные */
    widgetColumns: any;
    widgetLoading: boolean;
    widgetError  : any;
    connections  : any;
    loadConnections: () => void;
};

export const PageNotVisible: React.FC<Props> = ({
                                                    view,
                                                    swapTableWidget,
                                                    widgets,
                                                    addReference,
                                                    selectedWidgetId,
                                                    handleWidgetSelect,
                                                    handleTableSelect,
                                                    loadColumns,
                                                    showConnForm,
                                                    setShowConnForm,
                                                    showCreateForm,
                                                    setShowCreateForm,
                                                    widgetColumns,
                                                    widgetLoading,
                                                    widgetError,
                                                    connections,
                                                    loadConnections,
                                                }) => {
    /* забираем workspace-данные из контекста */
    const { selectedWs, tables, loadTables, reloadWorkspaces } = useWorkspaceContext();

    return (
        <div>
            <MenuTableWidget view={view} setSwapTableWidget={swapTableWidget} />

            {view === 'table' ? (
                <TablesRow
                    workspaceId={selectedWs?.id ?? null}
                    tables={tables}
                    loadTables={loadTables}
                    onTableSelect={handleTableSelect}
                />
            ) : (
                <Widget
                    loadColumns={loadColumns}
                    addReference={addReference}
                    widgets={widgets}
                    selectedWidgetId={selectedWidgetId}
                    onSelectWidget={handleWidgetSelect}
                    columns={widgetColumns}
                    loading={widgetLoading}
                    error={widgetError}
                />
            )}

            {/* ---------- modals ---------- */}
            {showConnForm && (
                <ModalAddConnection
                    onSuccess={() => {
                        setShowConnForm(false);
                        loadConnections();
                    }}
                    onCancel={() => setShowConnForm(false)}
                />
            )}

            {showCreateForm && (
                <ModalAddWorkspace
                    setShowConnForm={setShowConnForm}
                    connections={connections}
                    onSuccess={() => {
                        setShowCreateForm(false);
                        reloadWorkspaces();       {/* теперь прямо из контекста */}
                    }}
                    onCancel={() => setShowCreateForm(false)}
                />
            )}
        </div>
    );
};
