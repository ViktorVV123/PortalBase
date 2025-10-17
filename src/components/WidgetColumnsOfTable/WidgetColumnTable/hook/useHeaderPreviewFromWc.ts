// components/WidgetColumnsOfTable/WidgetColumnTable/hook/useHeaderPreviewFromWc.ts
import {useMemo} from 'react';
import type {WidgetColumn} from '@/shared/hooks/useWorkSpaces';
import type {HeaderModelItem} from '@/components/formTable/FormTable';

type WcReference = WidgetColumn['reference'][number];

function normRefs(src?: WcReference[] | null) {
    const list = Array.isArray(src) ? src : [];
    return [...list]
        .filter(r => r?.visible !== false) // только видимые
        .sort((a, b) => (a.ref_column_order ?? 0) - (b.ref_column_order ?? 0));
}

function fallback(v?: string | null) {
    const t = (v ?? '').trim();
    return t || '—';
}

function labelsForRef(r: WcReference): string[] {
    if ((r as any).type === 'combobox') {
        const raw = (r as any).combobox;
        if (!Array.isArray(raw)) return [fallback((r as any).ref_alias)];
        const visible = raw
            .filter((it: any) => it?.is_show === true)
            .sort((a: any, b: any) => (a?.combobox_column_order ?? 0) - (b?.combobox_column_order ?? 0));
        const arr = visible.map((it: any) => (it?.combobox_alias ?? '').trim()).filter(Boolean);
        return arr.length ? arr : [fallback((r as any).ref_alias)];
    }
    return [fallback((r as any).ref_alias)];
}

export function useHeaderPreviewFromWc(
    widgetColumns: WidgetColumn[],
    referencesMap: Record<number, WcReference[]>,
    liveRefs?: Record<number, WcReference[]> | null
) {
    return useMemo<HeaderModelItem[]>(() => {
        const ordered = [...(widgetColumns ?? [])].sort(
            (a, b) => (a.column_order ?? 0) - (b.column_order ?? 0) || a.id - b.id
        );

        const groups: HeaderModelItem[] = [];

        for (let i = 0; i < ordered.length; i++) {
            const wc = ordered[i];
            const src =
                (liveRefs && liveRefs[wc.id]) ??
                referencesMap[wc.id] ??
                wc.reference ??
                [];

            const refs = normRefs(src as any);

            // собираем подписи (combobox -> много меток)
            const labels: string[] = [];
            for (let j = 0; j < refs.length; j++) {
                const r = refs[j]!;
                const ls = labelsForRef(r);
                for (let k = 0; k < ls.length; k++) labels.push(ls[k]!);
            }

            // если всё скрыто — пропускаем группу полностью
            if (labels.length === 0) continue;

            groups.push({
                id: wc.id,
                title: (wc.alias ?? '').trim() || `Колонка #${wc.id}`,
                labels,
                span: Math.max(1, labels.length),
            });
        }

        return groups;
    }, [widgetColumns, referencesMap, liveRefs]);
}
