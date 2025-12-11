// src/components/Form/parts/InputCell.tsx
import React from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import { api } from '@/services/api';
import { ExtCol, getCanonicalType } from '@/components/Form/formTable/parts/FormatByDatatype';
import { fromInputValue, toInputValue } from '@/components/Form/formTable/parts/ToInputValue';
import { MenuItem, Select, TextField, Checkbox } from '@mui/material';

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

    // находим колонку по write_tc_id
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
        // текстовые поля с запятыми не трогаем
        return trimmed;
    }

    // для числовых меняем ВСЕ запятые на точки
    return trimmed.replace(/,/g, '.');
};

/** 👇 ОДИН общий loader, который можно вызывать и из хуков, и из useMainCrud */
export async function loadComboOptionsOnce(
    widgetColumnId: number,
    writeTcId: number,
): Promise<ComboOption[]> {
    const key = makeComboKey(widgetColumnId, writeTcId);
    const cached = comboCache.get(key);
    if (cached) return cached.options;

    const { data } = await api.get<ComboResp>(`/display/combobox/${widgetColumnId}/${writeTcId}`);
    const opts: ComboOption[] = data.data.map((row) => ({
        id: String(row.primary?.[0] ?? ''),
        show: (row.show ?? []).map(String),
        showHidden: (row.show_hidden ?? []).map(String),
    }));

    comboCache.set(key, { options: opts, columns: data.columns });
    return opts;
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

    React.useEffect(() => {
        if (!widgetColumnId || !writeTcId) return;

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);

            try {
                const key = makeComboKey(widgetColumnId, writeTcId);

                if (reloadToken === 0) {
                    // пробуем взять из кеша
                    const cached = comboCache.get(key);
                    if (cached) {
                        setOptions(cached.options);
                        return;
                    }
                } else {
                    // после CRUD в DrillDialog принудительно сбрасываем кеш
                    comboCache.delete(key);
                }

                const opts = await loadComboOptionsOnce(widgetColumnId, writeTcId);
                if (!cancelled) {
                    setOptions(opts);
                }
            } catch (e: any) {
                if (!cancelled) {
                    setError(String(e?.message ?? 'Ошибка загрузки combobox'));
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

    return { loading, options, error };
}

export type InputCellProps = {
    mode: 'add' | 'edit';
    col: ExtCol;
    value: string;
    onChange: (v: string) => void;
    readOnly: boolean;
    placeholder: string;
    /** если нужно явно перезагрузить combobox после CRUD (MainTable edit) */
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

    if (readOnly || writeTcId == null) {
        return (
            <span className={s.readonlyValue} title="Только для чтения">
                {value || '—'}
            </span>
        );
    }

    const isComboPrimary = col.type === 'combobox' && col.__is_primary_combo_input;

    const { options } = useComboOptions(
        col.widget_column_id,
        isComboPrimary ? writeTcId : null,
        comboReloadToken,
    );

    // ───── combobox primary ─────
    if (isComboPrimary) {
        return (
            <Select
                size="small"
                fullWidth
                value={value ?? ''}
                displayEmpty
                onChange={(e) => onChange(String(e.target.value ?? ''))}
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
                    <em>—</em>
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

    // числовые типы — сюда тащим переложение запятая → точка





    let inputValue: string;
    let handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

    if (isDateLike) {
        // даты/время обрабатываем как раньше
        inputValue = toInputValue(value ?? '', dt);
        handleChange = (e) => {
            const raw = e.target.value;
            const backend = fromInputValue(raw, dt);
            onChange(backend);
        };
    } else {
        // обычный текст/число
        inputValue = value ?? '';
        handleChange = (e) => {
            let raw = e.target.value;

            // 👇 если это числовая колонка — заменяем запятые на точки
            if (isNumericLike && raw.includes(',')) {
                raw = raw.replace(/,/g, '.');
            }

            onChange(raw);
        };
    }

    return (
        <TextField
            size="small"
            fullWidth
            type={inputType}
            value={inputValue}
            onChange={handleChange}
            placeholder={placeholder}
            inputProps={inputType === 'time' ? { step: 1 } : undefined}
            className={`${s.inpInCell} ${isDateLike ? s.dateTimeInput : ''}`}
        />
    );
};
