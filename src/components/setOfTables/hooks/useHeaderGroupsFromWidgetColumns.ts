import {useMemo} from 'react';
import type {WidgetColumn} from '@/shared/hooks/useWorkSpaces';
import type {HeaderGroup} from '@/shared/utils/headerGroups';
import type {WcReference} from '@/components/WidgetColumnsOfTable/WidgetColumnsOfTable';

export function useHeaderGroupsFromWidgetColumns(
    widgetColumns: WidgetColumn[] | undefined,
    referencesMap: Record<number, WcReference[]>,
    liveRefsForHeader: Record<number, WcReference[]> | null,
): HeaderGroup[] {
    return useMemo(() => {
        if (!widgetColumns?.length) return [];
        const rows = widgetColumns
            .map(wc => {
                const refs = (liveRefsForHeader?.[wc.id] ?? referencesMap[wc.id] ?? wc.reference ?? [])
                    .filter(r => r?.visible !== false);
                if (!refs.length) return null;
                const title = (wc.alias || refs[0]?.table_column?.name || `Колонка #${wc.id}`).trim();
                const labels = refs.map(r => r.ref_alias || '');
                const refIds = refs.map(r => r.table_column?.id).filter((id): id is number => typeof id === 'number');
                const order = wc.column_order ?? 0;
                return { id: wc.id, order, title, span: Math.max(1, refs.length), labels, refIds };
            })
            .filter(Boolean) as HeaderGroup[];
        rows.sort((a, b) => a.order - b.order || a.id - b.id);
        return rows;
    }, [widgetColumns, referencesMap, liveRefsForHeader]);
}
