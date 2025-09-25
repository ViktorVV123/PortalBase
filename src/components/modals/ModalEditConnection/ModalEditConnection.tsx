// components/modals/ModalEditConnection/ModalEditConnection.tsx
import {useCallback, useEffect, useMemo, useState} from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, CircularProgress, Stack, ThemeProvider, Box
} from '@mui/material';
import {dark} from '@/shared/themeUI/themeModal/ThemeModalUI';
import {api} from '@/services/api';

type UrlPart = {
    drivername?: string;
    username?: string;
    password?: string;           // вводит пользователь; по умолчанию — пусто
    host?: string;
    port?: number;
    database?: string;
    query?: Record<string, string>;
};

type Props = {
    open: boolean;
    connectionId: number | string;
    onSuccess: () => void;
    onCancel: () => void;
};

function pruneEmpty<T>(obj: T): Partial<T> {
    if (obj == null || typeof obj !== 'object') return obj as Partial<T>;
    const out: any = Array.isArray(obj) ? [] : {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === '' || v === undefined || v === null) continue;
        if (typeof v === 'object' && !Array.isArray(v)) {
            const child = pruneEmpty(v);
            if (Object.keys(child).length === 0) continue;
            out[k] = child;
        } else {
            out[k] = v;
        }
    }
    return out;
}

export const ModalEditConnection = ({
                                        open,
                                        connectionId,
                                        onSuccess,
                                        onCancel,
                                    }: Props) => {
    // форма
    const [url, setUrl] = useState<UrlPart>({
        drivername: '',
        username: '',
        password: '',   // ← всегда пустим при загрузке
        host: '',
        port: undefined,
        database: '',
        query: {},
    });
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    // служебное
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [queryJson, setQueryJson] = useState(''); // редактирование query как JSON

    const canSubmit = useMemo(() => {
        return Boolean(name && url.drivername && url.username && url.host && url.database);
    }, [name, url.drivername, url.username, url.host, url.database]);

    const loadConnection = useCallback(async () => {
        if (!connectionId) return;
        setLoading(true);
        setErr(null);
        try {
            const { data } = await api.get(`/connections/${connectionId}`);
            // ответ у тебя вида:
            // { id, name, description, conn_type, conn_str, url: { drivername, username, password:"***", host, port, database, query:{} } }

            const u = data?.url ?? {};
            setName(data?.name ?? '');
            setDescription(data?.description ?? '');
            setUrl({
                drivername: u.drivername ?? '',
                username:   u.username   ?? '',
                password:   '',                 // ВАЖНО: не подставляем "***"
                host:       u.host       ?? '',
                port:       u.port,
                database:   u.database   ?? '',
                query:      u.query      ?? {},
            });
            setQueryJson(
                u.query && Object.keys(u.query).length ? JSON.stringify(u.query, null, 2) : ''
            );
        } catch (e: any) {
            setErr(e?.response?.data?.detail ?? 'Не удалось загрузить подключение');
        } finally {
            setLoading(false);
        }
    }, [connectionId]);

    useEffect(() => {
        if (open) loadConnection();
    }, [open, loadConnection]);

    const handleUrl = (field: keyof UrlPart, value: string) => {
        setUrl(prev => ({ ...prev, [field]: field === 'port' ? Number(value) as any : value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true); setErr(null);

        // распарсим query если пользователь редактировал текстом
        let queryObj: Record<string, string> | undefined = undefined;
        if (queryJson.trim()) {
            try {
                const parsed = JSON.parse(queryJson);
                if (parsed && typeof parsed === 'object') queryObj = parsed;
            } catch {
                setErr('Некорректный JSON в поле query');
                setSaving(false);
                return;
            }
        }

        const urlPart: UrlPart = {
            drivername: url.drivername,
            username:   url.username,
            // пароль отправляем ТОЛЬКО если пользователь что-то ввёл
            ...(url.password && url.password.trim() ? { password: url.password } : {}),
            host:       url.host,
            port:       url.port,
            database:   url.database,
            ...(queryObj ? { query: queryObj } : (url.query && Object.keys(url.query!).length ? { query: url.query } : {})),
        };

        const payload = pruneEmpty({
            url: urlPart,
            connection: {
                name,
                description,
            },
        });

        try {
            await api.patch(`/connections/sqlalchemy/${connectionId}`, payload);
            onSuccess();
        } catch (e: any) {
            setErr(e?.response?.data?.detail ?? 'Не удалось сохранить изменения подключения');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ThemeProvider theme={dark}>
            <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
                <DialogTitle>Изменить подключение</DialogTitle>

                <form onSubmit={handleSubmit}>
                    <DialogContent dividers>
                        {loading ? (
                            <div style={{display:'flex', justifyContent:'center', padding:'24px 0'}}>
                                <CircularProgress />
                            </div>
                        ) : (
                            <Stack spacing={2}>
                                <Box component="section">
                                    <b>URL-параметры</b>
                                    <Stack spacing={2} mt={1}>
                                        <TextField
                                            label="drivername" size="small" fullWidth required
                                            value={url.drivername} onChange={e => handleUrl('drivername', e.target.value)}
                                        />
                                        <TextField
                                            label="username"   size="small" fullWidth required
                                            value={url.username} onChange={e => handleUrl('username', e.target.value)}
                                        />
                                        <TextField
                                            label="password"   size="small" fullWidth type="password"
                                            placeholder="Оставьте пустым, чтобы не менять"
                                            value={url.password} onChange={e => handleUrl('password', e.target.value)}
                                        />
                                        <TextField
                                            label="host"       size="small" fullWidth required
                                            value={url.host} onChange={e => handleUrl('host', e.target.value)}
                                        />
                                        <TextField
                                            label="port"       size="small" fullWidth type="number"
                                            value={url.port ?? ''} onChange={e => handleUrl('port', e.target.value)}
                                        />
                                        <TextField
                                            label="database"   size="small" fullWidth required
                                            value={url.database} onChange={e => handleUrl('database', e.target.value)}
                                        />
                                        <TextField
                                            label="query (JSON)" size="small" fullWidth multiline minRows={2}
                                            placeholder='например: {"sslmode":"require"}'
                                            value={queryJson} onChange={e => setQueryJson(e.target.value)}
                                        />
                                    </Stack>
                                </Box>

                                <Box component="section">
                                    <b>Метаданные</b>
                                    <Stack spacing={2} mt={1}>
                                        <TextField
                                            label="name" size="small" fullWidth required
                                            value={name} onChange={e => setName(e.target.value)}
                                        />
                                        <TextField
                                            label="description" size="small" fullWidth
                                            value={description} onChange={e => setDescription(e.target.value)}
                                        />
                                    </Stack>
                                </Box>

                                {err && <div style={{color:'#d33'}}>{err}</div>}
                            </Stack>
                        )}
                    </DialogContent>

                    <DialogActions sx={{pr:3, pb:2}}>
                        <Button onClick={onCancel}>Отмена</Button>
                        <Button
                            variant="contained" type="submit"
                            disabled={saving || loading || !canSubmit}
                            startIcon={(saving) ? <CircularProgress size={16}/> : undefined}
                        >
                            {saving ? 'Сохраняю…' : 'Сохранить'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </ThemeProvider>
    );
};
