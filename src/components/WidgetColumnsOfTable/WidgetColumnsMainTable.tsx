import React, {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import EditIcon from '@/assets/image/EditIcon.svg';
import {WidgetColumn} from '@/shared/hooks/useWorkSpaces';
import type { DebouncedFunc } from 'lodash';
import debounce from 'lodash/debounce';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Stack, TextField, FormControlLabel, Checkbox,
    createTheme, ThemeProvider
} from '@mui/material';

type ReferenceItem = WidgetColumn['reference'][number];

const dark = createTheme({
    palette: {mode: 'dark', primary: {main: '#ffffff'}},
    components: {
        MuiOutlinedInput: { styleOverrides: { root: { '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffffff' } } } },
        MuiInputLabel: { styleOverrides: { root: { '&.Mui-focused': { color: '#ffffff' } } } },
        MuiSelect: { styleOverrides: { icon: { color: '#ffffff' } } },
    },
});

type WidgetColumnsMainTableProps = {
    widgetColumns: WidgetColumn[];
    referencesMap: Record<number, ReferenceItem[]>;
    handleDeleteReference: (wcId: number, tblColId: number) => void;

    // (оставляем для перемещения групп ↑/↓, это меняет column_order у WC)
    updateWidgetColumn: (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => Promise<void> | void;

    // PATCH только по reference
    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: Partial<Pick<ReferenceItem,
            'ref_column_order' | 'width' | 'type' | 'ref_alias' | 'default' | 'placeholder' | 'visible'
        >>
    ) => Promise<ReferenceItem>;

    addReference: (
        widgetColId: number,
        tblColId: number,
        payload: { width: number; ref_column_order: number }
    ) => Promise<void>;

    refreshReferences?: (wcId: number) => Promise<void> | void;
    onRefsChange?: (refsMap: Record<number, ReferenceItem[]>) => void;
    deleteColumnWidget: (id: number) => void;
};

export const WidgetColumnsMainTable: React.FC<WidgetColumnsMainTableProps> = ({
                                                                                  widgetColumns,
                                                                                  referencesMap,
                                                                                  handleDeleteReference,
                                                                                  updateWidgetColumn,
                                                                                  updateReference,
                                                                                  addReference,
                                                                                  refreshReferences,
                                                                                  onRefsChange,
                                                                                  deleteColumnWidget
                                                                              }) => {
    const orderedWc = useMemo(
        () => [...widgetColumns].sort((a, b) => (a.column_order ?? 0) - (b.column_order ?? 0) || a.id - b.id),
        [widgetColumns]
    );


    const [aliasOverrides, setAliasOverrides] = useState<Record<number, string | null>>({});

    const [aliasDlg, setAliasDlg] = useState<{ open: boolean; wcId: number | null; value: string }>({
        open: false, wcId: null, value: '',
    });

    const openAliasDialog = (wc: WidgetColumn) => {
        setAliasDlg({ open: true, wcId: wc.id, value: wc.alias ?? '' });
    };

    const closeAliasDialog = () => setAliasDlg(a => ({ ...a, open: false }));

    const saveAlias = async () => {
        if (aliasDlg.wcId == null) return;
        const val = aliasDlg.value.trim();
        await updateWidgetColumn(aliasDlg.wcId, { alias: val || null });
        // локально обновим, чтобы UI сразу показал новое значение
        setAliasOverrides(prev => ({ ...prev, [aliasDlg.wcId!]: val || null }));
        closeAliasDialog();
    };

    const [localRefs, setLocalRefs] = useState<Record<number, ReferenceItem[]>>({});
    const localRefsRef = useRef<Record<number, ReferenceItem[]>>({});
    useEffect(() => {
        onRefsChange?.(localRefs);
        localRefsRef.current = localRefs;
    }, [localRefs, onRefsChange]);

    const snapshotRef = useRef<Record<number, number[]>>({});

    const reindex = useCallback((arr: ReferenceItem[]) => {
        return arr.map((r, idx) => ({ ...r, ref_column_order: idx }));
    }, []);

    useEffect(() => {
        const next: Record<number, ReferenceItem[]> = {};
        const snap: Record<number, number[]> = {};

        orderedWc.forEach((wc) => {
            const hasKey = Object.prototype.hasOwnProperty.call(referencesMap, wc.id);
            const src = hasKey ? (referencesMap[wc.id] ?? []) : (wc.reference ?? []);
            const sorted = [...src].sort((a, b) => (a.ref_column_order ?? 0) - (b.ref_column_order ?? 0));
            next[wc.id] = reindex(sorted);
            snap[wc.id] = sorted.map(r => r.table_column.id);
        });

        setLocalRefs(next);
        snapshotRef.current = snap;
    }, [orderedWc, referencesMap, reindex]);

    // устойчивый debounce
    const queueSyncRef = useRef<DebouncedFunc<() => Promise<void>> | null>(null);
    if (!queueSyncRef.current) {
        queueSyncRef.current = debounce(async () => {
            const state = localRefsRef.current;
            const snapshot = snapshotRef.current;

            // 1) add new
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                const nextOrder = (state[wcId] ?? []).map(r => r.table_column.id);
                const prevOrder = snapshot[wcId] ?? [];

                const addedIds = nextOrder.filter(id => !prevOrder.includes(id));
                for (const id of addedIds) {
                    const toIdx = nextOrder.indexOf(id);
                    const refObj = (state[wcId] ?? [])[toIdx];

                    // создаём запись
                    await addReference(wcId, id, {
                        width: refObj?.width ?? 1,
                        ref_column_order: toIdx,
                    });

                    // сразу восстанавливаем все мета-поля, чтобы бэк не оставил null
                    await updateReference(wcId, id, {
                        ref_alias: refObj?.ref_alias ?? null,
                        type: refObj?.type ?? null,
                        default: refObj?.default ?? null,
                        placeholder: refObj?.placeholder ?? null,
                        visible: refObj?.visible !== false,
                        width: refObj?.width ?? 1,
                        ref_column_order: toIdx,
                    });
                }
            }

            // 2) reorder common
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                const nextOrder = (state[wcId] ?? []).map(r => r.table_column.id);
                const prevOrder = snapshot[wcId] ?? [];
                const commonIds = nextOrder.filter(id => prevOrder.includes(id));
                for (const id of commonIds) {
                    const newIdx = nextOrder.indexOf(id);
                    const oldIdx = prevOrder.indexOf(id);
                    if (newIdx !== oldIdx) {
                        try {
                            await updateReference(wcId, id, { ref_column_order: newIdx });
                        } catch (e) {
                            console.warn('[sync:updateReference] wc=', wcId, 'col=', id, e);
                        }
                    }
                }
            }

            // 3) refresh snapshot
            const nextSnap: Record<number, number[]> = {};
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                nextSnap[wcId] = (state[wcId] ?? []).map(r => r.table_column.id);
            }
            snapshotRef.current = nextSnap;
        }, 250);
    }

    useEffect(() => () => queueSyncRef.current?.cancel(), []);

    // ── DnD ──
    type DragData = { srcWcId: number; fromIdx: number; tableColumnId: number };
    const [drag, setDrag] = useState<DragData | null>(null);

    const onDragStart =
        (srcWcId: number, fromIdx: number, tableColumnId: number) =>
            (e: React.DragEvent) => {
                const payload: DragData = { srcWcId, fromIdx, tableColumnId };
                e.dataTransfer.setData('application/json', JSON.stringify(payload));
                e.dataTransfer.effectAllowed = 'move';
                setDrag(payload);
            };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
    };

    const onDropRow = (dstWcId: number, toIdx: number) => async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        let data = drag;
        try {
            if (!data) {
                const raw = e.dataTransfer.getData('application/json');
                if (raw) data = JSON.parse(raw);
            }
        } catch {}
        if (!data) return;
        try {
            await applyCrossReorder(data, { dstWcId, toIdx });
        } finally {
            try { e.dataTransfer.clearData(); } catch {}
            setDrag(null);
            queueSyncRef.current?.flush();
        }
    };

    const onDropTbodyEnd = (dstWcId: number) => async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        let data: DragData | null = drag;
        try {
            if (!data) {
                const raw = e.dataTransfer.getData('application/json');
                if (raw) data = JSON.parse(raw);
            }
        } catch {}
        if (!data) return;
        const toIdx = localRefs[dstWcId]?.length ?? 0;
        await applyCrossReorder(data, { dstWcId, toIdx });
        try { e.dataTransfer.clearData(); } catch {}
        setDrag(null);
        queueSyncRef.current?.flush();
    };

    const reorderInside = async (wcId: number, fromIdx: number, toIdx: number) => {
        setLocalRefs(prev => {
            const src = prev[wcId] ?? [];
            const next = [...src];
            const [rm] = next.splice(fromIdx, 1);
            next.splice(toIdx, 0, rm);
            return { ...prev, [wcId]: reindex(next) };
        });
        queueSyncRef.current?.();
    };

    const moveAcross = async (srcWcId: number, fromIdx: number, dstWcId: number, toIdx: number) => {
        setLocalRefs(prev => {
            const src = prev[srcWcId] ?? [];
            const dst = prev[dstWcId] ?? [];
            const moved = src[fromIdx];
            if (!moved) return prev;
            if (dst.some(r => r.table_column.id === moved.table_column.id)) return prev;
            const nextSrc = [...src]; nextSrc.splice(fromIdx, 1);
            const nextDst = [...dst]; nextDst.splice(toIdx, 0, moved);
            return {
                ...prev,
                [srcWcId]: reindex(nextSrc),
                [dstWcId]: reindex(nextDst),
            };
        });
        queueSyncRef.current?.();
    };

    const applyCrossReorder = async (d: DragData, target: { dstWcId: number; toIdx: number }) => {
        const { srcWcId, fromIdx } = d;
        const { dstWcId, toIdx } = target;
        if (srcWcId === dstWcId) {
            await reorderInside(srcWcId, fromIdx, toIdx);
        } else {
            await moveAcross(srcWcId, fromIdx, dstWcId, toIdx);
        }
    };

    // ───────── МОДАЛКА ПРАВКИ СТРОКИ (только reference) ─────────
    type EditState = {
        open: boolean;
        wcId: number | null;
        rowIdx: number | null;
        ref_alias: string;
        ref_type: string;
        ref_width: number;
        ref_order: number;
        ref_default: string;
        ref_placeholder: string;
        ref_visible: boolean;
    };
    const [edit, setEdit] = useState<EditState>({
        open: false, wcId: null, rowIdx: null,
        ref_alias: '', ref_type: '', ref_width: 1, ref_order: 0,
        ref_default: '', ref_placeholder: '', ref_visible: true,
    });

    const openEdit = (wc: WidgetColumn, r: ReferenceItem, rowIdx: number) => {
        setEdit({
            open: true, wcId: wc.id, rowIdx,
            ref_alias: r.ref_alias ?? '',
            ref_type: r.type ?? '',
            ref_width: Number(r.width ?? 1),
            ref_order: r.ref_column_order ?? rowIdx,
            ref_default: r.default ?? '',
            ref_placeholder: r.placeholder ?? '',
            ref_visible: r.visible !== false,
        });
    };

    const closeEdit = () => setEdit(e => ({ ...e, open: false }));

    const saveEdit = async () => {
        if (edit.wcId == null || edit.rowIdx == null) return;
        const wcId = edit.wcId;
        const current = localRefs[wcId]?.[edit.rowIdx];
        if (!current?.table_column?.id) { closeEdit(); return; }
        const tableColumnId = current.table_column.id;

        await updateReference(wcId, tableColumnId, {
            ref_alias: edit.ref_alias || null,
            type: edit.ref_type || null,
            width: Number(edit.ref_width) || 1,
            ref_column_order: Number(edit.ref_order) || 0,
            default: edit.ref_default || null,
            placeholder: edit.ref_placeholder || null,
            visible: !!edit.ref_visible,
        });

        // оптимистично обновляем локальное состояние
        setLocalRefs(prev => {
            const list = [...(prev[wcId] ?? [])];
            list[edit.rowIdx!] = {
                ...list[edit.rowIdx!],
                ref_alias: edit.ref_alias || null,
                type: edit.ref_type || null,
                width: Number(edit.ref_width) || 1,
                ref_column_order: Number(edit.ref_order) || 0,
                default: edit.ref_default || null,
                placeholder: edit.ref_placeholder || null,
                visible: !!edit.ref_visible,
            };

            let next = list;
            const desiredIdx = Number(edit.ref_order) || 0;
            if (desiredIdx >= 0 && desiredIdx < list.length) {
                const [moved] = list.splice(edit.rowIdx!, 1);
                list.splice(desiredIdx, 0, moved);
                next = list;
            }

            return { ...prev, [wcId]: reindex(next) };
        });

        // опционально: await refreshReferences?.(wcId);
        closeEdit();
    };

    // перемещение ГРУПП (WC) — оставляем (меняет column_order у WidgetColumn)
    const moveGroup = async (wcId: number, dir: 'up' | 'down') => {
        const list = orderedWc;
        const i = list.findIndex((w) => w.id === wcId);
        if (i < 0) return;
        const j = dir === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return;
        const A = list[i], B = list[j];
        await Promise.all([
            updateWidgetColumn(A.id, { column_order: B.column_order ?? 0 }),
            updateWidgetColumn(B.id, { column_order: A.column_order ?? 0 }),
        ]);
    };

    return (
        <div>
            <h3 style={{ margin: '24px 0 8px' }}>References</h3>

            {orderedWc.map((wc, idx) => {
                const refs = localRefs[wc.id] ?? [];
                const isFirst = idx === 0;
                const isLast = idx === orderedWc.length - 1;
                const displayAlias = aliasOverrides[wc.id] ?? wc.alias;

                return (
                    <div key={wc.id} style={{marginBottom: 24}}>
                        <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                            <h4 style={{margin: 0}}>{displayAlias ?? `Колонка #${wc.id}`}</h4>
                            <span style={{color: 'grey'}}>({wc.column_order ?? 0})</span>
                            <div style={{display: 'flex', gap: 6, marginLeft: 8, alignItems: 'center'}}>
                                <button title="Переместить вверх" disabled={isFirst}
                                        onClick={() => moveGroup(wc.id, 'up')}
                                        style={{opacity: isFirst ? 0.4 : 1}}>↑
                                </button>
                                <button title="Переместить вниз" disabled={isLast}
                                        onClick={() => moveGroup(wc.id, 'down')}
                                        style={{opacity: isLast ? 0.4 : 1}}>↓
                                </button>

                                {/* ← редактирование alias */}
                                <EditIcon className={s.actionIcon} onClick={() => openAliasDialog(wc)}/>

                                <DeleteIcon className={s.actionIcon} onClick={() => deleteColumnWidget(wc.id)}/>
                            </div>
                        </div>

                        <table className={s.tbl} style={{marginTop: 8}}>
                            <thead>
                            <tr>
                                <th style={{width: 28}}/>
                                <th>name</th>
                                <th>ref_alias</th>
                                <th>type</th>
                                <th>width</th>
                                <th>default</th>
                                <th>placeholder</th>
                                <th>visible</th>
                                <th>ref_column_order</th>
                                <th></th>
                            </tr>
                            </thead>

                            <tbody onDragOver={onDragOver} onDrop={onDropTbodyEnd(wc.id)}>
                            {refs.length > 0 ? (
                                refs.map((r, rowIdx) => {
                                    const tblCol = r.table_column;
                                    const tblColId = tblCol?.id;
                                    const type = r.type ?? tblCol?.datatype ?? '—';
                                    const rowKey = tblColId != null ? `${wc.id}-${tblColId}` : `${wc.id}-idx-${rowIdx}`;
                                    return (
                                        <tr
                                            key={rowKey}
                                            draggable
                                            onDragStart={onDragStart(wc.id, rowIdx, tblCol?.id ?? -1)}
                                            onDrop={onDropRow(wc.id, rowIdx)}
                                            style={{cursor: 'move'}}
                                        >
                                            <td style={{textAlign: 'center', opacity: 0.6}}>⋮⋮</td>
                                            <td>{tblCol?.name ?? '—'}</td>
                                            <td>{r.ref_alias ?? '—'}</td>
                                            <td>{type}</td>
                                            <td>{r.width ?? '—'}</td>
                                            <td>{r.default ?? '—'}</td>
                                            <td>{r.placeholder ?? '—'}</td>
                                            <td style={{textAlign: 'center'}}>{r.visible ? '✔︎' : ''}</td>
                                            <td>{r.ref_column_order ?? rowIdx}</td>
                                            <td>
                                                {tblCol?.id ? (
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: 10
                                                    }}>
                                                        <EditIcon className={s.actionIcon}
                                                                  onClick={() => openEdit(wc, r, rowIdx)}/>
                                                        <DeleteIcon className={s.actionIcon}
                                                                    onClick={() => handleDeleteReference(wc.id, tblCol.id!)}/>
                                                    </div>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} style={{textAlign: 'center', opacity: 0.7}}>
                                        Нет связей — перетащите сюда строку из другого блока
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                );
            })}

            {/* Диалог правки (только reference) */}
            <ThemeProvider theme={dark}>
                <Dialog open={edit.open} onClose={closeEdit} fullWidth maxWidth="sm">
                    <DialogTitle>Правка reference</DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={2}>
                            <TextField label="ref_alias" size="small"
                                       value={edit.ref_alias}
                                       onChange={e => setEdit(v => ({...v, ref_alias: e.target.value}))}/>
                            <TextField label="type" size="small"
                                       value={edit.ref_type}
                                       onChange={e => setEdit(v => ({...v, ref_type: e.target.value}))}/>
                            <TextField type="number" label="width" size="small"
                                       value={edit.ref_width}
                                       onChange={e => setEdit(v => ({...v, ref_width: Number(e.target.value)}))}/>
                            <TextField label="default" size="small"
                                       value={edit.ref_default}
                                       onChange={e => setEdit(v => ({...v, ref_default: e.target.value}))}/>
                            <TextField label="placeholder" size="small"
                                       value={edit.ref_placeholder}
                                       onChange={e => setEdit(v => ({...v, ref_placeholder: e.target.value}))}/>
                            <FormControlLabel control={
                                <Checkbox checked={edit.ref_visible}
                                          onChange={e => setEdit(v => ({...v, ref_visible: e.target.checked}))}/>
                            } label="visible"/>
                            <TextField type="number" label="ref_column_order" size="small"
                                       value={edit.ref_order}
                                       onChange={e => setEdit(v => ({...v, ref_order: Number(e.target.value)}))}/>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeEdit}>Отмена</Button>
                        <Button variant="contained" onClick={saveEdit}>Сохранить</Button>
                    </DialogActions>
                </Dialog>
            </ThemeProvider>

            <ThemeProvider theme={dark}>
            <Dialog open={aliasDlg.open} onClose={closeAliasDialog} fullWidth maxWidth="xs">
                <DialogTitle>Изменить alias</DialogTitle>
                <DialogContent dividers>
                    <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        label="Alias"
                        value={aliasDlg.value}
                        onChange={e => setAliasDlg(v => ({ ...v, value: e.target.value }))}
                        placeholder="Пусто = сбросить alias"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeAliasDialog}>Отмена</Button>
                    <Button onClick={saveAlias} variant="contained">Сохранить</Button>
                </DialogActions>
            </Dialog>
            </ThemeProvider>


        </div>
    );
};
