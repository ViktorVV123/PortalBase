import React, {useEffect, useMemo, useState} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {
    FormDisplay,
    SubDisplay,
    WidgetForm,
    FormTreeColumn, Widget
} from '@/shared/hooks/useWorkSpaces';
import {api} from "@/services/api";
import {SubWormTable} from "@/components/formTable/SubFormTable";
import {TreeFormTable} from "@/components/formTable/TreeFormTable";

/** Модель шапки, приходящая из WidgetColumnsOfTable (твой headerGroups) */
export type HeaderModelItem = {
    id: number;          // widget_column_id
    title: string;       // заголовок группы (alias/fallback)
    labels: string[];    // подписи для каждой reference в группе (ref_alias / name)
    visible?: boolean;   // видимость группы (WC.visible)
    /** порядок reference внутри группы по table_column_id (опц.) */
    refIds?: number[];
};

type Props = {
    formDisplay: FormDisplay;
    loadSubDisplay: (
        formId: number,
        subOrder: number,
        primary?: Record<string, unknown>,
    ) => void;
    formsByWidget: Record<number, WidgetForm>;
    selectedWidget: Widget | null;
    selectedFormId: number | null;
    subDisplay: SubDisplay | null;
    subLoading: boolean;
    subError: string | null;
    formTrees: Record<number, FormTreeColumn[]>;
    loadFilteredFormDisplay: (formId: number, filter: {
        table_column_id: number;
        value: string | number
    }) => Promise<void>;
    setFormDisplay: (value: FormDisplay | null) => void;
    setSubDisplay: (value: SubDisplay | null) => void;

    /** ⬅️ новое: живая модель шапки (из WidgetColumnsOfTable.headerGroups) */
    headerGroups?: HeaderModelItem[];
};

export const FormTable: React.FC<Props> = ({
                                               formDisplay,
                                               selectedWidget,
                                               selectedFormId,
                                               subDisplay,
                                               subLoading,
                                               subError,
                                               formsByWidget,
                                               loadSubDisplay,
                                               formTrees,
                                               loadFilteredFormDisplay,
                                               setFormDisplay,
                                               setSubDisplay,
                                               headerGroups,
                                           }) => {
    const [lastPrimary, setLastPrimary] = useState<Record<string, unknown>>({});
    const [activeSubOrder, setActiveSubOrder] = useState<number>(0);
    const [activeFilters, setActiveFilters] = useState<
        { table_column_id: number; value: string | number }[]
    >([]);
    const [nestedTrees, setNestedTrees] = useState<Record<string, FormTreeColumn[]>>({});
    const [activeExpandedKey, setActiveExpandedKey] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedWidget) return;
        const widgetForm = formsByWidget[selectedWidget.id];
        if (!widgetForm) return;
        const order0 = widgetForm.sub_widgets[0]?.widget_order ?? 0;
        setActiveSubOrder(order0);
        setSubDisplay(null);
    }, [selectedWidget, formsByWidget, loadSubDisplay, setSubDisplay]);

    const handleRowClick = (rowPk: Record<string, unknown>) => {
        const widgetForm = formsByWidget[selectedWidget!.id];
        if (!widgetForm) return;
        setLastPrimary(rowPk);
        loadSubDisplay(widgetForm.form_id, activeSubOrder, rowPk);
    };

    const handleTabClick = (order: number) => {
        if (order === activeSubOrder) return;
        const widgetForm = formsByWidget[selectedWidget!.id];
        if (!widgetForm) return;
        setActiveSubOrder(order);
        if (Object.keys(lastPrimary).length === 0) return;
        loadSubDisplay(widgetForm.form_id, order, lastPrimary);
    };

    const handleResetFilters = async () => {
        if (!selectedFormId || !selectedWidget) return;
        setActiveFilters([]);
        setActiveExpandedKey(null);
        setLastPrimary({});
        setSubDisplay(null);
        setActiveSubOrder(0);
        try {
            const {data} = await api.post<FormDisplay>(`/display/${selectedFormId}/main`, []);
            setFormDisplay(data);
        } catch (e) {
            console.warn('❌ Ошибка при сбросе фильтров:', e);
        }
    };

    // сортировка исходных колонок так же, как раньше
    const sortedColumns = useMemo(
        () => [...formDisplay.columns].sort((a, b) => a.column_order - b.column_order),
        [formDisplay.columns]
    );

    /** Группировка по widget_column_id — надёжнее, чем по column_name */
    const byWcId = useMemo(() => {
        const map: Record<number, typeof sortedColumns> = {};
        for (const col of sortedColumns) {
            const k = col.widget_column_id;
            (map[k] ||= []).push(col);
        }
        return map;
    }, [sortedColumns]);

    /** Если headerModel есть — строим порядок и заголовки по нему. Иначе — старый фолбэк. */
    const headerPlan = useMemo(() => {
        if (!headerGroups || headerGroups.length === 0) {
            // fallback: группируем по column_name подряд
            const groups = [] as { id: number; title: string; labels: string[]; cols: typeof sortedColumns }[];
            let i = 0;
            while (i < sortedColumns.length) {
                const name = sortedColumns[i].column_name;
                const wcId = sortedColumns[i].widget_column_id;
                const cols: typeof sortedColumns = [];
                while (i < sortedColumns.length &&
                sortedColumns[i].column_name === name &&
                sortedColumns[i].widget_column_id === wcId) {
                    cols.push(sortedColumns[i]); i++;
                }
                groups.push({
                    id: wcId,
                    title: name,
                    labels: cols.map(() => '—'),
                    cols,
                });
            }
            return groups;
        }

        // нормальный путь: используем headerModel
        // 1) берём только видимые группы
        const visibleGroups = headerGroups.filter(g => g.visible !== false);

        const planned = visibleGroups.map(g => {
            // исходные «реальные» колонки для этой группы
            let cols = (byWcId[g.id] ?? []).slice();

            // ⬅️ НОВОЕ: если есть порядок refIds — применяем его
            if (g.refIds && g.refIds.length) {
                const pos = new Map<number, number>();
                g.refIds.forEach((id, i) => pos.set(id, i));

                cols.sort((a, b) => {
                    const ai = pos.has(a.table_column_id) ? pos.get(a.table_column_id)! : Number.MAX_SAFE_INTEGER;
                    const bi = pos.has(b.table_column_id) ? pos.get(b.table_column_id)! : Number.MAX_SAFE_INTEGER;
                    return ai - bi;
                });
            }

            // приводим labels к длине cols
            const labels = (g.labels ?? []).slice(0, cols.length);
            while (labels.length < cols.length) labels.push('—');

            return { id: g.id, title: g.title, labels, cols };
        });

        return planned;
    }, [headerGroups, byWcId, sortedColumns]);
    /** Плоский порядок колонок для рендера тела таблицы */
    const flatColumnsInRenderOrder = useMemo(
        () => headerPlan.flatMap(g => g.cols),
        [headerPlan]
    );

    const tree = selectedFormId ? formTrees[selectedFormId] : null;
    const widgetForm = selectedWidget ? formsByWidget[selectedWidget.id] : null;

    // Карта: "wcId:tableColId" -> индекс в row.values
    const valueIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        formDisplay.columns.forEach((c, i) => {
            const k = `${c.widget_column_id}:${c.table_column_id ?? -1}`;
            map.set(k, i);
        });
        return map;
    }, [formDisplay.columns]);

    return (
        <div style={{display: 'flex', gap: 10}}>
            {/* TREE BLOCK */}
            <TreeFormTable
                tree={tree}
                widgetForm={widgetForm}
                activeExpandedKey={activeExpandedKey}
                handleNestedValueClick={async (table_column_id, value) => {
                    if (!selectedFormId) return;
                    const newFilter = {table_column_id, value};
                    const filters = [
                        ...activeFilters.filter(f => f.table_column_id !== table_column_id),
                        newFilter
                    ];
                    try {
                        const {data} = await api.post<FormDisplay>(`/display/${selectedFormId}/main`, filters);
                        setFormDisplay(data);
                    } catch (e) {
                        console.warn('❌ Ошибка nested фильтра:', e);
                    }
                }}
                nestedTrees={nestedTrees}
                handleTreeValueClick={async (table_column_id, value) => {
                    if (!selectedFormId) return;
                    const filters = [{table_column_id, value}];
                    try {
                        const {data: mainData} = await api.post<FormDisplay>(`/display/${selectedFormId}/main`, filters);
                        setFormDisplay(mainData);

                        const {data} = await api.post<FormTreeColumn[] | FormTreeColumn>(
                            `/display/${selectedFormId}/tree`,
                            filters
                        );
                        const normalized = Array.isArray(data) ? data : [data];
                        const key = `${table_column_id}-${value}`;
                        setNestedTrees(prev => ({...prev, [key]: normalized}));
                        setActiveExpandedKey(key);
                    } catch (e) {
                        console.warn('❌ Ошибка handleTreeValueClick:', e);
                    }
                }}
                handleResetFilters={handleResetFilters}
            />

            {/* MAIN + SUB */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                <table className={s.tbl}>
                    <thead>
                    {/* верхняя строка — названия групп */}
                    <tr>
                        {headerPlan.map(g => (
                            <th key={`g-top-${g.id}`} colSpan={g.cols.length || 1}>
                                {g.title}
                            </th>
                        ))}
                    </tr>

                    {/* нижняя строка — подписи для каждой «реальной» колонки в группе */}
                    <tr>
                        {headerPlan.map(g =>
                            g.labels.slice(0, g.cols.length).map((label, idx) => (
                                <th key={`g-sub-${g.id}-${idx}`}>{label}</th>
                            ))
                        )}
                    </tr>
                    </thead>

                    <tbody>
                    {formDisplay.data.map((row, rowIdx) => (
                        <tr key={rowIdx} onClick={() => {
                            const pkObj = Object.fromEntries(
                                Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
                            );
                            handleRowClick(pkObj);
                        }}>
                            {flatColumnsInRenderOrder.map(col => {
                                const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                                const idx = valueIndexByKey.get(key);

                                const val = idx != null ? row.values[idx] : ''; // если нет индекса — пусто/фолбэк
                                return (
                                    <td key={`r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}>
                                        {val}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    </tbody>
                </table>

                <SubWormTable subLoading={subLoading} subError={subError} subDisplay={subDisplay}
                              handleTabClick={handleTabClick}/>
            </div>
        </div>
    );
};
