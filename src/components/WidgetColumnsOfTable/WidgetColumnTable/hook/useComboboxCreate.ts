import {useCallback, useState} from 'react';
import {api} from '@/services/api';
import {reindex} from '@/components/WidgetColumnsOfTable/ref-helpers';
import type {RefItem} from '@/components/WidgetColumnsOfTable/types';

type Deps = {
    localRefsRef: React.MutableRefObject<Record<number, RefItem[]>>;
    setLocalRefs: React.Dispatch<React.SetStateAction<Record<number, RefItem[]>>>;
    refreshReferences?: (wcId: number) => Promise<void>;
};

type Draft = {
    open: boolean;
    saving: boolean;
    wcId: number | null;
    tableColumnId: number | null;
    value: {
        table_id: number | null;
        combobox_column_id: number | null; // обязательный для POST path
        combobox_width: number;
        combobox_column_order: number;
        combobox_alias: string;
        is_primary: boolean;
        is_show: boolean;
        is_show_hidden: boolean;
    };
};

export function useComboboxCreate({ localRefsRef, setLocalRefs, refreshReferences }: Deps) {
    const [dlg, setDlg] = useState<Draft>({
        open: false,
        saving: false,
        wcId: null,
        tableColumnId: null,
        value: {
            table_id: null,
            combobox_column_id: null,
            combobox_width: 1,
            combobox_column_order: 0,
            combobox_alias: '',
            is_primary: false,
            is_show: true,
            is_show_hidden: false,
        },
    });

    const open = useCallback((wcId: number, tableColumnId: number, preset?: Partial<Draft['value']>) => {
        const list = localRefsRef.current?.[wcId] ?? [];
        const ref = list.find(x => x.table_column?.id === tableColumnId);
        const tableId = ref?.table_column?.table_id ?? null;
        const currentItems: any[] = Array.isArray((ref as any)?.combobox) ? (ref as any).combobox : [];
        const nextOrder = Number.isFinite(preset?.combobox_column_order as any)
            ? Number(preset!.combobox_column_order)
            : currentItems.length; // по умолчанию — в конец

        setDlg({
            open: true,
            saving: false,
            wcId,
            tableColumnId,
            value: {
                table_id: tableId,
                combobox_column_id: preset?.combobox_column_id ?? null,
                combobox_width: Math.max(1, Math.trunc(preset?.combobox_width ?? 1)),
                combobox_column_order: Math.max(0, Math.trunc(nextOrder)),
                combobox_alias: (preset?.combobox_alias ?? '').toString(),
                is_primary: !!preset?.is_primary,
                is_show: preset?.is_show ?? true,
                is_show_hidden: !!preset?.is_show_hidden,
            },
        });
    }, [localRefsRef]);

    const close = useCallback(() => setDlg(d => ({...d, open: false})), []);

    const onChange = useCallback((patch: Partial<Draft['value']>) => {
        setDlg(d => ({ ...d, value: { ...d.value, ...patch } }));
    }, []);

    const save = useCallback(async () => {
        const { wcId, tableColumnId, value } = dlg;
        if (wcId == null || tableColumnId == null || value.combobox_column_id == null) {
            console.warn('[ComboboxCreate] Missing ids', dlg);
            return;
        }

        const body = {
            combobox_width: Math.max(1, Math.trunc(+value.combobox_width || 1)),
            combobox_column_order: Math.max(0, Math.trunc(+value.combobox_column_order || 0)),
            combobox_alias: (value.combobox_alias ?? '').trim(),
            is_primary: !!value.is_primary,
            is_show: !!value.is_show,
            is_show_hidden: !!value.is_show_hidden,
        };

        try {
            setDlg(d => ({ ...d, saving: true }));
            const url = `/widgets/tables/references/${wcId}/${tableColumnId}/${value.combobox_column_id}`;
            await api.post(url, body);

            // оптимистично допишем новый элемент в локальный стор (если этой combobox_column_id не было)
            setLocalRefs(prev => {
                const list = prev[wcId] ?? [];
                const updated = list.map(r => {
                    if (r.table_column?.id !== tableColumnId) return r;
                    const orig: any[] = Array.isArray((r as any).combobox) ? (r as any).combobox : [];
                    const exists = orig.some(it =>
                        (it.combobox_column_id ?? it.id) === value.combobox_column_id
                    );
                    const next = exists
                        ? orig.map(it =>
                            (it.combobox_column_id ?? it.id) === value.combobox_column_id ? { ...it, ...body } : { ...it }
                        )
                        : orig.concat([{ id: value.combobox_column_id, combobox_column_id: value.combobox_column_id, ...body }]);

                    if (body.is_primary) {
                        for (const it of next) {
                            if ((it.combobox_column_id ?? it.id) !== value.combobox_column_id && it.is_primary) it.is_primary = false;
                        }
                    }
                    next
                        .sort((a, b) => (a.combobox_column_order ?? 0) - (b.combobox_column_order ?? 0))
                        .forEach((it, idx) => { it.combobox_column_order = idx; });

                    return { ...r, combobox: next } as any;
                });
                return { ...prev, [wcId]: reindex(updated) };
            });

            // подтянуть фактическое состояние с сервера (важно для новых id)
            await refreshReferences?.(wcId);

            setDlg(d => ({ ...d, saving: false, open: false }));
        } catch (e) {
            console.warn('[ComboboxCreate] POST ✗', e);
            setDlg(d => ({ ...d, saving: false }));
        }
    }, [dlg, setLocalRefs, refreshReferences]);

    return { dlg, open, close, onChange, save, setDlg };
}
