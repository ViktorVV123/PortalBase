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
import { useColumnResize, makeColKey, type UseColumnResizeReturn } from '@/shared/hooks/useColumnResize';


// ═══════════════════════════════════════════════════════════
// ШИРИНА КОЛОНОК — ДЕФОЛТНЫЕ ЗНАЧЕНИЯ
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
        type === 'checkboxnull' ||
        dt === 'boolean' ||
        dt === 'bool'
    );
};

/**
 * Дефолтная ширина колонки по типу данных.
 */
const getDefaultColWidth = (col: ColWithDatatype): number => {
    const dt = (col.datatype ?? '').toLowerCase();
    const type = (col.type ?? '').toLowerCase();

    if (isCheckboxColumn(col)) return 50;
    if (type === 'rls') return 50;
    if (type === 'combobox') return 150;

    if (/int|numeric|number|float|double|real|money|decimal/.test(dt)) {
        return 90;
    }

    if (dt === 'date' || type === 'date') return 110;
    if (dt === 'time' || dt === 'timetz' || type === 'time') return 90;

    if (
        dt.includes('timestamp') ||
        dt.includes('datetime') ||
        type.includes('timestamp')
    ) {
        return 170;
    }

    // Текст
    return 200;
};

/**
 * Минимальная ширина колонки по типу.
 */
const getMinColWidth = (col: ColWithDatatype): number => {
    if (isCheckboxColumn(col)) return 30;
    if ((col.type ?? '').toLowerCase() === 'rls') return 30;
    return 30; // минимум 30px для всех колонок
};

// ═══════════════════════════════════════════════════════════
// КОМПОНЕНТ: Заголовок колонки с resize handle
// ═══════════════════════════════════════════════════════════

type HeaderCellProps = {
    col: ExtCol;
    colKey: string;
    width: number;
    defaultWidth: number;
    onStartResize: UseColumnResizeReturn['startResize'];
    onResetWidth: (colKey: string, defaultWidth: number) => void;
    onResetAllWidths: () => void;
    children: React.ReactNode;
    isResizing: boolean;
};

const ResizableHeaderCell: React.FC<HeaderCellProps> = ({
                                                            col,
                                                            colKey,
                                                            width,
                                                            defaultWidth,
                                                            onStartResize,
                                                            onResetWidth,
                                                            onResetAllWidths,
                                                            children,
                                                            isResizing,
                                                        }) => {
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onStartResize(colKey, e.clientX, width);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.ctrlKey || e.metaKey) {
            // Ctrl + двойной клик — сбросить все колонки
            onResetAllWidths();
        } else {
            // Двойной клик — сбросить только эту колонку
            onResetWidth(colKey, defaultWidth);
        }
    };

    return (
        <th
            style={{
                width: `${width}px`,
                minWidth: `${getMinColWidth(col as ColWithDatatype)}px`,
                maxWidth: '800px',
                position: 'relative',
            }}
            className={`${s.resizableHeader} ${isResizing ? s.resizingCol : ''}`}
        >
            {children}
            <div
                className={s.resizeHandle}
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
                title="Потяните для изменения • 2×клик сброс • Ctrl+2×клик сбросить все"
            />
        </th>
    );
};

// ═══════════════════════════════════════════════════════════
// КОМПОНЕНТ: Заголовок группы с required меткой И RESIZE
// ═══════════════════════════════════════════════════════════

type GroupHeaderCellProps = {
    title: string;
    cols: ExtCol[];
    colSpan: number;
    groupWidth: number;
    onStartGroupResize: (e: React.MouseEvent) => void;
};

const GroupHeaderCell: React.FC<GroupHeaderCellProps> = ({
                                                             title,
                                                             cols,
                                                             colSpan,
                                                             groupWidth,
                                                             onStartGroupResize,
                                                         }) => {
    const hasRequired = cols.some(c => isColumnRequired(c));

    return (
        <th
            colSpan={colSpan}
            style={{ width: `${groupWidth}px` }}
        >
            <span className={s.ellipsis}>
                {title}
                {hasRequired && (
                    <Tooltip title="Обязательное поле" arrow placement="top">
                        <span className={s.requiredMark}>*</span>
                    </Tooltip>
                )}
            </span>
            <div
                className={s.resizeHandle}
                onMouseDown={onStartGroupResize}
                title="Потяните для изменения ширины группы"
            />
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
    formId: number | null;

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

    showValidationErrors?: boolean;
};

// ═══════════════════════════════════════════════════════════
// КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════

export const MainTable: React.FC<Props> = (p) => {
    // Хук для resize колонок с сохранением в localStorage
    const {
        getWidth,
        setWidth,
        startResize,
        resizing,
        resetWidths,
    } = useColumnResize(p.formId);

    // Ref для отслеживания группового ресайза
    const groupResizeRef = React.useRef<{
        groupCols: ExtCol[];
        startX: number;
        startWidths: number[];
        totalStartWidth: number;
    } | null>(null);

    const [isGroupResizing, setIsGroupResizing] = React.useState(false);

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

    // Вычисляем ширины с учётом сохранённых значений
    const colWidths = React.useMemo(() => {
        return renderCols.map((col) => {
            const colKey = makeColKey(col.widget_column_id, col.table_column_id ?? null);
            const defaultWidth = getDefaultColWidth(col as ColWithDatatype);
            return getWidth(colKey, defaultWidth);
        });
    }, [renderCols, getWidth]);

    // Вычисляем ширины групп (сумма ширин колонок в группе)
    const groupWidths = React.useMemo(() => {
        const widths: number[] = [];
        let colIndex = 0;

        renderHeaderPlan.forEach((g) => {
            let groupWidth = 0;
            for (let i = 0; i < g.cols.length; i++) {
                groupWidth += colWidths[colIndex] ?? 100;
                colIndex++;
            }
            widths.push(groupWidth);
        });

        return widths;
    }, [renderHeaderPlan, colWidths]);

    // Сброс одной колонки к дефолту
    const handleResetWidth = React.useCallback((colKey: string, defaultWidth: number) => {
        setWidth(colKey, defaultWidth);
    }, [setWidth]);

    // ═══════════════════════════════════════════════════════════
    // GROUP RESIZE HANDLERS
    // ═══════════════════════════════════════════════════════════

    const handleStartGroupResize = React.useCallback((
        e: React.MouseEvent,
        groupIndex: number,
        groupCols: ExtCol[]
    ) => {
        e.preventDefault();
        e.stopPropagation();

        // Находим индексы колонок группы в общем массиве
        let startColIndex = 0;
        for (let i = 0; i < groupIndex; i++) {
            startColIndex += renderHeaderPlan[i].cols.length;
        }

        const startWidths = groupCols.map((_, i) => colWidths[startColIndex + i] ?? 100);
        const totalStartWidth = startWidths.reduce((sum, w) => sum + w, 0);

        groupResizeRef.current = {
            groupCols,
            startX: e.clientX,
            startWidths,
            totalStartWidth,
        };

        setIsGroupResizing(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [renderHeaderPlan, colWidths]);

    // Mouse handlers для группового ресайза
    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!groupResizeRef.current) return;

            const { groupCols, startX, startWidths, totalStartWidth } = groupResizeRef.current;
            const delta = e.clientX - startX;
            const minTotalWidth = groupCols.length * 30; // минимум 30px на колонку
            const newTotalWidth = Math.max(minTotalWidth, totalStartWidth + delta);
            const ratio = newTotalWidth / totalStartWidth;

            // Пропорционально изменяем ширину каждой колонки в группе
            groupCols.forEach((col, i) => {
                const colKey = makeColKey(col.widget_column_id, col.table_column_id ?? null);
                const newWidth = Math.max(30, Math.round(startWidths[i] * ratio));
                setWidth(colKey, newWidth);
            });
        };

        const handleMouseUp = () => {
            if (!groupResizeRef.current) return;

            groupResizeRef.current = null;
            setIsGroupResizing(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [setWidth]);

    const drillDisabled = p.disableDrillWhileEditing && p.editingRowIdx != null;

    // Класс на таблицу во время ресайза
    const isAnyResizing = resizing.isResizing || isGroupResizing;
    const tableClassName = `${s.tbl} ${isAnyResizing ? s.tableResizing : ''}`;

    return (
        <div className={s.tableWrapper}>
            <table className={tableClassName}>
                <colgroup>
                    {renderCols.map((col, idx) => (
                        <col
                            key={`col-${col.widget_column_id}-${col.table_column_id ?? 'null'}`}
                            style={{
                                width: `${colWidths[idx]}px`,
                                minWidth: `${getMinColWidth(col as ColWithDatatype)}px`,
                            }}
                        />
                    ))}
                    <col className={s.actionsCol} />
                </colgroup>

                <thead>
                {/* Первая строка — группы с resize */}
                <tr>
                    {renderHeaderPlan.map((g, groupIndex) => (
                        <GroupHeaderCell
                            key={`g-top-${g.id}`}
                            title={g.title}
                            cols={g.cols}
                            colSpan={g.cols.length || 1}
                            groupWidth={groupWidths[groupIndex] ?? 100}
                            onStartGroupResize={(e) => handleStartGroupResize(e, groupIndex, g.cols)}
                        />
                    ))}
                    <th className={s.actionsCell} >
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

                {/* Вторая строка — подзаголовки с resize handles */}
                {p.showSubHeaders && (
                    <tr>
                        {(() => {
                            const nodes: React.ReactNode[] = [];
                            let colIndex = 0;

                            renderHeaderPlan.forEach((g) => {
                                const labels = (g.labels ?? []).slice(0, g.cols.length);
                                while (labels.length < g.cols.length) labels.push('—');

                                g.cols.forEach((col, i) => {
                                    const label = labels[i] ?? '—';
                                    const isReq = isColumnRequired(col);
                                    const colKey = makeColKey(col.widget_column_id, col.table_column_id ?? null);
                                    const width = colWidths[colIndex];
                                    const defaultWidth = getDefaultColWidth(col as ColWithDatatype);

                                    nodes.push(
                                        <ResizableHeaderCell
                                            key={`sub-${g.id}-${i}`}
                                            col={col}
                                            colKey={colKey}
                                            width={width}
                                            defaultWidth={defaultWidth}
                                            onStartResize={startResize}
                                            onResetWidth={handleResetWidth}
                                            onResetAllWidths={resetWidths}
                                            isResizing={resizing.colKey === colKey}
                                        >
                                            <span className={s.ellipsis}>
                                                {label}
                                                {isReq && <span className={s.requiredMark}>*</span>}
                                            </span>
                                        </ResizableHeaderCell>
                                    );

                                    colIndex++;
                                });
                            });

                            return nodes;
                        })()}
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