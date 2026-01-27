import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, FormControlLabel, Checkbox, Stack,
    CircularProgress, InputAdornment, Box
} from '@mui/material';
import { api } from '@/services/api';

type Props = {
    open: boolean;
    value: {
        combobox_width: number;
        combobox_column_order: number;
        combobox_alias: string;
        is_primary: boolean;
        is_show: boolean;
        is_show_hidden: boolean;
        combobox_column_id: number | null;
        combobox_column_name?: string | null;
    };
    onChange: (patch: Partial<Props['value']>) => void;
    onClose: () => void;
    onSave: () => void;
    saving?: boolean;
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

const readOnlyFieldSx = {
    ...textFieldSx,
    '& .MuiOutlinedInput-root': {
        ...textFieldSx['& .MuiOutlinedInput-root'],
        backgroundColor: 'var(--theme-surface)',
    },
};

const checkboxSx = {
    color: 'var(--checkbox-unchecked)',
    '&.Mui-checked': {
        color: 'var(--checkbox-checked)',
    },
};

export const ComboboxItemDialog: React.FC<Props> = ({
                                                        open, value, onChange, onClose, onSave, saving
                                                    }) => {
    const [nameLoading, setNameLoading] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchName = async (id: number) => {
            setNameLoading(true);
            setNameError(null);
            try {
                const { data } = await api.get(`/tables/columns/${id}`);
                if (!cancelled) {
                    const name = (data as any)?.name ?? '';
                    onChange({ combobox_column_name: name });
                }
            } catch {
                if (!cancelled) setNameError('Не удалось получить имя колонки');
            } finally {
                if (!cancelled) setNameLoading(false);
            }
        };

        if (
            open &&
            value.combobox_column_id &&
            (!value.combobox_column_name || value.combobox_column_name.trim() === '')
        ) {
            fetchName(value.combobox_column_id);
        }

        return () => { cancelled = true; };
    }, [open, value.combobox_column_id, value.combobox_column_name, onChange]);

    return (
        <Dialog
            open={open}
            onClose={saving ? undefined : onClose}
            fullWidth
            maxWidth="sm"
            PaperProps={{ sx: dialogPaperSx }}
        >
            <DialogTitle>Редактирование поля combobox</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        type="number"
                        label="combobox_width"
                        size="small"
                        value={value.combobox_width}
                        onChange={e => {
                            const n = parseInt(e.target.value, 10);
                            onChange({ combobox_width: Number.isFinite(n) ? Math.max(1, n) : 1 });
                        }}
                        inputProps={{ min: 1 }}
                        sx={textFieldSx}
                    />

                    <TextField
                        type="number"
                        label="combobox_column_order"
                        size="small"
                        value={value.combobox_column_order}
                        onChange={e => {
                            const n = parseInt(e.target.value, 10);
                            onChange({ combobox_column_order: Number.isFinite(n) ? Math.max(0, n) : 0 });
                        }}
                        inputProps={{ min: 0 }}
                        sx={textFieldSx}
                    />

                    <TextField
                        label="combobox_alias"
                        size="small"
                        value={value.combobox_alias ?? ''}
                        onChange={e => onChange({ combobox_alias: e.target.value })}
                        placeholder="Подпись столбца"
                        sx={textFieldSx}
                    />

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={!!value.is_primary}
                                onChange={e => onChange({ is_primary: e.target.checked })}
                                sx={checkboxSx}
                            />
                        }
                        label={<Box sx={{ color: 'var(--theme-text-primary)' }}>is_primary</Box>}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={!!value.is_show}
                                onChange={e => onChange({ is_show: e.target.checked })}
                                sx={checkboxSx}
                            />
                        }
                        label={<Box sx={{ color: 'var(--theme-text-primary)' }}>is_show</Box>}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={!!value.is_show_hidden}
                                onChange={e => onChange({ is_show_hidden: e.target.checked })}
                                sx={checkboxSx}
                            />
                        }
                        label={<Box sx={{ color: 'var(--theme-text-primary)' }}>is_show_hidden</Box>}
                    />

                    {/* ТОЛЬКО ПРОСМОТР: combobox_column_id */}
                    <TextField
                        label="combobox_column_id"
                        size="small"
                        value={value.combobox_column_id ?? ''}
                        InputProps={{ readOnly: true }}
                        sx={readOnlyFieldSx}
                    />

                    {/* ТОЛЬКО ПРОСМОТР: combobox_column_name */}
                    <TextField
                        label="combobox_column_name"
                        size="small"
                        value={value.combobox_column_name ?? ''}
                        InputProps={{
                            readOnly: true,
                            endAdornment: (
                                <InputAdornment position="end">
                                    {nameLoading ? <CircularProgress size={16} /> : null}
                                </InputAdornment>
                            ),
                        }}
                        error={!!nameError}
                        sx={readOnlyFieldSx}
                    />
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button
                    onClick={onClose}
                    disabled={!!saving}
                    sx={{ color: 'var(--theme-text-secondary)' }}
                >
                    Отмена
                </Button>
                <Button
                    type="button"
                    onClick={onSave}
                    disabled={!!saving}
                    variant="contained"
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
                    {saving ? 'Сохр...' : 'Сохранить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};