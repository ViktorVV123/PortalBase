import React from 'react';
import {Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, FormControlLabel, Checkbox, Autocomplete} from '@mui/material';

export type ColumnOption = { id: number; name: string; datatype: string; disabled: boolean };
export type AddDlgState = {
    open: boolean;
    wcId: number | null;
    table_column_id: number | null;
    width: number;
    ref_column_order: number;
    type: string;
    ref_alias: string;
    default: string;
    placeholder: string;
    visible: boolean;
    readonly: boolean;
    form_id: number | null;
};

type Props = {
    value: AddDlgState;
    columnOptions: ColumnOption[];
    formOptions: { id: number | null; name: string }[];
    getColLabel: (o?: ColumnOption | null) => string;
    onChange: (patch: Partial<AddDlgState>) => void;
    onOpenForms?: () => void;
    onClose: () => void;
    onSave: () => void;
};

export const AddReferenceDialog: React.FC<Props> = ({
                                                        value, columnOptions, formOptions, getColLabel, onChange, onOpenForms, onClose, onSave
                                                    }) => (
    <Dialog open={value.open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Добавить поле в группу</DialogTitle>
        <DialogContent dividers>
            <Stack spacing={2}>
                <Autocomplete<ColumnOption>
                    options={columnOptions}
                    value={columnOptions.find(o => o.id === value.table_column_id) ?? null}
                    getOptionLabel={getColLabel}
                    isOptionEqualToValue={(a, b) => a?.id === b?.id}
                    onChange={(_e, opt) => onChange({ table_column_id: opt?.id ?? null })}
                    getOptionDisabled={(option) => option.disabled}
                    renderOption={(props, option) => (
                        <li {...props}>
                            {getColLabel(option)} {option.disabled ? ' — уже используется' : ''}
                        </li>
                    )}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Столбец таблицы"
                            size="small"
                            placeholder="Выберите столбец…"
                        />
                    )}
                />

                <TextField label="ref_alias" size="small" value={value.ref_alias}
                           onChange={e => onChange({ref_alias: e.target.value})}/>
                <TextField label="type" size="small" value={value.type}
                           onChange={e => onChange({type: e.target.value})}/>
                <TextField
                    label="width"
                    type="number"
                    size="small"
                    value={value.width}
                    onChange={e => onChange({ width: (e.target as HTMLInputElement).value === '' ? 1 : Number(e.target.value) })}
                />
                <TextField label="default" size="small" value={value.default}
                           onChange={e => onChange({default: e.target.value})}/>
                <TextField label="placeholder" size="small" value={value.placeholder}
                           onChange={e => onChange({placeholder: e.target.value})}/>
                <FormControlLabel control={
                    <Checkbox checked={value.visible}
                              onChange={e => onChange({visible: e.target.checked})}/>
                } label="visible"/>
                <FormControlLabel control={
                    <Checkbox checked={value.readonly}
                              onChange={e => onChange({readonly: e.target.checked})}/>
                } label="только чтение"/>

                <TextField
                    type="number"
                    label="ref_column_order"
                    size="small"
                    value={value.ref_column_order}
                    onChange={e => onChange({ ref_column_order: (e.target as HTMLInputElement).value === '' ? 0 : Number(e.target.value) })}
                    helperText="Позиция в группе (0…N). По умолчанию — в конец."
                />

                {/* выбор формы */}
                <Autocomplete
                    options={formOptions}
                    value={formOptions.find(f => String(f.id) === String(value.form_id)) ?? formOptions[0]}
                    getOptionLabel={(o) => o?.name ?? ''}
                    onOpen={onOpenForms}
                    onChange={(_e, val) => onChange({ form_id: (val?.id ?? null) })}
                    isOptionEqualToValue={(a, b) => String(a.id) === String(b.id)}
                    renderInput={(params) => (
                        <TextField {...params} label="Форма" size="small" placeholder="— Без формы —"/>
                    )}
                />
            </Stack>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Отмена</Button>
            <Button variant="contained" onClick={onSave} disabled={!value.table_column_id}>Добавить</Button>
        </DialogActions>
    </Dialog>
);
