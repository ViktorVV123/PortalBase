import {useCallback, useState} from 'react';
import {api} from '@/services/api';
import {reindex} from '@/components/WidgetColumnsOfTable/ref-helpers';
import type {RefItem} from '@/components/WidgetColumnsOfTable/types';

type FlexibleFormCache = Partial<{
    main_widget_id: number;
    form_id: number;
    name: string;
}>;

type Deps = {
    localRefsRef: React.MutableRefObject<Record<number, RefItem[]>>;
    setLocalRefs: React.Dispatch<React.SetStateAction<Record<number, RefItem[]>>>;
    refreshReferences?: (wcId: number) => Promise<void>;

    /** Может быть без main_widget_id — тогда используем resolveMainWidgetId */
    formsById?: Record<number, FlexibleFormCache>;

    /** Колбэк-резолвер на случай, если в formsById нет main_widget_id */
    resolveMainWidgetId?: (formId: number) => Promise<number | null>;
};

export type OpenComboResult =
    | { ok: true }
    | { ok: false; reason: 'NO_FORM' | 'NO_TABLE' | 'NO_TYPE' };



type Draft = {
    open: boolean;
    saving: boolean;
    wcId: number | null;
    tableColumnId: number | null;
    value: {
        /** используется только для фильтрации колонок в диалоге; руками не вводится */
        table_id: number | null;

        /** обязательный для PATCH path */
        combobox_column_id: number | null;
        combobox_width: number;
        combobox_column_order: number;
        combobox_alias: string;
        is_primary: boolean;
        is_show: boolean;
        is_show_hidden: boolean;
    };
};

const comboKeyOf = (it: any) =>
    it?.combobox_column?.id ?? it?.combobox_column_id ?? it?.id ?? -1;

export function useComboboxCreate({
                                      localRefsRef,
                                      setLocalRefs,
                                      refreshReferences,
                                      formsById,
                                      resolveMainWidgetId,
                                  }: Deps) {
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

    const findRow = useCallback((wcId: number, tableColumnId: number): RefItem | undefined => {
        const list = localRefsRef.current?.[wcId] ?? [];
        return list.find(x => (x.table_column?.id as number) === tableColumnId);
    }, [localRefsRef]);

    /** достаём main_widget_id: из r.form, либо из formsById, либо через resolveMainWidgetId */
    const getMainWidgetId = useCallback(async (row: RefItem): Promise<number | null> => {
        const raw: any = row;

        // 1) уже лежит в r.form?
        if (raw?.form?.main_widget_id) {
            const n = Number(raw.form.main_widget_id);
            return Number.isFinite(n) ? n : null;
        }

        // 2) возьмём form_id
        const formId: number | null = raw?.form_id ?? raw?.form?.form_id ?? null;
        if (!formId) return null;

        // 3) попробуем из кэша
        const cached = formsById?.[formId];
        if (cached?.main_widget_id != null) {
            const n = Number(cached.main_widget_id);
            if (Number.isFinite(n)) return n;
        }

        // 4) последний шанс — внешний резолвер
        if (resolveMainWidgetId) {
            try {
                const n = await resolveMainWidgetId(formId);
                return Number.isFinite(n as number) ? (n as number) : null;
            } catch {
                /* ignore */
            }
        }

        return null;
    }, [formsById, resolveMainWidgetId]);

    /** по main_widget_id достаём table_id */
    const fetchTableIdByMainWidget = useCallback(async (mainWidgetId: number): Promise<number | null> => {
        try {
            const { data } = await api.get(`/widgets/${mainWidgetId}`);
            const tableId = (data?.table_id as number) ?? (data?.table?.id as number) ?? null;
            return Number.isFinite(tableId) ? tableId : null;
        } catch {
            return null;
        }
    }, []);

    /**
     * Открыть диалог создания combobox.
     * Если для строки нельзя определить table_id (нет формы/нет таблицы) — возвращаем ok:false.
     */
    const open = useCallback(async (
        wcId: number,
        tableColumnId: number,
        preset?: Partial<Draft['value']>
    ): Promise<OpenComboResult> => {
        const row = findRow(wcId, tableColumnId);
        if (!row) return { ok: false, reason: 'NO_TABLE' };

        const raw: any = row;
        const rowType: string | null =
            (raw.type as string | null) ??
            (raw.ref_type as string | null) ??
            null;

        if (!rowType || rowType.toLowerCase() !== 'combobox') {
            // тип не выбран или не combobox
            return { ok: false, reason: 'NO_TYPE' };
        }


        const mainWidgetId = await getMainWidgetId(row);
        if (!mainWidgetId) return { ok: false, reason: 'NO_FORM' };

        const tableIdFromForm = await fetchTableIdByMainWidget(mainWidgetId);
        if (!tableIdFromForm) return { ok: false, reason: 'NO_TABLE' };

        const currentItems: any[] = Array.isArray((row as any)?.combobox) ? (row as any).combobox : [];
        const nextOrder = Number.isFinite(preset?.combobox_column_order as any)
            ? Number(preset!.combobox_column_order)
            : currentItems.length;

        setDlg({
            open: true,
            saving: false,
            wcId,
            tableColumnId,
            value: {
                table_id: tableIdFromForm,                 // ← у каждой строки свой table_id
                combobox_column_id: preset?.combobox_column_id ?? null,
                combobox_width: Math.max(1, Math.trunc(preset?.combobox_width ?? 1)),
                combobox_column_order: Math.max(0, Math.trunc(nextOrder)),
                combobox_alias: (preset?.combobox_alias ?? '').toString(),
                is_primary: !!preset?.is_primary,
                is_show: preset?.is_show ?? true,
                is_show_hidden: !!preset?.is_show_hidden,
            },
        });

        return { ok: true };
    }, [findRow, getMainWidgetId, fetchTableIdByMainWidget]);

    const close = useCallback(() => setDlg(d => ({ ...d, open: false })), []);

    const onChange = useCallback((patch: Partial<Draft['value']>) => {
        setDlg(d => ({ ...d, value: { ...d.value, ...patch } }));
    }, []);

    /** PATCH upsert combobox-элемента */
    const save = useCallback(async () => {
        const { wcId, tableColumnId, value } = dlg;
        if (wcId == null || tableColumnId == null || value.combobox_column_id == null) {
            console.warn('[ComboboxCreate] Missing ids', dlg);
            return;
        }

        // 1) определяем, есть ли уже такой combobox в локальном состоянии
        const list = localRefsRef.current?.[wcId] ?? [];
        const row = list.find(r => (r.table_column?.id as number) === tableColumnId) as any;
        const orig: any[] = Array.isArray(row?.combobox) ? row.combobox : [];
        const key = Number(value.combobox_column_id);
        const exists = orig.some(it =>
            (it?.combobox_column?.id ?? it?.combobox_column_id ?? it?.id) === key
        );

        // 2) нормализуем payload
        const body = {
            combobox_width: Math.max(1, Math.trunc(+value.combobox_width || 1)),
            combobox_column_order: Math.max(0, Math.trunc(+value.combobox_column_order || 0)),
            combobox_alias: (value.combobox_alias ?? '').trim(),
            is_primary: !!value.is_primary,
            is_show: !!value.is_show,
            is_show_hidden: !!value.is_show_hidden,
        };

        const url = `/widgets/tables/references/${wcId}/${tableColumnId}/${key}`;

        try {
            setDlg(d => ({ ...d, saving: true }));

            // 3) CREATE vs UPDATE
            if (exists) {
                await api.patch(url, body);
            } else {
                await api.post(url, body);
            }

            // 4) оптимистичный апдейт локального стора
            setLocalRefs(prev => {
                const group = prev[wcId] ?? [];
                const updated = group.map((r: any) => {
                    if (r.table_column?.id !== tableColumnId) return r;

                    const current: any[] = Array.isArray(r.combobox) ? r.combobox : [];
                    const next = exists
                        ? current.map(it =>
                            (it?.combobox_column?.id ?? it?.combobox_column_id ?? it?.id) === key
                                ? { ...it, ...body }
                                : { ...it }
                        )
                        : current.concat([{ id: key, combobox_column_id: key, ...body }]);

                    // единственный primary
                    if (body.is_primary) {
                        for (const it of next) {
                            const idOf = it?.combobox_column?.id ?? it?.combobox_column_id ?? it?.id;
                            if (idOf !== key && it.is_primary) it.is_primary = false;
                        }
                    }

                    // порядок
                    next
                        .sort((a, b) => (a?.combobox_column_order ?? 0) - (b?.combobox_column_order ?? 0))
                        .forEach((it, idx) => { it.combobox_column_order = idx; });

                    return { ...r, combobox: next };
                });

                return { ...prev, [wcId]: reindex(updated) };
            });

            // 5) подтянуть с сервера (нужны реальные id nested-объектов)
            await refreshReferences?.(wcId);

            setDlg(d => ({ ...d, saving: false, open: false }));
        } catch (e: any) {
            console.warn('[ComboboxCreate] SAVE error', { exists, method: exists ? 'PATCH' : 'POST', url, body, e });
            // полезно увидеть ответ бэка в консоли
            // alert можно тоже добавить, если надо:
            // alert(`Не удалось сохранить combobox (${exists ? 'редактирование' : 'создание'}). Код: ${e?.response?.status ?? '—'}`);
            setDlg(d => ({ ...d, saving: false }));
        }
    }, [dlg, localRefsRef, setLocalRefs, refreshReferences]);


    return { dlg, open, close, onChange, save, setDlg };
}
