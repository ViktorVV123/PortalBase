// src/components/Form/mainTable/MainTable.tsx
import React from 'react';
import * as s from './MainTable.module.scss';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Tooltip } from '@mui/material';

import { MainTableAddRow } from './MainTableAddRow';
import { MainTableRow } from './MainTableRow';
import { isColumnRequired } from '@/shared/utils/requiredValidation/requiredValidation';


// ═══════════════════════════════════════════════════════════
// ШИРИНА КОЛОНОК — УМНАЯ ЛОГИКА
// ═══════════════════════════════════════════════════════════

type ColWithDatatype = ExtCol & {
    datatype?: string | null;
    width?: number | null;
    column_name?: string | null;
};

const isCheckboxColumn = (col: ColWithDatatype): boolean => {
    const type = (col.type ?? '').toLowerCase();
    const dt = (col.datatype ?? '').toLowerCase();

    return (
        type === 'checkbox' ||
        type === 'bool' ||
        type === 'boolean' ||
        dt === 'boolean' ||
        dt === 'bool'
    );
};

const getColWidthConfig = (col: ColWithDatatype): {
    min: number;
    max: number;
    preferred: number;
    fixed: boolean;
} => {
    const dt = (col.datatype ?? '').toLowerCase();
    const type = (col.type ?? '').toLowerCase();

    if (isCheckboxColumn(col)) {
        return { min: 50, max: 90, preferred: 70, fixed: true };
    }

    if (type === 'rls') {
        return { min: 40, max: 60, preferred: 50, fixed: true };
    }

    if (type === 'combobox') {
        return { min: 80, max: 200, preferred: 120, fixed: false };
    }

    if (/int|numeric|number|float|double|real|money|decimal/.test(dt)) {
        return { min: 60, max: 120, preferred: 80, fixed: false };
    }

    if (dt === 'date' || type === 'date') {
        return { min: 90, max: 120, preferred: 100, fixed: false };
    }

    if (dt === 'time' || dt === 'timetz' || type === 'time' || type === 'timetz') {
        return { min: 70, max: 100, preferred: 85, fixed: false };
    }

    if (
        dt.includes('timestamp') ||
        dt.includes('datetime') ||
        type.includes('timestamp') ||
        type === 'timestamptz' ||
        type === 'timestampwtz'
    ) {
        return { min: 130, max: 200, preferred: 160, fixed: false };
    }

    return { min: 100, max: 400, preferred: 200, fixed: false };
};

const calcColStyles = (cols: ColWithDatatype[]): React.CSSProperties[] => {
    if (!cols.length) return [];

    return cols.map((col) => {
        const config = getColWidthConfig(col);

        if (config.fixed) {
            return {
                width: `${config.preferred}px`,
                minWidth: `${config.min}px`,
                maxWidth: `${config.max}px`,
            };
        }

        const mult = Number(col.width);
        const factor = Number.isFinite(mult) && mult > 0 ? mult : 1;

        const preferred = Math.min(config.max, Math.max(config.min, config.preferred * factor));

        return {
            width: `${preferred}px`,
            minWidth: `${config.min}px`,
            maxWidth: `${config.max}px`,
        };
    });
};
// ═══════════════════════════════════════════════════════════
// КОМПОНЕНТ: Заголовок колонки с required меткой
// ═══════════════════════════════════════════════════════════

type HeaderCellProps = {
    title: string;
    cols: ExtCol[];
    colSpan: number;
};

const HeaderCell: React.FC<HeaderCellProps> = ({ title, cols, colSpan }) => {
    const hasRequired = cols.some(c => isColumnRequired(c));

    return (
        <th colSpan={colSpan}>
            <span className={s.ellipsis}>
                {title}
                {hasRequired && (
                    <Tooltip title="Обязательное поле" arrow placement="top">
                        <span className={s.requiredMark}>*</span>
                    </Tooltip>
                )}
            </span>
        </th>
    );
};

// ═══════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════

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

    comboReloadToken?: number;
    stylesColumnMeta?: {
        exists: boolean;
        valueIndex: number | null;
    } | null;

    editStylesDraft?: any;
    onEditStyleChange?: any;

    /** NEW: Показывать ошибки валидации */
    showValidationErrors?: boolean;
};
// ═══════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════

export const MainTable: React.FC<Props> = (p) => {
    const safeRows = React.useMemo(
        () => (p.filteredRows ?? []).filter((v) => v?.row && (v.row as any).primary_keys != null),
        [p.filteredRows]
    );

    const rlsMeta = React.useMemo(() => {
        const col = p.flatColumnsInRenderOrder.find((c) => c.type === 'rls');
        if (!col) return null;

        const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
        const idx = p.valueIndexByKey.get(key);
        if (idx == null) return null;

        return { col, idx };
    }, [p.flatColumnsInRenderOrder, p.valueIndexByKey]);

    const renderCols = React.useMemo(
        () => p.flatColumnsInRenderOrder.filter((c) => c.type !== 'rls'),
        [p.flatColumnsInRenderOrder]
    );

    const renderHeaderPlan = React.useMemo(() => {
        return (p.headerPlan ?? [])
            .map((g) => {
                const nextCols = (g.cols ?? []).filter((c) => c.type !== 'rls');
                if (!nextCols.length) return null;

                const nextLabels =
                    Array.isArray(g.labels) && g.labels.length === (g.cols?.length ?? 0)
                        ? g.labels.filter((_, i) => g.cols[i]?.type !== 'rls')
                        : g.labels;

                return { ...g, cols: nextCols, labels: nextLabels };
            })
            .filter(Boolean) as typeof p.headerPlan;
    }, [p.headerPlan]);

    const colStyles = React.useMemo(
        () => calcColStyles(renderCols as ColWithDatatype[]),
        [renderCols]
    );

    const drillDisabled = p.disableDrillWhileEditing && p.editingRowIdx != null;

    return (
        <div className={s.tableWrapper}>
            <table className={s.tbl}>
                <colgroup>
                    {renderCols.map((col, idx) => (
                        <col
                            key={`col-${col.widget_column_id}-${col.table_column_id ?? 'null'}-${
                                (col as any).combobox_column_id ?? 'null'
                            }`}
                            style={colStyles[idx]}
                        />
                    ))}
                    <col style={{ width: '70px', minWidth: '56px', maxWidth: '80px' }} />
                </colgroup>

                <thead>
                {/* Первая строка — группы с required меткой */}
                <tr>
                    {renderHeaderPlan.map((g) => (
                        <HeaderCell
                            key={`g-top-${g.id}`}
                            title={g.title}
                            cols={g.cols}
                            colSpan={g.cols.length || 1}
                        />
                    ))}
                    <th className={s.actionsCell}>
                        <button
                            type="button"
                            className={s.toggleBtn}
                            onClick={p.onToggleSubHeaders}
                            aria-label={
                                p.showSubHeaders ? 'Скрыть подзаголовки' : 'Показать подзаголовки'
                            }
                        >
                            {p.showSubHeaders ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
                        </button>
                    </th>
                </tr>

                {/* Вторая строка — подзаголовки */}
                {p.showSubHeaders && (
                    <tr>
                        {renderHeaderPlan.flatMap((g) => {
                            const labels = (g.labels ?? []).slice(0, g.cols.length);
                            while (labels.length < g.cols.length) labels.push('—');

                            const nodes: React.ReactNode[] = [];
                            let i = 0;

                            while (i < g.cols.length) {
                                const label = labels[i] ?? '—';
                                const col = g.cols[i];
                                let span = 1;

                                while (
                                    i + span < g.cols.length &&
                                    (labels[i + span] ?? '—') === label
                                    ) {
                                    span += 1;
                                }

                                const isReq = isColumnRequired(col);

                                nodes.push(
                                    <th key={`g-sub-${g.id}-${i}`} colSpan={span}>
                                        <span className={s.ellipsis}>
                                            {label}
                                            {isReq && (
                                                <span className={s.requiredMark}>*</span>
                                            )}
                                        </span>
                                    </th>
                                );

                                i += span;
                            }

                            return nodes;
                        })}
                        <th className={s.actionsCell} />
                    </tr>
                )}
                </thead>

                <tbody>
                {/* Строка добавления */}
                {p.isAdding && (
                    <MainTableAddRow
                        flatColumnsInRenderOrder={renderCols}
                        draft={p.draft}
                        onDraftChange={p.onDraftChange}
                        placeholderFor={p.placeholderFor}
                        comboReloadToken={p.comboReloadToken}
                        showValidationErrors={p.showValidationErrors}
                    />
                )}

                {/* Основные строки */}
                {safeRows.map((rowView) => (
                    <MainTableRow
                        key={p.pkToKey(rowView.row.primary_keys)}
                        rowView={rowView}
                        flatColumnsInRenderOrder={renderCols}
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
                        stylesColumnMeta={p.stylesColumnMeta}
                        editStylesDraft={p.editStylesDraft}
                        onEditStyleChange={p.onEditStyleChange}
                        showValidationErrors={p.showValidationErrors}
                    />
                ))}
                </tbody>
            </table>
        </div>
    );
};