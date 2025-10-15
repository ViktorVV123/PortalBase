import {useEffect, useState} from 'react';
import type {HeaderGroup} from '@/shared/utils/headerGroups';
import {buildHeaderGroupsFromWidgetColumns} from '@/shared/utils/headerGroups';
import type {WidgetColumn} from '@/shared/hooks/useWorkSpaces';
import type {WcReference} from '@/components/WidgetColumnsOfTable/WidgetColumnsOfTable';

/** Инъекция зависимостей делает хук тестируемым и не тянет api внутрь */
type GetColumnsByWidgetId = (widgetId: number) => Promise<WidgetColumn[]>;

export function useSubHeaderGroups(
    currentSubWidgetId: number | null,
    fetchReferences: (widgetColumnId: number) => Promise<WcReference[]>,
    getColumnsByWidgetId: GetColumnsByWidgetId,
) {
    const [subHeaderGroups, setSubHeaderGroups] = useState<HeaderGroup[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!currentSubWidgetId) { setSubHeaderGroups(null); return; }

        (async () => {
            try {
                const subWidgetColumns = await getColumnsByWidgetId(currentSubWidgetId);
                const pairs = await Promise.all(
                    subWidgetColumns.map(async wc => {
                        try { return [wc.id, await fetchReferences(wc.id)] as const; }
                        catch { return [wc.id, wc.reference ?? []] as const; }
                    })
                );
                if (cancelled) return;
                const map: Record<number, WcReference[]> = {};
                for (const [id, refs] of pairs) map[id] = refs;
                setSubHeaderGroups(buildHeaderGroupsFromWidgetColumns(subWidgetColumns, map));
            } catch {
                if (!cancelled) setSubHeaderGroups(null);
            }
        })();

        return () => { cancelled = true; };
    }, [currentSubWidgetId, fetchReferences, getColumnsByWidgetId]);

    return subHeaderGroups;
}
