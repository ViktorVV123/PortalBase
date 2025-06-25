import React from 'react';
import { WorkSpaceTypes } from '@/types/typesWorkSpaces';
import { Connection } from '@/types/typesConnection';
import * as styles from './DropDownList.module.scss';

type DropDownListProps = {
    workSpaces: WorkSpaceTypes[];
    selectedConnection: Connection | null;
    handleWorkspaceClick: (connectionId: number) => void;
    onAddClick: () => void;
};

const DropDownList = ({
                          workSpaces,
                          selectedConnection,
                          handleWorkspaceClick,
                          onAddClick,
                      }: DropDownListProps) => {
    return (
        <div className={styles.wrapper}>
            <div className={styles.container}>

            <button className={styles.addButton} onClick={onAddClick}>
                + Создать Workspace
            </button>

            <ul className={styles.list}>
                {workSpaces.map((ws) => (
                    <li
                        key={ws.id}
                        className={styles.item}
                        onClick={() => handleWorkspaceClick(ws.connection_id)}
                    >
                        {ws.name}
                    </li>
                ))}
            </ul>
            </div>


        </div>
    );
};

export default DropDownList;
