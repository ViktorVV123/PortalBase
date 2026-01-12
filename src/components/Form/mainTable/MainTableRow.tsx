// components/Form/mainTable/MainTableRow.tsx
import React, { useMemo } from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import LockIcon from '@/assets/image/LockIcon.svg';
import { Checkbox } from '@mui/material';

import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import { formatCellValue } from '@/shared/utils/cellFormat';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import { formatByDatatype } from '@/components/Form/formTable/parts/FormatByDatatype';
import { InputCell } from '@/components/Form/mainTable/InputCell';
import {
    ComboEditDisplay,
    getShown,
    isSameComboGroup,
    pickPrimaryCombo,
} from './MainTableCombo';
import { extractRowStyles, getCellStyle } from '@/shared/utils/rowStyles';
import { CellStyleButton } from './CellStyleButton';
import type { CellStyles } from './CellStylePopover';

type RowView = { row: FormDisplay['data'][number]; idx: number };

type RlsMeta = { col: ExtCol; idx: number } | null;

type MainTableRowProps = {
    rowView: RowView;

    flatColumnsInRenderOrder: ExtCol[];
    valueIndexByKey: Map<string, number>;
    isColReadOnly: (c: ExtCol) => boolean;
    placeholderFor: (c: ExtCol) => string;

    editingRowIdx: number | null;
    editDraft: Record<number, string>;
    onEditDraftChange: (tcId: number, v: string) => void;
    onSubmitEdit: () => void;
    onCancelEdit: () => void;
    editSaving: boolean;

    selectedKey: string | null;
    pkToKey: (pk: Record<string, unknown>) => string;
    onRowClick: (view: RowView) => void;
    onStartEdit: (rowIdx: number) => void;
    onDeleteRow: (rowIdx: number) => void;
    deletingRowIdx: number | null;

    onOpenDrill?: (
        fid?: number | null,
        meta?: {
            originColumnType?: 'combobox' | null;
            primary?: Record<string, unknown>;
            openedFromEdit?: boolean;
            targetWriteTcId?: number;
        }
    ) => void;

    disableDrillWhileEditing?: boolean;
    comboReloadToken?: number;
    rlsMeta: RlsMeta;

    /** Мета для колонки стилей */
    stylesColumnMeta?: {
        exists: boolean;
        valueIndex: number | null;
    } | null;

    /** Локальные изменения стилей во время редактирования */
    editStylesDraft?: Record<string, CellStyles | null>;

    /** Колбэк изменения стиля ячейки */
    onEditStyleChange?: (columnName: string, style: CellStyles | null) => void;
};

/** Правило "строка под RLS?" и как рисовать чекбоксы/булевые */
function isRlsLockedValue(val: unknown): boolean {
    if (val == null) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;

    const str = String(val).trim().toLowerCase();
    return str === '1' || str === 'true' || str === 'да' || str === 'yes';
}

export const MainTableRow: React.FC<MainTableRowProps> = (p) => {
    const { row, idx: rowIdx } = p.rowView;

    const isEditing = p.editingRowIdx === rowIdx;
    const rowKey = p.pkToKey(row.primary_keys);

    const rlsVal = p.rlsMeta ? row.values[p.rlsMeta.idx] : null;
    const isRowLocked = p.rlsMeta != null ? isRlsLockedValue(rlsVal) : false;

    const drillDisabled = p.disableDrillWhileEditing && p.editingRowIdx != null;

    // Проверяем, поддерживаются ли стили
    const stylesEnabled = !!p.stylesColumnMeta?.exists && p.stylesColumnMeta.valueIndex != null;

    // Стили из данных строки
    const rowStylesFromData = useMemo(() => {
        if (!p.stylesColumnMeta?.exists || p.stylesColumnMeta.valueIndex == null) {
            return {};
        }
        return extractRowStyles(row.values, p.stylesColumnMeta.valueIndex);
    }, [row.values, p.stylesColumnMeta]);

    // Мержим стили из данных + локальные изменения (draft) при редактировании
    const mergedRowStyles = useMemo(() => {
        if (!isEditing || !p.editStylesDraft) return rowStylesFromData;

        const merged = { ...rowStylesFromData };

        Object.entries(p.editStylesDraft).forEach(([colName, style]) => {
            if (style === null) {
                delete merged[colName];
            } else if (style) {
                merged[colName] = style;
            }
        });

        return merged;
    }, [rowStylesFromData, p.editStylesDraft, isEditing]);

    return (
        <tr
            key={rowKey}
            style={{ textAlign: 'center' }}
            className={p.selectedKey === rowKey ? s.selectedRow : undefined}
            aria-selected={p.selectedKey === rowKey || undefined}
            onClick={() => {
                if (isEditing) return;
                p.onRowClick({ row, idx: rowIdx });
            }}
        >
            {(() => {
                const cells: React.ReactNode[] = [];
                const cols = p.flatColumnsInRenderOrder;
                let i = 0;

                while (i < cols.length) {
                    const col = cols[i];

                    // ───── Combobox-группа → одна TD с colSpan ─────
                    if (col.type === 'combobox') {
                        let j = i + 1;
                        while (j < cols.length && isSameComboGroup(col, cols[j])) j += 1;
                        const group = cols.slice(i, j);
                        const span = group.length;
                        const primary = pickPrimaryCombo(group);
                        const writeTcId = (primary.__write_tc_id ?? primary.table_column_id) ?? null;

                        if (isEditing) {
                            cells.push(
                                <td
                                    key={`edit-combo-${primary.widget_column_id}:${writeTcId}`}
                                    colSpan={span}
                                    className={s.editCell}
                                >
                                    <div className={s.cellEditor}>
                                        <ComboEditDisplay
                                            group={group}
                                            row={row}
                                            valueIndexByKey={p.valueIndexByKey}
                                            editDraft={p.editDraft}
                                            onOpenDrill={drillDisabled ? undefined : p.onOpenDrill}
                                            comboReloadToken={p.comboReloadToken}
                                            onChangeDraft={p.onEditDraftChange}
                                        />
                                    </div>
                                </td>
                            );
                        } else {
                            // просмотр
                            const shownParts = group
                                .map((gcol) => getShown(p.valueIndexByKey, row.values, gcol))
                                .filter(Boolean);
                            const display = shownParts.length
                                ? shownParts.map(formatCellValue).join(' · ')
                                : '—';
                            const clickable = primary.form_id != null && !!p.onOpenDrill && !drillDisabled;

                            cells.push(
                                <td
                                    key={`view-combo-${primary.widget_column_id}:${writeTcId}`}
                                    colSpan={span}
                                >
                                    {clickable ? (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                p.onOpenDrill?.(primary.form_id!, {
                                                    originColumnType: 'combobox',
                                                    primary: row.primary_keys,
                                                    openedFromEdit: false,
                                                });
                                                console.debug('[MainTable] drill click (combobox)', {
                                                    formId: primary.form_id,
                                                    originColumnType: 'combobox',
                                                    widget_column_id: primary.widget_column_id,
                                                    table_column_id: primary.table_column_id,
                                                });
                                            }}
                                            style={{
                                                padding: 0,
                                                border: 'none',
                                                background: 'none',
                                                cursor: 'pointer',
                                                textDecoration: 'underline',
                                                color: 'var(--link,#66b0ff)',
                                            }}
                                            title={`Открыть форму #${primary.form_id}`}
                                        >
                                            {display}
                                        </button>
                                    ) : (
                                        <span className={s.ellipsis}>{display}</span>
                                    )}
                                </td>
                            );
                        }

                        i = j;
                        continue;
                    }

                    // ───── Обычная колонка ─────
                    const visKey = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                    const idxVal = p.valueIndexByKey.get(visKey);
                    const rawVal = idxVal != null ? row.values[idxVal] : null;
                    const shownVal = getShown(p.valueIndexByKey, row.values, col);
                    const ro = p.isColReadOnly(col) || col.visible === false;
                    const writeTcId = (col.__write_tc_id ?? col.table_column_id) ?? null;

                    // Получаем стиль для ячейки (используем merged при редактировании)
                    const cellStyle = getCellStyle(
                        isEditing ? mergedRowStyles : rowStylesFromData,
                        col.column_name
                    );

                    if (isEditing) {
                        cells.push(
                            <td key={`edit-${visKey}`} className={s.editCell} style={cellStyle}>
                                <div className={s.cellEditor}>
                                    <InputCell
                                        mode="edit"
                                        col={col}
                                        readOnly={ro}
                                        value={writeTcId == null ? '' : (p.editDraft[writeTcId] ?? '')}
                                        onChange={(v) => {
                                            if (writeTcId != null) p.onEditDraftChange(writeTcId, v);
                                        }}
                                        placeholder={p.placeholderFor(col)}
                                        comboReloadToken={p.comboReloadToken}
                                    />

                                    {/* 🎨 Кнопка стилизации */}
                                    {stylesEnabled && col.column_name && (
                                        <CellStyleButton
                                            columnName={col.column_name}
                                            currentStyle={cellStyle as CellStyles | undefined}
                                            onStyleChange={(colName, style) => {
                                                p.onEditStyleChange?.(colName, style);
                                            }}
                                        />
                                    )}
                                </div>
                            </td>
                        );
                    } else {
                        const clickable = col.form_id != null && !!p.onOpenDrill && !drillDisabled;
                        const pretty = formatByDatatype(shownVal, col as ExtCol);

                        const isCheckboxCol =
                            col.type === 'checkbox' || (col as ExtCol).type === 'bool';

                        if (isCheckboxCol) {
                            const checked = isRlsLockedValue(rawVal);
                            cells.push(
                                <td key={`cell-${visKey}`}>
                                    <Checkbox
                                        size="small"
                                        checked={checked}
                                        disabled
                                        sx={{
                                            color: 'rgba(255, 255, 255, 0.4)',
                                            '&.Mui-checked': {
                                                color: 'rgba(255, 255, 255, 0.9)',
                                            },
                                            '&.Mui-disabled': {
                                                color: 'rgba(255, 255, 255, 0.7)',
                                            },
                                        }}
                                    />
                                </td>
                            );
                        } else {
                            const content = pretty || '—';
                            cells.push(
                                <td key={`cell-${visKey}`} style={cellStyle}>
                                    {clickable ? (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                p.onOpenDrill?.(col.form_id!, {
                                                    originColumnType: null,
                                                    primary: row.primary_keys,
                                                    openedFromEdit: false,
                                                });
                                                console.debug('[MainTable] drill click (regular)', {
                                                    formId: col.form_id,
                                                    originColumnType: col.type ?? null,
                                                    widget_column_id: col.widget_column_id,
                                                    table_column_id: col.table_column_id,
                                                });
                                            }}
                                            style={{
                                                padding: 0,
                                                border: 'none',
                                                background: 'none',
                                                cursor: 'pointer',
                                                textDecoration: 'underline',
                                                color: 'var(--link,#66b0ff)',
                                            }}
                                            title={`Открыть форму #${col.form_id}`}
                                        >
                                            <span className={s.ellipsis}>{content}</span>
                                        </button>
                                    ) : (
                                        <span className={s.wrap}>{content}</span>
                                    )}
                                </td>
                            );
                        }
                    }

                    i += 1;
                }

                return cells;
            })()}

            {/* ───── actions-ячейка ───── */}
            <td className={s.actionsCell}>
                {isEditing ? (
                    (() => {
                        const hasEditable =
                            !isRowLocked &&
                            p.flatColumnsInRenderOrder.some(
                                (c) => c.visible !== false && !p.isColReadOnly(c)
                            );

                        return (
                            <>
                                {hasEditable && (
                                    <button
                                        className={s.okBtn}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            p.onSubmitEdit();
                                        }}
                                        disabled={p.editSaving}
                                    >
                                        {p.editSaving ? '…' : '✓'}
                                    </button>
                                )}
                                <button
                                    className={s.cancelBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        p.onCancelEdit();
                                    }}
                                    disabled={p.editSaving}
                                >
                                    ×
                                </button>
                            </>
                        );
                    })()
                ) : (
                    <div className={s.actionsRow}>
                        {/* EDIT */}
                        <button
                            type="button"
                            className={`${s.actionsBtn} ${isRowLocked ? s.actionsBtnDisabled : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isRowLocked) return;
                                p.onStartEdit(rowIdx);
                            }}
                            title={isRowLocked ? 'Редактирование запрещено (RLS)' : 'Редактировать'}
                        >
                            <EditIcon
                                style={{ pointerEvents: isRowLocked ? 'none' : 'auto' }}
                                className={s.actionIcon}
                            />
                        </button>

                        {/* DELETE */}
                        <button
                            type="button"
                            className={`${s.actionsBtn} ${
                                isRowLocked || p.deletingRowIdx === rowIdx ? s.actionsBtnDisabled : ''
                            }`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isRowLocked) return;
                                if (p.deletingRowIdx == null) p.onDeleteRow(rowIdx);
                            }}
                            title={isRowLocked ? 'Удаление запрещено (RLS)' : 'Удалить'}
                        >
                            <DeleteIcon
                                style={{ pointerEvents: isRowLocked ? 'none' : 'auto' }}
                                className={s.actionIcon}
                            />
                        </button>

                        {/* LOCK */}
                        <span
                            className={s.lockSlot}
                            title={isRowLocked ? 'Строка защищена политикой RLS' : undefined}
                        >
                            {isRowLocked && <LockIcon className={s.actionIcon} />}
                        </span>
                    </div>
                )}
            </td>
        </tr>
    );
};