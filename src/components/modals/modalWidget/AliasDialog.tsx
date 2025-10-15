import React from 'react';
import {Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField} from '@mui/material';

type Props = {
    open: boolean;
    value: string;
    onChange: (v: string) => void;
    onClose: () => void;
    onSave: () => void;
};

export const AliasDialog: React.FC<Props> = ({ open, value, onChange, onClose, onSave }) => (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle>Изменить alias</DialogTitle>
        <DialogContent dividers>
            <TextField autoFocus fullWidth size="small" label="Alias"
                       value={value}
                       onChange={e => onChange(e.target.value)}
                       placeholder="Пусто = сбросить alias"/>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Отмена</Button>
            <Button onClick={onSave} variant="contained">Сохранить</Button>
        </DialogActions>
    </Dialog>
);
