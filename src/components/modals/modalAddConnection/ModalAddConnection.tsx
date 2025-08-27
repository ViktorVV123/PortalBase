/* ModalAddConnection.tsx */
import { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, CircularProgress, CssBaseline,
    ThemeProvider, Box, Stack,
} from '@mui/material';

import { api } from '@/services/api';
import { CreateConnectionDto } from '@/types/typesCreateConnections';
import {dark} from "@/shared/themeUI/themeModal/ThemeModalUI";

type Props = {
open: boolean;
    onSuccess: () => void;
    onCancel : () => void;
};


export const ModalAddConnection = ({  open,onSuccess, onCancel }: Props) => {
    const [form, setForm] = useState<CreateConnectionDto>({
        url: { drivername:'', username:'', password:'', host:'', port:5432, database:'', query:{} },
        connection:{ name:'', description:'' },
    });
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState<string|null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;          // "url.host"
        const [section, field] = name.split('.');
        setForm(p => ({ ...p, [section]: { ...p[section as keyof typeof p], [field]: value }}));
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError(null);
        try {
            await api.post('/connections/sqlalchemy', form);
            onSuccess();
        } catch { setError('Не удалось создать подключение'); }
        finally { setLoading(false); }
    };

    return (
        <ThemeProvider theme={dark}>

            <Dialog
                open={open}
                onClose={onCancel}
                fullWidth
                maxWidth="sm"
                /* ───── ключевые для вложенного диалога ───── */
                disableEnforceFocus      /* внешняя ловушка не блокирует фокус */
                disableRestoreFocus      /* при закрытии не вернёт фокус во внешний */
                hideBackdrop             /* не рисуем второй тёмный слой */
                PaperProps={{
                    sx: {
                        zIndex: theme => theme.zIndex.modal + 1,  // всегда поверх первого
                    },
                }}
            >
                <DialogTitle>Создать connection (SQLAlchemy)</DialogTitle>

                <form onSubmit={submit}>
                    <DialogContent dividers sx={{ pt:2 }}>
                        {/* URL-block */}
                        <Box component="section" sx={{ mb:3 }}>
                            <b>URL-параметры</b>
                            <Stack spacing={2} mt={1}>
                                <TextField label="drivername" name="url.drivername" value={form.url.drivername}
                                           onChange={handleChange} size="small" fullWidth required/>
                                <TextField label="username"   name="url.username"   value={form.url.username}
                                           onChange={handleChange} size="small" fullWidth required/>
                                <TextField label="password"   name="url.password"   type="password"
                                           value={form.url.password} onChange={handleChange}
                                           size="small" fullWidth required/>
                                <TextField label="host"       name="url.host"       value={form.url.host}
                                           onChange={handleChange} size="small" fullWidth required/>
                                <TextField label="port"       name="url.port"       type="number"
                                           value={form.url.port}  onChange={handleChange}
                                           size="small" fullWidth required/>
                                <TextField label="database"   name="url.database"   value={form.url.database}
                                           onChange={handleChange} size="small" fullWidth required/>
                            </Stack>
                        </Box>

                        {/* metadata */}
                        <Box component="section">
                            <b>Метаданные</b>
                            <Stack spacing={2} mt={1}>
                                <TextField label="name"        name="connection.name"
                                           value={form.connection.name} onChange={handleChange}
                                           size="small" fullWidth required/>
                                <TextField label="description" name="connection.description"
                                           value={form.connection.description} onChange={handleChange}
                                           size="small" fullWidth required/>
                            </Stack>
                        </Box>

                        {error && <p style={{ color:'#d33', marginTop:16 }}>{error}</p>}
                    </DialogContent>

                    <DialogActions sx={{ pr:3, pb:2 }}>
                        <Button onClick={onCancel}>Отмена</Button>
                        <Button variant="contained" type="submit"
                                disabled={loading}
                                startIcon={loading && <CircularProgress size={16}/>}>
                            {loading ? 'Создаю…' : 'Создать'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </ThemeProvider>
    );
};
