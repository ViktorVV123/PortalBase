import React, { useEffect, useMemo, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, FormControl, InputLabel, Select, MenuItem, TextField,
    FormHelperText, Checkbox, FormControlLabel, CircularProgress, Box
} from '@mui/material';
import { api } from '@/services/api';

type ComboboxAddValue = {
    table_id: number | null;
    combobox_column_id: number | null;
    combobox_width: number;
    combobox_column_order: number;
    combobox_alias: string;
    is_primary: boolean;
    is_show: boolean;
    is_show_hidden: boolean;
};

type Props = {
    open: boolean;
    value: ComboboxAddValue;
    saving?: boolean;
    onChange: (patch: Partial<ComboboxAddValue>) => void;
    onClose: () => void;
    onSave: () => void;
};

type ColumnOption = { id: number; name: string };

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

const selectSx = {
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
    '& .MuiSelect-icon': {
        color: 'var(--icon-primary)',
    },
};

const checkboxSx = {
    color: 'var(--checkbox-unchecked)',
    '&.Mui-checked': {
        color: 'var(--checkbox-checked)',
    },
};

export const ComboboxAddDialog: React.FC<Props> = ({
                                                       open, value, saving = false, onChange, onClose, onSave
                                                   }) => {
    const [loadingCols, setLoadingCols] = useState(false);
    const [cols, setCols] = useState<ColumnOption[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!open) return;

            const tid = value.table_id ?? null;
            if (!Number.isFinite(tid as number) || (tid as number) <= 0) {
                setCols([]);
                setError('Форма не выбрана или не удалось определить таблицу для формы.');
                return;
            }

            setLoadingCols(true);
            setError(null);
            setCols([]);
            try {
                const { data } = await api.get(`/tables/${tid}/columns`);
                const arr = (data ?? []).map((c: any) => ({ id: c.id, name: c.name })) as ColumnOption[];
                if (!cancelled) setCols(arr);
            } catch {
                if (!cancelled) setError('Не удалось загрузить колонки таблицы.');
            } finally {
                if (!cancelled) setLoadingCols(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [open, value.table_id]);

    const canSave = useMemo(() => {
        const idOk = Number.isFinite(value.combobox_column_id as number) && (value.combobox_column_id as number) > 0;
        const tableOk = Number.isFinite(value.table_id as number) && (value.table_id as number) > 0;
        return idOk && tableOk && !saving;
    }, [value.combobox_column_id, value.table_id, saving]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            PaperProps={{ sx: dialogPaperSx }}
        >
            <DialogTitle>Добавить элемент Combobox</DialogTitle>
            <DialogContent dividers>
                <FormHelperText sx={{ mb: 1, color: 'var(--theme-text-secondary)' }}>
                    {Number.isFinite(value.table_id as number) && (value.table_id as number) > 0
                        ? `Колонки формы: таблица #${value.table_id}`
                        : 'Форма не выбрана — выбор колонок недоступен'}
                </FormHelperText>

                <FormControl
                    fullWidth
                    size="small"
                    margin="dense"
                    disabled={!Number.isFinite(value.table_id as number)}
                >
                    <InputLabel
                        id="combo-col-id-label"
                        sx={{
                            color: 'var(--theme-text-secondary)',
                            '&.Mui-focused': { color: 'var(--theme-primary)' },
                        }}
                    >
                        combobox_column_id
                    </InputLabel>
                    <Select
                        labelId="combo-col-id-label"
                        label="combobox_column_id"
                        value={value.combobox_column_id ?? ''}
                        onChange={(e) => {
                            const n = parseInt(String(e.target.value), 10);
                            onChange({ combobox_column_id: Number.isFinite(n) ? n : null });
                        }}
                        sx={selectSx}
                    >
                        {loadingCols ? (
                            <MenuItem disabled>
                                <CircularProgress size={16} sx={{ mr: 1 }} /> Загрузка…
                            </MenuItem>
                        ) : error ? (
                            <MenuItem disabled sx={{ color: 'var(--theme-error)' }}>{error}</MenuItem>
                        ) : (
                            cols.map(opt => (
                                <MenuItem key={opt.id} value={opt.id}>
                                    #{opt.id} · {opt.name}
                                </MenuItem>
                            ))
                        )}
                    </Select>
                    <FormHelperText sx={{ color: 'var(--theme-text-muted)' }}>
                        Выберите колонку **из таблицы формы** (список формируется автоматически).
                    </FormHelperText>
                </FormControl>

                <FormControl fullWidth margin="dense">
                    <TextField
                        type="number"
                        label="combobox_width"
                        size="small"
                        value={value.combobox_width}
                        onChange={e => onChange({ combobox_width: Math.max(1, Math.trunc(+e.target.value || 1)) })}
                        sx={textFieldSx}
                    />
                </FormControl>

                <FormControl fullWidth margin="dense">
                    <TextField
                        type="number"
                        label="combobox_column_order"
                        size="small"
                        value={value.combobox_column_order}
                        onChange={e => onChange({ combobox_column_order: Math.max(0, Math.trunc(+e.target.value || 0)) })}
                        sx={textFieldSx}
                    />
                </FormControl>

                <FormControl fullWidth margin="dense">
                    <TextField
                        label="combobox_alias"
                        size="small"
                        value={value.combobox_alias}
                        onChange={e => onChange({ combobox_alias: e.target.value })}
                        sx={textFieldSx}
                    />
                </FormControl>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
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
                </Box>
            </DialogContent>

            <DialogActions>
                <Button
                    onClick={onClose}
                    disabled={saving}
                    sx={{ color: 'var(--theme-text-secondary)' }}
                >
                    Отмена
                </Button>
                <Button
                    onClick={onSave}
                    disabled={!canSave}
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
                    {saving ? 'Сохранение…' : 'Сохранить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};