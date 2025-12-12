// components/Form/mainTable/MainTable.tsx
import React from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

import { MainTableAddRow } from './MainTableAddRow';
import { MainTableRow } from './MainTableRow';

// "логическая" ширина колонок из бэка → проценты
const DEFAULT_COL_WIDTH = 20; // если width не задан
const MIN_COL_WIDTH = 15;      // чтобы колонка не была совсем иголкой
const MAX_COL_WIDTH = 850;     // чтобы одна не съедала весь экран

type HeaderPlanGroup = {
    id: number;
    title: string;
    labels: string[];
    cols: ExtCol[];
};

type RowView = { row: FormDisplay['data'][number]; idx: number };

type Props = {
    headerPlan: HeaderPlanGroup[];
    showSubHeaders: boolean;
    onToggleSubHeaders: () => void;

    isAdding: boolean;
    draft: Record<number, string>;
    onDraftChange: (tcId: number, v: string) => void;

    flatColumnsInRenderOrder: ExtCol[];
    isColReadOnly: (c: ExtCol) => boolean;
    placeholderFor: (c: ExtCol) => string;

    filteredRows: RowView[];
    valueIndexByKey: Map<string, number>;

    selectedKey: string | null;
    pkToKey: (pk: Record<string, unknown>) => string;
    editingRowIdx: number | null;
    editDraft: Record<number, string>;
    onEditDraftChange: (tcId: number, v: string) => void;
    onSubmitEdit: () => void;
    onCancelEdit: () => void;
    editSaving: boolean;

    onRowClick: (view: RowView) => void;
    onStartEdit: (rowIdx: number) => void;
    onDeleteRow: (rowIdx: number) => void;
    deletingRowIdx: number | null;

    disableDrillWhileEditing?: boolean;

    onOpenDrill?: (
        fid?: number | null,
        meta?: {
            originColumnType?: 'combobox' | null;
            primary?: Record<string, unknown>;
            openedFromEdit?: boolean;
            targetWriteTcId?: number;
        }
    ) => void;

    /** триггер для перезагрузки combobox-опций после CRUD в DrillDialog */
    comboReloadToken?: number;
};

export const MainTable: React.FC<Props> = (p) => {
    const rlsMeta = React.useMemo(() => {
        const col = p.flatColumnsInRenderOrder.find(c => c.type === 'rls');
        if (!col) return null;

        const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
        const idx = p.valueIndexByKey.get(key);

        if (idx == null) return null;
        return { col, idx };
    }, [p.flatColumnsInRenderOrder, p.valueIndexByKey]);

    const colWidths = React.useMemo(() => {
        return p.flatColumnsInRenderOrder.map((col) => {
            const raw = Number((col as any).width);

            let w = Number.isFinite(raw) && raw > 0
                ? raw
                : DEFAULT_COL_WIDTH;

            if (w < MIN_COL_WIDTH) w = MIN_COL_WIDTH;
            if (w > MAX_COL_WIDTH) w = MAX_COL_WIDTH;

            // интерпретируем как проценты от ширины таблицы
            return `${w}%`;
        });
    }, [p.flatColumnsInRenderOrder]);

    const drillDisabled = p.disableDrillWhileEditing && p.editingRowIdx != null;

    return (
        <div style={{paddingBottom:20}}>
            <table className={s.tbl}>
                <colgroup>
                    {p.flatColumnsInRenderOrder.map((col, idx) => (
                        <col
                            key={`col-${col.widget_column_id}-${col.table_column_id ?? 'null'}-${(col as any).combobox_column_id ?? 'null'}`}
                            style={{ width: colWidths[idx] }}
                        />
                    ))}
                    {/* actions-колонка: минимальная ширина под иконки + не раздувается остатками ширины */}
                    <col
                        style={{
                            width: '1%',      // браузер старается сделать колонку как можно уже
                            minWidth: 56,     // но не меньше нужного под две иконки
                            maxWidth: 80,
                        }}
                    />
                </colgroup>

                <thead>
                <tr>
                    {p.headerPlan.map(g => (
                        <th key={`g-top-${g.id}`} colSpan={g.cols.length || 1}>
                            <span className={s.ellipsis}>{g.title}</span>
                        </th>
                    ))}
                    <th className={s.actionsCell}>
                        <button
                            type="button"
                            className={s.actionsBtn}
                            onClick={p.onToggleSubHeaders}
                            aria-label={p.showSubHeaders ? 'Скрыть подзаголовки' : 'Показать подзаголовки'}
                        >
                            {p.showSubHeaders ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
                        </button>
                    </th>
                </tr>
                {p.showSubHeaders && (
                    <tr>
                        {p.headerPlan.map(g => {
                            const span = g.cols.length || 1;
                            const label = (g.labels?.[0] ?? '—');
                            return (
                                <th key={`g-sub-${g.id}`} colSpan={span}>
                                    <span className={s.ellipsis}>{label}</span>
                                </th>
                            );
                        })}
                        <th className={s.actionsCell} />
                    </tr>
                )}
                </thead>

                <tbody>
                {/* ───────── Добавление ───────── */}
                {p.isAdding && (
                    <MainTableAddRow
                        flatColumnsInRenderOrder={p.flatColumnsInRenderOrder}
                        draft={p.draft}
                        onDraftChange={p.onDraftChange}
                        placeholderFor={p.placeholderFor}
                        comboReloadToken={p.comboReloadToken}
                    />
                )}

                {/* ───────── Основные строки ───────── */}
                {p.filteredRows.map((rowView) => (
                    <MainTableRow
                        key={p.pkToKey(rowView.row.primary_keys)}
                        rowView={rowView}
                        flatColumnsInRenderOrder={p.flatColumnsInRenderOrder}
                        valueIndexByKey={p.valueIndexByKey}
                        isColReadOnly={p.isColReadOnly}
                        placeholderFor={p.placeholderFor}
                        editingRowIdx={p.editingRowIdx}
                        editDraft={p.editDraft}
                        onEditDraftChange={p.onEditDraftChange}
                        onSubmitEdit={p.onSubmitEdit}
                        onCancelEdit={p.onCancelEdit}
                        editSaving={p.editSaving}
                        selectedKey={p.selectedKey}
                        pkToKey={p.pkToKey}
                        onRowClick={p.onRowClick}
                        onStartEdit={p.onStartEdit}
                        onDeleteRow={p.onDeleteRow}
                        deletingRowIdx={p.deletingRowIdx}
                        onOpenDrill={p.onOpenDrill}
                        disableDrillWhileEditing={drillDisabled}
                        comboReloadToken={p.comboReloadToken}
                        rlsMeta={rlsMeta}
                    />
                ))}
                </tbody>
            </table>
        </div>
    );
};
