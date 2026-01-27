/* ModalAddConnection.tsx */
import { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, CircularProgress, Box, Stack,
} from '@mui/material';

import { api } from '@/services/api';
import { CreateConnectionDto } from '@/types/typesCreateConnections';

type Props = {
    open: boolean;
    onSuccess: () => void;
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

export const ModalAddConnection = ({ open, onSuccess, onCancel }: Props) => {
    const [form, setForm] = useState<CreateConnectionDto>({
        url: { drivername: '', username: '', password: '', host: '', port: 5432, database: '', query: {} },
        connection: { name: '', description: '' },
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const [section, field] = name.split('.');
        setForm(p => ({ ...p, [section]: { ...p[section as keyof typeof p], [field]: value } }));
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await api.post('/connections/sqlalchemy', form);
            onSuccess();
        } catch {
            setError('Не удалось создать подключение');
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
            disableEnforceFocus
            disableRestoreFocus
            hideBackdrop
            PaperProps={{
                sx: {
                    ...dialogPaperSx,
                    zIndex: theme => theme.zIndex.modal + 1,
                },
            }}
        >
            <DialogTitle>Создать connection (SQLAlchemy)</DialogTitle>

            <form onSubmit={submit}>
                <DialogContent dividers sx={{ pt: 2 }}>
                    {/* URL-block */}
                    <Box component="section" sx={{ mb: 3 }}>
                        <Box sx={{ fontWeight: 600, color: 'var(--theme-text-primary)', mb: 1 }}>
                            URL-параметры
                        </Box>
                        <Stack spacing={2}>
                            <TextField
                                label="drivername"
                                name="url.drivername"
                                value={form.url.drivername}
                                onChange={handleChange}
                                size="small"
                                fullWidth
                                required
                                sx={textFieldSx}
                            />
                            <TextField
                                label="username"
                                name="url.username"
                                value={form.url.username}
                                onChange={handleChange}
                                size="small"
                                fullWidth
                                required
                                sx={textFieldSx}
                            />
                            <TextField
                                label="password"
                                name="url.password"
                                type="password"
                                value={form.url.password}
                                onChange={handleChange}
                                size="small"
                                fullWidth
                                required
                                sx={textFieldSx}
                            />
                            <TextField
                                label="host"
                                name="url.host"
                                value={form.url.host}
                                onChange={handleChange}
                                size="small"
                                fullWidth
                                required
                                sx={textFieldSx}
                            />
                            <TextField
                                label="port"
                                name="url.port"
                                type="number"
                                value={form.url.port}
                                onChange={handleChange}
                                size="small"
                                fullWidth
                                required
                                sx={textFieldSx}
                            />
                            <TextField
                                label="database"
                                name="url.database"
                                value={form.url.database}
                                onChange={handleChange}
                                size="small"
                                fullWidth
                                required
                                sx={textFieldSx}
                            />
                        </Stack>
                    </Box>

                    {/* metadata */}
                    <Box component="section">
                        <Box sx={{ fontWeight: 600, color: 'var(--theme-text-primary)', mb: 1 }}>
                            Метаданные
                        </Box>
                        <Stack spacing={2}>
                            <TextField
                                label="name"
                                name="connection.name"
                                value={form.connection.name}
                                onChange={handleChange}
                                size="small"
                                fullWidth
                                required
                                sx={textFieldSx}
                            />
                            <TextField
                                label="description"
                                name="connection.description"
                                value={form.connection.description}
                                onChange={handleChange}
                                size="small"
                                fullWidth
                                required
                                sx={textFieldSx}
                            />
                        </Stack>
                    </Box>

                    {error && (
                        <Box sx={{ color: 'var(--theme-error)', mt: 2 }}>
                            {error}
                        </Box>
                    )}
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
                        disabled={loading}
                        startIcon={loading && <CircularProgress size={16} />}
                        sx={{
                            backgroundColor: 'var(--button-primary-bg)',
                            color: 'var(--button-primary-text)',
                            '&:hover': {
                                backgroundColor: 'var(--button-primary-hover)',
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