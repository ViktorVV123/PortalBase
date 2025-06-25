import React, {useState} from 'react';
import {WorkSpaceTypes} from '@/types/typesWorkSpaces';
import * as styles from './DropDownList.module.scss';
import EditImg from '@/assets/image/EditIcon.svg'
import DeleteImg from '@/assets/image/DeleteIcon.svg'


type DropDownListProps = {
    workSpaces: WorkSpaceTypes[];
    onSelect: (ws: WorkSpaceTypes) => void;
    onAddClickWorkspace: () => void;
    selectedId?: number; // чтобы подсветить активный пункт (необязательно)
    deleteWorkspace: (wsId: number) => void
    updateWorkspace: (id: number, patch: Partial<Omit<WorkSpaceTypes, 'id'>>) => void;
};

const DropDownList = ({
                          workSpaces,
                          onSelect,
                          onAddClickWorkspace,
                          selectedId,
                          deleteWorkspace, updateWorkspace

                      }: DropDownListProps) => {


    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState({
        name: '',

    });

    const [value, setValue]         = useState('');

    const startEdit = (ws: WorkSpaceTypes) => {
        setEditingId(ws.id);
        setValue(ws.name);
    };

    const finishEdit = (save: boolean) => {
        if (save && editingId !== null) {
            updateWorkspace(editingId, { name: value.trim() });
        }
        setEditingId(null);
    };


    return (
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
                        }`}>
                        {editingId === ws.id ? (
                            <input
                                value={value}
                                autoFocus
                                onChange={e => setValue(e.target.value)}
                                onBlur={() => finishEdit(true)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') finishEdit(true);
                                    if (e.key === 'Escape') finishEdit(false);
                                }}
                            />
                        ) : (
                            <span onClick={() => onSelect(ws)}>{ws.name}</span>
                        )}
                        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                            <span onClick={() => startEdit(ws)}><EditImg/></span>
                            <span onClick={() => deleteWorkspace(ws.id)}><DeleteImg/></span>
                        </div>

                    </li>
                ))}
            </ul>

        </div>
    )
};

export default DropDownList;
