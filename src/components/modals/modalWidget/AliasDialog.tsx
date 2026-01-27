import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';

type Props = {
    open: boolean;
    value: string;
    onChange: (v: string) => void;
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

export const AliasDialog: React.FC<Props> = ({ open, value, onChange, onClose, onSave }) => (
    <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: dialogPaperSx }}
    >
        <DialogTitle>Изменить alias</DialogTitle>
        <DialogContent dividers>
            <TextField
                autoFocus
                fullWidth
                size="small"
                label="Alias"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder="Пусто = сбросить alias"
                sx={textFieldSx}
            />
        </DialogContent>
        <DialogActions>
            <Button
                onClick={onClose}
                sx={{ color: 'var(--theme-text-secondary)' }}
            >
                Отмена
            </Button>
            <Button
                onClick={onSave}
                variant="contained"
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