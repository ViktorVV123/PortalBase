import {useRef, useState} from 'react';
import debounce from 'lodash/debounce';
import type {DebouncedFunc} from 'lodash';

import {logApi, reindex, toFullPatch} from '../ref-helpers';
import type {RefItem} from '../types';

type DragData = { srcWcId: number; fromIdx: number; tableColumnId: number };

type Args = {
    setLocalRefs: React.Dispatch<React.SetStateAction<Record<number, RefItem[]>>>;
    localRefsRef: React.MutableRefObject<Record<number, RefItem[]>>;
    getIdxById: (wcId: number, tableColumnId: number) => number;
    snapshotRef: React.MutableRefObject<Record<number, number[]>>;
    callUpdateReference: (wcId: number, tblColId: number, patch: any) => Promise<any>;
    createReference: (wcId: number, tblColId: number, r: RefItem, order: number) => Promise<any>;
};

export function useRefsDnd({
                               setLocalRefs,
                               localRefsRef,
                               getIdxById,
                               snapshotRef,
                               callUpdateReference,
                               createReference
                           }: Args) {
    const [drag, setDrag] = useState<DragData | null>(null);

    // общая очередь синка: ADD -> POST, REORDER -> PATCH, без DELETE
    const queueSyncRef = useRef<DebouncedFunc<() => Promise<void>> | null>(null);
    if (!queueSyncRef.current) {
        queueSyncRef.current = debounce(async () => {
            const state = localRefsRef.current;
            const snapshot = snapshotRef.current;

            // 1) ADD (новые / кросс-перенос)
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                const nextIds = (state[wcId] ?? []).map(r => r.table_column!.id);
                const prevIds = snapshot[wcId] ?? [];
                const added = nextIds.filter(id => !prevIds.includes(id));
                for (const id of added) {
                    const toIdx = nextIds.indexOf(id);
                    const refObj = (state[wcId] ?? [])[toIdx];
                    if (!refObj) continue;
                    await createReference(wcId, id, refObj, toIdx);
                }
            }

            // 2) REORDER
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                const nextIds = (state[wcId] ?? []).map(r => r.table_column!.id);
                const prevIds = snapshot[wcId] ?? [];
                const common = nextIds.filter(id => prevIds.includes(id));
                for (const id of common) {
                    const newIdx = nextIds.indexOf(id);
                    const oldIdx = prevIds.indexOf(id);
                    if (newIdx !== oldIdx) {
                        const row = (state[wcId] ?? [])[newIdx];
                        if (!row) continue;
                        try { await callUpdateReference(wcId, id, toFullPatch(row, newIdx)); }
                        catch (e) { console.warn('[order-sync]', wcId, id, e); }
                    }
                }
            }

            // 3) обновить снапшот (без DELETE)
            const nextSnap: Record<number, number[]> = {};
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                nextSnap[wcId] = (state[wcId] ?? []).map(r => r.table_column!.id);
            }
            snapshotRef.current = nextSnap;
            logApi('SYNC:snapshot:update', nextSnap);
        }, 250);
    }

    const onDragStart = (srcWcId: number, fromIdx: number, tableColumnId: number) => (e: React.DragEvent) => {
        const payload: DragData = {srcWcId, fromIdx, tableColumnId};
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
        setDrag(payload);
        logApi('UI:dragStart', payload);
    };
    const onDragEnd = () => setDrag(null);
    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; };

    const applyCrossReorder = async (d: DragData, target: { dstWcId: number; toIdx: number }) => {
        const {srcWcId, fromIdx} = d;
        const {dstWcId, toIdx} = target;

        if (srcWcId === dstWcId) {
            setLocalRefs(prev => {
                const src = prev[srcWcId] ?? [];
                const next = [...src];
                const [rm] = next.splice(fromIdx, 1);
                if (!rm) return prev;
                next.splice(toIdx, 0, rm);
                logApi('UI:reorder:inside', {wcId: srcWcId, fromIdx, toIdx});
                return {...prev, [srcWcId]: reindex(next)};
            });
        } else {
            setLocalRefs(prev => {
                const src = prev[srcWcId] ?? [];
                const dst = prev[dstWcId] ?? [];
                const moved = src[fromIdx];
                if (!moved) return prev;
                if (dst.some(r => r.table_column?.id === moved.table_column?.id)) return prev; // защита от дублей
                const nextSrc = [...src]; nextSrc.splice(fromIdx, 1);
                const nextDst = [...dst]; nextDst.splice(toIdx, 0, moved);
                logApi('UI:reorder:cross', {fromWcId: srcWcId, toWcId: dstWcId, fromIdx, toIdx, tableColumnId: moved.table_column?.id});
                return {...prev, [srcWcId]: reindex(nextSrc), [dstWcId]: reindex(nextDst)};
            });
        }
        queueSyncRef.current?.();
    };

    const onDropRow = (dstWcId: number, toIdx: number) => async (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        let data = drag;
        try { if (!data) { const raw = e.dataTransfer.getData('application/json'); if (raw) data = JSON.parse(raw); } } catch {}
        if (!data) return;
        try { await applyCrossReorder(data, {dstWcId, toIdx}); }
        finally { try { e.dataTransfer.clearData(); } catch {} setDrag(null); queueSyncRef.current?.flush(); }
    };

    const onDropTbodyEnd = (dstWcId: number) => async (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        let data: DragData | null = drag;
        try { if (!data) { const raw = e.dataTransfer.getData('application/json'); if (raw) data = JSON.parse(raw); } } catch {}
        if (!data) return;
        const toIdx = localRefsRef.current[dstWcId]?.length ?? 0;
        await applyCrossReorder(data, {dstWcId, toIdx});
        try { e.dataTransfer.clearData(); } catch {}
        setDrag(null);
        queueSyncRef.current?.flush();
    };

    return {onDragStart, onDragEnd, onDragOver, onDropRow, onDropTbodyEnd, queueSyncRef};
}
