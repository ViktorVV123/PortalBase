import React from 'react';
import {Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Autocomplete} from '@mui/material';

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

export const FormPickerDialog: React.FC<Props> = ({
                                                      open, value, options, onOpen, onChange, onClear, onClose, onSave
                                                  }) => (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
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
                    <TextField {...params} label="Форма" size="small" placeholder="Начните вводить…"/>
                )}
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={onClear}>Очистить</Button>
            <Button onClick={onClose}>Отмена</Button>
            <Button variant="contained" onClick={onSave}>Сохранить</Button>
        </DialogActions>
    </Dialog>
);
