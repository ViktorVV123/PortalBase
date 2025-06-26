import React from 'react';
import {Connection} from "@/types/typesConnection";
import * as styles from  './SelectedConnectionList.module.scss';


type SelectedConnectionListProps = {
    selectedConnection: Connection | null;
}
export const SelectedConnectionList = ({selectedConnection}:SelectedConnectionListProps) => {
    return (
        <>
            {selectedConnection && (
                <div className={styles.container}>

                    {/* <h4>{selectedConnection.name}</h4>
                    <p><strong>ID:</strong> {selectedConnection.id}</p>*/}
                    {/* <p>
                        <strong>Описание:</strong> {selectedConnection.description}</p>
                    <p><strong>Тип:</strong> {selectedConnection.conn_type}</p>*/}
                    <div>{selectedConnection.name}</div>
                    <p style={{display: 'flex', alignItems: 'center'}}><strong>Строка
                        подключения:</strong><br/><code>{selectedConnection.conn_str}</code></p>
                </div>
            )}
        </>
    );
};

