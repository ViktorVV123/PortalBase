// components/Form/mainTable/MainTableAddRow.tsx
import React from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import { InputCell } from '@/components/Form/mainTable/InputCell';
import {
    getWriteTcIdForComboGroup,
    isSameComboGroup,
    pickPrimaryCombo,
} from './MainTableCombo';
import {isColumnRequired, isEmptyValue} from "@/shared/utils/requiredValidation/requiredValidation";


type MainTableAddRowProps = {
    flatColumnsInRenderOrder: ExtCol[];
    draft: Record<number, string>;
    onDraftChange: (tcId: number, v: string) => void;
    placeholderFor: (c: ExtCol) => string;
    comboReloadToken?: number;
    /** NEW: Показывать ошибки валидации */
    showValidationErrors?: boolean;
};

export const MainTableAddRow: React.FC<MainTableAddRowProps> = ({
                                                                    flatColumnsInRenderOrder,
                                                                    draft,
                                                                    onDraftChange,
                                                                    placeholderFor,
                                                                    comboReloadToken,
                                                                    showValidationErrors = false,
                                                                }) => {
    const cols = flatColumnsInRenderOrder;

    return (
        <tr className={s.addRow}>
            {(() => {
                const cells: React.ReactNode[] = [];
                let i = 0;

                while (i < cols.length) {
                    const col = cols[i];

                    // Combobox-группа?
                    if (col.type === 'combobox') {
                        let j = i + 1;
                        while (j < cols.length && isSameComboGroup(col, cols[j])) j += 1;
                        const group = cols.slice(i, j);
                        const span = group.length;
                        const primary = pickPrimaryCombo(group);
                        const writeTcId = getWriteTcIdForComboGroup(group);

                        const ro = false;
                        const value = writeTcId == null ? '' : (draft[writeTcId] ?? '');

                        // Проверка на required и пустоту
                        const isReq = isColumnRequired(primary);
                        const isEmpty = isEmptyValue(value);
                        const hasError = showValidationErrors && isReq && isEmpty;

                        cells.push(
                            <td
                                key={`add-combo-${primary.widget_column_id}:${writeTcId ?? 'null'}`}
                                colSpan={span}
                                className={`${s.editCell} ${hasError ? s.cellError : ''} ${isReq ? s.requiredCell : ''}`}
                            >
                                <InputCell
                                    mode="add"
                                    col={primary}
                                    readOnly={ro}
                                    value={value}
                                    onChange={(v) => {
                                        if (writeTcId != null) onDraftChange(writeTcId, v);
                                    }}
                                    placeholder={isReq ? `${placeholderFor(primary)} *` : placeholderFor(primary)}
                                    comboReloadToken={comboReloadToken}
                                    showError={showValidationErrors}
                                />
                            </td>
                        );
                        i = j;
                        continue;
                    }

                    // Обычная колонка (add)
                    const writeTcId = (col.__write_tc_id ?? col.table_column_id) ?? null;
                    const ro = false;
                    const value = writeTcId == null ? '' : (draft[writeTcId] ?? '');

                    // Проверка на required и пустоту
                    const isReq = isColumnRequired(col);
                    const isEmpty = isEmptyValue(value);
                    const hasError = showValidationErrors && isReq && isEmpty;

                    cells.push(
                        <td
                            key={`add-${col.widget_column_id}:${col.table_column_id ?? -1}`}
                            className={`${s.editCell} ${hasError ? s.cellError : ''} ${isReq ? s.requiredCell : ''}`}
                        >
                            <div className={s.cellEditor}>
                                <InputCell
                                    mode="add"
                                    col={col}
                                    readOnly={ro}
                                    value={value}
                                    onChange={(v) => {
                                        if (writeTcId != null) onDraftChange(writeTcId, v);
                                    }}
                                    placeholder={isReq ? `${placeholderFor(col)} *` : placeholderFor(col)}
                                    comboReloadToken={comboReloadToken}
                                    showError={showValidationErrors}
                                />
                            </div>
                        </td>
                    );
                    i += 1;
                }

                return cells;
            })()}
            {/* actions-ячейка при добавлении пока пустая */}
            <td className={s.actionsCell} />
        </tr>
    );
};