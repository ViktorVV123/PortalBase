import React, { useMemo } from 'react';
import * as s from "@/components/setOfTables/SetOfTables.module.scss";
import { SubDisplay } from "@/shared/hooks/useWorkSpaces";

type SubformProps = {
    subDisplay: SubDisplay | null;
    handleTabClick: (order: number) => void;
    subLoading: any;
    subError: any;
};

export const SubWormTable = ({
                                 subDisplay,
                                 handleTabClick,
                                 subLoading,
                                 subError,
                             }: SubformProps) => {
    // Без данных — просто табы/плейсхолдер
    const hasTabs = (subDisplay?.sub_widgets?.length ?? 0) > 0;

    // ───────── Подготовка колонок и шапки ─────────
    const sortedColumns = useMemo(() => {
        const cols = subDisplay?.columns ?? [];
        return [...cols].sort(
            (a, b) => (a.column_order ?? 0) - (b.column_order ?? 0)
        );
    }, [subDisplay?.columns]);

    /**
     * Группируем последовательно, как фолбэк в FormTable:
     * ключ группы — (column_name, widget_column_id)
     * title = column_name
     * labels = subcolumn_name | '—'
     */
    const headerPlan = useMemo(() => {
        const groups: {
            id: number;
            title: string;
            labels: string[];
            cols: typeof sortedColumns;
        }[] = [];

        let i = 0;
        while (i < sortedColumns.length) {
            const name = sortedColumns[i].column_name;
            const wcId = sortedColumns[i].widget_column_id;
            const cols: typeof sortedColumns = [];

            while (
                i < sortedColumns.length &&
                sortedColumns[i].column_name === name &&
                sortedColumns[i].widget_column_id === wcId
                ) {
                cols.push(sortedColumns[i]);
                i++;
            }

            const labels = cols.map(
                (c) => (c as any).subcolumn_name ?? "—"
            );

            groups.push({
                id: wcId,
                title: name ?? `Колонка #${wcId}`,
                labels,
                cols,
            });
        }
        return groups;
    }, [sortedColumns]);

    // Плоский порядок колонок, как в FormTable
    const flatColumnsInRenderOrder = useMemo(
        () => headerPlan.flatMap((g) => g.cols),
        [headerPlan]
    );

    // Индекс значения по ключу «wcId:tableColId», чтобы корректно маппить values после нашей сортировки
    const valueIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        (subDisplay?.columns ?? []).forEach((c, i) => {
            const key = `${c.widget_column_id}:${c.table_column_id ?? -1}`;
            map.set(key, i);
        });
        return map;
    }, [subDisplay?.columns]);

    return (
        <div>
            {hasTabs && (
                <ul className={s.tabs}>
                    {subDisplay!.sub_widgets.map((sw) => {
                        const isActive =
                            sw.widget_order === subDisplay!.displayed_widget.widget_order;
                        return (
                            <li key={sw.widget_order}>
                                <button
                                    className={isActive ? s.tabActive : s.tab}
                                    onClick={() => handleTabClick(sw.widget_order)}
                                >
                                    {sw.name}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {!subDisplay ? null : subLoading ? (
                <p>Загрузка sub-виджета…</p>
            ) : subError ? (
                <p className={s.error}>{subError}</p>
            ) : (
                <table className={s.tbl}>
                    <thead>
                    {/* верхняя строка — названия групп */}
                    <tr>
                        {headerPlan.map((g) => (
                            <th key={`sub-g-top-${g.id}`} colSpan={g.cols.length || 1}>
                                {g.title}
                            </th>
                        ))}
                    </tr>

                    {/* нижняя строка — подписи для каждой «реальной» колонки */}
                    <tr>
                        {headerPlan.map((g) =>
                            g.labels.slice(0, g.cols.length).map((label, idx) => (
                                <th key={`sub-g-sub-${g.id}-${idx}`}>{label}</th>
                            ))
                        )}
                    </tr>
                    </thead>

                    <tbody>
                    {subDisplay.data.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                            {flatColumnsInRenderOrder.map((col) => {
                                const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                                const idx = valueIndexByKey.get(key);
                                const val = idx != null ? row.values[idx] : "";
                                return (
                                    <td key={`sub-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}>
                                        {val}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};
