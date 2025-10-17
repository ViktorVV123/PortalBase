import React from 'react';
import {Checkbox} from '@mui/material';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import EditIcon from '@/assets/image/EditIcon.svg';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import type {ComboItem, RefItem} from '../types';
import {toFullPatch} from '../ref-helpers';

export type RefRowProps = {
    wcId: number;
    r: RefItem;
    visibleText: string;
    formText: string;
    onOpenEdit: (wcId: number, tableColumnId: number) => void;
    onDelete: (wcId: number, tableColumnId: number) => void;
    onOpenForm: (wcId: number, tblColId: number, currentVal?: number | null) => void;

    // DnD (строчные)
    getIdxById: (wcId: number, tableColumnId: number) => number;
    onDragStart: (srcWcId: number, fromIdx: number, tableColumnId: number) => (e: React.DragEvent) => void;
    onDragEnd: () => void;
    onDropRow: (dstWcId: number, toIdx: number) => (e: React.DragEvent) => void;

    // локальный стейт + синк
    setLocalRefs: React.Dispatch<React.SetStateAction<Record<number, RefItem[]>>>;
    localRefsRef: React.MutableRefObject<Record<number, RefItem[]>>;
    callUpdateReference: (wcId: number, tblColId: number, patch: any) => Promise<any>;
    onOpenComboItem: (wcId: number, tblColId: number, item: ComboItem) => void;
};

export const RefRow: React.FC<RefRowProps> = ({
                                                  wcId, r, visibleText, formText, onOpenEdit, onDelete, onOpenForm,
                                                  getIdxById, onDragStart, onDragEnd, onDropRow,
                                                  setLocalRefs, localRefsRef, callUpdateReference,onOpenComboItem
                                              }) => {
    const tblCol = r.table_column;
    const tblColId = tblCol?.id!;
    const type = r.type ?? '—';
    const visible = (r.visible ?? true);

    // Небольшой, чисто-отображенческий компонент (без интерактива, чтобы не ломать DnD)
    const ComboboxPreview: React.FC<{
        items?: ComboItem[] | null;
        onItemClick?: (item: ComboItem) => void;
    }> = ({ items, onItemClick }) => {
        if (!items || items.length === 0) return <>—</>;
        return (
            <div
                style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}
                draggable={false}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                {items.map((it) => {
                    const label = (it.combobox_alias && it.combobox_alias.trim()) || `col:${it.combobox_column_id}`;
                   /* const flags = [
                        it.is_primary ? 'P' : '',
                        it.is_show ? 'S' : '',
                        it.is_show_hidden ? 'H' : '',
                    ].filter(Boolean).join('');*/
                    return (
                        <span
                            key={it.combobox_column_id}
                            style={{
                                fontSize: 12,
                                border: '1px solid rgba(255,255,255,0.25)',
                                borderRadius: 4,
                                padding: '2px 6px',
                                whiteSpace: 'nowrap',
                                opacity: 0.95,
                                cursor: onItemClick ? 'pointer' : 'default',
                            }}
                            title={`order:${it.combobox_column_order} • width:${it.combobox_width} • id:${it.combobox_column_id}`}
                            onClick={() => onItemClick?.(it)}
                        >
            #{it.combobox_column_order}
          </span>
                    );
                })}
            </div>
        );
    };



    return (
        <tr
            key={`${wcId}:${tblColId}`}
            draggable
            onDragStart={onDragStart(wcId, getIdxById(wcId, tblColId), tblColId)}
            onDragEnd={onDragEnd}
            onDrop={onDropRow(wcId, getIdxById(wcId, tblColId))}
            style={{cursor: 'move'}}
        >
            <td style={{textAlign: 'center', opacity: 0.6}}>⋮⋮</td>
            <td>{tblCol?.name ?? '—'}</td>
            <td>{r.ref_alias ?? '—'}</td>
            <td>{type}</td>

            {/* readonly */}
            <td style={{textAlign: 'center'}}>
                <div onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} draggable={false}
                     style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Checkbox
                        size="small"
                        sx={{color: 'common.white', '&.Mui-checked': {color: 'common.white'}}}
                        checked={!!r.readonly}
                        onChange={async (e) => {
                            const nextVal = e.target.checked;
                            setLocalRefs(prev => ({
                                ...prev,
                                [wcId]: (prev[wcId] ?? []).map(item =>
                                    item.table_column?.id === tblColId ? {...item, readonly: nextVal} : item
                                )
                            }));
                            try {
                                const currentRow = (localRefsRef.current[wcId] ?? []).find(x => x.table_column?.id === tblColId);
                                if (currentRow) {
                                    await callUpdateReference(wcId, tblColId, {
                                        ...toFullPatch({
                                            ...currentRow,
                                            readonly: nextVal
                                        })
                                    });
                                } else {
                                    await callUpdateReference(wcId, tblColId, {readonly: nextVal});
                                }
                            } catch {
                                setLocalRefs(prev => ({
                                    ...prev,
                                    [wcId]: (prev[wcId] ?? []).map(item =>
                                        item.table_column?.id === tblColId ? {...item, readonly: !nextVal} : item
                                    )
                                }));
                            }
                        }}
                    />
                </div>
            </td>

            <td>{r.width ?? '—'}</td>
            <td>{r.default ?? '—'}</td>
            <td>{r.placeholder ?? '—'}</td>

            {/* visible */}
            <td style={{textAlign: 'center'}}>
                <div onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} draggable={false}
                     style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>
                    <Checkbox
                        size="small"
                        sx={{color: 'common.white', '&.Mui-checked': {color: 'common.white'}}}
                        checked={visible}
                        onChange={async (e) => {
                            const nextVal = e.target.checked;
                            if (visible === nextVal) return;
                            setLocalRefs(prev => ({
                                ...prev,
                                [wcId]: (prev[wcId] ?? []).map(item =>
                                    item.table_column?.id === tblColId ? {...item, visible: nextVal} : item
                                )
                            }));
                            try {
                                const currentRow = (localRefsRef.current[wcId] ?? []).find(x => x.table_column?.id === tblColId);
                                if (currentRow) {
                                    await callUpdateReference(wcId, tblColId, {
                                        ...toFullPatch({
                                            ...currentRow,
                                            visible: nextVal
                                        })
                                    });
                                } else {
                                    await callUpdateReference(wcId, tblColId, {visible: nextVal});
                                }
                            } catch {
                                setLocalRefs(prev => ({
                                    ...prev,
                                    [wcId]: (prev[wcId] ?? []).map(item =>
                                        item.table_column?.id === tblColId ? {...item, visible: !nextVal} : item
                                    )
                                }));
                            }
                        }}
                    />
                </div>
            </td>

            <td>{r.ref_column_order ?? 0}</td>
            <td>
                <ComboboxPreview
                    items={Array.isArray((r as any).combobox) ? (r as any).combobox : null}
                    onItemClick={(item) => onOpenComboItem(wcId, tblColId, item)}
                />
            </td>

            {/* Form (clickable) */}
            <td
                onClick={(e) => {
                    e.stopPropagation();
                    onOpenForm(wcId, tblColId, (r as any).form_id ?? (r as any).form);
                }}
                title="Выбрать форму"
                style={{cursor: 'pointer', textDecoration: 'underline dotted'}}
            >
                {formText}
            </td>

            <td>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10}}>
                    <EditIcon className={s.actionIcon} onClick={(e) => {
                        e.stopPropagation();
                        onOpenEdit(wcId, tblColId);
                    }} aria-label="Редактировать поле"/>
                    <DeleteIcon className={s.actionIcon} onClick={() => onDelete(wcId, tblColId)}
                                aria-label="Удалить поле из группы"/>
                </div>
            </td>
        </tr>
    );
};
