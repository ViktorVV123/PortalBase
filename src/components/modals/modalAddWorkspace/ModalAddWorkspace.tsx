/* ModalAddWorkspace.tsx */
import {ChangeEvent, useState} from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, IconButton,
    FormControl, InputLabel, Select, MenuItem, Stack,
    CircularProgress, ThemeProvider, CssBaseline, createTheme, SelectChangeEvent,
} from '@mui/material';

import AddIcon from '@/assets/image/AddIcon.svg';   // ← ваш SVG-компонент
import {api} from '@/services/api';
import {Connection} from '@/types/typesConnection';

const dark = createTheme({
    palette: {
        mode: 'dark',
        primary: {main: '#ffffff'},  // ← чтобы все focus-ring были белые
    },
    components: {
        /* белый бордер при фокусе */
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#ffffff',
                    },
                },
            },
        },
        /* белая подпись (label) в фокусе */
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    '&.Mui-focused': {color: '#ffffff'},
                },
            },
        },
        /* белая стрелочка у Select */
        MuiSelect: {
            styleOverrides: {icon: {color: '#ffffff'}},
        },
    },
});
type Props = {
    connections: Connection[];
    onSuccess: () => void;
    onCancel: () => void;
    setShowConnForm: (v: boolean) => void;
    open: boolean;             // ✔ лучше управлять диалогом снаружи
};

export const ModalAddWorkspace = ({
                                      connections, onSuccess, onCancel, setShowConnForm, open,
                                  }: Props) => {

    /* ----- local state ----- */
    const [form, setForm] = useState({
        connection_id: connections[0]?.id ?? '',
        group: '',
        name: '',
        description: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handle =
        (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setForm(prev => ({...prev, [e.target.name]: e.target.value}));

    const handleSelect = (e: SelectChangeEvent) => {
        setForm(prev => ({
            ...prev,
            connection_id: Number(e.target.value),   // строку → число
        }));
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            await api.post('/workspaces/', form);
            onSuccess();
        } catch {
            setError('Не удалось создать Workspace');
        } finally {
            setLoading(false);
        }
    };

    /* ----- render ----- */
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
                                    required
                                >
                                    {connections.map(c => (
                                        <MenuItem key={c.id} value={c.id}>
                                            {c.name} (id:{c.id})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {/* кнопка «добавить коннектор» справа от селекта */}
                            <IconButton
                                size="small"
                                sx={{alignSelf: 'flex-end', mt: -1.5}}   /* прижимаем к селекту */
                                onClick={() => setShowConnForm(true)}
                            >
                                <AddIcon width={18} height={18}/>
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
                                multiline rows={3}
                                value={form.description}
                                onChange={handle}
                                required
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
    )
        ;
};
