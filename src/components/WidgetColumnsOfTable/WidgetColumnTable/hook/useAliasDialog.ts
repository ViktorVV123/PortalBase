import {useCallback, useState} from 'react';
import type {WidgetColumn} from '@/shared/hooks/useWorkSpaces';

type UpdateWidgetColumnFn = (
    id: number,
    patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
) => Promise<unknown>;

export function useAliasDialog(callUpdateWidgetColumn: UpdateWidgetColumnFn) {
    // локальные alias-override'ы для мгновенного UI-обновления
    const [aliasOverrides, setAliasOverrides] = useState<Record<number, string | null>>({});

    // состояние модалки
    const [aliasDlg, setAliasDlg] = useState<{
        open: boolean;
        wcId: number | null;
        value: string;
    }>({ open: false, wcId: null, value: '' });

    // открыть по колонке (id + текущее значение)
    const openAliasDialog = useCallback((wc: Pick<WidgetColumn, 'id' | 'alias'>) => {
        setAliasDlg({ open: true, wcId: wc.id, value: wc.alias ?? '' });
    }, []);

    const closeAliasDialog = useCallback(() => {
        setAliasDlg(d => ({ ...d, open: false }));
    }, []);

    // сохранить (PATCH + локальный override)
    const saveAlias = useCallback(async () => {
        if (aliasDlg.wcId == null) return;
        const val = aliasDlg.value.trim();
        await callUpdateWidgetColumn(aliasDlg.wcId, { alias: val || null });
        setAliasOverrides(prev => ({ ...prev, [aliasDlg.wcId!]: val || null }));
        closeAliasDialog();
    }, [aliasDlg.wcId, aliasDlg.value, callUpdateWidgetColumn, closeAliasDialog]);

    return {
        aliasOverrides,
        aliasDlg,
        setAliasDlg,
        openAliasDialog,
        closeAliasDialog,
        saveAlias,
    };
}
