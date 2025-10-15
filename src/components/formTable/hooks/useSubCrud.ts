import {useCallback, useState} from 'react';
import {api} from '@/services/api';
import type {DTable, FormDisplay, Widget} from '@/shared/hooks/useWorkSpaces';

export type UseSubCrudDeps = {
    formIdForSub: number | null;
    currentWidgetId?: number;
    currentOrder: number | null;
    handleTabClick: (order: number) => void;
    flatColumnsInRenderOrder: FormDisplay['columns'];
};

export function useSubCrud({
                               formIdForSub,
                               currentWidgetId,
                               currentOrder,
                               handleTabClick,
                               flatColumnsInRenderOrder,
                           }: UseSubCrudDeps) {
    const [isAddingSub, setIsAddingSub] = useState(false);
    const [draftSub, setDraftSub] = useState<Record<number, string>>({});
    const [savingSub, setSavingSub] = useState(false);

    const [editingRowIdxSub, setEditingRowIdxSub] = useState<number | null>(null);
    const [editDraftSub, setEditDraftSub] = useState<Record<number, string>>({});
    const [editSavingSub, setEditSavingSub] = useState(false);

    const preflight = useCallback(async (kind: 'insert' | 'update' | 'delete') => {
        if (!currentWidgetId) return {ok:false};
        try {
            const {data: widget} = await api.get<Widget>(`/widgets/${currentWidgetId}`);
            const {data: table} = await api.get<DTable>(`/tables/${widget.table_id}`);
            const q = kind === 'insert' ? table?.insert_query
                : kind === 'update' ? table?.update_query
                    : table?.delete_query;
            if (!q || !q.trim()) return {ok:false};
        } catch {
            return {ok:false};
        }
        return {ok:true};
    }, [currentWidgetId]);

    const startAddSub = useCallback(async () => {
        const pf = await preflight('insert');
        if (!pf.ok || !formIdForSub || !currentWidgetId) return;

        setIsAddingSub(true);
        const init: Record<number, string> = {};
        flatColumnsInRenderOrder.forEach(c => { if (c.table_column_id != null) init[c.table_column_id] = ''; });
        setDraftSub(init);
    }, [preflight, formIdForSub, currentWidgetId, flatColumnsInRenderOrder]);

    const cancelAddSub = useCallback(() => { setIsAddingSub(false); setDraftSub({}); }, []);

    const submitAddSub = useCallback(async () => {
        if (!formIdForSub || !currentWidgetId) return;
        const pf = await preflight('insert');
        if (!pf.ok) return;

        setSavingSub(true);
        try {
            const values = Object.entries(draftSub)
                .filter(([, v]) => v !== '' && v !== undefined && v !== null)
                .map(([table_column_id, value]) => ({ table_column_id: Number(table_column_id), value: String(value) }));

            const body = { pk: {}, values };
            const url = `/data/${formIdForSub}/${currentWidgetId}`;

            try { await api.post(url, body); }
            catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 404 && String(detail).includes('Insert query not found')) return;
                if (status === 404) { await api.post(`${url}/`, body); } else { throw err; }
            }

            if (currentOrder != null) handleTabClick(currentOrder);
            setIsAddingSub(false);
            setDraftSub({});
        } finally {
            setSavingSub(false);
        }
    }, [formIdForSub, currentWidgetId, draftSub, currentOrder, handleTabClick, preflight]);

    const startEditSub = useCallback(async (row: FormDisplay['data'][number], valueIndexByKey: Map<string, number>) => {
        const pf = await preflight('update');
        if (!pf.ok) return;

        const init: Record<number, string> = {};
        flatColumnsInRenderOrder.forEach(col => {
            const k = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
            const idx = valueIndexByKey.get(k);
            const val = idx != null ? row.values[idx] : '';
            if (col.table_column_id != null) init[col.table_column_id] = (val ?? '').toString();
        });
        setEditDraftSub(init);
    }, [preflight, flatColumnsInRenderOrder]);

    return {
        // state
        isAddingSub, draftSub, savingSub,
        editingRowIdxSub, editDraftSub, editSavingSub,
        // handlers
        startAddSub, cancelAddSub, submitAddSub,
        setDraftSub,
        setEditingRowIdxSub, setEditDraftSub, setEditSavingSub,
    };
}
