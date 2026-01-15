// components/WidgetColumnsOfTable/WidgetColumnTable/hook/useHeaderPreviewFromWc.ts
import { useMemo } from 'react';
import type { WidgetColumn } from '@/shared/hooks/useWorkSpaces';
import type { HeaderModelItem } from '@/components/Form/formTable/FormTable';

type WcReference = WidgetColumn['reference'][number];

/**
 * Фильтрует только видимые refs и сортирует по ref_column_order
 */
function getVisibleRefs(src?: WcReference[] | null): WcReference[] {
    const list = Array.isArray(src) ? src : [];
    return [...list]
        .filter((r) => r?.visible !== false) // только видимые
        .sort((a, b) => {
            const orderA = a.ref_column_order ?? 0;
            const orderB = b.ref_column_order ?? 0;
            if (orderA !== orderB) return orderA - orderB;
            // Вторичная сортировка для стабильности
            const idA = (a as any).table_column?.id ?? 0;
            const idB = (b as any).table_column?.id ?? 0;
            return idA - idB;
        });
}

/**
 * Возвращает fallback если строка пустая
 */
function fallback(v?: string | null, defaultVal = '—'): string {
    const t = (v ?? '').trim();
    return t || defaultVal;
}

/**
 * Генерирует labels для одного ref
 * Сейчас просто возвращает ref_alias, но можно расширить для combobox
 */
function labelsForRef(r: WcReference): string[] {
    const alias = fallback((r as any).ref_alias);

    // Если это combobox с несколькими элементами — можно добавить их тоже
    // const comboItems = (r as any).combobox;
    // if (Array.isArray(comboItems) && comboItems.length > 1) {
    //     return comboItems
    //         .filter((c: any) => c?.is_show !== false)
    //         .map((c: any) => fallback(c?.combobox_alias, alias));
    // }

    return [alias];
}

/**
 * Хук для генерации модели шапки таблицы из widget columns
 *
 * Приоритет источников данных:
 * 1. liveRefs (локальное состояние после DnD)
 * 2. referencesMap (загруженное с сервера)
 * 3. wc.reference (fallback из самого widget column)
 */
export function useHeaderPreviewFromWc(
    widgetColumns: WidgetColumn[],
    referencesMap: Record<number, WcReference[]>,
    liveRefs?: Record<number, WcReference[]> | null
): HeaderModelItem[] {
    return useMemo<HeaderModelItem[]>(() => {
        // Сортируем группы по column_order
        const ordered = [...(widgetColumns ?? [])].sort(
            (a, b) => (a.column_order ?? 0) - (b.column_order ?? 0) || a.id - b.id
        );

        const groups: HeaderModelItem[] = [];

        for (const wc of ordered) {
            // Приоритет: liveRefs > referencesMap > wc.reference
            const src =
                liveRefs?.[wc.id] ??
                referencesMap[wc.id] ??
                wc.reference ??
                [];

            // Берём только ВИДИМЫЕ refs
            const visibleRefs = getVisibleRefs(src as any);

            // Если нет видимых refs — пропускаем группу
            if (visibleRefs.length === 0) {
                continue;
            }

            // Собираем labels для всех видимых refs
            const labels: string[] = [];
            for (const r of visibleRefs) {
                const refLabels = labelsForRef(r);
                labels.push(...refLabels);
            }

            // Если после сбора labels пусто — пропускаем
            if (labels.length === 0) {
                continue;
            }

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