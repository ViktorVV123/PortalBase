import React, {useEffect, useState} from 'react';
import * as styles from './Main.module.scss';
import {UseLoadConnections} from "@/shared/hooks/UseLoadConnections";
import {useWorkSpaces} from "@/shared/hooks/UseWorkSpaces";
import {Connection} from "@/types/typesConnection";
import {CreateWorkspaceForm} from "@/components/сreateWorkspaceForm/CreateWorkspaceForm";
import {CreateConnectionForm} from "@/components/createConnectionsForm/CreateConnectionsForm";
import Header from "@/components/header/Header";

const Main = () => {

    const {loadConnections, connections, loading, error,} = UseLoadConnections();
    const {loadWorkSpaces, workSpaces} = useWorkSpaces()
    const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showConnForm, setShowConnForm] = useState(false);
    const [open, setOpen] = useState(false);
    const handleWorkspaceClick = (connectionId: number) => {
        const conn = connections.find(c => c.id === connectionId);
        if (conn) setSelectedConnection(conn);
    };

    useEffect(() => {
        loadConnections();
    }, [loadConnections]);
    useEffect(() => {
        loadWorkSpaces()
    }, [loadConnections]);

    /* 4. Состояния загрузки / ошибки */
    if (loading) return <p>Загрузка…</p>;
    if (error) return <p style={{color: 'red'}}>{error}</p>;


    return (
        <div className={styles.container}>
            <Header open={open} setOpen={setOpen} workSpaces={workSpaces} selectedConnection={selectedConnection}
                    handleWorkspaceClick={(connectionId: number) => handleWorkspaceClick(connectionId)}
                    onAddClick={() => setShowCreateForm(true)}/>
            {selectedConnection && (
                <div>

                    <h4>{selectedConnection.name}</h4>
                    <p><strong>ID:</strong> {selectedConnection.id}</p>
                    <p><strong>Описание:</strong> {selectedConnection.description}</p>
                    <p><strong>Тип:</strong> {selectedConnection.conn_type}</p>
                    <p><strong>Строка подключения:</strong><br /><code>{selectedConnection.conn_str}</code></p>
                </div>
            )}

            <div>
                {showConnForm && (

                    <CreateConnectionForm
                        onSuccess={() => {
                            setShowConnForm(false);
                            loadConnections();        // обновляем список
                        }}
                        onCancel={() => setShowConnForm(false)}
                    />
                )}

                {showCreateForm && (
                    <CreateWorkspaceForm
                        setShowConnForm={setShowConnForm}
                        connections={connections}
                        onSuccess={() => {
                            setShowCreateForm(false);
                            loadWorkSpaces();
                        }}
                        onCancel={() => setShowCreateForm(false)}
                    />
                )}
            </div>

        </div>
    );
};

export default Main;