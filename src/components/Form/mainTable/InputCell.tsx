// src/components/Form/mainTable/InputCell.tsx
import React from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import { api } from '@/services/api';
import { ExtCol, getCanonicalType } from '@/components/Form/formTable/parts/FormatByDatatype';
import { fromInputValue, toInputValue } from '@/components/Form/formTable/parts/ToInputValue';
import { MenuItem, Select, TextField, CircularProgress, Checkbox } from '@mui/material';
import { isColumnRequired, isEmptyValue } from "@/shared/utils/requiredValidation/requiredValidation";
import { TriStateCheckbox } from "@/shared/ui/TriStateCheckbox";
import { comboCache, ComboOption } from '@/shared/utils/comboCache';

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG
// ═══════════════════════════════════════════════════════════════════════════════
const DEBUG_COMBO = false;

function logCombo(action: string, data: Record<string, any>) {
    if (!DEBUG_COMBO) return;
    console.log(
        `%c[InputCell:Combo] %c${action}`,
        'color: #E91E63; font-weight: bold',
        'color: #2196F3',
        data
    );
}

/** combobox-мета с бэка */
type ComboColumnMeta = { ref_column_order: number; width: number; combobox_alias: string | null };
type ComboResp = {
    columns: ComboColumnMeta[];
    data: Array<{
        primary: (string | number)[];
        show: (string | number)[];
        show_hidden: (string | number)[];
    }>;
};

// Re-export для обратной совместимости
export type { ComboOption };

const isNumericLike = (dt: unknown): boolean =>
    typeof dt === 'string' &&
    /int|numeric|number|float|double|real|money|decimal/i.test(dt);


export const normalizeValueForColumn = (
    writeTcId: number,
    raw: string,
    cols: ExtCol[],
): string => {
    const trimmed = raw.trim();
    if (!trimmed.includes(',')) return trimmed;

    const col = cols.find(c => {
        const w = (c.__write_tc_id ?? c.table_column_id) ?? null;
        return w === writeTcId;
    });
    if (!col) return trimmed;

    const canonical = getCanonicalType(col);
    const rawDt = (col as any).datatype ?? null;

    const isNumeric =
        isNumericLike(canonical) ||
        isNumericLike(rawDt);

    if (!isNumeric) {
        return trimmed;
    }

    return trimmed.replace(/,/g, '.');
};

/**
 * Загружает combobox опции с кэшированием
 * - Проверяет LRU кэш с TTL
 * - Сохраняет в localStorage между сессиями
 */
export async function loadComboOptionsOnce(
    widgetColumnId: number,
    writeTcId: number,
): Promise<ComboOption[]> {
    const key = comboCache.makeKey(widgetColumnId, writeTcId);

    // Проверяем кэш (с учётом TTL)
    const cached = comboCache.getOptions(widgetColumnId, writeTcId);
    if (cached) {
        logCombo('cache:hit', { key, optionsCount: cached.length });
        return cached;
    }

    logCombo('cache:miss', { key });

    // Загружаем с бэкенда
    const { data } = await api.get<ComboResp>(`/display/combobox/${widgetColumnId}/${writeTcId}`);

    const opts: ComboOption[] = data.data.map((row) => ({
        id: String(row.primary?.[0] ?? ''),
        show: (row.show ?? []).map(String),
        showHidden: (row.show_hidden ?? []).map(String),
    }));

    // Сохраняем в кэш
    comboCache.set(key, opts, data.columns);

    logCombo('cache:set', { key, optionsCount: opts.length });

    return opts;
}

/**
 * Очищает кэш combobox
 * @param widgetColumnId - если указан вместе с writeTcId, очищает конкретный combobox
 * @param writeTcId - если указан вместе с widgetColumnId, очищает конкретный combobox
 * Если оба не указаны — очищает весь кэш
 */
export function clearComboCache(widgetColumnId?: number, writeTcId?: number) {
    if (widgetColumnId != null && writeTcId != null) {
        comboCache.invalidate(widgetColumnId, writeTcId);
        logCombo('cache:invalidate', { widgetColumnId, writeTcId });
    } else {
        comboCache.clear();
        logCombo('cache:clear', {});
    }
}

export function buildOptionLabel(opt: ComboOption): string {
    const base = opt.show ?? [];
    const extra = (opt.showHidden ?? []).filter(v => !base.includes(v));
    const parts = [...base, ...extra];
    return parts.length ? parts.join(' · ') : opt.id;
}

export function useComboOptions(
    widgetColumnId: number,
    writeTcId: number | null,
    reloadToken = 0,
) {
    const [loading, setLoading] = React.useState(false);
    const [options, setOptions] = React.useState<ComboOption[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const [ready, setReady] = React.useState(false);

    React.useEffect(() => {
        if (!widgetColumnId || !writeTcId) {
            setReady(true);
            return;
        }

        let cancelled = false;
        setReady(false);

        const load = async () => {
            setLoading(true);
            setError(null);

            try {
                // Если reloadToken > 0 — принудительно инвалидируем кэш
                if (reloadToken > 0) {
                    comboCache.invalidate(widgetColumnId, writeTcId);
                    logCombo('cache:forced-invalidate', { widgetColumnId, writeTcId, reloadToken });
                }

                const opts = await loadComboOptionsOnce(widgetColumnId, writeTcId);
                if (!cancelled) {
                    setOptions(opts);
                    setReady(true);
                }
            } catch (e: any) {
                if (!cancelled) {
                    const errMsg = String(e?.message ?? 'Ошибка загрузки combobox');
                    setError(errMsg);
                    setReady(true);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [widgetColumnId, writeTcId, reloadToken]);

    return { loading, options, error, ready };
}

// ═══════════════════════════════════════════════════════════════════════════════
// СТИЛИ — используем CSS переменные темы
// ═══════════════════════════════════════════════════════════════════════════════

const errorSxBase = {
    '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--theme-error) !important',
        borderWidth: '2px !important',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--theme-error) !important',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--theme-error) !important',
    },
};

const selectSx = {
    '& .MuiSelect-select': {
        padding: '2px 6px',
        minHeight: '32px',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        color: 'var(--input-text)',
    },
    '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--input-border)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--input-border-hover)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--input-border-focus)',
    },
    '& .MuiSelect-icon': {
        color: 'var(--icon-primary)',
    },
    backgroundColor: 'var(--input-bg)',
    color: 'var(--input-text)',
};

const textFieldSx = {
    '& .MuiInputBase-root': {
        alignItems: 'stretch',
        color: 'var(--input-text)',
        backgroundColor: 'var(--input-bg)',
    },
    '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--input-border)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--input-border-hover)',
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: 'var(--input-border-focus)',
    },
    '& .MuiInputBase-input': {
        color: 'var(--input-text)',
    },
    '& .MuiInputBase-inputMultiline': {
        padding: '4px 6px',
        lineHeight: 1.3,
    },
    '& textarea': {
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
    },
    '& input[type="date"], & input[type="time"], & input[type="datetime-local"]': {
        color: 'var(--input-text)',
        colorScheme: 'var(--color-scheme, dark)',
        '&::-webkit-calendar-picker-indicator': {
            filter: 'var(--calendar-icon-filter, invert(0.8))',
            cursor: 'pointer',
            opacity: 0.7,
            '&:hover': {
                opacity: 1,
            },
        },
    },
};

const checkboxSx = {
    color: 'var(--checkbox-unchecked)',
    '&.Mui-checked': {
        color: 'var(--checkbox-checked)',
    },
};

const checkboxErrorSx = {
    color: 'var(--theme-error)',
    '&.Mui-checked': {
        color: 'var(--theme-error)',
    },
};

export type InputCellProps = {
    mode: 'add' | 'edit';
    col: ExtCol;
    value: string;
    onChange: (v: string) => void;
    readOnly: boolean;
    placeholder: string;
    comboReloadToken?: number;
    showError?: boolean;
};

export const InputCell: React.FC<InputCellProps> = ({
                                                        mode,
                                                        col,
                                                        value,
                                                        onChange,
                                                        readOnly,
                                                        placeholder,
                                                        comboReloadToken = 0,
                                                        showError = false,
                                                    }) => {
    const writeTcId = (col.__write_tc_id ?? col.table_column_id) ?? null;

    const isRequired = isColumnRequired(col);
    const isEmpty = isEmptyValue(value);
    const hasError = showError && isRequired && isEmpty;

    const errorSx = hasError ? errorSxBase : {};

    if (readOnly || writeTcId == null) {
        return (
            <span className={s.readonlyValue} title="Только для чтения">
                {value || '—'}
            </span>
        );
    }

    const shouldRenderAsCombo = col.type === 'combobox';

    const { options, loading, ready } = useComboOptions(
        col.widget_column_id,
        shouldRenderAsCombo ? writeTcId : null,
        comboReloadToken,
    );

    // ───── combobox ─────
    if (shouldRenderAsCombo) {
        if (loading || !ready) {
            return (
                <div
                    className={s.inpInCell}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 32,
                        gap: 8,
                        color: 'var(--theme-text-muted)',
                        fontSize: 12,
                    }}
                >
                    <CircularProgress size={16} sx={{ color: 'var(--theme-text-muted)' }} />
                    <span>Загрузка...</span>
                </div>
            );
        }

        const currentValue = value ?? '';
        const hasValueInOptions = !currentValue || options.some(o => o.id === currentValue);

        const effectiveOptions = hasValueInOptions
            ? options
            : [
                { id: currentValue, show: [`#${currentValue}`], showHidden: ['Значение не найдено'] },
                ...options
            ];

        return (
            <Select
                size="small"
                fullWidth
                value={currentValue}
                displayEmpty
                error={hasError}
                onChange={(e) => {
                    const newVal = String(e.target.value ?? '');
                    onChange(newVal);
                }}
                className={s.inpInCell}
                sx={{
                    ...selectSx,
                    ...errorSx,
                }}
                MenuProps={{
                    PaperProps: {
                        sx: {
                            backgroundColor: 'var(--dropdown-bg)',
                            color: 'var(--dropdown-text)',
                            border: '1px solid var(--dropdown-border)',
                            '& .MuiMenuItem-root': {
                                color: 'var(--dropdown-text)',
                                '&:hover': {
                                    backgroundColor: 'var(--dropdown-hover)',
                                },
                                '&.Mui-selected': {
                                    backgroundColor: 'var(--dropdown-hover)',
                                    '&:hover': {
                                        backgroundColor: 'var(--dropdown-hover)',
                                    },
                                },
                            },
                        },
                    },
                }}
            >
                <MenuItem value="">
                    <em style={{ color: 'var(--theme-text-muted)' }}>— не выбрано —</em>
                </MenuItem>
                {effectiveOptions.map((o) => (
                    <MenuItem
                        key={o.id}
                        value={o.id}
                        title={o.showHidden.join(' / ')}
                        sx={
                            !hasValueInOptions && o.id === currentValue
                                ? { color: 'var(--theme-warning)', fontStyle: 'italic' }
                                : undefined
                        }
                    >
                        {buildOptionLabel(o)}
                    </MenuItem>
                ))}
            </Select>
        );
    }

    // ───── дата / время / timestamp (+tz) И ЧИСЛА / ТЕКСТ ─────
    const dt = getCanonicalType(col);

    const inputType =
        dt === 'date'
            ? 'date'
            : dt === 'time' || dt === 'timetz'
                ? 'time'
                : dt === 'timestamp' || dt === 'timestamptz'
                    ? 'datetime-local'
                    : undefined;

    const isTriStateCheckbox = col.type === 'checkboxNull';
    const isRegularCheckbox = col.type === 'checkbox' || col.type === 'bool';

    if (isTriStateCheckbox) {
        return (
            <TriStateCheckbox
                value={value}
                onChange={(newState) => {
                    onChange(newState);
                }}
                showError={hasError}
            />
        );
    }

    if (isRegularCheckbox) {
        const checked =
            value === 'true' ||
            value === '1' ||
            value === 't' ||
            value === 'T' ||
            value === 'yes' ||
            value === 'да';

        return (
            <Checkbox
                size="small"
                checked={checked}
                onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
                sx={hasError ? checkboxErrorSx : checkboxSx}
            />
        );
    }

    const isDateLike =
        inputType === 'date' ||
        inputType === 'time' ||
        inputType === 'datetime-local';

    let inputValue: string;
    let handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

    if (isDateLike) {
        inputValue = toInputValue(value ?? '', dt);
        handleChange = (e) => {
            const raw = e.target.value;
            const backend = fromInputValue(raw, dt);
            onChange(backend);
        };
    } else {
        inputValue = value ?? '';
        handleChange = (e) => {
            let raw = e.target.value;

            if (isNumericLike(dt) && raw.includes(',')) {
                raw = raw.replace(/,/g, '.');
            }

            onChange(raw);
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multiline для текстовых полей (и add, и edit)
    // Позволяет видеть весь текст без горизонтальной прокрутки
    // ═══════════════════════════════════════════════════════════════════════════
    const isMultiline =
        !isDateLike &&
        !isTriStateCheckbox &&
        !isRegularCheckbox;

    return (
        <TextField
            size="small"
            fullWidth
            type={isMultiline ? undefined : inputType}
            value={inputValue}
            onChange={handleChange}
            placeholder={placeholder}
            error={hasError}
            inputProps={
                !isMultiline && inputType === 'time'
                    ? { step: 1 }
                    : undefined
            }
            multiline={isMultiline}
            minRows={isMultiline ? 1 : undefined}
            maxRows={isMultiline ? 6 : undefined}
            className={`${s.inpInCell} ${isDateLike ? s.dateTimeInput : ''}`}
            sx={{
                ...textFieldSx,
                ...errorSx,
            }}
        />
    );
};