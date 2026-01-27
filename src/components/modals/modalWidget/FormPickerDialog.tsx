import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Autocomplete } from '@mui/material';

export type FormOption = { id: number | null; name: string };

type Props = {
    open: boolean;
    value: number | null;
    options: FormOption[];
    onOpen?: () => void;
    onChange: (v: number | null) => void;
    onClear: () => void;
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

export const FormPickerDialog: React.FC<Props> = ({
                                                      open, value, options, onOpen, onChange, onClear, onClose, onSave
                                                  }) => (
    <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: dialogPaperSx }}
    >
        <DialogTitle>Выбор формы</DialogTitle>
        <DialogContent dividers>
            <Autocomplete
                options={options}
                value={options.find(f => String(f.id) === String(value)) ?? options[0]}
                getOptionLabel={(o) => o?.name ?? ''}
                onOpen={onOpen}
                onChange={(_e, val) => onChange(val?.id ?? null)}
                isOptionEqualToValue={(a, b) => String(a.id) === String(b.id)}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Форма"
                        size="small"
                        placeholder="Начните вводить…"
                        sx={textFieldSx}
                    />
                )}
            />
        </DialogContent>
        <DialogActions>
            <Button
                onClick={onClear}
                sx={{ color: 'var(--theme-error)' }}
            >
                Очистить
            </Button>
            <Button
                onClick={onClose}
                sx={{ color: 'var(--theme-text-secondary)' }}
            >
                Отмена
            </Button>
            <Button
                variant="contained"
                onClick={onSave}
                sx={{
                    backgroundColor: 'var(--button-primary-bg)',
                    color: 'var(--button-primary-text)',
                    '&:hover': {
                        backgroundColor: 'var(--button-primary-hover)',
                    },
                }}
            >
                Сохранить
            </Button>
        </DialogActions>
    </Dialog>
);