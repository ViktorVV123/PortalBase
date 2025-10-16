import {useCallback, useState} from 'react';
import {api} from '@/services/api';
import {getFormId, reindex} from '../../ref-helpers';
import type {AddDlgState, RefItem} from '../../types';

type Deps = {
    localRefsRef: React.MutableRefObject<Record<number, RefItem[]>>;
    setLocalRefs: React.Dispatch<React.SetStateAction<Record<number, RefItem[]>>>;
    snapshotRef: React.MutableRefObject<Record<number, number[]>>;
    refreshReferences?: (wcId: number) => Promise<void> | void;
};

export function useAddReference({
                                    localRefsRef,
                                    setLocalRefs,
                                    snapshotRef,
                                    refreshReferences,
                                }: Deps) {
    const [addDlg, setAddDlg] = useState<AddDlgState>({
        open: false,
        wcId: null,
        table_column_id: null,
        width: 1,
        ref_column_order: 0,
        type: '',
        ref_alias: '',
        default: '',
        placeholder: '',
        visible: true,
        readonly: false,
        form_id: null,
    });

    const openAddDialog = useCallback((wcId: number) => {
        const current = localRefsRef.current[wcId] ?? [];
        setAddDlg({
            open: true,
            wcId,
            table_column_id: null,
            width: 1,
            ref_column_order: current.length,
            type: '',
            ref_alias: '',
            default: '',
            placeholder: '',
            visible: true,
            readonly: false,
            form_id: null,
        });
    }, [localRefsRef]);

    const closeAddDialog = useCallback(() => setAddDlg(d => ({...d, open: false})), []);

    const saveAddDialog = useCallback(async () => {
        const {wcId, table_column_id} = addDlg;
        if (!wcId || !table_column_id) return;

        const payload = {
            width: Number.isFinite(addDlg.width) ? addDlg.width : 1,
            ref_column_order: Number.isFinite(addDlg.ref_column_order) ? addDlg.ref_column_order : 0,
            type: addDlg.type.trim() ? addDlg.type.trim() : null,
            ref_alias: addDlg.ref_alias.trim() ? addDlg.ref_alias.trim() : null,
            default: addDlg.default.trim() ? addDlg.default.trim() : null,
            placeholder: addDlg.placeholder.trim() ? addDlg.placeholder.trim() : null,
            visible: !!addDlg.visible,
            readonly: !!addDlg.readonly,
            form_id: addDlg.form_id ?? null,
        };

        const {data} = await api.post<RefItem>(`/widgets/tables/references/${wcId}/${table_column_id}`, payload);

        const normalizedFormId = getFormId((data as any).form ?? (data as any).form_id ?? null);

        setLocalRefs(prev => {
            const list = prev[wcId] ?? [];
            const to = Math.max(0, Math.min(addDlg.ref_column_order, list.length));
            const created: RefItem = {...data, ...( { form: normalizedFormId, form_id: normalizedFormId } as any )};
            const next = [...list];
            next.splice(to, 0, created);
            const reindexed = reindex(next);
            const nextState = {...prev, [wcId]: reindexed};

            // Синхроним снапшот, чтобы DnD очередь не отправила лишний PATCH
            const ids = reindexed.map(r => r.table_column?.id).filter(Boolean) as number[];
            snapshotRef.current = {...snapshotRef.current, [wcId]: ids};

            return nextState;
        });

        await refreshReferences?.(wcId);
        closeAddDialog();
    }, [addDlg, setLocalRefs, snapshotRef, refreshReferences, closeAddDialog]);

    return {
        addDlg, setAddDlg,
        openAddDialog, closeAddDialog, saveAddDialog,
    };
}
