import React, {useEffect, useMemo, useRef, useState} from 'react';
import * as styles from './Main.module.scss';
import {UseLoadConnections} from "@/shared/hooks/UseLoadConnections";
import {useWorkSpaces} from "@/shared/hooks/UseWorkSpaces";
import {Connection} from "@/types/typesConnection";
import Header from "@/components/header/Header";
import {SelectedConnectionList} from "@/components/selectedConnectionList/SelectedConnectionList";
import {ModalAddWorkspace} from "@/components/modals/modalAddWorkspace/ModalAddWorkspace";
import {ModalAddConnection} from "@/components/modals/modalAddConnection/ModalAddConnection";
import {TablesRow} from "@/components/TablesRow/TablesRow";
import {WorkSpaceTypes} from "@/types/typesWorkSpaces";

const Main = () => {

    const {loadConnections, connections, loading, error,} = UseLoadConnections();
    const {loadWorkSpaces, workSpaces, deleteWorkspace, updateWorkspace, tables, loadTables} = useWorkSpaces()
    const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showConnForm, setShowConnForm] = useState(false);


    const [open, setOpen] = useState(false);
    const handleWorkspaceClick = (connectionId: number) => {
        const conn = connections.find(c => c.id === connectionId);
        if (conn) setSelectedConnection(conn);
        setShowCreateForm(false);
    };

    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selectedWs = useMemo(
        () => workSpaces.find(w => w.id === selectedId) ?? null,
        [workSpaces, selectedId],
    );

    useEffect(() => {
        if (workSpaces.length && selectedId === null) {
            /* сразу выбираем первый workspace */
            setSelectedId(workSpaces[0].id);
            handleWorkspaceClick(workSpaces[0].connection_id);
        }
    }, [workSpaces, selectedId]);


    useEffect(() => {
        loadConnections();
    }, [loadConnections]);
    useEffect(() => {
        loadWorkSpaces()
    }, [loadConnections]);
    useEffect(() => {
        if (connections.length && !selectedConnection) {
            setSelectedConnection(connections[0]);
        }
    }, [connections, selectedConnection]);

    const selectWorkspace = (ws: WorkSpaceTypes) => {
        setSelectedId(ws.id);
        setOpen(false);
        handleWorkspaceClick(ws.connection_id);
    };



    const wrapperRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleOutside = (e: MouseEvent) => {
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [setOpen]);


    /* 4. Состояния загрузки / ошибки */
    if (loading) return <p>Загрузка…</p>;
    if (error) return <p style={{color: 'red'}}>{error}</p>;
    const onAddClickWorkspace = () => {
        setShowCreateForm(true)
        setOpen(false);
    }


    return (
        <div className={styles.container}>
            <Header  selectedConnection={selectedConnection} wrapperRef={wrapperRef} selectWorkspace={selectWorkspace}  selected={selectedWs}
                    setSelected={(ws:any) => setSelectedId(ws?.id ?? null)} updateWorkspace={updateWorkspace} deleteWorkspace={deleteWorkspace}
                    open={open} setOpen={setOpen} workSpaces={workSpaces}
                    handleWorkspaceClick={(connectionId: number) => handleWorkspaceClick(connectionId)}
                    onAddClickWorkspace={onAddClickWorkspace}/>
            <div>

                <TablesRow
                    workspaceId={selectedId}  /* ← id выбранного WS */
                    tables={tables}
                    loadTables={loadTables}
                />

                {showConnForm && (
                    <ModalAddConnection onSuccess={() => {
                        setShowConnForm(false);
                        loadConnections();        // обновляем список
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

export default Main;