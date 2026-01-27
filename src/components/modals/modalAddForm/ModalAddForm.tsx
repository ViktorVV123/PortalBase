import React, { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Stack, CircularProgress,
    FormControlLabel, Checkbox, IconButton, Divider, Autocomplete, Switch, Box
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

import { api } from '@/services/api';
import { Widget, WidgetForm, Column } from '@/shared/hooks/useWorkSpaces';

type Props = {
    open: boolean;
    widget: Widget;
    onSuccess: (form: WidgetForm) => void;
    onCancel: () => void;
};

type SubRow = { widget_order: number; where_conditional: string; sub_widget_id: number | '' };
type TreeRow = { column_order: number; table_column_id: number | '' };

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

const checkboxSx = {
    color: 'var(--checkbox-unchecked)',
    '&.Mui-checked': {
        color: 'var(--checkbox-checked)',
    },
};

const switchSx = {
    '& .MuiSwitch-switchBase': {
        color: 'var(--theme-surface-elevated)',
        '&.Mui-checked': {
            color: 'var(--checkbox-checked)',
            '& + .MuiSwitch-track': {
                backgroundColor: 'var(--checkbox-checked)',
            },
        },
    },
    '& .MuiSwitch-track': {
        backgroundColor: 'var(--checkbox-unchecked)',
    },
};

export const ModalAddForm = ({ open, widget, onSuccess, onCancel }: Props) => {
    const [form, setForm] = useState({ name: '', description: '', path: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchBar, setSearchBar] = useState<boolean>(true);
    const [useSub, setUseSub] = useState(false);
    const [useTree, setUseTree] = useState(false);

    const [subRows, setSubRows] = useState<SubRow[]>([
        { widget_order: 1, where_conditional: '', sub_widget_id: '' }
    ]);
    const [treeRows, setTreeRows] = useState<TreeRow[]>([
        { column_order: 1, table_column_id: '' }
    ]);

    const [availableWidgets, setAvailableWidgets] = useState<Widget[]>([]);
    const [availableColumns, setAvailableColumns] = useState<Column[]>([]);
    const [listsLoading, setListsLoading] = useState(false);

    const handle = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const addSubRow = () => setSubRows(prev => [
        ...prev,
        { widget_order: (prev[prev.length - 1]?.widget_order ?? 0) + 1, where_conditional: '', sub_widget_id: '' }
    ]);
    const delSubRow = (idx: number) => setSubRows(prev => prev.filter((_, i) => i !== idx));
    const updSubRow = (idx: number, patch: Partial<SubRow>) =>
        setSubRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

    const addTreeRow = () => setTreeRows(prev => [
        ...prev,
        { column_order: (prev[prev.length - 1]?.column_order ?? 0) + 1, table_column_id: '' }
    ]);
    const delTreeRow = (idx: number) => setTreeRows(prev => prev.filter((_, i) => i !== idx));
    const updTreeRow = (idx: number, patch: Partial<TreeRow>) =>
        setTreeRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));

    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        (async () => {
            setListsLoading(true);
            try {
                const widgetsRes = await api.get<Widget[]>('/widgets');
                const widgets = widgetsRes.data.sort((a, b) => a.id - b.id);
                const colsRes = await api.get<Column[]>(`/tables/${widget.table_id}/columns`);
                const cols = colsRes.data.sort((a, b) => a.id - b.id);
                if (!cancelled) {
                    setAvailableWidgets(widgets);
                    setAvailableColumns(cols);
                }
            } finally {
                if (!cancelled) setListsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [open, widget.table_id]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) {
            setError('Введите название формы');
            return;
        }

        if (useSub) {
            for (const r of subRows) {
                if (r.sub_widget_id === '' || isNaN(Number(r.sub_widget_id))) {
                    setError('В разделе Sub-widgets выберите под-виджет по имени.');
                    return;
                }
            }
        }
        if (useTree) {
            for (const r of treeRows) {
                if (r.table_column_id === '' || isNaN(Number(r.table_column_id))) {
                    setError('В разделе Tree-fields выберите колонку по имени.');
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
                    search_bar: searchBar,
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

            const { data } = await api.post<WidgetForm>('/forms/', body);
            onSuccess(data);
        } catch {
            setError('Не удалось создать форму');
        } finally {
            setLoading(false);
        }
    };

    const widgetById = useMemo(() => {
        const m = new Map<number, Widget>();
        availableWidgets.forEach(w => m.set(w.id, w));
        return m;
    }, [availableWidgets]);

    const columnById = useMemo(() => {
        const m = new Map<number, Column>();
        availableColumns.forEach(c => m.set(c.id, c));
        return m;
    }, [availableColumns]);

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            fullWidth
            maxWidth="md"
            PaperProps={{ sx: dialogPaperSx }}
        >
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
                            sx={textFieldSx}
                        />

                        <TextField
                            label="Описание"
                            name="description"
                            size="small"
                            fullWidth
                            value={form.description}
                            onChange={handle}
                            sx={textFieldSx}
                        />

                        <TextField
                            label="Path (опционально)"
                            name="path"
                            size="small"
                            fullWidth
                            value={form.path}
                            onChange={handle}
                            sx={textFieldSx}
                        />

                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Box>
                                <Box sx={{ fontWeight: 600, color: 'var(--theme-text-primary)' }}>
                                    Строка поиска
                                </Box>
                            </Box>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={searchBar}
                                        onChange={(_, v) => setSearchBar(v)}
                                        sx={switchSx}
                                    />
                                }
                                label={
                                    <Box sx={{ color: 'var(--theme-text-secondary)' }}>
                                        {searchBar ? 'Включена' : 'Выключена'}
                                    </Box>
                                }
                            />
                        </Stack>

                        <Divider sx={{ borderColor: 'var(--theme-border)' }} />

                        {/* SUB-WIDGETS */}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={useSub}
                                    onChange={(_, v) => setUseSub(v)}
                                    sx={checkboxSx}
                                />
                            }
                            label={
                                <Box sx={{ color: 'var(--theme-text-primary)' }}>
                                    Добавить sub-виджеты
                                </Box>
                            }
                        />

                        {useSub && (
                            <Stack spacing={1}>
                                {subRows.map((row, idx) => {
                                    const selectedWidget = typeof row.sub_widget_id === 'number'
                                        ? widgetById.get(row.sub_widget_id) ?? null
                                        : null;

                                    return (
                                        <Stack key={idx} direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                                            <TextField
                                                label="Порядок (widget_order)"
                                                type="number"
                                                size="small"
                                                value={row.widget_order}
                                                onChange={e => updSubRow(idx, { widget_order: Number(e.target.value) })}
                                                sx={{ ...textFieldSx, width: 210 }}
                                            />

                                            <Autocomplete
                                                sx={{ minWidth: 280, flex: '0 0 auto' }}
                                                options={availableWidgets.filter(w => w.id !== widget.id)}
                                                loading={listsLoading}
                                                value={selectedWidget}
                                                onChange={(_, val) => updSubRow(idx, { sub_widget_id: (val?.id ?? '') as any })}
                                                getOptionLabel={(w) => w ? `${w.name}  (#${w.id}) · tbl:${w.table_id}` : ''}
                                                isOptionEqualToValue={(a, b) => a.id === b.id}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label="Sub-widget (по имени)"
                                                        size="small"
                                                        sx={textFieldSx}
                                                        InputProps={{
                                                            ...params.InputProps,
                                                            endAdornment: (
                                                                <>
                                                                    {listsLoading ? <CircularProgress size={16} /> : null}
                                                                    {params.InputProps.endAdornment}
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                )}
                                            />

                                            <TextField
                                                label="where_conditional (SQL)"
                                                size="small"
                                                value={row.where_conditional}
                                                onChange={e => updSubRow(idx, { where_conditional: e.target.value })}
                                                sx={{ ...textFieldSx, flex: 1, minWidth: 240 }}
                                            />

                                            <IconButton
                                                onClick={() => delSubRow(idx)}
                                                size="small"
                                                sx={{ color: 'var(--icon-primary)' }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    );
                                })}
                                <Button
                                    startIcon={<AddIcon />}
                                    onClick={addSubRow}
                                    sx={{
                                        alignSelf: 'flex-start',
                                        color: 'var(--theme-primary)',
                                    }}
                                >
                                    Добавить sub-widget
                                </Button>
                            </Stack>
                        )}

                        <Divider sx={{ borderColor: 'var(--theme-border)' }} />

                        {/* TREE-FIELDS */}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={useTree}
                                    onChange={(_, v) => setUseTree(v)}
                                    sx={checkboxSx}
                                />
                            }
                            label={
                                <Box sx={{ color: 'var(--theme-text-primary)' }}>
                                    Добавить поля дерева (tree)
                                </Box>
                            }
                        />

                        {useTree && (
                            <Stack spacing={1}>
                                {treeRows.map((row, idx) => {
                                    const selectedColumn = typeof row.table_column_id === 'number'
                                        ? columnById.get(row.table_column_id) ?? null
                                        : null;

                                    return (
                                        <Stack key={idx} direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                                            <TextField
                                                label="Порядок (column_order)"
                                                type="number"
                                                size="small"
                                                value={row.column_order}
                                                onChange={e => updTreeRow(idx, { column_order: Number(e.target.value) })}
                                                sx={{ ...textFieldSx, width: 260 }}
                                            />

                                            <Autocomplete
                                                sx={{ minWidth: 300, flex: '0 0 auto' }}
                                                options={availableColumns}
                                                loading={listsLoading}
                                                value={selectedColumn}
                                                onChange={(_, val) => updTreeRow(idx, { table_column_id: (val?.id ?? '') as any })}
                                                getOptionLabel={(c) => c ? `${c.name}  (#${c.id})` : ''}
                                                isOptionEqualToValue={(a, b) => a.id === b.id}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label="Колонка (по имени)"
                                                        size="small"
                                                        sx={textFieldSx}
                                                        InputProps={{
                                                            ...params.InputProps,
                                                            endAdornment: (
                                                                <>
                                                                    {listsLoading ? <CircularProgress size={16} /> : null}
                                                                    {params.InputProps.endAdornment}
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                )}
                                            />

                                            <IconButton
                                                onClick={() => delTreeRow(idx)}
                                                size="small"
                                                sx={{ color: 'var(--icon-primary)' }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    );
                                })}
                                <Button
                                    startIcon={<AddIcon />}
                                    onClick={addTreeRow}
                                    sx={{
                                        alignSelf: 'flex-start',
                                        color: 'var(--theme-primary)',
                                    }}
                                >
                                    Добавить поле дерева
                                </Button>
                            </Stack>
                        )}

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
                        disabled={loading || !form.name.trim()}
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