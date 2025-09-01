import {ChangeEvent, useState} from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Stack, CircularProgress, ThemeProvider
} from '@mui/material';

import {api} from '@/services/api';
import {Widget, WidgetForm} from '@/shared/hooks/useWorkSpaces';
import {dark} from '@/shared/themeUI/themeModal/ThemeModalUI';

type Props = {
    open: boolean;
    widget: Widget;
    onSuccess: (form: WidgetForm) => void;
    onCancel: () => void;
};

export const ModalAddForm = ({open, widget, onSuccess, onCancel}: Props) => {
    const [form, setForm] = useState({
        name: '',
        description: '',
        path: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handle = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({...prev, [e.target.name]: e.target.value}));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) {
            setError('Введите название формы');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const body = {
                form: {
                    main_widget_id: widget.id,
                    name: form.name,
                    description: form.description || null,
                    path: form.path || null,
                },
            };
            const {data} = await api.post<WidgetForm>('/forms/', body);
            onSuccess(data);
        } catch {
            setError('Не удалось создать форму');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemeProvider theme={dark}>
            <Dialog open={open} onClose={onCancel} fullWidth maxWidth="sm">
                <DialogTitle>Новая форма для «{widget.name}»</DialogTitle>

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

                          {/*  <TextField
                                label="Path (опционально)"
                                name="path"
                                size="small"
                                fullWidth
                                value={form.path}
                                onChange={handle}
                            />*/}

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
