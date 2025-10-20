import {useCallback, useState} from 'react';
import {api} from '@/services/api';
import {reindex} from '@/components/WidgetColumnsOfTable/ref-helpers';
import type {ComboItem, RefItem} from '@/components/WidgetColumnsOfTable/types';

type Deps = {
    localRefsRef: React.MutableRefObject<Record<number, RefItem[]>>;
    setLocalRefs: React.Dispatch<React.SetStateAction<Record<number, RefItem[]>>>;
    // опционально: оставлено для совместимости
    callUpdateReference?: (wcId: number, tblColId: number, patch: any) => Promise<any>;
    // ВАЖНО: рефетч всей группы после изменений (подтянуть новые combobox-элементы)
    refreshReferences?: (wcId: number) => Promise<void>;
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
                                      refreshReferences, // ← добавили
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

    const open = useCallback((wcId: number, tableColumnId: number, item: any) => {
        let comboId =
            item?.combobox_column_id ??
            item?.id ??
            item?.combobox_column?.id ??
            null;

        if (comboId == null) {
            const list = localRefsRef.current?.[wcId] ?? [];
            const ref = list.find(x => x.table_column?.id === tableColumnId);
            const only = Array.isArray((ref as any)?.combobox) ? (ref as any).combobox : [];
            if (only.length === 1 && only[0]?.combobox_column_id != null) {
                comboId = only[0].combobox_column_id;
            }
        }

        setDlg({
            open: true,
            saving: false,
            wcId,
            tableColumnId,
            combobox_column_id: comboId,
            value: {
                combobox_width: Number.isFinite(item?.combobox_width) ? item.combobox_width : 1,
                combobox_column_order: Number.isFinite(item?.combobox_column_order) ? item.combobox_column_order : 0,
                combobox_alias: item?.combobox_alias ?? '',
                is_primary: !!item?.is_primary,
                is_show: !!item?.is_show,
                is_show_hidden: !!item?.is_show_hidden,
            },
        });
    }, [localRefsRef]);

    const close = useCallback(() => setDlg(d => ({...d, open: false})), []);
    const onChange = useCallback((patch: Partial<Draft['value']>) => {
        setDlg(d => ({...d, value: {...d.value, ...patch}}));
    }, []);

    const save = useCallback(async () => {
        const { wcId, tableColumnId, combobox_column_id, value } = dlg;

        // eslint-disable-next-line no-console
        console.warn('[ComboboxEditor.save] ids:', { wcId, tableColumnId, combobox_column_id });
        if (wcId == null || tableColumnId == null || combobox_column_id == null) {
            // eslint-disable-next-line no-console
            console.warn('[ComboboxEditor] Missing ids', { wcId, tableColumnId, combobox_column_id });
            return;
        }

        const width = Number.isFinite(+value.combobox_width) ? Math.max(1, Math.trunc(+value.combobox_width)) : 1;
        const order = Number.isFinite(+value.combobox_column_order) ? Math.max(0, Math.trunc(+value.combobox_column_order)) : 0;
        const alias = (value.combobox_alias ?? '').toString().trim();

        const body = {
            combobox_width: width,
            combobox_column_order: order,
            combobox_alias: alias,
            is_primary: !!value.is_primary,
            is_show: !!value.is_show,
            is_show_hidden: !!value.is_show_hidden,
        };

        try {
            setDlg(d => ({ ...d, saving: true }));

            const url = `/widgets/tables/references/${wcId}/${tableColumnId}/${combobox_column_id}`;
            // eslint-disable-next-line no-console
            console.debug('[ComboboxEditor] PATCH →', url, body);
            await api.patch(url, body);
            // eslint-disable-next-line no-console
            console.debug('[ComboboxEditor] PATCH ✓');

            // оптимистично обновляем локально отредактированный элемент
            setLocalRefs(prev => {
                const list = prev[wcId] ?? [];
                const updated = list.map(r => {
                    if (r.table_column?.id !== tableColumnId) return r;
                    const orig: any[] = Array.isArray((r as any).combobox) ? (r as any).combobox : [];
                    const next = orig.map(it =>
                        (it.combobox_column_id ?? it.id) === combobox_column_id ? { ...it, ...body } : { ...it }
                    );

                    // если сделали текущий primary — снимаем с остальных
                    if (body.is_primary) {
                        for (const it of next) {
                            if ((it.combobox_column_id ?? it.id) !== combobox_column_id && it.is_primary) it.is_primary = false;
                        }
                    }

                    next
                        .sort((a, b) => (a.combobox_column_order ?? 0) - (b.combobox_column_order ?? 0))
                        .forEach((it, idx) => { it.combobox_column_order = idx; });

                    return { ...r, combobox: next } as any;
                });
                return { ...prev, [wcId]: reindex(updated) };
            });

            // КРИТИЧНО: подтянуть свежие данные с бэка (новые элементы появятся сразу)
            if (typeof refreshReferences === 'function') {
                await refreshReferences(wcId);
            }

            setDlg(d => ({ ...d, saving: false, open: false }));
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[ComboboxEditor] PATCH ✗', e);
            setDlg(d => ({ ...d, saving: false }));
        }
    }, [dlg, setLocalRefs, refreshReferences]);

    return { dlg, open, close, onChange, save, setDlg };
}
