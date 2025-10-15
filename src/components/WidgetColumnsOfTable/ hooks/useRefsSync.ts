import {useEffect, useMemo, useRef} from 'react';
import debounce from 'lodash/debounce';
import type {DebouncedFunc} from 'lodash';
import {createReference, logApi, reindex, toFullPatch} from '../ref-helpers';
import type {RefItem} from '../types';

type Args = {
    callUpdateReference: (wcId: number, tblColId: number, patch: any) => Promise<any>;
    setLocalRefs: React.Dispatch<React.SetStateAction<Record<number, RefItem[]>>>;
    localRefsRef: React.MutableRefObject<Record<number, RefItem[]>>;
};

export function useRefsSync({callUpdateReference, setLocalRefs, localRefsRef}: Args) {
    const snapshotRef = useRef<Record<number, number[]>>({});
    const queueSyncRef = useRef<DebouncedFunc<() => Promise<void>> | null>(null);

    const logStateSnapshot = (wcId: number, local: Record<number, RefItem[]>, snap: Record<number, number[]>) => {
        const rows = (local[wcId] ?? []).map((r: RefItem) => ({
            table_column_id: r.table_column?.id ?? null,
            name: r.table_column?.name ?? null,
            ref_alias: r.ref_alias ?? null,
            visible: r.visible ?? null,
            readonly: r.readonly ?? null,
            width: r.width ?? null,
            order: r.ref_column_order ?? null,
        }));
        logApi('STATE', {wcId, rows, orderIds: snap[wcId] ?? []});
    };

    useEffect(() => {
        if (!queueSyncRef.current) {
            queueSyncRef.current = debounce(async () => {
                const state = localRefsRef.current;
                const snapshot = snapshotRef.current;

                Object.keys(state).forEach(k => logStateSnapshot(Number(k), state, snapshot));

                // 1) additions -> POST
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

                // 2) reorders -> PATCH
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
                            await callUpdateReference(wcId, id, toFullPatch(row, newIdx));
                        }
                    }
                }

                // 3) update snapshot (без DELETE — бэк чистит сам)
                const nextSnap: Record<number, number[]> = {};
                for (const wcIdStr of Object.keys(state)) {
                    const wcId = Number(wcIdStr);
                    nextSnap[wcId] = (state[wcId] ?? []).map(r => r.table_column!.id);
                }
                snapshotRef.current = nextSnap;
                logApi('SYNC:snapshot:update', nextSnap);
            }, 250);
        }
        return () => queueSyncRef.current?.cancel();
    }, [callUpdateReference, localRefsRef]);

    // init from props
    const initFromProps = (orderedWc: {id: number}[], referencesMap: Record<number, RefItem[]>) => {
        const next: Record<number, RefItem[]> = {};
        const snap: Record<number, number[]> = {};

        for (const wc of orderedWc) {
            const src = (referencesMap[wc.id] ?? []);
            const norm = src.map((r) => {
                const copy: RefItem = {...r, table_column: r.table_column ? {...r.table_column} : r.table_column} as RefItem;
                const fid = (r as any).form_id ?? (r as any).form ?? null;
                (copy as any).form = fid; (copy as any).form_id = fid;
                return copy;
            });
            const sorted = norm.sort((a, b) => (a.ref_column_order ?? 0) - (b.ref_column_order ?? 0));
            next[wc.id] = reindex(sorted);
            snap[wc.id] = sorted.map(r => r.table_column?.id).filter(Boolean) as number[];
        }

        return {next, snap};
    };

    return {snapshotRef, queueSyncRef};
}
