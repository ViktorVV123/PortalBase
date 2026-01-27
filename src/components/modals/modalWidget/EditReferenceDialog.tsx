import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Stack,
    TextField,
    FormControlLabel,
    Checkbox,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Box
} from '@mui/material';

export type EditState = {
    open: boolean;
    wcId: number | null;
    tableColumnId: number | null;
    ref_alias: string;
    ref_type: string | null;
    ref_width: number;
    ref_order: number;
    ref_default: string;
    ref_placeholder: string;
    ref_visible: boolean;
    ref_readOnly: boolean;
    ref_datatype: string | null;
};

type Props = {
    value: EditState;
    onChange: (patch: Partial<EditState>) => void;
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

export const EditReferenceDialog: React.FC<Props> = ({ value, onChange, onClose, onSave }) => (
    <Dialog
        open={value.open}
        onClose={onClose}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: dialogPaperSx }}
    >
        <DialogTitle>Правка reference</DialogTitle>
        <DialogContent dividers>
            <Stack spacing={2}>
                <TextField
                    label="ref_alias"
                    size="small"
                    value={value.ref_alias}
                    onChange={e => onChange({ ref_alias: e.target.value })}
                    sx={textFieldSx}
                />

                <FormControl size="small" fullWidth>
                    <InputLabel
                        id="ref-type-label"
                        sx={{
                            color: 'var(--theme-text-secondary)',
                            '&.Mui-focused': { color: 'var(--theme-primary)' },
                        }}
                    >
                        type
                    </InputLabel>
                    <Select
                        labelId="ref-type-label"
                        label="type"
                        value={value.ref_type ?? ''}
                        onChange={e => {
                            const v = e.target.value;

                            if (v === 'rls') {
                                const dt = (value.ref_datatype || '').toLowerCase();

                                if (dt !== 'boolean' && dt !== 'bool') {
                                    alert('Тип "rls" можно задавать только для колонок с datatype=boolean.');
                                    return;
                                }
                            }

                            onChange({ ref_type: v === '' ? null : String(v) });
                        }}
                        MenuProps={{ disableScrollLock: true }}
                        sx={selectSx}
                    >
                        <MenuItem value="">
                            <em>— пусто —</em>
                        </MenuItem>
                        <MenuItem value="combobox">combobox</MenuItem>
                        <MenuItem value="rls">rls</MenuItem>
                        <MenuItem value="date">Календарь</MenuItem>
                        <MenuItem value="checkbox">Чекбокс</MenuItem>
                        <MenuItem value="checkboxNull">Чекбокс null</MenuItem>
                        <MenuItem value="timestampwtz">Календарь со временем и тайм зоной</MenuItem>
                        <MenuItem value="timestamp">Календарь со временем</MenuItem>
                        <MenuItem value="timewtz">Время с тайм зоной</MenuItem>
                        <MenuItem value="time">Время</MenuItem>
                        <MenuItem value="styles">Стиль</MenuItem>
                    </Select>
                </FormControl>

                <TextField
                    type="number"
                    label="width"
                    size="small"
                    value={value.ref_width}
                    onChange={e => onChange({ ref_width: Number(e.target.value) })}
                    sx={textFieldSx}
                />
                <TextField
                    label="default"
                    size="small"
                    value={value.ref_default}
                    onChange={e => onChange({ ref_default: e.target.value })}
                    sx={textFieldSx}
                />
                <TextField
                    label="placeholder"
                    size="small"
                    value={value.ref_placeholder}
                    onChange={e => onChange({ ref_placeholder: e.target.value })}
                    sx={textFieldSx}
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={value.ref_visible}
                            onChange={e => onChange({ ref_visible: e.target.checked })}
                            sx={checkboxSx}
                        />
                    }
                    label={<Box sx={{ color: 'var(--theme-text-primary)' }}>visible</Box>}
                />
                <FormControlLabel
                    control={
                        <Checkbox
                            checked={value.ref_readOnly}
                            onChange={e => onChange({ ref_readOnly: e.target.checked })}
                            sx={checkboxSx}
                        />
                    }
                    label={<Box sx={{ color: 'var(--theme-text-primary)' }}>только чтение</Box>}
                />
                <TextField
                    type="number"
                    label="ref_column_order"
                    size="small"
                    value={value.ref_order}
                    onChange={e => onChange({ ref_order: Number(e.target.value) })}
                    sx={textFieldSx}
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