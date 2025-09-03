// utils/headerGroups.ts
import {WidgetColumn} from "@/shared/hooks/useWorkSpaces";

export type HeaderGroup = {
    id: number;
    title: string;
    labels: string[];
    refIds: number[];
    span: number;
    order: number;
};

type Wc = WidgetColumn;           // если у тебя алиас
type WcReference = WidgetColumn['reference'][number];

export function buildHeaderGroupsFromWidgetColumns(
    widgetColumns: Wc[],
    referencesMap: Record<number, WcReference[]>, // wc.id -> refs[]
): HeaderGroup[] {
    const items = widgetColumns
        .map((wc) => {
            const refs = referencesMap[wc.id] ?? wc.reference ?? [];

            // Группа видима, если есть хотя бы один "видимый" ref
            const groupVisible = refs.some(r => r.visible !== false);
            if (!groupVisible) return null;

            const title =
                (wc.alias ?? '').trim() ||
                refs[0]?.table_column?.name ||
                `Колонка #${wc.id}`;

            const labels = refs.length
                ? refs.map(r => r.ref_alias || '')
                : ['—'];

            const refIds = refs
                .map(r => r.table_column?.id)
                .filter((id): id is number => !!id);

            return {
                id: wc.id,
                title,
                labels,
                refIds,
                span: Math.max(1, refs.length || 1),
                order: wc.column_order ?? 0,
            };
        })
        .filter(Boolean) as HeaderGroup[];

    items.sort((a, b) => (a.order - b.order) || (a.id - b.id));
    return items;
}
