import React, {useEffect, useMemo, useState} from 'react';
import {Checkbox, Menu, MenuItem, IconButton} from '@mui/material';
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
    onOpenComboItem: (wcId: number, tblColId: number, item: ComboItem) => void;

    // DnD (строчные)
    getIdxById: (wcId: number, tableColumnId: number) => number;
    onDragStart: (srcWcId: number, fromIdx: number, tableColumnId: number) => (e: React.DragEvent<HTMLTableRowElement>) => void;
    onDragEnd: () => void;
    onDropRow: (dstWcId: number, toIdx: number) => (e: React.DragEvent<HTMLTableRowElement>) => void;

    // локальный стейт + синк
    setLocalRefs: React.Dispatch<React.SetStateAction<Record<number, RefItem[]>>>;
    localRefsRef: React.MutableRefObject<Record<number, RefItem[]>>;
    callUpdateReference: (wcId: number, tblColId: number, patch: any) => Promise<any>;
};

const getComboId = (it: ComboItem, fallback: number) =>
    (it as any).combobox_column_id ?? (it as any).id ?? fallback;

export const RefRow: React.FC<RefRowProps> = ({
                                                  wcId,
                                                  r,
                                                  visibleText,
                                                  formText,
                                                  onOpenEdit,
                                                  onDelete,
                                                  onOpenForm,
                                                  onOpenComboItem,
                                                  getIdxById,
                                                  onDragStart,
                                                  onDragEnd,
                                                  onDropRow,
                                                  setLocalRefs,
                                                  localRefsRef,
                                                  callUpdateReference
                                              }) => {
    const tblCol = r.table_column;
    const tblColId = tblCol?.id as number;
    const type = r.type ?? '—';
    const visible = (r.visible ?? true);

    // combobox список
    const comboItems: ComboItem[] = useMemo(() => {
        const raw = Array.isArray((r as any).combobox) ? (r as any).combobox as ComboItem[] : [];
        return [...raw].sort((a, b) => {
            const ap = a?.is_primary ? -1 : 0;
            const bp = b?.is_primary ? -1 : 0;
            if (ap !== bp) return ap - bp;
            const ao = (a?.combobox_column_order ?? 0);
            const bo = (b?.combobox_column_order ?? 0);
            return ao - bo;
        });
    }, [r]);

    // выбранный элемент — первичный или первый (для запуска по умолчанию, если нужно)
    const initialSelected = useMemo(() => {
        if (!comboItems.length) return '';
        const primary = comboItems.find(it => it?.is_primary);
        const first = primary ?? comboItems[0];
        return String(getComboId(first, 0));
    }, [comboItems]);

    // меню
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const menuOpen = Boolean(menuAnchor);
    useEffect(() => {
        // просто синхронизируемся, если список поменялся
        if (!comboItems.length && menuOpen) setMenuAnchor(null);
    }, [comboItems, menuOpen]);

    const openMenu = (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();
        setMenuAnchor(e.currentTarget);
    };
    const closeMenu = () => setMenuAnchor(null);

    const handlePick = (item: ComboItem) => {
        onOpenComboItem(wcId, tblColId, item);
        closeMenu();
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
                <div
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                    draggable={false}
                    style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                >
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
                                    await callUpdateReference(wcId, tblColId, toFullPatch({...currentRow, readonly: nextVal}));
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
                <div
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                    draggable={false}
                    style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                >
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
                                    await callUpdateReference(wcId, tblColId, toFullPatch({...currentRow, visible: nextVal}));
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

            {/* Combobox — только белая иконка по центру + чёрное меню */}
            <td
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
                style={{ textAlign: 'center' }}
            >
                {comboItems.length ? (
                    <>
                        <IconButton
                            onClick={openMenu}
                            title="Открыть список combobox"
                            sx={{
                                color: '#fff',
                                p: 0.5,
                                '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
                            }}
                        >
                            {/* простая «бургер/меню» иконка белая */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <circle cx="5" cy="12" r="2"></circle>
                                <circle cx="12" cy="12" r="2"></circle>
                                <circle cx="19" cy="12" r="2"></circle>
                            </svg>
                        </IconButton>

                        <Menu
                            anchorEl={menuAnchor}
                            open={menuOpen}
                            onClose={closeMenu}
                            MenuListProps={{
                                dense: true,
                                sx: { bgcolor: '#0f0f0f', color: '#fff' },
                            }}
                            PaperProps={{
                                sx: { bgcolor: '#0f0f0f', color: '#fff', border: '1px solid #444' },
                            }}
                        >
                            {comboItems.map((it, idx) => {
                                const id = getComboId(it, idx);
                                const label = (it.combobox_alias?.trim() || `id:${id}`);
                                const order = (it.combobox_column_order ?? idx);
                                return (
                                    <MenuItem
                                        key={id}
                                        onClick={() => handlePick(it)}
                                        sx={{
                                            color: '#fff',
                                            '&.Mui-selected': { bgcolor: '#1a1a1a' },
                                            '&:hover': { bgcolor: '#141414' },
                                        }}
                                    >
                                        #{order} · {label}{it.is_primary ? ' ★' : ''}
                                        {it.is_show === false ? ' (hidden)' : ''}
                                    </MenuItem>
                                );
                            })}
                        </Menu>
                    </>
                ) : '—'}
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
                    <EditIcon
                        className={s.actionIcon}
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenEdit(wcId, tblColId);
                        }}
                        aria-label="Редактировать поле"
                    />
                    <DeleteIcon
                        className={s.actionIcon}
                        onClick={() => onDelete(wcId, tblColId)}
                        aria-label="Удалить поле из группы"
                    />
                </div>
            </td>
        </tr>
    );
};
