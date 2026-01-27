/* ModalAddTable.tsx */
import { ChangeEvent, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Stack, CircularProgress, Box,
} from '@mui/material';

import { api } from '@/services/api';
import { WorkSpaceTypes } from '@/types/typesWorkSpaces';
import { DTable } from "@/shared/hooks/useWorkSpaces";

type Props = {
    open: boolean;
    workspace: WorkSpaceTypes;
    onSuccess: (table: DTable) => void;
    onCancel: () => void;
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

export const ModalAddTable = ({
                                  open, workspace, onSuccess, onCancel,
                              }: Props) => {
    const [form, setForm] = useState({
        name: '',
        description: '',
        select_query: '',
        insert_query: '',
        update_query: '',
        delete_query: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handle = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) {
            setError('Введите название таблицы');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const { data } = await api.post<DTable>('/tables/', {
                workspace_id: workspace.id,
                ...form,
            });
            onSuccess(data);
        } catch {
            setError('Не удалось создать таблицу');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            fullWidth
            maxWidth="sm"
            PaperProps={{ sx: dialogPaperSx }}
        >
            <DialogTitle>Новая таблица в «{workspace.name}»</DialogTitle>

            <form onSubmit={submit}>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <TextField
                            label="Название"
                            name="name"
                            size="small"
                            fullWidth
                            value={form.name}
                            onChange={handle}
                            required
                            sx={textFieldSx}
                        />

                        <TextField
                            label="Описание"
                            name="description"
                            size="small"
                            fullWidth
                            value={form.description}
                            onChange={handle}
                            sx={textFieldSx}
                        />

                        <TextField
                            label="SELECT query"
                            name="select_query"
                            size="small"
                            fullWidth
                            multiline
                            rows={2}
                            value={form.select_query}
                            onChange={handle}
                            sx={textFieldSx}
                        />

                        <TextField
                            label="INSERT query"
                            name="insert_query"
                            size="small"
                            fullWidth
                            multiline
                            rows={2}
                            value={form.insert_query}
                            onChange={handle}
                            sx={textFieldSx}
                        />

                        <TextField
                            label="UPDATE query"
                            name="update_query"
                            size="small"
                            fullWidth
                            multiline
                            rows={2}
                            value={form.update_query}
                            onChange={handle}
                            sx={textFieldSx}
                        />

                        <TextField
                            label="DELETE query"
                            name="delete_query"
                            size="small"
                            fullWidth
                            multiline
                            rows={2}
                            value={form.delete_query}
                            onChange={handle}
                            sx={textFieldSx}
                        />

                        {error && (
                            <Box sx={{ color: 'var(--theme-error)' }}>
                                {error}
                            </Box>
                        )}
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ pr: 3, pb: 2 }}>
                    <Button
                        onClick={onCancel}
                        sx={{ color: 'var(--theme-text-secondary)' }}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        type="submit"
                        disabled={loading || !form.name.trim()}
                        startIcon={loading && <CircularProgress size={16} />}
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
                        {loading ? 'Создаю…' : 'Создать'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};