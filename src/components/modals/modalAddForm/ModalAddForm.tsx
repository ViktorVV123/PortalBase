import {ChangeEvent, useState} from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Stack, CircularProgress, ThemeProvider,
    FormControlLabel, Checkbox, IconButton, Divider
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

import {api} from '@/services/api';
import {Widget, WidgetForm} from '@/shared/hooks/useWorkSpaces';
import {dark} from '@/shared/themeUI/themeModal/ThemeModalUI';

type Props = {
    open: boolean;
    widget: Widget;
    onSuccess: (form: WidgetForm) => void;
    onCancel: () => void;
};

type SubRow = { widget_order: number; where_conditional: string; sub_widget_id: number | '' };
type TreeRow = { column_order: number; table_column_id: number | '' };

export const ModalAddForm = ({open, widget, onSuccess, onCancel}: Props) => {
    const [form, setForm] = useState({ name: '', description: '', path: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // чекбоксы
    const [useSub, setUseSub]   = useState(false);
    const [useTree, setUseTree] = useState(false);

    // динамические списки
    const [subRows, setSubRows] = useState<SubRow[]>([
        { widget_order: 1, where_conditional: '', sub_widget_id: '' }
    ]);
    const [treeRows, setTreeRows] = useState<TreeRow[]>([
        { column_order: 1, table_column_id: '' }
    ]);

    const handle = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({...prev, [e.target.name]: e.target.value}));

    // helpers для списков
    const addSubRow = () => setSubRows(prev => [...prev, { widget_order: (prev[prev.length-1]?.widget_order ?? 0) + 1, where_conditional: '', sub_widget_id: '' }]);
    const delSubRow = (idx: number) => setSubRows(prev => prev.filter((_,i)=>i!==idx));
    const updSubRow = (idx: number, patch: Partial<SubRow>) =>
        setSubRows(prev => prev.map((r,i)=> i===idx ? {...r, ...patch} : r));

    const addTreeRow = () => setTreeRows(prev => [...prev, { column_order: (prev[prev.length-1]?.column_order ?? 0) + 1, table_column_id: '' }]);
    const delTreeRow = (idx: number) => setTreeRows(prev => prev.filter((_,i)=>i!==idx));
    const updTreeRow = (idx: number, patch: Partial<TreeRow>) =>
        setTreeRows(prev => prev.map((r,i)=> i===idx ? {...r, ...patch} : r));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) {
            setError('Введите название формы');
            return;
        }

        // валидация минимальная для включённых секций
        if (useSub) {
            for (const r of subRows) {
                if (r.sub_widget_id === '' || isNaN(Number(r.sub_widget_id))) {
                    setError('В разделе Sub-widgets заполните "sub_widget_id" (число).');
                    return;
                }
            }
        }
        if (useTree) {
            for (const r of treeRows) {
                if (r.table_column_id === '' || isNaN(Number(r.table_column_id))) {
                    setError('В разделе Tree-fields заполните "table_column_id" (число).');
                    return;
                }
            }
        }

        setLoading(true);
        setError(null);
        try {
            const body: any = {
                form: {
                    main_widget_id: widget.id,
                    name: form.name,
                    description: form.description || null,
                    path: form.path || null,
                },
            };

            if (useSub) {
                body.sub_widgets_lst = subRows.map(r => ({
                    widget_order: Number(r.widget_order) || 0,
                    where_conditional: r.where_conditional || null,
                    sub_widget_id: Number(r.sub_widget_id),
                }));
            }

            if (useTree) {
                body.tree_fields_lst = treeRows.map(r => ({
                    column_order: Number(r.column_order) || 0,
                    table_column_id: Number(r.table_column_id),
                }));
            }

            const {data} = await api.post<WidgetForm>('/forms/', body);
            onSuccess(data);
        } catch (e: any) {
            setError('Не удалось создать форму');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemeProvider theme={dark}>
            <Dialog open={open} onClose={onCancel} fullWidth maxWidth="md">
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

                            <TextField
                                label="Path (опционально)"
                                name="path"
                                size="small"
                                fullWidth
                                value={form.path}
                                onChange={handle}
                            />

                            <Divider flexItem />

                            {/* SUB-WIDGETS */}
                            <FormControlLabel
                                control={<Checkbox checked={useSub} onChange={(_,v)=>setUseSub(v)} />}
                                label="Добавить sub-виджеты"
                            />

                            {useSub && (
                                <Stack spacing={1}>
                                    {subRows.map((row, idx) => (
                                        <Stack key={idx} direction="row" spacing={1} alignItems="center">
                                            <TextField
                                                label="Порядок (widget_order)"
                                                type="number"
                                                size="small"
                                                value={row.widget_order}
                                                onChange={e => updSubRow(idx, { widget_order: Number(e.target.value) })}
                                                sx={{ width: 210 }}
                                            />
                                            <TextField
                                                label="sub_widget_id"
                                                type="number"
                                                size="small"
                                                value={row.sub_widget_id}
                                                onChange={e => updSubRow(idx, { sub_widget_id: (e.target.value === '' ? '' : Number(e.target.value)) })}
                                                sx={{ width: 210 }}
                                            />
                                            <TextField
                                                label="where_conditional (SQL)"
                                                size="small"
                                                value={row.where_conditional}
                                                onChange={e => updSubRow(idx, { where_conditional: e.target.value })}
                                                sx={{ flex: 1 }}
                                            />
                                            <IconButton onClick={() => delSubRow(idx)} size="small">
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    ))}
                                    <Button startIcon={<AddIcon/>} onClick={addSubRow} sx={{ alignSelf: 'flex-start' }}>
                                        Добавить sub-widget
                                    </Button>
                                </Stack>
                            )}

                            <Divider flexItem />

                            {/* TREE-FIELDS */}
                            <FormControlLabel
                                control={<Checkbox checked={useTree} onChange={(_,v)=>setUseTree(v)} />}
                                label="Добавить поля дерева (tree)"
                            />

                            {useTree && (
                                <Stack spacing={1}>
                                    {treeRows.map((row, idx) => (
                                        <Stack key={idx} direction="row" spacing={1} alignItems="center">
                                            <TextField
                                                label="Порядок (column_order)"
                                                type="number"
                                                size="small"
                                                value={row.column_order}
                                                onChange={e => updTreeRow(idx, { column_order: Number(e.target.value) })}
                                                sx={{ width: 260 }}
                                            />
                                            <TextField
                                                label="table_column_id"
                                                type="number"
                                                size="small"
                                                value={row.table_column_id}
                                                onChange={e => updTreeRow(idx, { table_column_id: (e.target.value === '' ? '' : Number(e.target.value)) })}
                                                sx={{ width: 260 }}
                                            />
                                            <IconButton onClick={() => delTreeRow(idx)} size="small">
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    ))}
                                    <Button startIcon={<AddIcon/>} onClick={addTreeRow} sx={{ alignSelf: 'flex-start' }}>
                                        Добавить поле дерева
                                    </Button>
                                </Stack>
                            )}

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
