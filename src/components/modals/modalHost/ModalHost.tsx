import React from 'react';

import {useMainModals} from "@/pages/main/hook/useMainModals";
import {ModalAddConnection} from "@/components/modals/modalAddConnection/ModalAddConnection";
import {ModalAddWorkspace} from "@/components/modals/modalAddWorkspace/ModalAddWorkspace";
import {ModalAddTable} from "@/components/modals/modalAddNewTable/ModalAddNewTable";
import {ModalAddWidget} from "@/components/modals/modalAddWidget/ModalAddWidget";
import {ModalAddForm} from "@/components/modals/modalAddForm/ModalAddForm";
import {ModalEditForm} from "@/components/modals/modalEditForm/ModalEditForm";
import {ModalEditConnection} from "@/components/modals/modalEditConnection/ModalEditConnection";

type Props = {
    modals: ReturnType<typeof useMainModals>;
    connections: any[];
    deleteConnection: (id:number)=>Promise<void>;
    reloadWidgetForms: ()=>Promise<void>;
    deleteTreeFieldFromForm: any; deleteSubWidgetFromForm: any;
};

export const ModalHost: React.FC<Props> = ({
                                               modals, connections, deleteConnection, reloadWidgetForms,
                                               deleteTreeFieldFromForm, deleteSubWidgetFromForm
                                           }) => (
    <>
        {modals.showConnForm && (
            <ModalAddConnection
                open={modals.showConnForm}
                onSuccess={modals.onConnAddSuccess}
                onCancel={() => modals.setShowConnForm(false)}
            />
        )}

        {modals.showCreateForm && (
            <ModalAddWorkspace
                onEditConnection={(conn) => {
                    modals.setEditingConnId(conn.id);
                    modals.setEditingConnInitial({
                        url: { drivername: conn.url?.drivername, username: conn.url?.username, password: '', host: conn.url?.host, port: conn.url?.port, database: conn.url?.database, query: conn.url?.query ?? {} },
                        connection: { name: conn.name ?? conn.connection?.name, description: conn.description ?? conn.connection?.description }
                    });
                    modals.setEditConnOpen(true);
                }}
                deleteConnection={deleteConnection}
                open={modals.showCreateForm}
                setShowConnForm={modals.setShowConnForm}
                connections={connections}
                onSuccess={modals.onWorkspaceAddSuccess}
                onCancel={() => modals.setShowCreateForm(false)}
            />
        )}

        {modals.showCreateTable && modals.createTblWs && (
            <ModalAddTable
                open={modals.showCreateTable}
                workspace={modals.createTblWs}
                onSuccess={modals.onTableAddSuccess}
                onCancel={() => modals.setShowCreateTable(false)}
            />
        )}

        {modals.showCreateWidget && modals.createWidgetTable && (
            <ModalAddWidget
                open={modals.showCreateWidget}
                table={modals.createWidgetTable}
                onSuccess={modals.onWidgetAddSuccess}
                onCancel={() => modals.setShowCreateWidget(false)}
            />
        )}

        {modals.showCreateFormModal && modals.createFormWidget && (
            <ModalAddForm
                open={modals.showCreateFormModal}
                widget={modals.createFormWidget}
                onSuccess={modals.onFormAddSuccess}
                onCancel={() => modals.setShowCreateFormModal(false)}
            />
        )}

        {modals.formToEdit && (
            <ModalEditForm
                deleteSubWidgetFromForm={deleteSubWidgetFromForm}
                deleteTreeFieldFromForm={deleteTreeFieldFromForm}
                open={modals.editFormOpen}
                onClose={() => modals.setEditFormOpen(false)}
                form={modals.formToEdit}
                reloadWidgetForms={reloadWidgetForms}
            />
        )}

        {modals.editConnOpen && modals.editingConnId != null && (
            <ModalEditConnection
                open={modals.editConnOpen}
                connectionId={modals.editingConnId}
                onSuccess={modals.onConnEditSuccess}
                onCancel={() => {
                    modals.setEditConnOpen(false);
                    modals.setEditingConnId(null);
                    modals.setEditingConnInitial(null);
                }}
            />
        )}
    </>
);
