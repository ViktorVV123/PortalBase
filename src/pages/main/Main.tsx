import React, {useEffect, useState} from 'react';
import * as styles from './Main.module.scss';
import {UseLoadConnections} from "@/shared/hooks/UseLoadConnections";
import {useWorkSpaces} from "@/shared/hooks/UseWorkSpaces";
import {Connection} from "@/types/typesConnection";
import Header from "@/components/header/Header";
import {SelectedConnectionList} from "@/components/selectedConnectionList/SelectedConnectionList";
import {ModalAddWorkspace} from "@/components/modals/modalAddWorkspace/ModalAddWorkspace";
import {ModalAddConnection} from "@/components/modals/modalAddConnection/ModalAddConnection";

const Main = () => {

    const {loadConnections, connections, loading, error,} = UseLoadConnections();
    const {loadWorkSpaces, workSpaces,deleteWorkspace,updateWorkspace} = useWorkSpaces()
    const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showConnForm, setShowConnForm] = useState(false);
    const [open, setOpen] = useState(false);
    const handleWorkspaceClick = (connectionId: number) => {
        const conn = connections.find(c => c.id === connectionId);
        if (conn) setSelectedConnection(conn);
        setShowCreateForm(false);
    };



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

    /* 4. Состояния загрузки / ошибки */
    if (loading) return <p>Загрузка…</p>;
    if (error) return <p style={{color: 'red'}}>{error}</p>;
    const onAddClickWorkspace = () => {
        setShowCreateForm(true)
        setOpen(false);
    }

    return (
        <div className={styles.container}>
            <Header updateWorkspace={updateWorkspace} deleteWorkspace={deleteWorkspace} open={open} setOpen={setOpen} workSpaces={workSpaces}
                    handleWorkspaceClick={(connectionId: number) => handleWorkspaceClick(connectionId)}
                    onAddClickWorkspace={onAddClickWorkspace} />
            <div>
                <SelectedConnectionList selectedConnection={selectedConnection}/>
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