import React from 'react';
import { WorkSpaceTypes } from '@/types/typesWorkSpaces';
import * as styles from './DropDownList.module.scss';

type DropDownListProps = {
    workSpaces: WorkSpaceTypes[];
    onSelect: (ws: WorkSpaceTypes) => void;
    onAddClickWorkspace: () => void;
    selectedId?: number; // чтобы подсветить активный пункт (необязательно)
};

const DropDownList = ({
                          workSpaces,
                          onSelect,
                          onAddClickWorkspace,
                          selectedId,
                      }: DropDownListProps) => (
    <div className={styles.wrapper}>

        <button className={styles.addButton} onClick={onAddClickWorkspace}>
            + Создать Workspace
        </button>

        <ul className={styles.list}>
            {workSpaces.map((ws) => (
                <li
                    key={ws.id}
                    className={`${styles.item} ${
                        ws.id === selectedId ? styles.itemActive : ''
                    }`}
                    onClick={() => onSelect(ws)}
                >
                    {ws.name}
                </li>
            ))}
        </ul>

    </div>
);

export default DropDownList;
