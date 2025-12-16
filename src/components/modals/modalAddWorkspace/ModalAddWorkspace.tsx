/* ModalAddWorkspace.tsx */
import {ChangeEvent, useEffect, useState} from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, IconButton,
    FormControl, InputLabel, Select, MenuItem, Stack,
    CircularProgress, ThemeProvider, SelectChangeEvent,
} from '@mui/material';

import AddIcon from '@/assets/image/AddIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import EditIcon from '@/assets/image/EditIcon.svg';

import {api} from '@/services/api';

import * as styles from './ModalAddWorkspace.module.scss';
import {dark} from '@/shared/themeUI/themeModal/ThemeModalUI';
import {Connection} from "@/shared/hooks/stores";

/** Если у твоего Connection уже есть эти поля — отдельный тип не нужен */
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

export const ModalAddWorkspace = ({
                                      deleteConnection,
                                      connections,
                                      onSuccess,
                                      onCancel,
                                      setShowConnForm,
                                      open,
                                      onEditConnection,
                                  }: Props) => {
    // Изначально выбираем ПОСЛЕДНЕЕ подключение
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

    // 👉 Ключевой эффект: при изменении списка connections
    // автоматически выбираем последнее подключение
    useEffect(() => {
        if (!connections.length) {
            setForm(prev => ({ ...prev, connection_id: '' }));
            return;
        }

        const lastId = connections[connections.length - 1]?.id;
        if (lastId == null) return;

        setForm(prev => {
            // если уже выбран lastId — ничего не меняем, чтобы не дергать лишние рендеры
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
        <ThemeProvider theme={dark}>
            <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
                <DialogTitle>Создать workspace</DialogTitle>

                <form onSubmit={submit}>
                    <DialogContent dividers>
                        <Stack spacing={2}>
                            {/* SELECT подключения */}
                            <FormControl fullWidth size="small">
                                <InputLabel id="conn-label">Подключение</InputLabel>
                                <Select
                                    labelId="conn-label"
                                    name="connection_id"
                                    label="Подключение"
                                    value={form.connection_id}
                                    onChange={handleSelect}
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
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    display: 'flex',
                                                    gap: 10,
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
                                                    onClick={(e) =>
                                                        handleEditConn(e, c)
                                                    }
                                                    title="Редактировать"
                                                >
                                                    <EditIcon />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) =>
                                                        handleDeleteConn(
                                                            e,
                                                            c.id,
                                                        )
                                                    }
                                                    title="Удалить"
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </span>

                                            <span
                                                className={
                                                    styles.descriptionModal
                                                }
                                            >
                                                {c.description ||
                                                c.connection?.description ? (
                                                    <span>
                                                        <strong>
                                                            Описание:
                                                        </strong>{' '}
                                                        {c.description ??
                                                            c.connection
                                                                ?.description}
                                                    </span>
                                                ) : null}
                                                {c['conn_type'] && (
                                                    <span>
                                                        &nbsp;
                                                        <strong>Тип:</strong>{' '}
                                                        {String(c['conn_type'])}
                                                    </span>
                                                )}
                                                {c['conn_str'] && (
                                                    <span>
                                                        &nbsp;
                                                        <strong>
                                                            Строка
                                                            подключения:
                                                        </strong>{' '}
                                                        {String(c['conn_str'])}
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
                                sx={{ alignSelf: 'flex-end', mt: -1.5 }}
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
                            />

                            <TextField
                                label="Название"
                                name="name"
                                size="small"
                                fullWidth
                                value={form.name}
                                onChange={handle}
                                required
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
                            />

                            {error && (
                                <span style={{ color: '#d33' }}>{error}</span>
                            )}
                        </Stack>
                    </DialogContent>

                    <DialogActions sx={{ pr: 3, pb: 2 }}>
                        <Button onClick={onCancel}>Отмена</Button>
                        <Button
                            variant="contained"
                            type="submit"
                            disabled={
                                loading ||
                                !form.name.trim() ||
                                form.connection_id === ''
                            }
                            startIcon={
                                loading && <CircularProgress size={16} />
                            }
                        >
                            {loading ? 'Создаю…' : 'Создать'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </ThemeProvider>
    );
};
