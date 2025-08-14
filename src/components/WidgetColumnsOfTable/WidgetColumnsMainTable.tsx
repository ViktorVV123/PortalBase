import React, {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import {WidgetColumn} from '@/shared/hooks/useWorkSpaces';
import debounce from 'lodash/debounce';

type ReferenceItem = WidgetColumn['reference'][number];

type WidgetColumnsMainTableProps = {
    widgetColumns: WidgetColumn[];
    referencesMap: Record<number, ReferenceItem[]>;
    handleDeleteReference: (wcId: number, tblColId: number) => void;

    updateWidgetColumn: (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => Promise<void> | void;

    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: Partial<Pick<ReferenceItem, 'ref_column_order' | 'width'>>
    ) => Promise<ReferenceItem>;

    addReference: (
        widgetColId: number,
        tblColId: number,
        payload: { width: number; ref_column_order: number }
    ) => Promise<void>;

    refreshReferences?: (wcId: number) => Promise<void> | void;
    onRefsChange?: (refsMap: Record<number, ReferenceItem[]>) => void;
};

export const WidgetColumnsMainTable: React.FC<WidgetColumnsMainTableProps> = ({
                                                                                  widgetColumns,
                                                                                  referencesMap,
                                                                                  handleDeleteReference,
                                                                                  updateWidgetColumn,
                                                                                  updateReference,
                                                                                  addReference,
                                                                                  refreshReferences,
                                                                                  onRefsChange
                                                                              }) => {
    // группы в порядке column_order
    const orderedWc = useMemo(
        () =>
            [...widgetColumns].sort(
                (a, b) => (a.column_order ?? 0) - (b.column_order ?? 0) || a.id - b.id
            ),
        [widgetColumns]
    );

    /** локальная истина по ссылкам */
    const [localRefs, setLocalRefs] = useState<Record<number, ReferenceItem[]>>({});
    const localRefsRef = useRef<Record<number, ReferenceItem[]>>({});
    useEffect(() => {
        onRefsChange?.(localRefs);
        localRefsRef.current = localRefs;
    }, [localRefs, onRefsChange]);

    /** снапшот подтверждённого сервером порядка (по id) */
    const snapshotRef = useRef<Record<number, number[]>>({});

    /** утилита: проставить корректный ref_column_order по текущему порядку */
    const reindex = useCallback((arr: ReferenceItem[]) => {
        return arr.map((r, idx) => ({ ...r, ref_column_order: idx }));
    }, []);

    /** первичная инициализация localRefs + snapshot */
    useEffect(() => {
        const next: Record<number, ReferenceItem[]> = {};
        const snap: Record<number, number[]> = {};

        orderedWc.forEach((wc) => {
            const hasKey = Object.prototype.hasOwnProperty.call(referencesMap, wc.id);
            const src = hasKey ? (referencesMap[wc.id] ?? []) : (wc.reference ?? []);
            const sorted = [...src].sort(
                (a, b) => (a.ref_column_order ?? 0) - (b.ref_column_order ?? 0)
            );
            next[wc.id] = reindex(sorted);                 // ← локально нормализуем
            snap[wc.id] = sorted.map(r => r.table_column.id);
        });

        setLocalRefs(next);
        snapshotRef.current = snap;
    }, [orderedWc, referencesMap, reindex]);


    /** стабильный дебаунс, живёт в ref, читает только .current */
        // @ts-ignore
    const queueSyncRef = useRef<ReturnType<typeof debounce>>();
    if (!queueSyncRef.current) {
        queueSyncRef.current = debounce(async () => {
            const state = localRefsRef.current;
            const snapshot = snapshotRef.current;

            // console.debug('[sync] state', state, 'snapshot', snapshot);

            // 1) cross‑add
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                const nextOrder = (state[wcId] ?? []).map(r => r.table_column.id);
                const prevOrder = snapshot[wcId] ?? [];

                const addedIds = nextOrder.filter(id => !prevOrder.includes(id));
                for (const id of addedIds) {
                    const toIdx = nextOrder.indexOf(id);
                    const refObj = (state[wcId] ?? [])[toIdx];
                    const width = refObj?.width ?? 1;
                    // console.debug('[sync:add]', { wcId, id, toIdx, width });
                    try {
                        await addReference(wcId, id, { width, ref_column_order: toIdx });
                    } catch (e) {
                        console.warn('[sync:addReference] wc=', wcId, 'col=', id, e);
                    }
                }
            }

            // 2) reorder внутри — только общие id
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                const nextOrder = (state[wcId] ?? []).map(r => r.table_column.id);
                const prevOrder = snapshot[wcId] ?? [];
                const commonIds = nextOrder.filter(id => prevOrder.includes(id));

                for (const id of commonIds) {
                    const newIdx = nextOrder.indexOf(id);
                    const oldIdx = prevOrder.indexOf(id);
                    if (newIdx !== oldIdx) {
                        // console.debug('[sync:patch]', { wcId, id, newIdx });
                        try {
                            await updateReference(wcId, id, { ref_column_order: newIdx });
                        } catch (e) {
                            console.warn('[sync:updateReference] wc=', wcId, 'col=', id, e);
                        }
                    }
                }
            }

            // 3) обновляем снапшот
            const nextSnap: Record<number, number[]> = {};
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                nextSnap[wcId] = (state[wcId] ?? []).map(r => r.table_column.id);
            }
            snapshotRef.current = nextSnap;

            // по желанию подтянуть с сервера:
            // await Promise.all(Object.keys(state).map(id => refreshReferences?.(Number(id))));
        }, 250);
    }

    useEffect(() => {
        const q = queueSyncRef.current!;
        return () => q.cancel(); // на размонтировании
    }, []);

    // ───────── перемещение групп (WC) ─────────
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

    // ───────── DnD ─────────
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
            // отправляем немедленно
            try { queueSyncRef.current!.flush(); } catch {}
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
        // отправляем немедленно
        try { queueSyncRef.current!.flush(); } catch {}
    };

    // ───────── перестановки ─────────
    // внутри группы
    const reorderInside = async (wcId: number, fromIdx: number, toIdx: number) => {
        setLocalRefs(prev => {
            const src = prev[wcId] ?? [];
            const next = [...src];
            const [rm] = next.splice(fromIdx, 1);
            next.splice(toIdx, 0, rm);
            return { ...prev, [wcId]: reindex(next) };  // ← сразу обновили ref_column_order
        });
        queueSyncRef.current!();
    };

    // между группами
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
        queueSyncRef.current!();
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
                            <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                                <button
                                    title="Переместить вверх"
                                    disabled={isFirst}
                                    onClick={() => moveGroup(wc.id, 'up')}
                                    style={{ opacity: isFirst ? 0.4 : 1 }}
                                >
                                    ↑
                                </button>
                                <button
                                    title="Переместить вниз"
                                    disabled={isLast}
                                    onClick={() => moveGroup(wc.id, 'down')}
                                    style={{ opacity: isLast ? 0.4 : 1 }}
                                >
                                    ↓
                                </button>
                                <span>{wc.id}</span>
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
                                                    <DeleteIcon
                                                        className={s.actionIcon}
                                                        onClick={() => handleDeleteReference(wc.id, tblCol.id!)}
                                                    />
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
        </div>
    );
};
