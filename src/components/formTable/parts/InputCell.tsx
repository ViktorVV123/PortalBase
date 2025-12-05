// src/components/formTable/parts/InputCell.tsx
import React from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import { api } from '@/services/api';
import {ExtCol, getCanonicalType} from '@/components/formTable/parts/FormatByDatatype';
import { fromInputValue, toInputValue } from '@/components/formTable/parts/ToInputValue';
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

/** Собираем красивую подпись из show + show_hidden */
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

    const key = `${widgetColumnId}:${writeTcId ?? 'null'}:${reloadToken}`;

    React.useEffect(() => {
        if (!widgetColumnId || !writeTcId) return;

        const cached = comboCache.get(key);
        if (!reloadToken && cached) {
            setOptions(cached.options);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        api
            .get<ComboResp>(`/display/combobox/${widgetColumnId}/${writeTcId}`)
            .then(({ data }) => {
                if (cancelled) return;
                const opts: ComboOption[] = data.data.map((row) => ({
                    id: String(row.primary?.[0] ?? ''),
                    show: (row.show ?? []).map(String),
                    showHidden: (row.show_hidden ?? []).map(String),
                }));
                comboCache.set(key, { options: opts, columns: data.columns });
                setOptions(opts);
            })
            .catch((e: any) => {
                if (cancelled) return;
                setError(String(e?.message ?? 'Ошибка загрузки combobox'));
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [key, widgetColumnId, writeTcId, reloadToken]);

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




    if (isComboPrimary) {
        return (
            <Select
                size="small"
                fullWidth
                value={value ?? ''}
                displayEmpty
                onChange={(e) => onChange(String(e.target.value ?? ''))}
                // те же классы, что и для TextField в ячейке
                className={s.inpInCell}
                // компактный вид и обрезка текста внутри
                sx={{
                    '& .MuiSelect-select': {
                        padding: '2px 6px',              // меньше отступы
                        minHeight: '32px',               // высота как у TextField small
                        display: 'flex',
                        alignItems: 'center',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',        // не растягивает колонку, а ставит …
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

    // ───── дата / время / timestamp (+tz) ─────
    const dt = getCanonicalType(col);
    const inputType =
        dt === 'date'
            ? 'date'
            : dt === 'time' || dt === 'timetz'
                ? 'time'
                : dt === 'timestamp' || dt === 'timestamptz'
                    ? 'datetime-local'
                    : undefined;

    const inputValue = toInputValue(value ?? '', dt);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const backend = fromInputValue(raw, dt);
        onChange(backend);
    };



    const isCheckbox = col.type === 'checkbox' || col.type === 'bool'

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