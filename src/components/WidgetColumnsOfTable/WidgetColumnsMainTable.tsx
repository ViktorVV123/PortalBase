import React, {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import EditIcon from '@/assets/image/EditIcon.svg';
import {WidgetColumn} from '@/shared/hooks/useWorkSpaces';
import type { DebouncedFunc } from 'lodash';
import debounce from 'lodash/debounce';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Stack, TextField, FormControlLabel, Checkbox, createTheme, ThemeProvider
} from '@mui/material';

type ReferenceItem = WidgetColumn['reference'][number];

const dark = createTheme({
    palette: {mode: 'dark', primary: {main: '#ffffff'}},
    components: {
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffffff' },
                },
            },
        },
        MuiInputLabel: { styleOverrides: { root: { '&.Mui-focused': { color: '#ffffff' } } } },
        MuiSelect: { styleOverrides: { icon: { color: '#ffffff' } } },
    },
});

type WidgetColumnsMainTableProps = {
    widgetColumns: WidgetColumn[];
    referencesMap: Record<number, ReferenceItem[]>;
    handleDeleteReference: (wcId: number, tblColId: number) => void;

    updateWidgetColumn: (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => Promise<void> | void;

    // расширенный патч
    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: Partial<Pick<ReferenceItem, 'ref_column_order' | 'width' | 'type' | 'ref_alias'>>
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
        () =>
            [...widgetColumns].sort(
                (a, b) => (a.column_order ?? 0) - (b.column_order ?? 0) || a.id - b.id
            ),
        [widgetColumns]
    );

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
            const sorted = [...src].sort(
                (a, b) => (a.ref_column_order ?? 0) - (b.ref_column_order ?? 0)
            );
            next[wc.id] = reindex(sorted);
            snap[wc.id] = sorted.map(r => r.table_column.id);
        });

        setLocalRefs(next);
        snapshotRef.current = snap;
    }, [orderedWc, referencesMap, reindex]);

    // стабильный debounce в ref

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
                    const width = refObj?.width ?? 1;
                    try {
                        await addReference(wcId, id, { width, ref_column_order: toIdx });
                    } catch (e) {
                        console.warn('[sync:addReference] wc=', wcId, 'col=', id, e);
                    }
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

    // ── DnD ── (как было)
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

    // ───────── МОДАЛКА ПРАВКИ СТРОКИ ─────────
    type EditState = {
        open: boolean;
        wcId: number | null;
        rowIdx: number | null;
        // WC fields
        wc_alias: string;
        wc_default: string;
        wc_placeholder: string;
        wc_visible: boolean;
        wc_column_order: number;
        // REF fields
        ref_alias: string;
        ref_type: string;
        ref_width: number;
        ref_order: number;
    };
    const [edit, setEdit] = useState<EditState>({
        open: false, wcId: null, rowIdx: null,
        wc_alias: '', wc_default: '', wc_placeholder: '', wc_visible: false, wc_column_order: 0,
        ref_alias: '', ref_type: '', ref_width: 1, ref_order: 0,
    });

    const openEdit = (wc: WidgetColumn, r: ReferenceItem, rowIdx: number) => {
        setEdit({
            open: true, wcId: wc.id, rowIdx,
            wc_alias: wc.alias ?? '',
            wc_default: wc.default ?? '',
            wc_placeholder: wc.placeholder ?? '',
            wc_visible: !!wc.visible,
            wc_column_order: wc.column_order ?? 0,
            ref_alias: r.ref_alias ?? '',
            ref_type: r.type ?? '',
            ref_width: Number(r.width ?? 1),
            ref_order: r.ref_column_order ?? rowIdx,
        });
    };

    const closeEdit = () => setEdit(e => ({ ...e, open: false }));

    const saveEdit = async () => {
        if (edit.wcId == null || edit.rowIdx == null) return;
        const wcId = edit.wcId;
        const current = localRefs[wcId]?.[edit.rowIdx];
        if (!current?.table_column?.id) { closeEdit(); return; }
        const tableColumnId = current.table_column.id;

        // 1) отправляем PATCH-ы параллельно
        await Promise.all([
            updateWidgetColumn(wcId, {
                alias: edit.wc_alias || null,
                default: edit.wc_default || null,
                placeholder: edit.wc_placeholder || null,
                visible: edit.wc_visible,
                column_order: edit.wc_column_order,
            }),
            updateReference(wcId, tableColumnId, {
                ref_alias: edit.ref_alias || null,
                type: edit.ref_type || null,
                width: Number(edit.ref_width) || 1,
                ref_column_order: Number(edit.ref_order) || 0,
            }),
        ]);

        // 2) оптимистично обновляем локальное состояние
        setLocalRefs(prev => {
            const list = [...(prev[wcId] ?? [])];
            // обновляем поля
            list[edit.rowIdx!] = {
                ...list[edit.rowIdx!],
                ref_alias: edit.ref_alias || null,
                type: edit.ref_type || null,
                width: Number(edit.ref_width) || 1,
                ref_column_order: Number(edit.ref_order) || 0,
            };

            let next = list;

            // если ref_order изменили вручную → переставим элемент
            const desiredIdx = Number(edit.ref_order) || 0;
            if (desiredIdx >= 0 && desiredIdx < list.length) {
                const [moved] = list.splice(edit.rowIdx!, 1);
                list.splice(desiredIdx, 0, moved);
                next = list;
            }

            return { ...prev, [wcId]: reindex(next) };
        });

        // (опционально можно подёрнуть refreshReferences(wcId))
        // await refreshReferences?.(wcId);

        closeEdit();
    };

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

                return (
                    <div key={wc.id} style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <h4 style={{ margin: 0 }}>{wc.alias ?? `Колонка #${wc.id}`}</h4>
                            <span style={{ color: 'grey' }}>({wc.column_order ?? 0})</span>
                            <div style={{ display: 'flex', gap: 6, marginLeft: 8, alignItems: 'center' }}>
                                <button title="Переместить вверх" disabled={isFirst}
                                        onClick={() => moveGroup(wc.id, 'up')}
                                        style={{ opacity: isFirst ? 0.4 : 1 }}>↑</button>
                                <button title="Переместить вниз" disabled={isLast}
                                        onClick={() => moveGroup(wc.id, 'down')}
                                        style={{ opacity: isLast ? 0.4 : 1 }}>↓</button>
                                <span>{wc.id}</span>
                                <DeleteIcon className={s.actionIcon} onClick={() => deleteColumnWidget(wc.id)} />
                            </div>
                        </div>

                        <table className={s.tbl} style={{ marginTop: 8 }}>
                            <thead>
                            <tr>
                                <th style={{ width: 28 }} />
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
                                            style={{ cursor: 'move' }}
                                        >
                                            <td style={{ textAlign: 'center', opacity: 0.6 }}>⋮⋮</td>
                                            <td>{tblCol?.name ?? '—'}</td>
                                            <td>{r.ref_alias ?? '—'}</td>
                                            <td>{type}</td>
                                            <td>{r.width ?? '—'}</td>
                                            <td>{orderedWc.find((w) => w.id === wc.id)?.default ?? '—'}</td>
                                            <td>{orderedWc.find((w) => w.id === wc.id)?.placeholder ?? '—'}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                {orderedWc.find((w) => w.id === wc.id)?.visible ? '✔︎' : ''}
                                            </td>
                                            <td>{r.ref_column_order ?? rowIdx}</td>
                                            <td>
                                                {tblCol?.id ? (
                                                    <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:10}}>
                                                        <EditIcon className={s.actionIcon}
                                                                  onClick={() => openEdit(wc, r, rowIdx)} />
                                                        <DeleteIcon className={s.actionIcon}
                                                                    onClick={() => handleDeleteReference(wc.id, tblCol.id!)} />
                                                    </div>
                                                ) : null}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'center', opacity: 0.7 }}>
                                        Нет связей — перетащите сюда строку из другого блока
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                );
            })}

            {/* ── Диалог правки строки ── */}
        <ThemeProvider theme={dark}>
            <Dialog open={edit.open} onClose={closeEdit} fullWidth maxWidth="sm">
                <DialogTitle>Правка столбца/связи</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        {/* WidgetColumn (group) */}
                        <TextField label="Alias (WC)" size="small"
                                   value={edit.wc_alias}
                                   onChange={e => setEdit(v => ({...v, wc_alias: e.target.value}))}/>
                        <TextField label="Default (WC)" size="small"
                                   value={edit.wc_default}
                                   onChange={e => setEdit(v => ({...v, wc_default: e.target.value}))}/>
                        <TextField label="Placeholder (WC)" size="small"
                                   value={edit.wc_placeholder}
                                   onChange={e => setEdit(v => ({...v, wc_placeholder: e.target.value}))}/>
                        <FormControlLabel control={
                            <Checkbox checked={edit.wc_visible}
                                      onChange={e => setEdit(v => ({...v, wc_visible: e.target.checked}))}/>
                        } label="Visible (WC)"/>
                        <TextField type="number" label="column_order (WC)" size="small"
                                   value={edit.wc_column_order}
                                   onChange={e => setEdit(v => ({...v, wc_column_order: Number(e.target.value)}))}/>

                        {/* Reference (row) */}
                        <TextField label="ref_alias (REF)" size="small"
                                   value={edit.ref_alias}
                                   onChange={e => setEdit(v => ({...v, ref_alias: e.target.value}))}/>
                        <TextField label="type (REF)" size="small"
                                   value={edit.ref_type}
                                   onChange={e => setEdit(v => ({...v, ref_type: e.target.value}))}/>
                        <TextField type="number" label="width (REF)" size="small"
                                   value={edit.ref_width}
                                   onChange={e => setEdit(v => ({...v, ref_width: Number(e.target.value)}))}/>

                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeEdit}>Отмена</Button>
                    <Button variant="contained" onClick={saveEdit}>Сохранить</Button>
                </DialogActions>
            </Dialog>
        </ThemeProvider>
        </div>
    );
};
