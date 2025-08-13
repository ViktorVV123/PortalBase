import React, {useEffect, useMemo, useState} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import {WidgetColumn} from '@/shared/hooks/useWorkSpaces';

type ReferenceItem = WidgetColumn['reference'][number];

type WidgetColumnsMainTableProps = {
    widgetColumns: WidgetColumn[];
    referencesMap: Record<number, ReferenceItem[]>;
    handleDeleteReference: (wcId: number, tblColId: number) => void;

    updateWidgetColumn: (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => Promise<void> | void;

    // PATCH /widgets/tables/references/{widgetColumnId}/{tableColumnId}
    // меняем только ref_column_order (и при желании width)
    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: Partial<Pick<ReferenceItem, 'ref_column_order' | 'width'>>
    ) => Promise<ReferenceItem>;

    // POST /widgets/tables/references/{widgetColId}/{tblColId}
    // для кросс-переноса добавляем связь с width и ref_column_order
    addReference: (
        widgetColId: number,
        tblColId: number,
        payload: { width: number; ref_column_order: number }
    ) => Promise<void>;

    // Притянуть свежие reference для wc (если нужно)
    refreshReferences?: (wcId: number) => Promise<void> | void;
};

export const WidgetColumnsMainTable: React.FC<WidgetColumnsMainTableProps> = ({
                                                                                  widgetColumns,
                                                                                  referencesMap,
                                                                                  handleDeleteReference,
                                                                                  updateWidgetColumn,
                                                                                  updateReference,
                                                                                  addReference,
                                                                                  refreshReferences,
                                                                              }) => {
    // показываем группы в порядке column_order
    const orderedWc = useMemo(
        () =>
            [...widgetColumns].sort(
                (a, b) => (a.column_order ?? 0) - (b.column_order ?? 0) || a.id - b.id
            ),
        [widgetColumns]
    );

    // локальная копия reference для мгновенного отклика UI
    const [localRefs, setLocalRefs] = useState<Record<number, ReferenceItem[]>>({});

    useEffect(() => {
        const next: Record<number, ReferenceItem[]> = {};
        orderedWc.forEach((wc) => {
            // важно: используем referencesMap, если ключ уже есть (даже если это [])
            const hasKey = Object.prototype.hasOwnProperty.call(referencesMap, wc.id);
            const src = hasKey ? (referencesMap[wc.id] ?? []) : (wc.reference ?? []);
            next[wc.id] = [...src].sort(
                (a, b) => (a.ref_column_order ?? 0) - (b.ref_column_order ?? 0)
            );
        });
        setLocalRefs(next);
    }, [orderedWc, referencesMap]);


    // перемещение групп ↑/↓
    const moveGroup = async (wcId: number, dir: 'up' | 'down') => {
        const list = orderedWc;
        const i = list.findIndex((w) => w.id === wcId);
        if (i < 0) return;
        const j = dir === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return;
        const A = list[i],
            B = list[j];
        await Promise.all([
            updateWidgetColumn(A.id, {column_order: B.column_order ?? 0}),
            updateWidgetColumn(B.id, {column_order: A.column_order ?? 0}),
        ]);
    };

    // ─── DnD ───
    type DragData = { srcWcId: number; fromIdx: number; tableColumnId: number };
    const [drag, setDrag] = useState<DragData | null>(null);

    const onDragStart =
        (srcWcId: number, fromIdx: number, tableColumnId: number) =>
            (e: React.DragEvent) => {
                const payload: DragData = {srcWcId, fromIdx, tableColumnId};
                e.dataTransfer.setData('application/json', JSON.stringify(payload));
                e.dataTransfer.effectAllowed = 'move';
                setDrag(payload);
            };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    // drop на строку (вставить ПЕРЕД этой строкой)
    const onDropRow = (dstWcId: number, toIdx: number) => async (e: React.DragEvent) => {
        e.preventDefault();
        let data = drag;
        try {
            if (!data) {
                const raw = e.dataTransfer.getData('application/json');
                if (raw) data = JSON.parse(raw);
            }
        } catch {
        }
        if (!data) return;
        try {
            await applyCrossReorder(data, {dstWcId, toIdx});
        } catch (err) {
            console.warn('DnD row failed', err);
        } finally {
            setDrag(null);
        }
    };

    // drop на пустую таблицу / в конец
    const onDropTbodyEnd =
        (dstWcId: number) => async (e: React.DragEvent) => {
            e.preventDefault();
            let data: DragData | null = drag;
            try {
                if (!data) {
                    const raw = e.dataTransfer.getData('application/json');
                    if (raw) data = JSON.parse(raw);
                }
            } catch {
            }
            if (!data) return;

            const toIdx = localRefs[dstWcId]?.length ?? 0;
            await applyCrossReorder(data, {dstWcId, toIdx});
            setDrag(null);
        };

    // внутри одной группы: переупорядочиваем и PATCH-им ТОЛЬКО ref_column_order
    // было: const patches = ...; await Promise.all(patches.map(...))

    const reorderInside = async (wcId: number, fromIdx: number, toIdx: number) => {
        const src = localRefs[wcId] ?? [];
        const next = [...src];
        const [rm] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, rm);
        setLocalRefs(prev => ({...prev, [wcId]: next}));

        // последовательно, только тем кто реально сдвинулся
        for (let idx = 0; idx < next.length; idx += 1) {
            const r = next[idx];
            if ((r.ref_column_order ?? 0) !== idx) {
                await updateReference(wcId, r.table_column.id, {ref_column_order: idx});
            }
        }
        await refreshReferences?.(wcId);
    };


    // между группами: создаём связь в целевой группе и обновляем оба списка
    const moveAcross = async (srcWcId: number, fromIdx: number, dstWcId: number, toIdx: number) => {
        const src = localRefs[srcWcId] ?? [];
        const dst = localRefs[dstWcId] ?? [];
        const moved = src[fromIdx];
        if (!moved || !moved.table_column?.id) return;
        if (dst.some(r => r.table_column.id === moved.table_column.id)) return;

        // оптимистичный UI
        const nextSrc = [...src];
        nextSrc.splice(fromIdx, 1);
        const nextDst = [...dst];
        nextDst.splice(toIdx, 0, moved);
        setLocalRefs(prev => ({...prev, [srcWcId]: nextSrc, [dstWcId]: nextDst}));

        try {
            await addReference(dstWcId, moved.table_column.id, {
                width: moved.width ?? 1,
                ref_column_order: toIdx,
            });

            // сервер сам удалит в источнике и переиндексирует
            await Promise.all([refreshReferences?.(srcWcId), refreshReferences?.(dstWcId)]);
        } catch (e) {
            // откат UI, если не вышло
            setLocalRefs(prev => ({...prev, [srcWcId]: src, [dstWcId]: dst}));
            console.warn('moveAcross failed', e);
        }
    };


    // единая точка
    const applyCrossReorder = async (
        d: DragData,
        target: { dstWcId: number; toIdx: number }
    ) => {
        const {srcWcId, fromIdx} = d;
        const {dstWcId, toIdx} = target;
        if (srcWcId === dstWcId) {
            await reorderInside(srcWcId, fromIdx, toIdx);
        } else {
            await moveAcross(srcWcId, fromIdx, dstWcId, toIdx);
        }
    };

    return (
        <div>
            <h3 style={{margin: '24px 0 8px'}}>References</h3>

            {orderedWc.map((wc, idx) => {
                const refs = localRefs[wc.id] ?? [];
                const isFirst = idx === 0;
                const isLast = idx === orderedWc.length - 1;

                return (
                    <div key={wc.id} style={{marginBottom: 24}}>
                        <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                            <h4 style={{margin: 0}}>{wc.alias ?? `Колонка #${wc.id}`}</h4>
                            <span style={{color: 'grey'}}>({wc.column_order ?? 0})</span>
                            <div style={{display: 'flex', gap: 6, marginLeft: 8}}>
                                <button

                                    title="Переместить вверх"
                                    disabled={isFirst}
                                    onClick={() => moveGroup(wc.id, 'up')}
                                    style={{opacity: isFirst ? 0.4 : 1}}
                                >
                                    ↑
                                </button>
                                <button

                                    title="Переместить вниз"
                                    disabled={isLast}
                                    onClick={() => moveGroup(wc.id, 'down')}
                                    style={{opacity: isLast ? 0.4 : 1}}
                                >
                                    ↓
                                </button>
                                <span>{wc.id}</span>
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
                                    const type = r.type ?? tblCol?.datatype ?? '—';
                                    return (
                                        <tr
                                            key={`${wc.id}-${tblCol?.id ?? 'x'}`} // стабильный key
                                            draggable
                                            onDragStart={onDragStart(wc.id, rowIdx, tblCol.id)}
                                            onDrop={onDropRow(wc.id, rowIdx)}
                                            style={{cursor: 'move'}}
                                        >
                                            <td style={{textAlign: 'center', opacity: 0.6}}>⋮⋮</td>
                                            <td>{tblCol?.name ?? '—'}</td>
                                            <td>{r.ref_alias ?? '—'}</td>
                                            <td>{type}</td>
                                            <td>{r.width ?? '—'}</td>
                                            <td>{orderedWc.find((w) => w.id === wc.id)?.default ?? '—'}</td>
                                            <td>
                                                {orderedWc.find((w) => w.id === wc.id)?.placeholder ?? '—'}
                                            </td>
                                            <td style={{textAlign: 'center'}}>
                                                {orderedWc.find((w) => w.id === wc.id)?.visible ? '✔︎' : ''}
                                            </td>
                                            <td>{r.ref_column_order ?? rowIdx}</td>
                                            <td>
                                                {tblCol?.id ? (
                                                    <DeleteIcon
                                                        className={s.actionIcon}
                                                        onClick={() => handleDeleteReference(wc.id, tblCol.id)}
                                                    />
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
        </div>
    );
};

