import {useCallback, useState} from 'react';
import {reindex} from '../../ref-helpers';
import type {EditState, RefItem, RefPatch} from '../../types';

/** Вспомогалка */
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

type Deps = {
    /** Актуальные refs по wcId (как в useLocalRefs) */
    localRefsRef: React.MutableRefObject<Record<number, RefItem[]>>;
    /** Сеттер локального состояния refs */
    setLocalRefs: React.Dispatch<React.SetStateAction<Record<number, RefItem[]>>>;
    /** PATCH /widgets/tables/references/:wcId/:tblColId */
    callUpdateReference: (wcId: number, tableColumnId: number, patch: RefPatch) => Promise<unknown>;
    /** Очередь синка порядка (из useRefsDnd) */
    queueSyncRef: React.MutableRefObject<(() => void) | null>;
};

export function useEditReference({
                                     localRefsRef,
                                     setLocalRefs,
                                     callUpdateReference,
                                     queueSyncRef,
                                 }: Deps) {
    const [edit, setEdit] = useState<EditState>({
        open: false,
        wcId: null,
        tableColumnId: null,
        ref_alias: '',
        ref_type: '',
        ref_width: 1,
        ref_order: 0,
        ref_default: '',
        ref_placeholder: '',
        ref_visible: true,
        ref_readOnly: false,
    });

    const openEditById = useCallback((wcId: number, tableColumnId: number) => {
        const listNow = localRefsRef.current[wcId] ?? [];
        const current = listNow.find(x => x.table_column?.id === tableColumnId);
        const idxNow = listNow.findIndex(x => x.table_column?.id === tableColumnId);
        if (!current) return;

        setEdit({
            open: true,
            wcId,
            tableColumnId,
            ref_alias: current.ref_alias ?? '',
            ref_type: current.type ?? '',
            ref_width: Number(current.width ?? 1),
            ref_order: idxNow < 0 ? (current.ref_column_order ?? 0) : idxNow,
            ref_default: current.default ?? '',
            ref_placeholder: current.placeholder ?? '',
            ref_visible: current.visible ?? true,
            ref_readOnly: !!current.readonly,
        });
    }, [localRefsRef]);

    const closeEdit = useCallback(() => setEdit(e => ({ ...e, open: false })), []);

    const saveEdit = useCallback(async () => {
        if (!edit.wcId || !edit.tableColumnId) return;

        const wcId = edit.wcId;
        const tableColumnId = edit.tableColumnId;

        const list = localRefsRef.current[wcId] ?? [];
        const current = list.find(x => x.table_column?.id === tableColumnId);
        if (!current) { closeEdit(); return; }

        const to = clamp(
            Number.isFinite(edit.ref_order) ? Number(edit.ref_order) : 0,
            0,
            Math.max(0, list.length - 1)
        );

        const patch: RefPatch = {
            ref_alias: (edit.ref_alias ?? '').trim() || null,
            type: (edit.ref_type ?? '').trim() || null,
            width: Number(edit.ref_width) || 1,
            default: (edit.ref_default ?? '').trim() || null,
            placeholder: (edit.ref_placeholder ?? '').trim() || null,
            visible: !!edit.ref_visible,
            readonly: !!edit.ref_readOnly,
        };

        await callUpdateReference(wcId, tableColumnId, patch);

        // локально применим всё кроме порядка — порядок пустим через очередь
        setLocalRefs(prev => {
            const list = prev[wcId] ?? [];
            const filtered = list.filter(x => x.table_column?.id !== tableColumnId);
            const updated: RefItem = {
                ...current,
                ref_alias: patch.ref_alias ?? null,
                type: patch.type ?? null,
                width: patch.width ?? 1,
                default: patch.default ?? null,
                placeholder: patch.placeholder ?? null,
                visible: patch.visible ?? true,
                readonly: patch.readonly ?? false,
            };
            const next = [...filtered];
            next.splice(to, 0, updated);
            return { ...prev, [wcId]: reindex(next) };
        });

        // синк перестановок
        queueSyncRef.current?.();
        closeEdit();
    }, [edit, callUpdateReference, localRefsRef, setLocalRefs, closeEdit, queueSyncRef]);

    return {
        edit, setEdit,
        openEditById,
        closeEdit,
        saveEdit,
    };
}
