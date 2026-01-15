// src/components/Form/mainTable/MainTableCombo.tsx
import React from 'react';
import * as s from './MainTable.module.scss';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import { formatCellValue } from '@/shared/utils/cellFormat';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import { MenuItem, Select, IconButton, Tooltip, CircularProgress } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import {
    buildOptionLabel,
    useComboOptions,
} from '@/components/Form/mainTable/InputCell';

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG
// ═══════════════════════════════════════════════════════════════════════════════
const DEBUG_COMBO = true;

function logCombo(action: string, data: Record<string, any>) {
    if (!DEBUG_COMBO) return;
    console.log(
        `%c[ComboEditDisplay] %c${action}`,
        'color: #9C27B0; font-weight: bold',
        'color: #2196F3',
        data
    );
}

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

    // ═══════════════════════════════════════════════════════════════════════════
    // DEBUG: Логируем при рендере
    // ═══════════════════════════════════════════════════════════════════════════
    if (DEBUG_COMBO) {
        logCombo('RENDER', {
            groupSize: group.length,
            primaryColumnName: primary.column_name,
            widget_column_id: primary.widget_column_id,
            table_column_id: primary.table_column_id,
            __write_tc_id: primary.__write_tc_id,
            __is_primary_combo_input: primary.__is_primary_combo_input,
            computedWriteTcId: writeTcId,
            comboReloadToken,
            groupDetails: group.map(g => ({
                column_name: g.column_name,
                widget_column_id: g.widget_column_id,
                table_column_id: g.table_column_id,
                __write_tc_id: g.__write_tc_id,
                __is_primary_combo_input: g.__is_primary_combo_input,
                combobox_column_id: g.combobox_column_id,
            })),
        });
    }

    const { options, loading, ready, error } = useComboOptions(
        primary.widget_column_id,
        writeTcId,
        comboReloadToken ?? 0,
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // DEBUG: Логируем результат загрузки опций
    // ═══════════════════════════════════════════════════════════════════════════
    if (DEBUG_COMBO) {
        logCombo('OPTIONS STATE', {
            loading,
            ready,
            error,
            optionsCount: options.length,
            firstOptions: options.slice(0, 3).map(o => ({ id: o.id, label: buildOptionLabel(o) })),
        });
    }

    // Текущее значение из draft
    const currentValue = writeTcId != null ? (editDraft[writeTcId] ?? '') : '';

    // Есть ли drill (form_id)
    const hasDrill = primary.form_id != null && !!onOpenDrill;

    if (DEBUG_COMBO) {
        logCombo('CURRENT VALUE', {
            writeTcId,
            currentValue,
            editDraftKeys: Object.keys(editDraft),
            hasDrill,
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Loading state
    // ═══════════════════════════════════════════════════════════════════════════
    if (loading || !ready) {
        return (
            <div className={s.comboEditWrapper} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CircularProgress size={16} />
                <span style={{ fontSize: 12, opacity: 0.7 }}>Загрузка...</span>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Error state
    // ═══════════════════════════════════════════════════════════════════════════
    if (error) {
        return (
            <div className={s.comboEditWrapper} style={{ color: '#f44336', fontSize: 12 }}>
                Ошибка: {error}
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // No writeTcId
    // ═══════════════════════════════════════════════════════════════════════════
    if (writeTcId == null) {
        logCombo('ERROR: No writeTcId!', { primary });
        return (
            <div className={s.comboEditWrapper} style={{ color: '#ff9800', fontSize: 12 }}>
                ⚠️ Нет write_tc_id для combobox
            </div>
        );
    }

    return (
        <div className={s.comboEditWrapper}>
            {/* Select для быстрого выбора */}
            <Select
                size="small"
                fullWidth
                value={currentValue}
                displayEmpty
                onChange={(e) => {
                    const newVal = String(e.target.value ?? '');
                    logCombo('onChange', { writeTcId, oldValue: currentValue, newValue: newVal });
                    onChangeDraft(writeTcId, newVal);
                }}
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
                {options.length === 0 ? (
                    <MenuItem disabled>
                        <em style={{ opacity: 0.5 }}>Нет доступных опций</em>
                    </MenuItem>
                ) : (
                    options.map((o) => (
                        <MenuItem
                            key={o.id}
                            value={o.id}
                            title={o.showHidden.join(' / ')}
                        >
                            {buildOptionLabel(o)}
                        </MenuItem>
                    ))
                )}
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