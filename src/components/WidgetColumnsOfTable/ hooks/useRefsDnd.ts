import { useRef, useState, useCallback } from 'react';
import debounce from 'lodash/debounce';
import type { DebouncedFunc } from 'lodash';

import { logApi, reindex, toFullPatch } from '../ref-helpers';
import type { RefItem } from '../types';

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
                               createReference,
                           }: Args) {
    const [drag, setDrag] = useState<DragData | null>(null);

    // ⬇️ НОВОЕ: Флаг что sync уже выполняется
    const isSyncingRef = useRef(false);
    // ⬇️ НОВОЕ: Флаг что нужен повторный sync
    const pendingSyncRef = useRef(false);

    // Основная функция синхронизации
    const doSync = useCallback(async () => {
        // ⬇️ НОВОЕ: Защита от параллельного выполнения
        if (isSyncingRef.current) {
            pendingSyncRef.current = true;
            logApi('SYNC:deferred', { reason: 'already syncing' });
            return;
        }

        isSyncingRef.current = true;
        pendingSyncRef.current = false;

        try {
            const state = localRefsRef.current;
            const snapshot = snapshotRef.current;

            // 1) ADD (новые / кросс-перенос) — ПОСЛЕДОВАТЕЛЬНО
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                const list = state[wcId] ?? [];
                // ⬇️ ИСПРАВЛЕНО: добавили filter(Boolean) для защиты от undefined
                const nextIds = list.map(r => r.table_column?.id).filter(Boolean) as number[];
                const prevIds = snapshot[wcId] ?? [];
                const added = nextIds.filter(id => !prevIds.includes(id));

                for (const id of added) {
                    const toIdx = nextIds.indexOf(id);
                    const refObj = list[toIdx];
                    if (!refObj) continue;

                    try {
                        await createReference(wcId, id, refObj, toIdx);
                        logApi('SYNC:ADD:ok', { wcId, id, toIdx });
                    } catch (e: any) {
                        // 409 = уже существует, это OK при кросс-переносе
                        if (e?.response?.status !== 409) {
                            console.warn('[SYNC:ADD:error]', wcId, id, e);
                        }
                    }
                }
            }

            // 2) REORDER — batch по 3 запроса
            const reorderTasks: Array<() => Promise<void>> = [];

            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                const list = state[wcId] ?? [];
                const nextIds = list.map(r => r.table_column?.id).filter(Boolean) as number[];
                const prevIds = snapshot[wcId] ?? [];
                const common = nextIds.filter(id => prevIds.includes(id));

                for (const id of common) {
                    const newIdx = nextIds.indexOf(id);
                    const oldIdx = prevIds.indexOf(id);

                    if (newIdx !== oldIdx) {
                        const row = list[newIdx];
                        if (!row) continue;

                        reorderTasks.push(async () => {
                            try {
                                await callUpdateReference(wcId, id, toFullPatch(row, newIdx));
                            } catch (e) {
                                console.warn('[SYNC:REORDER:error]', wcId, id, e);
                            }
                        });
                    }
                }
            }

            // ⬇️ НОВОЕ: Выполняем REORDER batch по 3 (не все сразу!)
            for (let i = 0; i < reorderTasks.length; i += 3) {
                const batch = reorderTasks.slice(i, i + 3);
                await Promise.all(batch.map(fn => fn()));
            }

            // 3) Обновить снапшот
            const nextSnap: Record<number, number[]> = {};
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                nextSnap[wcId] = (state[wcId] ?? [])
                    .map(r => r.table_column?.id)
                    .filter(Boolean) as number[];
            }
            snapshotRef.current = nextSnap;
            logApi('SYNC:snapshot:update', nextSnap);

        } finally {
            isSyncingRef.current = false;

            // ⬇️ НОВОЕ: Если за время sync пришли изменения — запускаем ещё раз
            if (pendingSyncRef.current) {
                pendingSyncRef.current = false;
                logApi('SYNC:retry', {});
                setTimeout(doSync, 50);
            }
        }
    }, [localRefsRef, snapshotRef, callUpdateReference, createReference]);

    // ⬇️ ИЗМЕНЕНО: debounce 350ms вместо 250ms
    const queueSyncRef = useRef<DebouncedFunc<() => Promise<void>> | null>(null);
    if (!queueSyncRef.current) {
        queueSyncRef.current = debounce(doSync, 350);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DnD handlers (почти без изменений)
    // ─────────────────────────────────────────────────────────────────────────

    const onDragStart = (srcWcId: number, fromIdx: number, tableColumnId: number) => (e: React.DragEvent) => {
        const payload: DragData = { srcWcId, fromIdx, tableColumnId };
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
        setDrag(payload);
        logApi('UI:dragStart', payload);
    };

    const onDragEnd = () => setDrag(null);

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
    };

    const applyCrossReorder = async (d: DragData, target: { dstWcId: number; toIdx: number }) => {
        const { srcWcId, fromIdx } = d;
        const { dstWcId, toIdx } = target;

        if (srcWcId === dstWcId) {
            setLocalRefs(prev => {
                const src = prev[srcWcId] ?? [];
                if (fromIdx < 0 || fromIdx >= src.length) return prev;

                const next = [...src];
                const [rm] = next.splice(fromIdx, 1);
                if (!rm) return prev;

                // ⬇️ ИСПРАВЛЕНО: корректируем toIdx
                const adjustedToIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
                const safeIdx = Math.max(0, Math.min(adjustedToIdx, next.length));
                next.splice(safeIdx, 0, rm);

                logApi('UI:reorder:inside', { wcId: srcWcId, fromIdx, toIdx: safeIdx });
                return { ...prev, [srcWcId]: reindex(next) };
            });
        } else {
            setLocalRefs(prev => {
                const src = prev[srcWcId] ?? [];
                const dst = prev[dstWcId] ?? [];

                if (fromIdx < 0 || fromIdx >= src.length) return prev;

                const moved = src[fromIdx];
                if (!moved) return prev;

                // Защита от дублей
                if (dst.some(r => r.table_column?.id === moved.table_column?.id)) return prev;

                const nextSrc = [...src];
                nextSrc.splice(fromIdx, 1);

                const nextDst = [...dst];
                const safeToIdx = Math.max(0, Math.min(toIdx, nextDst.length));
                nextDst.splice(safeToIdx, 0, moved);

                logApi('UI:reorder:cross', {
                    fromWcId: srcWcId,
                    toWcId: dstWcId,
                    fromIdx,
                    toIdx: safeToIdx,
                    tableColumnId: moved.table_column?.id,
                });

                return {
                    ...prev,
                    [srcWcId]: reindex(nextSrc),
                    [dstWcId]: reindex(nextDst),
                };
            });
        }

        // Запускаем sync (debounced)
        queueSyncRef.current?.();
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
        } catch { /* ignore */ }

        if (!data) return;

        try {
            await applyCrossReorder(data, { dstWcId, toIdx });
        } finally {
            try { e.dataTransfer.clearData(); } catch { /* ignore */ }
            setDrag(null);
            // ❌ УБРАЛИ: queueSyncRef.current?.flush();
            // flush() вызывал sync ДО того как React обновил state
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
        } catch { /* ignore */ }

        if (!data) return;

        const toIdx = localRefsRef.current[dstWcId]?.length ?? 0;
        await applyCrossReorder(data, { dstWcId, toIdx });

        try { e.dataTransfer.clearData(); } catch { /* ignore */ }
        setDrag(null);
        // ❌ УБРАЛИ: queueSyncRef.current?.flush();
    };

    return {
        onDragStart,
        onDragEnd,
        onDragOver,
        onDropRow,
        onDropTbodyEnd,
        queueSyncRef,
    };
}