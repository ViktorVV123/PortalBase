import { useCallback, useState } from 'react';
import {ComboItem, RefItem} from "@/components/WidgetColumnsOfTable/types";
import {reindex, toFullPatch} from "@/components/WidgetColumnsOfTable/ref-helpers";


type Deps = {
    localRefsRef: React.MutableRefObject<Record<number, RefItem[]>>;
    setLocalRefs: React.Dispatch<React.SetStateAction<Record<number, RefItem[]>>>;
    callUpdateReference: (wcId: number, tblColId: number, patch: any) => Promise<any>;
};

type Draft = {
    open: boolean;
    saving: boolean;
    wcId: number | null;
    tableColumnId: number | null;
    combobox_column_id: number | null;
    value: {
        combobox_width: number;
        combobox_column_order: number;
        combobox_alias: string;
        is_primary: boolean;
        is_show: boolean;
        is_show_hidden: boolean;
    };
};

export function useComboboxEditor({
                                      localRefsRef,
                                      setLocalRefs,
                                      callUpdateReference,
                                  }: Deps) {
    const [dlg, setDlg] = useState<Draft>({
        open: false,
        saving: false,
        wcId: null,
        tableColumnId: null,
        combobox_column_id: null,
        value: {
            combobox_width: 1,
            combobox_column_order: 0,
            combobox_alias: '',
            is_primary: false,
            is_show: true,
            is_show_hidden: false,
        },
    });

    const open = useCallback((wcId: number, tableColumnId: number, item: ComboItem) => {
        setDlg({
            open: true,
            saving: false,
            wcId,
            tableColumnId,
            combobox_column_id: item.combobox_column_id,
            value: {
                combobox_width: item.combobox_width ?? 1,
                combobox_column_order: item.combobox_column_order ?? 0,
                combobox_alias: item.combobox_alias ?? '',
                is_primary: !!item.is_primary,
                is_show: !!item.is_show,
                is_show_hidden: !!item.is_show_hidden,
            },
        });
    }, []);

    const close = useCallback(() => {
        setDlg(d => ({ ...d, open: false }));
    }, []);

    const onChange = useCallback((patch: Partial<Draft['value']>) => {
        setDlg(d => ({ ...d, value: { ...d.value, ...patch } }));
    }, []);

    const save = useCallback(async () => {
        if (!dlg.wcId || !dlg.tableColumnId || !dlg.combobox_column_id) return;
        setDlg(d => ({ ...d, saving: true }));
        const wcId = dlg.wcId;
        const tblColId = dlg.tableColumnId;
        const comboId = dlg.combobox_column_id;

        const list = localRefsRef.current[wcId] ?? [];
        const current = list.find(x => x.table_column?.id === tblColId);
        if (!current) { setDlg(d => ({ ...d, saving: false, open: false })); return; }

        const orig = Array.isArray(current.combobox) ? [...current.combobox] : [];
        const next = orig.map(it => {
            if (it.combobox_column_id !== comboId) return it;
            return {
                ...it,
                combobox_width: dlg.value.combobox_width,
                combobox_column_order: dlg.value.combobox_column_order,
                combobox_alias: dlg.value.combobox_alias?.trim() || null,
                is_primary: dlg.value.is_primary,
                is_show: dlg.value.is_show,
                is_show_hidden: dlg.value.is_show_hidden,
            };
        });

        // если отмечен новый primary — снимаем флаг с остальных
        if (dlg.value.is_primary) {
            for (const it of next) {
                if (it.combobox_column_id !== comboId) it.is_primary = false;
            }
        }

        // реиндексация по порядку (чтобы не было дыр)
        next.sort((a, b) => (a.combobox_column_order ?? 0) - (b.combobox_column_order ?? 0))
            .forEach((it, idx) => { it.combobox_column_order = idx; });

        // оптимистичное обновление локального стейта
        setLocalRefs(prev => {
            const list = prev[wcId] ?? [];
            const updated = list.map(r => r.table_column?.id === tblColId ? { ...r, combobox: next } : r);
            return { ...prev, [wcId]: reindex(updated) };
        });

        try {
            // серверный PATCH: передаём combobox как полный массив
            const patch = { ...toFullPatch({ ...current, combobox: next }) , combobox: next };
            await callUpdateReference(wcId, tblColId, patch);
            setDlg(d => ({ ...d, saving: false, open: false }));
        } catch (e) {
            // откат (перечитать локальный из ref)
            setLocalRefs(prev => ({ ...prev })); // простая перерисовка; по желанию можно хранить snapshot
            setDlg(d => ({ ...d, saving: false }));
            console.warn('PATCH combobox error', e);
        }
    }, [dlg, localRefsRef, setLocalRefs, callUpdateReference]);

    return { dlg, open, close, onChange, save, setDlg };
}
