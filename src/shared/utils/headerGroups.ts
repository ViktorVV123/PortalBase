// src/shared/headerGroups.ts
export type HeaderGroup = {
    id: number;            // widget_column_id
    title: string;
    labels: string[];      // ref_alias'ы (или fallback)
    refIds: number[];      // порядок reference по table_column_id
};

type Wc = { id: number; alias?: string|null; visible: boolean; column_order?: number; reference?: any[] };

export function buildHeaderGroupsFromWidgetColumns(
    widgetColumns: Wc[],
    referencesMap: Record<number, any[]>   // wc.id -> refs[]
): HeaderGroup[] {
    const items = widgetColumns
        .filter(wc => wc.visible !== false)
        .map((wc) => {
            const refs = referencesMap[wc.id] ?? wc.reference ?? [];

            const title =
                (wc.alias ?? '').trim() ||
                refs[0]?.table_column?.name ||
                `Колонка #${wc.id}`;

            const labels =
                refs.length > 0
                    ? refs.map((r: any) => r.ref_alias || '')
                    : ['—'];

            const refIds =
                refs.length > 0
                    ? refs.map((r: any) => r.table_column?.id).filter(Boolean)
                    : [];

            return { id: wc.id, title, labels, refIds };
        });

    // порядок пусть задаётся по column_order, если нужно — добавь сортировку тут
    return items;
}
