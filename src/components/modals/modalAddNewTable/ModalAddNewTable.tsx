/* ModalAddTable.tsx */
import {ChangeEvent, useState} from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Stack, CircularProgress,
    ThemeProvider, CssBaseline, createTheme,
} from '@mui/material';

import {api} from '@/services/api';
import {WorkSpaceTypes} from '@/types/typesWorkSpaces';

/* ——— единый «чёрно-белый» theme как в ModalAddWorkspace ——— */
const dark = createTheme({
    palette: {
        mode: 'dark',
        primary: {main: '#ffffff'},
    },
    components: {
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#ffffff',
                    },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: { '&.Mui-focused': {color: '#ffffff'} },
            },
        },
    },
});

/* ——— типы пропсов ——— */
type Props = {
    open: boolean;
    workspace: WorkSpaceTypes;
    onSuccess: () => void;
    onCancel: () => void;
};

export const ModalAddTable = ({
                                  open, workspace, onSuccess, onCancel,
                              }: Props) => {
    /* ——— локальный стейт формы ——— */
    const [form, setForm] = useState({
        name         : '',
        description  : '',
        select_query : '',
        insert_query : '',
        update_query : '',
        delete_query : '',
    });
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState<string|null>(null);

    const handle = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({...prev, [e.target.name]: e.target.value}));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('Введите название таблицы'); return; }

        setLoading(true); setError(null);
        try {
            await api.post('/tables/', {
                workspace_id : workspace.id,
                ...form,
            });
            onSuccess();                 // сообщаем родителю
        } catch {
            setError('Не удалось создать таблицу');
        } finally {
            setLoading(false);
        }
    };

    /* ——— рендер модалки ——— */
    return (
        <ThemeProvider theme={dark}>
            <CssBaseline/>

            <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
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
                            />

                            <TextField
                                label="Описание"
                                name="description"
                                size="small"
                                fullWidth
                                value={form.description}
                                onChange={handle}
                            />

                            <TextField
                                label="SELECT query"
                                name="select_query"
                                size="small"
                                fullWidth
                                multiline rows={2}
                                value={form.select_query}
                                onChange={handle}
                            />

                            <TextField
                                label="INSERT query"
                                name="insert_query"
                                size="small"
                                fullWidth
                                multiline rows={2}
                                value={form.insert_query}
                                onChange={handle}
                            />

                            <TextField
                                label="UPDATE query"
                                name="update_query"
                                size="small"
                                fullWidth
                                multiline rows={2}
                                value={form.update_query}
                                onChange={handle}
                            />

                            <TextField
                                label="DELETE query"
                                name="delete_query"
                                size="small"
                                fullWidth
                                multiline rows={2}
                                value={form.delete_query}
                                onChange={handle}
                            />

                            {error && <span style={{color: '#d33'}}>{error}</span>}
                        </Stack>
                    </DialogContent>

                    <DialogActions sx={{pr: 3, pb: 2}}>
                        <Button onClick={onCancel}>Отмена</Button>
                        <Button
                            variant="contained"
                            type="submit"
                            disabled={loading || !form.name.trim()}
                            startIcon={loading && <CircularProgress size={16}/>}
                        >
                            {loading ? 'Создаю…' : 'Создать'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </ThemeProvider>
    );
};
