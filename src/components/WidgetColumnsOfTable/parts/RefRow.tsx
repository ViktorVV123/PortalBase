import React, {useMemo, useState} from 'react';
import {Checkbox, Menu, MenuItem, IconButton, Tooltip} from '@mui/material';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import EditIcon from '@/assets/image/EditIcon.svg';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import type {ComboItem, RefItem} from '../types';
import {toFullPatch} from '../ref-helpers';
import {api} from '@/services/api';

export type RefRowProps = {
    wcId: number;
    r: RefItem;
    visibleText: string;
    formText: string;

    onOpenEdit: (wcId: number, tableColumnId: number) => void;
    onDelete: (wcId: number, tableColumnId: number) => void;
    onOpenForm: (wcId: number, tblColId: number, currentVal?: number | null) => void;
    onOpenComboItem: (wcId: number, tblColId: number, item: ComboItem) => void;

    onOpenComboCreate: (
        wcId: number,
        tblColId: number,
        preset?: Partial<{
            combobox_column_id: number | null;
            combobox_width: number;
            combobox_column_order: number;
            combobox_alias: string;
            is_primary: boolean;
            is_show: boolean;
            is_show_hidden: boolean;
        }>
    ) => void;

    // DnD
    getIdxById: (wcId: number, tableColumnId: number) => number;
    onDragStart: (
        srcWcId: number,
        fromIdx: number,
        tableColumnId: number
    ) => (e: React.DragEvent<HTMLTableRowElement>) => void;
    onDragEnd: () => void;
    onDropRow: (dstWcId: number, toIdx: number) => (e: React.DragEvent<HTMLTableRowElement>) => void;

    // локальный стейт + синк
    setLocalRefs: React.Dispatch<React.SetStateAction<Record<number, RefItem[]>>>;
    localRefsRef: React.MutableRefObject<Record<number, RefItem[]>>;
    callUpdateReference: (wcId: number, tblColId: number, patch: any) => Promise<any>;
};

const comboIdOf = (it: any, fallback: number) =>
    it?.combobox_column?.id ?? it?.combobox_column_id ?? it?.id ?? fallback;

export const RefRow: React.FC<RefRowProps> = ({
                                                  wcId,
                                                  r,
                                                  visibleText: _visibleText,
                                                  formText,
                                                  onOpenEdit,
                                                  onDelete,
                                                  onOpenForm,
                                                  onOpenComboItem,
                                                  onOpenComboCreate,
                                                  getIdxById,
                                                  onDragStart,
                                                  onDragEnd,
                                                  onDropRow,
                                                  setLocalRefs,
                                                  localRefsRef,
                                                  callUpdateReference,
                                              }) => {
    const tblCol = r.table_column;
    const tblColId = tblCol?.id as number;
    const type = r.type ?? '—';
    const visible = r.visible ?? true;


    // combobox список
    const comboItems: ComboItem[] = useMemo(() => {
        const raw = Array.isArray((r as any).combobox) ? ((r as any).combobox as ComboItem[]) : [];
        return [...raw].sort((a: any, b: any) => {
            const ap = a?.is_primary ? -1 : 0;
            const bp = b?.is_primary ? -1 : 0;
            if (ap !== bp) return ap - bp;
            return (a?.combobox_column_order ?? 0) - (b?.combobox_column_order ?? 0);
        });
    }, [(r as any).combobox]);

    const hasCombos = comboItems.length > 0;
    const iconFill = hasCombos ? '#f8f8f8' : '#757474';

    // ключ версии — учитывает nested id
    const comboKey = useMemo(() => {
        const raw = Array.isArray((r as any).combobox) ? ((r as any).combobox as ComboItem[]) : [];
        return raw
            .map((it: any, idx: number) => {
                const id = comboIdOf(it, idx);
                return `${id}:${it.combobox_alias ?? ''}:${it.combobox_column_order ?? 0}:${it.is_primary ? 1 : 0}:${it.is_show ? 1 : 0}:${it.is_show_hidden ? 1 : 0}`;
            })
            .join('|');
    }, [(r as any).combobox]);

    // меню
    const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
    const menuOpen = Boolean(menuAnchor);

    const openMenu = (e: React.MouseEvent<HTMLElement>) => {
        e.stopPropagation();
        setMenuAnchor(e.currentTarget);
    };
    const closeMenu = () => setMenuAnchor(null);

    const handlePick = (item: ComboItem) => {
        onOpenComboItem(wcId, tblColId, item);
        closeMenu();
    };

    // Удаление по combobox_column.id
    const deleteComboItem = async (comboId: number) => {
        // оптимистично — убрать из локального стора по nested id
        setLocalRefs(prev => {
            const list = prev[wcId] ?? [];
            const updated = list.map(row => {
                if (row.table_column?.id !== tblColId) return row;
                const orig: any[] = Array.isArray((row as any).combobox) ? (row as any).combobox : [];
                const next = orig.filter(it => comboIdOf(it, -1) !== comboId);

                next
                    .sort((a, b) => (a.combobox_column_order ?? 0) - (b.combobox_column_order ?? 0))
                    .forEach((it, idx) => {
                        it.combobox_column_order = idx;
                    });

                return {...row, combobox: next} as any;
            });
            return {...prev, [wcId]: updated};
        });

        try {
            await api.delete(`/widgets/tables/references/${wcId}/${tblColId}/${comboId}`);
            closeMenu();
        } catch (e) {
            // мягкий откат — вернёмся к снапшоту
            const snapshot = localRefsRef.current;
            setLocalRefs(prev => ({...prev, [wcId]: snapshot[wcId] ?? prev[wcId]}));
            console.warn('[RefRow] DELETE combobox failed:', e);
        }
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
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    draggable={false}
                    style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}
                >
                    <Checkbox
                        size="small"
                        sx={{color: 'common.white', '&.Mui-checked': {color: 'common.white'}}}
                        checked={!!r.readonly}
                        onChange={async (e) => {
                            const nextVal = e.target.checked;
                            setLocalRefs((prev) => ({
                                ...prev,
                                [wcId]: (prev[wcId] ?? []).map((item) =>
                                    item.table_column?.id === tblColId ? {...item, readonly: nextVal} : item
                                ),
                            }));
                            try {
                                const currentRow = (localRefsRef.current[wcId] ?? []).find((x) => x.table_column?.id === tblColId);
                                if (currentRow) {
                                    await callUpdateReference(wcId, tblColId, toFullPatch({
                                        ...currentRow,
                                        readonly: nextVal
                                    }));
                                } else {
                                    await callUpdateReference(wcId, tblColId, {readonly: nextVal});
                                }
                            } catch {
                                setLocalRefs((prev) => ({
                                    ...prev,
                                    [wcId]: (prev[wcId] ?? []).map((item) =>
                                        item.table_column?.id === tblColId ? {...item, readonly: !nextVal} : item
                                    ),
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
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
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
                            setLocalRefs((prev) => ({
                                ...prev,
                                [wcId]: (prev[wcId] ?? []).map((item) =>
                                    item.table_column?.id === tblColId ? {...item, visible: nextVal} : item
                                ),
                            }));
                            try {
                                const currentRow = (localRefsRef.current[wcId] ?? []).find((x) => x.table_column?.id === tblColId);
                                if (currentRow) {
                                    await callUpdateReference(wcId, tblColId, toFullPatch({
                                        ...currentRow,
                                        visible: nextVal
                                    }));
                                } else {
                                    await callUpdateReference(wcId, tblColId, {visible: nextVal});
                                }
                            } catch {
                                setLocalRefs((prev) => ({
                                    ...prev,
                                    [wcId]: (prev[wcId] ?? []).map((item) =>
                                        item.table_column?.id === tblColId ? {...item, visible: !nextVal} : item
                                    ),
                                }));
                            }
                        }}
                    />
                </div>
            </td>

            <td>{r.ref_column_order ?? 0}</td>

            {/* Combobox — меню с редактированием и удалением (по combobox_column.id) */}
            <td
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
                style={{textAlign: 'center'}}
            >
                <>
                    <IconButton
                        onClick={openMenu}
                        title="Открыть список combobox"
                        sx={{color: '#fff', p: 0.5, '&:hover': {backgroundColor: 'rgba(255,255,255,0.08)'}}}
                    >
                        <svg  width="20" height="20" viewBox="0 0 24 24" fill={iconFill} aria-hidden="true">
                            <circle cx="5" cy="12" r="2"></circle>
                            <circle cx="12" cy="12" r="2"></circle>
                            <circle cx="19" cy="12" r="2"></circle>
                        </svg>
                    </IconButton>

                    <Menu
                        key={comboKey}
                        anchorEl={menuAnchor}
                        open={menuOpen}
                        onClose={closeMenu}
                        keepMounted
                        disablePortal
                        MenuListProps={{dense: true, sx: {bgcolor: '#0f0f0f', color: '#fff'}}}
                        PaperProps={{sx: {bgcolor: '#0f0f0f', color: '#fff', border: '1px solid #444'}}}
                    >
                        {/* Создать/Добавить */}
                        <MenuItem
                            onClick={() => {
                                closeMenu();
                                onOpenComboCreate(wcId, tblColId, {
                                    combobox_column_order: comboItems.length,
                                    combobox_width: 1,
                                });
                            }}
                            sx={{color: '#fff', fontWeight: 600}}
                        >
                            {comboItems.length ? 'Добавить…' : 'Создать…'}
                        </MenuItem>

                        {comboItems.length > 0 && (
                            <div style={{height: 1, background: '#333', margin: '4px 8px'}}/>
                        )}

                        {comboItems.map((it, idx) => {
                            const id = comboIdOf(it, idx); // ← nested id
                            const label = (it as any)?.combobox_alias?.trim() || `id:${id}`;

                            return (
                                <MenuItem
                                    key={id}
                                    sx={{
                                        color: '#fff',
                                        '&.Mui-selected': {bgcolor: '#1a1a1a'},
                                        '&:hover': {bgcolor: '#141414'},
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 8,
                                    }}
                                    title={` width:${(it as any)?.combobox_width ?? 1} • id:${id}`}
                                >
                  <span onClick={() => {
                      handlePick(it);
                  }}>
                    {label}
                      {(it as any)?.is_primary}
                      {(it as any)?.is_show === false}
                  </span>

                                    <span onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                    <Tooltip title="Редактировать">
                      <IconButton
                          size="small"
                          sx={{color: '#fff'}}
                          onClick={() => {
                              closeMenu();
                              onOpenComboItem(wcId, tblColId, it);
                          }}
                      >
                        <EditIcon/>
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Удалить">
                      <IconButton
                          size="small"
                          sx={{color: '#fff'}}
                          onClick={async () => {
                              closeMenu();
                              const ok = confirm('Удалить элемент combobox?');
                              if (!ok) return;
                              await deleteComboItem(id); // ← удаляем по combobox_column.id
                          }}
                      >
                        <DeleteIcon/>
                      </IconButton>
                    </Tooltip>
                  </span>
                                </MenuItem>
                            );
                        })}
                    </Menu>
                </>
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
            <td>{r.table_column.id}</td>
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
