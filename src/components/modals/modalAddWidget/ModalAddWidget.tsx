/* ModalAddWidget.tsx */
import {useState, ChangeEvent} from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Stack, CircularProgress,
    ThemeProvider, CssBaseline, createTheme,
} from '@mui/material';

import {api} from '@/services/api';
import {DTable} from '@/shared/hooks/useWorkSpaces';

const dark = createTheme({
    palette: {mode: 'dark', primary: {main: '#ffffff'}},
    components: {
        MuiOutlinedInput: {styleOverrides: {root: {
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {borderColor: '#fff'},
                }}},
        MuiInputLabel:    {styleOverrides: {root: {'&.Mui-focused': {color: '#fff'}}}},
    },
});

type Props = {
    open: boolean;
    table: DTable;                 // ← сюда передаём выбранную таблицу
    onSuccess: () => void;
    onCancel : () => void;
};

export const ModalAddWidget = ({open, table, onSuccess, onCancel}: Props) => {
    const [form, setForm] = useState({name: '', description: ''});
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState<string|null>(null);

    const handle = (e: ChangeEvent<HTMLInputElement>) =>
        setForm(prev => ({...prev, [e.target.name]: e.target.value}));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('Введите имя виджета'); return; }

        setLoading(true); setError(null);
        try {
            await api.post('/widgets/', {
                table_id   : table.id,
                name       : form.name,
                description: form.description,
            });
            onSuccess();                       // сообщаем родителю
        } catch {
            setError('Не удалось создать widget');
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <ThemeProvider theme={dark}>
            <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
                <DialogTitle>Новый widget в «{table.name}»</DialogTitle>

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
