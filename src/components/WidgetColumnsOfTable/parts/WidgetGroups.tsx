import React from 'react';
import AddIcon from '@mui/icons-material/AddBox';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import {RefRow, RefRowProps} from './RefRow';
import type {RefItem} from '../types';

type TbodyDndHandlers = {
    onDragOver: (e: React.DragEvent) => void;
    onDropTbodyEnd: (wcId: number) => (e: React.DragEvent) => void;
};

type Props = {
    wcId: number;
    title: string;
    order: number;
    refs: RefItem[];
    isFirst: boolean;
    isLast: boolean;

    moveGroup: (wcId: number, dir: 'up'|'down') => void;
    onOpenAlias: () => void;
    onDeleteGroup: () => void;
    onAddField: () => void;

    // 👇 было: Omit<React.ComponentProps<typeof RefRow>, ...>
    // стало: Omit<RefRowProps, ...> & TbodyDndHandlers
    rowProps: Omit<RefRowProps, 'wcId'|'r'|'formText'|'visibleText'> & TbodyDndHandlers;
    formNameById: Record<string,string>;
};

export const WidgetGroup: React.FC<Props> = ({
                                                 wcId, title, order, refs, isFirst, isLast,
                                                 moveGroup, onOpenAlias, onDeleteGroup, onAddField,
                                                 rowProps, formNameById
                                             }) => {
    return (
        <div style={{marginBottom:24}}>
            <div style={{display:'flex', gap:10, alignItems:'center'}}>
                <h4 style={{margin:0}}>{title}</h4>
                <span style={{color:'grey'}}>({order})</span>
                <div style={{display:'flex', gap:6, marginLeft:8, alignItems:'center'}}>
                    <button title="Переместить вверх" aria-label="Переместить группу вверх" disabled={isFirst}
                            onClick={()=>moveGroup(wcId,'up')} style={{opacity:isFirst?0.4:1}}>↑</button>
                    <button title="Переместить вниз" aria-label="Переместить группу вниз" disabled={isLast}
                            onClick={()=>moveGroup(wcId,'down')} style={{opacity:isLast?0.4:1}}>↓</button>

                    <EditIcon className={s.actionIcon} onClick={onOpenAlias} aria-label="Переименовать alias"/>
                    <DeleteIcon className={s.actionIcon} onClick={onDeleteGroup} aria-label="Удалить группу"/>

                    <button className={s.okBtn} style={{marginLeft:12}} onClick={onAddField}
                            title="Добавить поле в эту группу" aria-label="Добавить поле в группу">
                        <AddIcon/>
                    </button>
                </div>
            </div>

            <table className={s.tbl} style={{marginTop: 8}}>
                <thead>
                <tr>
                    <th style={{width: 28}}/>
                    <th>Название</th>
                    <th>Подзаголовок</th>
                    <th>Тип</th>
                    <th>Только чтение</th>
                    <th>Ширина</th>
                    <th>default</th>
                    <th>placeholder</th>
                    <th>Видимость</th>
                    <th>Очередность</th>
                    <th>Combobox</th>
                    <th>Формы</th>
                    <th/>
                </tr>
                </thead>
                <tbody onDragOver={rowProps.onDragOver} onDrop={rowProps.onDropTbodyEnd(wcId)}>
                {refs.length > 0 ? refs.map((r) => {
                    const formId = (r as any).form_id ?? (r as any).form;
                    const formText = formId != null ? (formNameById[String(formId)] ?? `#${formId}`) : formNameById['null'];
                    return (
                        <RefRow
                            key={`${wcId}:${r.table_column?.id}`}
                            wcId={wcId}
                            r={r}
                            visibleText={(r.visible ?? true) ? '✓' : '✗'}
                            formText={formText}
                            {...rowProps}
                        />
                    );
                }) : (
                    <tr>
                        <td colSpan={13} style={{textAlign: 'center', opacity: 0.7}}>
                            Нет связей — перетащите сюда строку из другого блока или нажмите «+ поле»
                        </td>
                    </tr>
                )}
                </tbody>
            </table>
        </div>
    );
};


