// src/components/modals/ModalEditForm.tsx

import React, {useMemo, useState, useEffect} from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Tabs, Tab, Box, Stack, TextField, Button, MenuItem,
    FormControl, InputLabel, Select, createTheme, ThemeProvider,
    IconButton, Tooltip, Autocomplete, CircularProgress, Divider,
    Alert, FormControlLabel, Switch, Typography, Paper
} from '@mui/material';
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import SaveIcon from "@mui/icons-material/Save";
import {WidgetForm, Widget, Column} from '@/shared/hooks/useWorkSpaces';
import {api} from '@/services/api';

const dark = createTheme({palette: {mode: 'dark', primary: {main: '#ffffff'}}});

type Props = {
    open: boolean;
    onClose: () => void;
    form: WidgetForm;
    reloadWidgetForms: () => Promise<void>;
    deleteSubWidgetFromForm: (formId: number, subWidgetId: number) => Promise<void>;
    deleteTreeFieldFromForm: (formId: number, tableColumnId: number) => Promise<void>;
};

export const ModalEditForm: React.FC<Props> = ({
                                                   open, onClose, form, reloadWidgetForms,
                                                   deleteSubWidgetFromForm, deleteTreeFieldFromForm
                                               }) => {
    const [tab, setTab] = useState<'main' | 'sub' | 'tree'>('main');

    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════

    const [err, setErr] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    const showError = (msg: string) => {
        setErr(msg);
        setTimeout(() => setErr(null), 5000);
    };

    const showSuccess = (msg: string = 'Сохранено') => {
        setInfo(msg);
        setTimeout(() => setInfo(null), 1500);
    };

    const emitFormMutated = (formId: number) => {
        window.dispatchEvent(
            new CustomEvent<{ formId: number }>('portal:form-mutated', {
                detail: { formId }
            })
        );
    };

    // ═══════════════════════════════════════════════════════════
    // MAIN STATE
    // ═══════════════════════════════════════════════════════════

    const [mainName, setMainName] = useState(form.name);
    const [mainDesc, setMainDesc] = useState(form.description ?? '');
    const [mainPath, setMainPath] = useState<string>(form.path ?? '');
    const [mainGroup, setMainGroup] = useState<string>(form.group ?? '');
    const [mainWidgetId, setMainWidgetId] = useState<number>(form.main_widget_id);
    const [mainSearchBar, setMainSearchBar] = useState<boolean>(!!form.search_bar);
    const [savingMain, setSavingMain] = useState(false);

    // ═══════════════════════════════════════════════════════════
    // LISTS STATE
    // ═══════════════════════════════════════════════════════════

    const [availableWidgets, setAvailableWidgets] = useState<Widget[]>([]);
    const [availableColumns, setAvailableColumns] = useState<Column[]>([]);
    const [listsLoading, setListsLoading] = useState(false);

    const [subList, setSubList] = useState(form.sub_widgets ?? []);
    const [treeList, setTreeList] = useState(form.tree_fields ?? []);

    // ═══════════════════════════════════════════════════════════
    // SUB STATE
    // ═══════════════════════════════════════════════════════════

    const [subId, setSubId] = useState<number>(0);
    const [subOrder, setSubOrder] = useState<number>(0);
    const [subWhere, setSubWhere] = useState<string>('');
    const [savingSub, setSavingSub] = useState(false);
    const [deletingSub, setDeletingSub] = useState(false);
    const [subQueryDelete, setSubQueryDelete] = useState('');

    // New sub
    const [newSubOrder, setNewSubOrder] = useState<number>(1);
    const [newSubWhere, setNewSubWhere] = useState<string>('');
    const [newSubWidget, setNewSubWidget] = useState<Widget | null>(null);
    const [addingSub, setAddingSub] = useState(false);
    const [newSubDeleteQuery, setNewSubDeleteQuery] = useState('');

    // ═══════════════════════════════════════════════════════════
    // TREE STATE
    // ═══════════════════════════════════════════════════════════

    const [treeColId, setTreeColId] = useState<number>(0);
    const [treeOrder, setTreeOrder] = useState<number>(0);
    const [savingTree, setSavingTree] = useState(false);
    const [deletingTree, setDeletingTree] = useState(false);

    // New tree
    const [newTreeOrder, setNewTreeOrder] = useState<number>(1);
    const [newTreeColumn, setNewTreeColumn] = useState<Column | null>(null);
    const [addingTree, setAddingTree] = useState(false);

    // ═══════════════════════════════════════════════════════════
    // COMPUTED
    // ═══════════════════════════════════════════════════════════

    const currentSub = useMemo(
        () => subList.find(s => s.sub_widget_id === subId),
        [subId, subList]
    );

    const currentTree = useMemo(
        () => treeList.find(t => t.table_column_id === treeColId),
        [treeColId, treeList]
    );

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

    const getNextSubOrder = () =>
        subList.length ? Math.max(...subList.map(it => it.widget_order ?? 0)) + 1 : 1;

    const getNextTreeOrder = () =>
        treeList.length ? Math.max(...treeList.map(it => it.column_order ?? 0)) + 1 : 1;

    // Проверка изменений для Sub
    const subHasChanges =
        !!currentSub &&
        (
            subOrder !== (currentSub.widget_order ?? 0) ||
            subWhere !== (currentSub.where_conditional ?? '') ||
            subQueryDelete !== (currentSub.delete_sub_query ?? '')
        );

    // Проверка изменений для Tree
    const treeHasChanges = currentTree && (
        treeOrder !== (currentTree.column_order ?? 0)
    );

    // ═══════════════════════════════════════════════════════════
    // EFFECTS
    // ═══════════════════════════════════════════════════════════

    // Синхронизация при открытии
    useEffect(() => {
        if (!open) return;

        setErr(null);
        setInfo(null);

        const freshSubList = form.sub_widgets ?? [];
        const freshTreeList = form.tree_fields ?? [];

        setSubList(freshSubList);
        setTreeList(freshTreeList);

        setMainName(form.name);
        setMainDesc(form.description ?? '');
        setMainPath(form.path ?? '');
        setMainGroup(form.group ?? '');
        setMainWidgetId(form.main_widget_id);
        setMainSearchBar(!!form.search_bar);

        // Reset selections
        setSubId(freshSubList[0]?.sub_widget_id ?? 0);
        setTreeColId(freshTreeList[0]?.table_column_id ?? 0);

        setNewSubOrder(freshSubList.length ? Math.max(...freshSubList.map(it => it.widget_order ?? 0)) + 1 : 1);
        setNewTreeOrder(freshTreeList.length ? Math.max(...freshTreeList.map(it => it.column_order ?? 0)) + 1 : 1);

        setNewSubWidget(null);
        setNewSubWhere('');
        setSubQueryDelete('');
        setNewTreeColumn(null);
    }, [open, form]);

    // Загрузка списков
    useEffect(() => {
        if (!open) return;
        let cancelled = false;

        (async () => {
            setListsLoading(true);
            try {
                const widgetsRes = await api.get<Widget[]>('/widgets');
                const widgets = widgetsRes.data.sort((a, b) => a.id - b.id);

                const mainW = widgets.find(w => w.id === form.main_widget_id);
                const tableId = mainW?.table_id ?? widgets[0]?.table_id ?? null;

                const colsRes = tableId
                    ? await api.get<Column[]>(`/tables/${tableId}/columns`)
                    : { data: [] as Column[] };
                const cols = colsRes.data.sort((a: Column, b: Column) => a.id - b.id);

                if (!cancelled) {
                    setAvailableWidgets(widgets);
                    setAvailableColumns(cols);
                }
            } catch {
                if (!cancelled) showError('Не удалось загрузить списки');
            } finally {
                if (!cancelled) setListsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [open, form.main_widget_id]);

    // Синхронизация выбранного sub
    useEffect(() => {
        if (subList.length === 0) {
            setSubId(0);
        } else if (!subList.some(s => s.sub_widget_id === subId)) {
            setSubId(subList[0].sub_widget_id);
        }
    }, [subList, subId]);

    useEffect(() => {
        if (currentSub) {
            setSubOrder(currentSub.widget_order ?? 0);
            setSubWhere(currentSub.where_conditional ?? '');
            setSubQueryDelete((currentSub as any).delete_sub_query ?? '');
        }
    }, [currentSub]);

    // Синхронизация выбранного tree
    useEffect(() => {
        if (treeList.length === 0) {
            setTreeColId(0);
        } else if (!treeList.some(t => t.table_column_id === treeColId)) {
            setTreeColId(treeList[0].table_column_id);
        }
    }, [treeList, treeColId]);

    useEffect(() => {
        if (currentTree) {
            setTreeOrder(currentTree.column_order ?? 0);
        }
    }, [currentTree]);

    // ═══════════════════════════════════════════════════════════
    // HANDLERS - MAIN
    // ═══════════════════════════════════════════════════════════

    const saveMain = async () => {
        setSavingMain(true);
        setErr(null);
        try {
            const patch: Record<string, unknown> = {};

            if (mainWidgetId !== form.main_widget_id) patch.main_widget_id = mainWidgetId;
            if (mainName !== form.name) patch.name = mainName;
            if (mainGroup !== form.group) patch.group = mainGroup;
            if ((mainDesc || null) !== (form.description ?? null)) patch.description = mainDesc || null;
            if ((mainPath || null) !== (form.path ?? null)) patch.path = mainPath || null;
            if (Boolean(form.search_bar) !== mainSearchBar) patch.search_bar = mainSearchBar;

            if (Object.keys(patch).length > 0) {
                await api.patch(`/forms/${form.form_id}`, patch);
                emitFormMutated(form.form_id);
                await reloadWidgetForms();
                showSuccess();
            }
        } catch {
            showError('Не удалось сохранить');
        } finally {
            setSavingMain(false);
        }
    };

    // ═══════════════════════════════════════════════════════════
    // HANDLERS - SUB
    // ═══════════════════════════════════════════════════════════

    const saveSub = async () => {
        if (!subId || !currentSub) return;

        const order = Number(subOrder) || 0;
        if (order <= 0) {
            showError('Порядок должен быть больше 0');
            return;
        }

        // Проверка конфликта order
        if (subList.some(s => s.widget_order === order && s.sub_widget_id !== subId)) {
            showError(`Порядок ${order} уже занят`);
            return;
        }

        setSavingSub(true);
        try {
            const body = { widget_order: order, where_conditional: subWhere || null, delete_sub_query: subQueryDelete || null, };
            await api.patch(`/forms/${form.form_id}/sub/${subId}`, body);

            setSubList(prev => prev.map(it =>
                it.sub_widget_id === subId
                    ? { ...it, widget_order: order, where_conditional: subWhere || null,delete_sub_query: subQueryDelete || null, }
                    : it
            ));

            emitFormMutated(form.form_id);
            showSuccess();
            await reloadWidgetForms();
        } catch {
            showError('Не удалось сохранить');
        } finally {
            setSavingSub(false);
        }
    };

    const addSub = async () => {
        if (!newSubWidget) return;

        if (subList.some(s => s.sub_widget_id === newSubWidget.id)) {
            showError('Этот виджет уже добавлен');
            return;
        }

        const order = Number(newSubOrder) || 0;
        if (order <= 0) {
            showError('Порядок должен быть больше 0');
            return;
        }

        if (subList.some(s => s.widget_order === order)) {
            showError(`Порядок ${order} уже занят`);
            return;
        }

        setAddingSub(true);
        try {
            await api.post(`/forms/${form.form_id}/sub`, {
                sub_widget_id: newSubWidget.id,
                widget_order: order,
                where_conditional: newSubWhere || null,
                delete_sub_query: newSubDeleteQuery || null,
            });

            const newItem = {
                sub_widget_id: newSubWidget.id,
                widget_order: order,
                where_conditional: newSubWhere || null,
                form_id: form.form_id,
                delete_sub_query: newSubDeleteQuery || null,
            };

            setSubList(prev => [...prev, newItem].sort((a, b) => (a.widget_order ?? 0) - (b.widget_order ?? 0)));
            setSubId(newSubWidget.id);

            setNewSubWidget(null);
            setNewSubWhere('');
            setNewSubDeleteQuery('');
            setNewSubOrder(order + 1);

            emitFormMutated(form.form_id);
            showSuccess('Добавлено');
            await reloadWidgetForms();
        } catch (e: any) {
            const status = e?.response?.status;
            showError(status === 409 || status === 400
                ? 'Этот виджет уже существует'
                : 'Не удалось добавить'
            );
        } finally {
            setAddingSub(false);
        }
    };

    const deleteSub = async () => {
        if (!subId) return;
        if (!confirm('Удалить sub-виджет?')) return;

        setDeletingSub(true);
        try {
            await deleteSubWidgetFromForm(form.form_id, subId);
            setSubList(prev => prev.filter(it => it.sub_widget_id !== subId));
            emitFormMutated(form.form_id);
            showSuccess('Удалено');
            await reloadWidgetForms();
        } catch {
            showError('Не удалось удалить');
        } finally {
            setDeletingSub(false);
        }
    };

    // ═══════════════════════════════════════════════════════════
    // HANDLERS - TREE
    // ═══════════════════════════════════════════════════════════

    const saveTree = async () => {
        if (!treeColId || !currentTree) return;

        const order = Number(treeOrder) || 0;

        if (treeList.some(t => t.column_order === order && t.table_column_id !== treeColId)) {
            showError(`Порядок ${order} уже занят`);
            return;
        }

        setSavingTree(true);
        try {
            await api.patch(`/forms/${form.form_id}/tree/${treeColId}`, { column_order: order });

            setTreeList(prev => prev.map(it =>
                it.table_column_id === treeColId ? { ...it, column_order: order } : it
            ));

            emitFormMutated(form.form_id);
            showSuccess();
            await reloadWidgetForms();
        } catch {
            showError('Не удалось сохранить');
        } finally {
            setSavingTree(false);
        }
    };

    const addTree = async () => {
        if (!newTreeColumn) return;

        if (treeList.some(t => t.table_column_id === newTreeColumn.id)) {
            showError('Это поле уже добавлено');
            return;
        }

        setAddingTree(true);
        try {
            const order = Number(newTreeOrder) || 0;

            await api.post(`/forms/${form.form_id}/tree`, {
                table_column_id: newTreeColumn.id,
                column_order: order,
            });

            const newItem = { table_column_id: newTreeColumn.id, column_order: order };

            setTreeList(prev => [...prev, newItem].sort((a, b) => (a.column_order ?? 0) - (b.column_order ?? 0)));
            setTreeColId(newTreeColumn.id);

            setNewTreeColumn(null);
            setNewTreeOrder(order + 1);

            emitFormMutated(form.form_id);
            showSuccess('Добавлено');
            await reloadWidgetForms();
        } catch (e: any) {
            const status = e?.response?.status;
            showError(status === 409 || status === 400
                ? 'Это поле уже существует'
                : 'Не удалось добавить'
            );
        } finally {
            setAddingTree(false);
        }
    };

    const deleteTree = async () => {
        if (!treeColId) return;
        if (!confirm('Удалить tree-поле?')) return;

        setDeletingTree(true);
        try {
            await deleteTreeFieldFromForm(form.form_id, treeColId);
            setTreeList(prev => prev.filter(it => it.table_column_id !== treeColId));
            emitFormMutated(form.form_id);
            showSuccess('Удалено');
            await reloadWidgetForms();
        } catch {
            showError('Не удалось удалить');
        } finally {
            setDeletingTree(false);
        }
    };

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    const clearPaperSx = {
        bgcolor: 'transparent',
        backgroundImage: 'none', // важно для MUI dark overlay
    } as const;

    return (
        <ThemeProvider theme={dark}>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
                <DialogTitle>
                    Редактирование формы #{form.form_id}
                    <Typography variant="body2" color="text.secondary">
                        {form.name}
                    </Typography>
                </DialogTitle>

                <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
                    <Tab value="main" label="Основное" />
                    <Tab value="sub" label={`Sub-виджеты (${subList.length})`} />
                    <Tab value="tree" label={`Tree-поля (${treeList.length})`} />
                </Tabs>

                <DialogContent dividers>
                    {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
                    {info && <Alert severity="success" sx={{ mb: 2 }}>{info}</Alert>}

                    {/* ═══════════════ MAIN TAB ═══════════════ */}
                    {tab === 'main' && (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                           {/* <TextField
                                label="Main widget ID"
                                type="number"
                                value={mainWidgetId}
                                onChange={e => setMainWidgetId(Number(e.target.value))}
                            />*/}

                            <TextField
                                label="Название"
                                value={mainName}
                                onChange={e => setMainName(e.target.value)}
                            />
                            <TextField
                                label="Описание"
                                value={mainDesc}
                                onChange={e => setMainDesc(e.target.value)}
                            />
                            <TextField
                                label="Путь"
                                value={mainPath}
                                onChange={e => setMainPath(e.target.value)}
                            />
                            <TextField
                                label="Группа"
                                value={mainGroup}
                                onChange={e => setMainGroup(e.target.value)}
                            />

                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography>Строка поиска</Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={mainSearchBar}
                                            onChange={e => setMainSearchBar(e.target.checked)}
                                        />
                                    }
                                    label={mainSearchBar ? 'Вкл' : 'Выкл'}
                                />
                            </Stack>
                        </Stack>
                    )}

                    {/* ═══════════════ SUB TAB ═══════════════ */}
                    {tab === 'sub' && (
                        <Stack spacing={3} sx={{ mt: 1 }}>
                            {/* Существующие */}
                            {subList.length > 0 && (
                                <Paper variant="outlined" sx={{ p: 2, ...clearPaperSx }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Редактирование
                                    </Typography>


                                    <Stack spacing={2}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Sub-виджет</InputLabel>
                                                <Select
                                                    label="Sub-виджет"
                                                    value={subId || ''}
                                                    onChange={e => setSubId(Number(e.target.value))}
                                                >
                                                    {subList.map(s => (
                                                        <MenuItem key={s.sub_widget_id} value={s.sub_widget_id}>
                                                            #{s.sub_widget_id} • order: {s.widget_order ?? 0}
                                                            {widgetById.get(s.sub_widget_id)?.name
                                                                ? ` • ${widgetById.get(s.sub_widget_id)!.name}`
                                                                : ''
                                                            }
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>

                                            <Tooltip title="Удалить">
                                                <IconButton
                                                    onClick={deleteSub}
                                                    disabled={!subId || deletingSub}
                                                    color="error"
                                                    size="small"
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>

                                        <Stack direction="row" spacing={3}>
                                            <TextField
                                                label="Порядок"
                                                type="number"
                                                size="small"
                                                value={subOrder}
                                                onChange={e => setSubOrder(Number(e.target.value))}
                                                sx={{ width: 120 }}
                                            />
                                            <TextField
                                                label="where_conditional"
                                                size="small"
                                                value={subWhere}
                                                onChange={e => setSubWhere(e.target.value)}
                                                sx={{ flex: 1 }}
                                            />
                                            <TextField
                                                label="delete_sub_query"
                                                size="small"
                                                value={subQueryDelete}
                                                onChange={e => setSubQueryDelete(e.target.value)}
                                                sx={{ flex: 1 }}
                                            />

                                            <Button
                                                variant="contained"
                                                size="small"
                                                startIcon={<SaveIcon />}
                                                onClick={saveSub}
                                                disabled={savingSub || !subHasChanges}
                                            >
                                                {savingSub ? '...' : 'Сохранить'}
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Paper>
                            )}

                            {/* Добавление нового */}
                            <Paper variant="outlined" sx={{ p: 2, ...clearPaperSx }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Добавить новый
                                </Typography>

                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <TextField
                                        label="Порядок"
                                        type="number"
                                        size="small"
                                        value={newSubOrder}
                                        onChange={e => setNewSubOrder(Number(e.target.value))}
                                        sx={{ width: 100 }}
                                    />

                                    <Autocomplete
                                        sx={{ minWidth: 280 }}
                                        size="small"
                                        options={availableWidgets.filter(w => w.id !== form.main_widget_id)}
                                        loading={listsLoading}
                                        value={newSubWidget}
                                        onChange={(_, val) => setNewSubWidget(val)}
                                        getOptionLabel={w => w ? `${w.name} (#${w.id})` : ''}
                                        isOptionEqualToValue={(a, b) => a.id === b.id}
                                        renderInput={params => (
                                            <TextField
                                                {...params}
                                                label="Виджет"
                                                InputProps={{
                                                    ...params.InputProps,
                                                    endAdornment: (
                                                        <>
                                                            {listsLoading && <CircularProgress size={16} />}
                                                            {params.InputProps.endAdornment}
                                                        </>
                                                    ),
                                                }}
                                            />
                                        )}
                                    />

                                    <TextField
                                        label="where_conditional"
                                        size="small"
                                        value={newSubWhere}
                                        onChange={e => setNewSubWhere(e.target.value)}
                                        sx={{ flex: 1, minWidth: 180 }}
                                    />
                                    <TextField
                                        label="delete_sub_query"
                                        size="small"
                                        value={newSubDeleteQuery}
                                        onChange={e => setNewSubDeleteQuery(e.target.value)}
                                        sx={{ flex: 1, minWidth: 180 }}
                                    />

                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={addSub}
                                        disabled={addingSub || !newSubWidget}
                                    >
                                        {addingSub ? '...' : 'Добавить'}
                                    </Button>
                                </Stack>
                            </Paper>
                        </Stack>
                    )}

                    {/* ═══════════════ TREE TAB ═══════════════ */}
                    {tab === 'tree' && (
                        <Stack spacing={3} sx={{ mt: 1 }}>
                            {/* Существующие */}
                            {treeList.length > 0 && (
                                <Paper variant="outlined" sx={{ p: 2, ...clearPaperSx }}>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Редактирование
                                    </Typography>

                                    <Stack spacing={3}>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Tree-поле</InputLabel>
                                                <Select
                                                    label="Tree-поле"
                                                    value={treeColId || ''}
                                                    onChange={e => setTreeColId(Number(e.target.value))}
                                                >
                                                    {treeList.map(tf => (
                                                        <MenuItem key={tf.table_column_id} value={tf.table_column_id}>
                                                            #{tf.table_column_id} • order: {tf.column_order ?? 0}
                                                            {columnById.get(tf.table_column_id)?.name
                                                                ? ` • ${columnById.get(tf.table_column_id)!.name}`
                                                                : ''
                                                            }
                                                        </MenuItem>
                                                    ))}
                                                </Select>

                                            </FormControl>

                                            <Tooltip title="Удалить">
                                                <IconButton
                                                    onClick={deleteTree}
                                                    disabled={!treeColId || deletingTree}
                                                    color="error"
                                                    size="small"
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>

                                        <Stack direction="row" spacing={2}>
                                            <TextField
                                                label="Порядок"
                                                type="number"
                                                size="small"
                                                value={treeOrder}
                                                onChange={e => setTreeOrder(Number(e.target.value))}
                                                sx={{ width: 120 }}
                                            />
                                            <Button
                                                variant="contained"
                                                size="small"
                                                startIcon={<SaveIcon />}
                                                onClick={saveTree}
                                                disabled={savingTree || !treeHasChanges}
                                            >
                                                {savingTree ? '...' : 'Сохранить'}
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Paper>
                            )}

                            {/* Добавление нового */}
                            <Paper variant="outlined" sx={{ p: 2, ...clearPaperSx }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Добавить новое
                                </Typography>

                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <TextField
                                        label="Порядок"
                                        type="number"
                                        size="small"
                                        value={newTreeOrder}
                                        onChange={e => setNewTreeOrder(Number(e.target.value))}
                                        sx={{ width: 100 }}
                                    />

                                    <Autocomplete
                                        sx={{ minWidth: 280 }}
                                        size="small"
                                        options={availableColumns}
                                        loading={listsLoading}
                                        value={newTreeColumn}
                                        onChange={(_, val) => setNewTreeColumn(val)}
                                        getOptionLabel={c => c ? `${c.name} (#${c.id})` : ''}
                                        isOptionEqualToValue={(a, b) => a.id === b.id}
                                        renderInput={params => (
                                            <TextField
                                                {...params}
                                                label="Колонка"
                                                InputProps={{
                                                    ...params.InputProps,
                                                    endAdornment: (
                                                        <>
                                                            {listsLoading && <CircularProgress size={16} />}
                                                            {params.InputProps.endAdornment}
                                                        </>
                                                    ),
                                                }}
                                            />
                                        )}
                                    />

                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={addTree}
                                        disabled={addingTree || !newTreeColumn}
                                    >
                                        {addingTree ? '...' : 'Добавить'}
                                    </Button>
                                </Stack>
                            </Paper>
                        </Stack>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={onClose}>Закрыть</Button>
                    {tab === 'main' && (
                        <Button
                            onClick={saveMain}
                            variant="contained"
                            disabled={savingMain}
                            startIcon={<SaveIcon />}
                        >
                            {savingMain ? 'Сохраняю...' : 'Сохранить'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </ThemeProvider>
    );
};