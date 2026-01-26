// src/components/Form/mainTable/MainTableRow.tsx
import React, { useMemo } from 'react';
import * as s from './MainTable.module.scss';
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

// Импорт функций валидации
import { isColumnRequired, isEmptyValue } from '@/shared/utils/requiredValidation/requiredValidation';
import {TriStateCheckboxDisplay} from "@/shared/ui/TriStateCheckbox";

const DEBUG = false;

function logRow(action: string, data: Record<string, any>) {
    if (!DEBUG) return;
    console.log(
        `%c[MainTableRow] %c${action}`,
        'color: #FF9800; font-weight: bold',
        'color: #2196F3',
        data
    );
}

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

    stylesColumnMeta?: {
        exists: boolean;
        valueIndex: number | null;
        tableColumnNameMap?: Map<string, string>;
        readonly?: boolean;
    } | null;

    editStylesDraft?: Record<string, CellStyles | null>;
    onEditStyleChange?: (columnName: string, style: CellStyles | null) => void;

    // Показывать ошибки валидации
    showValidationErrors?: boolean;
};

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

    const stylesEnabled =
        !!p.stylesColumnMeta?.exists &&
        p.stylesColumnMeta.valueIndex != null &&
        !p.stylesColumnMeta.readonly;

    const rowStylesFromData = useMemo(() => {
        if (!p.stylesColumnMeta?.exists || p.stylesColumnMeta.valueIndex == null) {
            return {};
        }
        return extractRowStyles(
            row.values,
            p.stylesColumnMeta.valueIndex,
            p.stylesColumnMeta.tableColumnNameMap
        );
    }, [row.values, p.stylesColumnMeta]);

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

    if (DEBUG && rowIdx === 0) {
        console.log(
            `%c[MainTableRow] %cRENDER row[0]`,
            'color: #FF9800; font-weight: bold',
            'color: #9E9E9E',
            {
                rowIdx,
                isEditing,
                isRowLocked,
                editingRowIdx: p.editingRowIdx,
                deletingRowIdx: p.deletingRowIdx,
                showValidationErrors: p.showValidationErrors,
                hasOnStartEdit: typeof p.onStartEdit === 'function',
                hasOnDeleteRow: typeof p.onDeleteRow === 'function',
            }
        );
    }

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        logRow('CLICK: Edit button', { rowIdx, isRowLocked, isEditing });

        if (isRowLocked) {
            logRow('BLOCKED: Edit - row is locked (RLS)', { rowIdx });
            return;
        }

        if (typeof p.onStartEdit !== 'function') {
            console.error('[MainTableRow] onStartEdit is not a function!', p.onStartEdit);
            return;
        }

        logRow('CALLING: onStartEdit()', { rowIdx });
        try {
            p.onStartEdit(rowIdx);
            logRow('SUCCESS: onStartEdit() called', { rowIdx });
        } catch (err) {
            console.error('[MainTableRow] onStartEdit() threw error:', err);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        logRow('CLICK: Delete button', { rowIdx, isRowLocked, deletingRowIdx: p.deletingRowIdx });

        if (isRowLocked) {
            logRow('BLOCKED: Delete - row is locked (RLS)', { rowIdx });
            return;
        }

        if (p.deletingRowIdx != null) {
            logRow('BLOCKED: Delete - another delete in progress', { deletingRowIdx: p.deletingRowIdx });
            return;
        }

        if (typeof p.onDeleteRow !== 'function') {
            console.error('[MainTableRow] onDeleteRow is not a function!', p.onDeleteRow);
            return;
        }

        logRow('CALLING: onDeleteRow()', { rowIdx });
        try {
            p.onDeleteRow(rowIdx);
            logRow('SUCCESS: onDeleteRow() called', { rowIdx });
        } catch (err) {
            console.error('[MainTableRow] onDeleteRow() threw error:', err);
        }
    };

    const handleSubmitEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        logRow('CLICK: Submit edit (✓)', { rowIdx, editSaving: p.editSaving });

        if (p.editSaving) {
            logRow('BLOCKED: Submit - saving in progress', {});
            return;
        }

        if (typeof p.onSubmitEdit !== 'function') {
            console.error('[MainTableRow] onSubmitEdit is not a function!', p.onSubmitEdit);
            return;
        }

        logRow('CALLING: onSubmitEdit()', {});
        try {
            p.onSubmitEdit();
            logRow('SUCCESS: onSubmitEdit() called', {});
        } catch (err) {
            console.error('[MainTableRow] onSubmitEdit() threw error:', err);
        }
    };

    const handleCancelEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        logRow('CLICK: Cancel edit (×)', { rowIdx, editSaving: p.editSaving });

        if (p.editSaving) {
            logRow('BLOCKED: Cancel - saving in progress', {});
            return;
        }

        if (typeof p.onCancelEdit !== 'function') {
            console.error('[MainTableRow] onCancelEdit is not a function!', p.onCancelEdit);
            return;
        }

        logRow('CALLING: onCancelEdit()', {});
        try {
            p.onCancelEdit();
            logRow('SUCCESS: onCancelEdit() called', {});
        } catch (err) {
            console.error('[MainTableRow] onCancelEdit() threw error:', err);
        }
    };

    const handleRowClick = () => {
        logRow('CLICK: Row', { rowIdx, isEditing, willProcess: !isEditing });

        if (isEditing) {
            logRow('BLOCKED: Row click - currently editing', { rowIdx });
            return;
        }

        if (typeof p.onRowClick !== 'function') {
            console.error('[MainTableRow] onRowClick is not a function!', p.onRowClick);
            return;
        }

        p.onRowClick({ row, idx: rowIdx });
    };

    return (
        <tr
            className={p.selectedKey === rowKey ? s.selectedRow : undefined}
            aria-selected={p.selectedKey === rowKey || undefined}
            onClick={handleRowClick}
        >
            {(() => {
                const cells: React.ReactNode[] = [];
                const cols = p.flatColumnsInRenderOrder;
                let i = 0;

                while (i < cols.length) {
                    const col = cols[i];

                    // ───── Combobox-группа ─────
                    if (col.type === 'combobox') {
                        let j = i + 1;
                        while (j < cols.length && isSameComboGroup(col, cols[j])) j += 1;
                        const group = cols.slice(i, j);
                        const span = group.length;
                        const primary = pickPrimaryCombo(group);
                        const writeTcId = (primary.__write_tc_id ?? primary.table_column_id) ?? null;

                        if (isEditing) {
                            // Проверка на required и пустоту для combobox
                            const isReq = isColumnRequired(primary);
                            const value = writeTcId == null ? '' : (p.editDraft[writeTcId] ?? '');
                            const isEmpty = isEmptyValue(value);
                            const hasError = p.showValidationErrors && isReq && isEmpty;

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
                                            }}
                                            className={s.linkButton}
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

                    const cellStyle = getCellStyle(
                        isEditing ? mergedRowStyles : rowStylesFromData,
                        col.column_name
                    );

                    if (isEditing) {
                        // Проверка на required и пустоту для обычной колонки
                        const isReq = isColumnRequired(col);
                        const value = writeTcId == null ? '' : (p.editDraft[writeTcId] ?? '');
                        const isEmpty = isEmptyValue(value);
                        const hasError = p.showValidationErrors && isReq && isEmpty;

                        cells.push(
                            <td
                                key={`edit-${visKey}`}
                                className={s.editCell}
                                style={cellStyle}
                            >
                                <div className={s.cellEditor}>
                                    <InputCell
                                        mode="edit"
                                        col={col}
                                        readOnly={ro}
                                        value={value}
                                        onChange={(v) => {
                                            if (writeTcId != null) p.onEditDraftChange(writeTcId, v);
                                        }}
                                        placeholder={isReq ? `${p.placeholderFor(col)} *` : p.placeholderFor(col)}
                                        comboReloadToken={p.comboReloadToken}
                                        showError={hasError}
                                    />

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

                        // ═══════════════════════════════════════════════════════════
                        // CHECKBOX — два варианта:
                        // - checkboxNull: трёхпозиционный (false, true, null)
                        // - checkbox/bool: обычный двухпозиционный
                        // ═══════════════════════════════════════════════════════════
                        const isTriStateCheckbox = col.type === 'checkboxNull';
                        const isRegularCheckbox = col.type === 'checkbox' || (col as ExtCol).type === 'bool';

                        if (isTriStateCheckbox) {
                            // Трёхпозиционный checkbox с поддержкой null
                            cells.push(
                                <td key={`cell-${visKey}`} className={s.checkboxCell}>
                                    <TriStateCheckboxDisplay value={rawVal} />
                                </td>
                            );
                        } else if (isRegularCheckbox) {
                            // Обычный двухпозиционный checkbox
                            const checked = isRlsLockedValue(rawVal);
                            cells.push(
                                <td key={`cell-${visKey}`} className={s.checkboxCell}>
                                    <Checkbox
                                        size="small"
                                        checked={checked}
                                        disabled
                                        sx={{
                                            color: 'rgba(255, 255, 255, 0.4)',
                                            '&.Mui-checked': { color: 'rgba(255, 255, 255, 0.9)' },
                                            '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.7)' },
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
                                            }}
                                            className={s.linkButton}
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

            {/* ───── Actions ───── */}
            <td className={s.actionsCell}>
                {isEditing ? (
                    (() => {
                        const hasEditable =
                            !isRowLocked &&
                            p.flatColumnsInRenderOrder.some(
                                (c) => c.visible !== false && !p.isColReadOnly(c)
                            );

                        return (
                            <div className={s.actionsRow}>
                                {hasEditable && (
                                    <button
                                        className={s.okBtn}
                                        onClick={handleSubmitEdit}
                                        disabled={p.editSaving}
                                        title="Сохранить"
                                    >
                                        {p.editSaving ? '…' : '✓'}
                                    </button>
                                )}
                                <button
                                    className={s.cancelBtn}
                                    onClick={handleCancelEdit}
                                    disabled={p.editSaving}
                                    title="Отменить"
                                >
                                    ×
                                </button>
                            </div>
                        );
                    })()
                ) : (
                    <div className={s.actionsRow}>
                        <button
                            type="button"
                            className={`${s.actionsBtn} ${isRowLocked ? s.actionsBtnDisabled : ''}`}
                            onClick={handleEditClick}
                            title={isRowLocked ? 'Редактирование запрещено (RLS)' : 'Редактировать'}
                        >
                            <EditIcon className={s.actionIcon} />
                        </button>

                        <button
                            type="button"
                            className={`${s.actionsBtn} ${
                                isRowLocked || p.deletingRowIdx === rowIdx ? s.actionsBtnDisabled : ''
                            }`}
                            onClick={handleDeleteClick}
                            title={isRowLocked ? 'Удаление запрещено (RLS)' : 'Удалить'}
                        >
                            <DeleteIcon className={s.actionIcon} />
                        </button>

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