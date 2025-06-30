import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as styles from './Main.module.scss';
import {UseLoadConnections} from "@/shared/hooks/UseLoadConnections";
import {useWorkSpaces} from "@/shared/hooks/UseWorkSpaces";
import {Connection} from "@/types/typesConnection";
import Header from "@/components/header/Header";
import {ModalAddWorkspace} from "@/components/modals/modalAddWorkspace/ModalAddWorkspace";
import {ModalAddConnection} from "@/components/modals/modalAddConnection/ModalAddConnection";
import {TablesRow} from "@/components/TablesRow/TablesRow";
import {WorkSpaceTypes} from "@/types/typesWorkSpaces";
import {useOutsideClick} from "@/shared/hooks/useOutsideClick";
import {useDefaultWorkspace} from "@/shared/hooks/useDefaultWorkspace";
import {UseWidget} from "@/shared/hooks/useWidget";
import Widget from "@/components/widget/Widget";
import {MenuTableWidget} from "@/components/menuTableWidget/MenuTableWidget";

export const Main = () => {

    const {loadConnections, connections, loading, error,} = UseLoadConnections();
    const {loadWorkSpaces, workSpaces, deleteWorkspace, updateWorkspace, tables, loadTables} = useWorkSpaces()
    const {loadWidget, widget,widgetColumn,loadWidgetForTable} = UseWidget()
    const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
    const [selectedWidgetId, setSelectedWidgetId] = useState<number | null>(null);
    const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showConnForm, setShowConnForm] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [swapTableWidget, setSwapTableWidget] = useState(0);
    const selectedWs = useMemo(
        () => workSpaces.find(w => w.id === selectedId) ?? null,
        [workSpaces, selectedId],
    );
    const wrapperRef = useRef<HTMLDivElement>(null);
    const handleWorkspaceClick = (connectionId: number) => {
        const conn = connections.find(c => c.id === connectionId);
        if (conn) setSelectedConnection(conn);
        setShowCreateForm(false);
    };
    const selectWorkspace = (ws: WorkSpaceTypes) => {
        setSelectedId(ws.id);
        setOpen(false);
        handleWorkspaceClick(ws.connection_id);
    };
    useOutsideClick(wrapperRef, () => setOpen(false));
    useDefaultWorkspace(
        workSpaces,
        selectedId,
        id => setSelectedId(id),
        connectionId => handleWorkspaceClick(connectionId),
    );
    //конекшены
    useEffect(() => {
        loadConnections();
    }, [loadConnections]);
    //рабочее пространство
    useEffect(() => {
        loadWorkSpaces()
    }, [loadConnections]);
    //виджеты
    useEffect(() => {
        loadWidget()
    }, [loadWidget]);

    useEffect(() => {
          if (selectedWidgetId !== null) loadWidgetForTable(selectedWidgetId);
        }, [selectedWidgetId, loadWidgetForTable]);
    //хз


    const handleTableSelect = useCallback(
        (tableId: number) => {
            loadWidgetForTable(tableId);
        },
        [loadWidgetForTable],
    );

    /* 4. Состояния загрузки / ошибки */
    if (loading) return <p>Загрузка…</p>;
    if (error) return <p style={{color: 'red'}}>{error}</p>;
    const onAddClickWorkspace = () => {
        setShowCreateForm(true)
        setOpen(false);
    }
    /* колбэк с устойчивой ссылкой */


    return (
        <div className={styles.container}>
            <Header  selectedConnection={selectedConnection} wrapperRef={wrapperRef}
                    selectWorkspace={selectWorkspace}
                    selected={selectedWs} updateWorkspace={updateWorkspace}
                    deleteWorkspace={deleteWorkspace} open={open} setOpen={setOpen} workSpaces={workSpaces}
                    onAddClickWorkspace={onAddClickWorkspace}/>

            <MenuTableWidget setSwapTableWidget={setSwapTableWidget}/>
            {swapTableWidget === 0 ?
                <TablesRow
                    handleTableSelect={handleTableSelect}
                  workspaceId={selectedId}
                  tables={tables}
                  loadTables={loadTables}
                  onTableSelect={id => {
                    setSelectedTableId(id);
                      loadWidgetForTable(id);          // подгружаем widget/columns
                  }}
                /> : <Widget
                    widget={widget}
                    columns={widgetColumn}

                />
            }

            <div>


                {showConnForm && (
                    <ModalAddConnection onSuccess={() => {
                        setShowConnForm(false);
                        loadConnections();
                    }}
                                        onCancel={() => setShowConnForm(false)}/>

                )}

                {showCreateForm && (
                    <ModalAddWorkspace setShowConnForm={setShowConnForm}
                                       connections={connections}
                                       onSuccess={() => {
                                           setShowCreateForm(false);
                                           loadWorkSpaces();
                                       }}
                                       onCancel={() => setShowCreateForm(false)}/>

                )}

            </div>

        </div>
    );
};

