import React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Stack, TextField, FormControlLabel, Checkbox, Autocomplete, Box
} from '@mui/material';

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

// ═══════════════════════════════════════════════════════════
// СТИЛИ ДЛЯ ДИАЛОГА — используем CSS переменные темы
// ═══════════════════════════════════════════════════════════
const dialogPaperSx = {
    backgroundColor: 'var(--theme-background)',
    color: 'var(--theme-text-primary)',
    '& .MuiDialogTitle-root': {
        backgroundColor: 'var(--theme-surface)',
        color: 'var(--theme-text-primary)',
        borderBottom: '1px solid var(--theme-border)',
    },
    '& .MuiDialogContent-root': {
        backgroundColor: 'var(--theme-background)',
        color: 'var(--theme-text-primary)',
    },
    '& .MuiDialogActions-root': {
        backgroundColor: 'var(--theme-surface)',
        borderTop: '1px solid var(--theme-border)',
    },
};

const textFieldSx = {
    '& .MuiOutlinedInput-root': {
        color: 'var(--input-text)',
        backgroundColor: 'var(--input-bg)',
        '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--input-border)',
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--input-border-hover)',
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--input-border-focus)',
        },
    },
    '& .MuiInputLabel-root': {
        color: 'var(--theme-text-secondary)',
        '&.Mui-focused': {
            color: 'var(--theme-primary)',
        },
    },
};

const checkboxSx = {
    color: 'var(--checkbox-unchecked)',
    '&.Mui-checked': {
        color: 'var(--checkbox-checked)',
    },
};

export const AddReferenceDialog: React.FC<Props> = ({
                                                        value, columnOptions, formOptions, getColLabel, onChange, onOpenForms, onClose, onSave
                                                    }) => (
    <Dialog
        open={value.open}
        onClose={onClose}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: dialogPaperSx }}
    >
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
                            sx={textFieldSx}
                        />
                    )}
                />

                <TextField
                    label="ref_alias"
                    size="small"
                    value={value.ref_alias}
                    onChange={e => onChange({ ref_alias: e.target.value })}
                    sx={textFieldSx}
                />
                <TextField
                    label="type"
                    size="small"
                    value={value.type}
                    onChange={e => onChange({ type: e.target.value })}
                    sx={textFieldSx}
                />
                <TextField
                    label="width"
                    type="number"
                    size="small"
                    value={value.width}
                    onChange={e => onChange({ width: (e.target as HTMLInputElement).value === '' ? 1 : Number(e.target.value) })}
                    sx={textFieldSx}
                />
                <TextField
                    label="default"
                    size="small"
                    value={value.default}
                    onChange={e => onChange({ default: e.target.value })}
                    sx={textFieldSx}
                />
                <TextField
                    label="placeholder"
                    size="small"
                    value={value.placeholder}
                    onChange={e => onChange({ placeholder: e.target.value })}
                    sx={textFieldSx}
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={value.visible}
                            onChange={e => onChange({ visible: e.target.checked })}
                            sx={checkboxSx}
                        />
                    }
                    label={<Box sx={{ color: 'var(--theme-text-primary)' }}>visible</Box>}
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={value.readonly}
                            onChange={e => onChange({ readonly: e.target.checked })}
                            sx={checkboxSx}
                        />
                    }
                    label={<Box sx={{ color: 'var(--theme-text-primary)' }}>только чтение</Box>}
                />

                <TextField
                    type="number"
                    label="ref_column_order"
                    size="small"
                    value={value.ref_column_order}
                    onChange={e => onChange({ ref_column_order: (e.target as HTMLInputElement).value === '' ? 0 : Number(e.target.value) })}
                    sx={textFieldSx}
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
                        <TextField
                            {...params}
                            label="Форма"
                            size="small"
                            placeholder="— Без формы —"
                            sx={textFieldSx}
                        />
                    )}
                />
            </Stack>
        </DialogContent>
        <DialogActions>
            <Button
                onClick={onClose}
                sx={{ color: 'var(--theme-text-secondary)' }}
            >
                Отмена
            </Button>
            <Button
                variant="contained"
                onClick={onSave}
                disabled={!value.table_column_id}
                sx={{
                    backgroundColor: 'var(--button-primary-bg)',
                    color: 'var(--button-primary-text)',
                    '&:hover': {
                        backgroundColor: 'var(--button-primary-hover)',
                    },
                    '&.Mui-disabled': {
                        backgroundColor: 'var(--checkbox-disabled)',
                    },
                }}
            >
                Добавить
            </Button>
        </DialogActions>
    </Dialog>
);