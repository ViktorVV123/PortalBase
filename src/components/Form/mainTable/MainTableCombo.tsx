// src/components/Form/mainTable/MainTableCombo.tsx
import React from 'react';
import * as s from './MainTable.module.scss';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import { formatCellValue } from '@/shared/utils/cellFormat';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import { MenuItem, Select, IconButton, Tooltip } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

// ⬇️ Берём общие вещи из InputCell, не дублируем
import {
    buildOptionLabel,
    useComboOptions,
} from '@/components/Form/mainTable/InputCell';

/** Хелпер: одинаковая ли группа combobox (для объединения в одну TD) */
export function isSameComboGroup(a: ExtCol, b: ExtCol): boolean {
    if (!a || !b) return false;
    const aWrite = (a.__write_tc_id ?? a.table_column_id) ?? null;
    const bWrite = (b.__write_tc_id ?? b.table_column_id) ?? null;
    return (
        a.type === 'combobox' &&
        b.type === 'combobox' &&
        a.widget_column_id === b.widget_column_id &&
        aWrite != null &&
        bWrite != null &&
        aWrite === bWrite
    );
}

/** Хелпер: найти первичную колонку в combobox-группе (где Select / drill) */
export function pickPrimaryCombo(cols: ExtCol[]): ExtCol {
    const primary = cols.find(c => c.__is_primary_combo_input);
    return primary ?? cols[0];
}

/** Хелпер: взять показанное значение для визуальной колонки */
function getValueKey(col: ExtCol): string {
    const syntheticTcId =
        col.type === 'combobox' &&
        col.combobox_column_id != null &&
        col.table_column_id != null
            ? -1_000_000 - Number(col.combobox_column_id)
            : col.table_column_id ?? -1;

    return `${col.widget_column_id}:${syntheticTcId}`;
}

export function getShown(
    valIndexByKey: Map<string, number>,
    rowValues: (string | number | null)[],
    col: ExtCol,
) {
    const key = getValueKey(col);
    const idx = valIndexByKey.get(key);
    const shownVal = idx != null ? rowValues[idx] : '';
    return shownVal == null ? '' : String(shownVal);
}

/** Для combobox-группы вернуть реальный write_tc_id (один на всю группу) */
export function getWriteTcIdForComboGroup(group: ExtCol[]): number | null {
    const primary = pickPrimaryCombo(group);
    if (primary.__write_tc_id != null) return primary.__write_tc_id;

    for (const g of group) {
        if (g.__write_tc_id != null) return g.__write_tc_id;
    }

    console.warn('[MainTable][add] combobox group has no __write_tc_id', group);
    return null;
}

/** Отображение combobox в режиме редактирования с Select + кнопка drill */
type ComboEditDisplayProps = {
    group: ExtCol[];
    row: FormDisplay['data'][number];
    valueIndexByKey: Map<string, number>;
    editDraft: Record<number, string>;
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
    /** 👉 колбэк, чтобы менять draft по write_tc_id */
    onChangeDraft: (tcId: number, v: string) => void;
};

export const ComboEditDisplay: React.FC<ComboEditDisplayProps> = ({
                                                                      group,
                                                                      row,
                                                                      valueIndexByKey,
                                                                      editDraft,
                                                                      onOpenDrill,
                                                                      comboReloadToken,
                                                                      onChangeDraft,
                                                                  }) => {
    const primary = pickPrimaryCombo(group);
    const writeTcId = (primary.__write_tc_id ?? primary.table_column_id) ?? null;

    const { options, loading } = useComboOptions(
        primary.widget_column_id,
        writeTcId ?? null,
        comboReloadToken ?? 0,
    );

    // Текущее значение из draft
    const currentValue = writeTcId != null ? (editDraft[writeTcId] ?? '') : '';

    // Есть ли drill (form_id)
    const hasDrill = primary.form_id != null && !!onOpenDrill;

    return (
        <div className={s.comboEditWrapper}>
            {/* Select для быстрого выбора */}
            <Select
                size="small"
                fullWidth
                value={currentValue}
                displayEmpty
                onChange={(e) => {
                    if (writeTcId != null) {
                        onChangeDraft(writeTcId, String(e.target.value ?? ''));
                    }
                }}
                disabled={loading}
                className={s.comboSelect}
                sx={{
                    flex: 1,
                    minWidth: 0,
                    '& .MuiSelect-select': {
                        padding: '4px 8px',
                        paddingRight: '28px !important',
                        minHeight: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        fontSize: '13px',
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.3)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.5)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'var(--link, #66b0ff)',
                    },
                }}
                MenuProps={{
                    PaperProps: {
                        sx: {
                            maxHeight: 300,
                            backgroundColor: '#2a2a2a',
                            '& .MuiMenuItem-root': {
                                fontSize: '13px',
                                padding: '6px 12px',
                            },
                        },
                    },
                }}
            >
                <MenuItem value="">
                    <em style={{ opacity: 0.6 }}>— не выбрано —</em>
                </MenuItem>
                {options.map((o) => (
                    <MenuItem
                        key={o.id}
                        value={o.id}
                        title={o.showHidden.join(' / ')}
                    >
                        {buildOptionLabel(o)}
                    </MenuItem>
                ))}
            </Select>

            {/* Кнопка drill — открыть форму для редактирования справочника */}
            {hasDrill && (
                <Tooltip title="Открыть справочник" arrow>
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenDrill?.(primary.form_id!, {
                                originColumnType: 'combobox',
                                primary: row.primary_keys,
                                openedFromEdit: true,
                                targetWriteTcId: writeTcId ?? undefined,
                            });
                        }}
                        sx={{
                            ml: 0.5,
                            p: 0.5,
                            color: 'var(--link, #66b0ff)',
                            '&:hover': {
                                backgroundColor: 'rgba(102, 176, 255, 0.1)',
                            },
                        }}
                    >
                        <OpenInNewIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                </Tooltip>
            )}
        </div>
    );
};