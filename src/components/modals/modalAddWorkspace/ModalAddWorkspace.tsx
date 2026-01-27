/* ModalAddWorkspace.tsx */
import { ChangeEvent, useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, IconButton,
    FormControl, InputLabel, Select, MenuItem, Stack,
    CircularProgress, SelectChangeEvent, Box,
} from '@mui/material';

import AddIcon from '@/assets/image/AddIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import EditIcon from '@/assets/image/EditIcon.svg';

import { api } from '@/services/api';

import * as styles from './ModalAddWorkspace.module.scss';
import { Connection } from "@/shared/hooks/stores";

type ConnectionItem = Connection & {
    url?: {
        drivername?: string;
        username?: string;
        host?: string;
        port?: number;
        database?: string;
        query?: any;
    };
    connection?: { name?: string; description?: string };
};

type Props = {
    connections: ConnectionItem[];
    onSuccess: () => void;
    onCancel: () => void;
    setShowConnForm: (v: boolean) => void;
    open: boolean;
    deleteConnection: (id: number) => void;
    onEditConnection?: (conn: ConnectionItem) => void;
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

export const ModalAddWorkspace = ({
                                      deleteConnection,
                                      connections,
                                      onSuccess,
                                      onCancel,
                                      setShowConnForm,
                                      open,
                                      onEditConnection,
                                  }: Props) => {
    const [form, setForm] = useState<{
        connection_id: any;
        group: string;
        name: string;
        description: string;
    }>({
        connection_id: connections[connections.length - 1]?.id ?? '',
        group: '',
        name: '',
        description: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!connections.length) {
            setForm(prev => ({ ...prev, connection_id: '' }));
            return;
        }

        const lastId = connections[connections.length - 1]?.id;
        if (lastId == null) return;

        setForm(prev => {
            if (prev.connection_id === lastId) return prev;
            return { ...prev, connection_id: lastId };
        });
    }, [connections]);

    const handle = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSelect = (e: SelectChangeEvent) => {
        const val = e.target.value;
        setForm(prev => ({
            ...prev,
            connection_id: val === '' ? '' : Number(val),
        }));
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            const payload = {
                ...form,
                connection_id:
                    typeof form.connection_id === 'number'
                        ? form.connection_id
                        : undefined,
            };
            await api.post('/workspaces/', payload);
            onSuccess();
        } catch {
            setError('Не удалось создать Workspace');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteConn = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        e.preventDefault();
        if (!confirm('Удалить подключение?')) return;
        await deleteConnection(id);
    };

    const handleEditConn = (e: React.MouseEvent, conn: ConnectionItem) => {
        e.stopPropagation();
        e.preventDefault();
        onEditConnection?.(conn);
    };

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            fullWidth
            maxWidth="sm"
            PaperProps={{ sx: dialogPaperSx }}
        >
            <DialogTitle>Создать workspace</DialogTitle>

            <form onSubmit={submit}>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        {/* SELECT подключения */}
                        <FormControl fullWidth size="small">
                            <InputLabel
                                id="conn-label"
                                sx={{
                                    color: 'var(--theme-text-secondary)',
                                    '&.Mui-focused': { color: 'var(--theme-primary)' },
                                }}
                            >
                                Подключение
                            </InputLabel>
                            <Select
                                labelId="conn-label"
                                name="connection_id"
                                label="Подключение"
                                value={form.connection_id}
                                onChange={handleSelect}
                                sx={selectSx}
                                renderValue={(value) => {
                                    const id =
                                        typeof value === 'number'
                                            ? value
                                            : Number(value);
                                    const conn = connections.find(c => c.id === id);
                                    return conn
                                        ? (conn.name ??
                                            conn.connection?.name ??
                                            `#${id}`)
                                        : '';
                                }}
                                required
                            >
                                {connections.map((c) => (
                                    <MenuItem
                                        key={c.id}
                                        value={c.id}
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-start',
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                gap: 1,
                                                alignItems: 'center',
                                            }}
                                        >
                                            <span>
                                                {c.name ??
                                                    c.connection?.name ??
                                                    `#${c.id}`}
                                            </span>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => handleEditConn(e, c)}
                                                title="Редактировать"
                                                sx={{ color: 'var(--icon-primary)' }}
                                            >
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => handleDeleteConn(e, c.id)}
                                                title="Удалить"
                                                sx={{ color: 'var(--theme-error)' }}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </Box>

                                        <span className={styles.descriptionModal}>
                                            {c.description || c.connection?.description ? (
                                                <span>
                                                    <strong>Описание:</strong>{' '}
                                                    {c.description ?? c.connection?.description}
                                                </span>
                                            ) : null}
                                            {c['conn_type'] && (
                                                <span>
                                                    &nbsp;<strong>Тип:</strong> {String(c['conn_type'])}
                                                </span>
                                            )}
                                            {c['conn_str'] && (
                                                <span>
                                                    &nbsp;<strong>Строка подключения:</strong> {String(c['conn_str'])}
                                                </span>
                                            )}
                                        </span>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* кнопка «добавить коннектор» */}
                        <IconButton
                            size="small"
                            sx={{
                                alignSelf: 'flex-end',
                                mt: -1.5,
                                color: 'var(--icon-primary)',
                                '&:hover': {
                                    backgroundColor: 'var(--theme-hover)',
                                },
                            }}
                            onClick={() => setShowConnForm(true)}
                            title="Добавить подключение"
                        >
                            <AddIcon width={18} height={18} />
                        </IconButton>

                        <TextField
                            label="Группа"
                            name="group"
                            size="small"
                            fullWidth
                            value={form.group}
                            onChange={handle}
                            required
                            sx={textFieldSx}
                        />

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
                            multiline
                            rows={3}
                            value={form.description}
                            onChange={handle}
                            required
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
                        disabled={
                            loading ||
                            !form.name.trim() ||
                            form.connection_id === ''
                        }
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