// src/components/Form/parts/InputCell.tsx
import React from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import { api } from '@/services/api';
import { ExtCol, getCanonicalType } from '@/components/Form/formTable/parts/FormatByDatatype';
import { fromInputValue, toInputValue } from '@/components/Form/formTable/parts/ToInputValue';
import { MenuItem, Select, TextField, Checkbox, CircularProgress } from '@mui/material';

// ═══════════════════════════════════════════════════════════════════════════════
// DEBUG
// ═══════════════════════════════════════════════════════════════════════════════
const DEBUG_COMBO = true;

function logCombo(action: string, data: Record<string, any>) {
    if (!DEBUG_COMBO) return;
    console.log(
        `%c[InputCell:Combo] %c${action}`,
        'color: #E91E63; font-weight: bold',
        'color: #2196F3',
        data
    );
}

/** combobox-мета с бэка (если понадобится) */
type ComboColumnMeta = { ref_column_order: number; width: number; combobox_alias: string | null };
type ComboResp = {
    columns: ComboColumnMeta[];
    data: Array<{
        primary: (string | number)[];
        show: (string | number)[];
        show_hidden: (string | number)[];
    }>;
};

export type ComboOption = {
    id: string;           // primary[0] → как строка
    show: string[];       // то, что backend даёт в show
    showHidden: string[]; // то, что backend даёт в show_hidden
};

/** общий кеш для combobox-опций */
const comboCache = new Map<string, { options: ComboOption[]; columns: ComboColumnMeta[] }>();

const makeComboKey = (widgetColumnId: number, writeTcId: number) =>
    `${widgetColumnId}:${writeTcId}`;

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

/** 👇 ОДИН общий loader, который можно вызывать и из хуков, и из useMainCrud */
export async function loadComboOptionsOnce(
    widgetColumnId: number,
    writeTcId: number,
): Promise<ComboOption[]> {
    const key = makeComboKey(widgetColumnId, writeTcId);

    logCombo('loadComboOptionsOnce', { widgetColumnId, writeTcId, key, hasCached: comboCache.has(key) });

    const cached = comboCache.get(key);
    if (cached) {
        logCombo('loadComboOptionsOnce → from cache', { key, count: cached.options.length });
        return cached.options;
    }

    logCombo('loadComboOptionsOnce → fetching from API', { url: `/display/combobox/${widgetColumnId}/${writeTcId}` });

    const { data } = await api.get<ComboResp>(`/display/combobox/${widgetColumnId}/${writeTcId}`);

    logCombo('loadComboOptionsOnce → API response', {
        columnsCount: data.columns?.length,
        dataCount: data.data?.length,
        firstItem: data.data?.[0],
    });

    const opts: ComboOption[] = data.data.map((row) => ({
        id: String(row.primary?.[0] ?? ''),
        show: (row.show ?? []).map(String),
        showHidden: (row.show_hidden ?? []).map(String),
    }));

    comboCache.set(key, { options: opts, columns: data.columns });

    logCombo('loadComboOptionsOnce → cached', { key, count: opts.length });

    return opts;
}

/** Очистка кеша для конкретного combobox (вызывать после CRUD) */
export function clearComboCache(widgetColumnId?: number, writeTcId?: number) {
    if (widgetColumnId != null && writeTcId != null) {
        const key = makeComboKey(widgetColumnId, writeTcId);
        comboCache.delete(key);
        logCombo('clearComboCache → specific', { key });
    } else {
        comboCache.clear();
        logCombo('clearComboCache → ALL', {});
    }
}

/** Собираем красивую подпись из show + show_hidden (как у тебя было) */
export function buildOptionLabel(opt: ComboOption): string {
    const base = opt.show ?? [];
    const extra = (opt.showHidden ?? []).filter(v => !base.includes(v));
    const parts = [...base, ...extra];
    return parts.length ? parts.join(' · ') : opt.id;
}

/** Загружает и кэширует варианты для combobox колонки */
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
        logCombo('useComboOptions:effect', { widgetColumnId, writeTcId, reloadToken });

        if (!widgetColumnId || !writeTcId) {
            logCombo('useComboOptions:skip', { reason: 'no widgetColumnId or writeTcId' });
            setReady(true);
            return;
        }

        let cancelled = false;
        setReady(false);

        const load = async () => {
            setLoading(true);
            setError(null);

            try {
                const key = makeComboKey(widgetColumnId, writeTcId);

                if (reloadToken === 0) {
                    const cached = comboCache.get(key);
                    if (cached) {
                        logCombo('useComboOptions:fromCache', { key, count: cached.options.length });
                        setOptions(cached.options);
                        setReady(true);
                        return;
                    }
                } else {
                    comboCache.delete(key);
                    logCombo('useComboOptions:cacheCleared', { key, reloadToken });
                }

                const opts = await loadComboOptionsOnce(widgetColumnId, writeTcId);
                if (!cancelled) {
                    logCombo('useComboOptions:loaded', { count: opts.length });
                    setOptions(opts);
                    setReady(true);
                }
            } catch (e: any) {
                if (!cancelled) {
                    const errMsg = String(e?.message ?? 'Ошибка загрузки combobox');
                    logCombo('useComboOptions:ERROR', { error: errMsg, e });
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

export type InputCellProps = {
    mode: 'add' | 'edit';
    col: ExtCol;
    value: string;
    onChange: (v: string) => void;
    readOnly: boolean;
    placeholder: string;
    comboReloadToken?: number;
};

/** Универсальный инпут для Main/Sub: текст, combobox, date/time/timestamp(+tz) */
export const InputCell: React.FC<InputCellProps> = ({
                                                        mode,
                                                        col,
                                                        value,
                                                        onChange,
                                                        readOnly,
                                                        placeholder,
                                                        comboReloadToken = 0,
                                                    }) => {
    const writeTcId = (col.__write_tc_id ?? col.table_column_id) ?? null;

    // ═══════════════════════════════════════════════════════════════════════════
    // DEBUG: Логируем при рендере combobox колонки
    // ═══════════════════════════════════════════════════════════════════════════
    const isComboType = col.type === 'combobox';

    if (DEBUG_COMBO && isComboType) {
        logCombo('RENDER', {
            columnName: col.column_name ?? col.ref_column_name,
            type: col.type,
            widget_column_id: col.widget_column_id,
            table_column_id: col.table_column_id,
            writeTcId,
            __is_primary_combo_input: col.__is_primary_combo_input,
            __write_tc_id: col.__write_tc_id,
            readOnly,
            value,
        });
    }

    if (readOnly || writeTcId == null) {
        if (DEBUG_COMBO && isComboType) {
            logCombo('RENDER → readonly/no writeTcId', { readOnly, writeTcId });
        }
        return (
            <span className={s.readonlyValue} title="Только для чтения">
                {value || '—'}
            </span>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ИСПРАВЛЕНО: Проверяем type === 'combobox' даже если __is_primary_combo_input не установлен
    // ═══════════════════════════════════════════════════════════════════════════
    const isComboPrimary = col.type === 'combobox' && col.__is_primary_combo_input;

    // НОВОЕ: Если type === 'combobox' но __is_primary_combo_input не установлен,
    // всё равно пытаемся показать как combobox
    const shouldRenderAsCombo = col.type === 'combobox';

    if (DEBUG_COMBO && isComboType) {
        logCombo('COMBO CHECK', {
            isComboPrimary,
            shouldRenderAsCombo,
            willLoadOptions: shouldRenderAsCombo,
        });
    }

    const { options, loading, ready } = useComboOptions(
        col.widget_column_id,
        // ИСПРАВЛЕНО: загружаем опции если это combobox (не только если primary)
        shouldRenderAsCombo ? writeTcId : null,
        comboReloadToken,
    );

    // ───── combobox ─────
    if (shouldRenderAsCombo) {
        if (DEBUG_COMBO) {
            logCombo('COMBO RENDER', {
                loading,
                ready,
                optionsCount: options.length,
                currentValue: value,
            });
        }

        // Пока опции не загружены — показываем loading
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
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: 12,
                    }}
                >
                    <CircularProgress size={16} color="inherit" />
                    <span>Загрузка...</span>
                </div>
            );
        }

        // Проверяем: если value есть, но его нет в options
        const currentValue = value ?? '';
        const hasValueInOptions = !currentValue || options.some(o => o.id === currentValue);

        // Если значение не найдено в опциях — добавляем его как "временный" пункт
        const effectiveOptions = hasValueInOptions
            ? options
            : [
                { id: currentValue, show: [`#${currentValue}`], showHidden: ['Значение не найдено'] },
                ...options
            ];

        if (DEBUG_COMBO) {
            logCombo('COMBO SELECT', {
                currentValue,
                hasValueInOptions,
                effectiveOptionsCount: effectiveOptions.length,
                firstOptions: effectiveOptions.slice(0, 3).map(o => ({ id: o.id, label: buildOptionLabel(o) })),
            });
        }

        return (
            <Select
                size="small"
                fullWidth
                value={currentValue}
                displayEmpty
                onChange={(e) => {
                    const newVal = String(e.target.value ?? '');
                    logCombo('COMBO onChange', { oldValue: currentValue, newValue: newVal });
                    onChange(newVal);
                }}
                className={s.inpInCell}
                sx={{
                    '& .MuiSelect-select': {
                        padding: '2px 6px',
                        minHeight: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                    },
                }}
            >
                <MenuItem value="">
                    <em>— не выбрано —</em>
                </MenuItem>
                {effectiveOptions.map((o) => (
                    <MenuItem
                        key={o.id}
                        value={o.id}
                        title={o.showHidden.join(' / ')}
                        sx={
                            !hasValueInOptions && o.id === currentValue
                                ? { color: 'warning.main', fontStyle: 'italic' }
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

    const isCheckbox = col.type === 'checkbox' || col.type === 'bool';

    if (isCheckbox) {
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

    const isMultiline =
        mode === 'edit' &&
        !isDateLike &&
        !isCheckbox;

    return (
        <TextField
            size="small"
            fullWidth
            type={isMultiline ? undefined : inputType}
            value={inputValue}
            onChange={handleChange}
            placeholder={placeholder}
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
                '& .MuiInputBase-root': {
                    alignItems: 'stretch',
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
            }}
        />
    );
};