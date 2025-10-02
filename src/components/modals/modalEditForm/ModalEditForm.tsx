import React, { useMemo, useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Tabs, Tab, Box, Stack, TextField, Button, MenuItem,
    FormControl, InputLabel, Select, createTheme, ThemeProvider,
    IconButton, Tooltip, Autocomplete, CircularProgress, Divider, Alert
} from '@mui/material';
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { WidgetForm, Widget, Column } from '@/shared/hooks/useWorkSpaces';
import { api } from '@/services/api';

const dark = createTheme({ palette: { mode: 'dark', primary: { main: '#ffffff' } } });

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

    // ---------- MAIN ----------
    const [mainName, setMainName] = useState(form.name);
    const [mainDesc, setMainDesc] = useState(form.description ?? '');
    const [mainPath, setMainPath] = useState<string>('' as any);
    const [mainWidgetId, setMainWidgetId] = useState<number>(form.main_widget_id);
    const [savingMain, setSavingMain] = useState(false);

    // Ошибки/уведомления
    const [err, setErr] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    // ---------- Списки для выбора ----------
    const [availableWidgets, setAvailableWidgets] = useState<Widget[]>([]);
    const [availableColumns, setAvailableColumns] = useState<Column[]>([]);
    const [listsLoading, setListsLoading] = useState(false);

    // Локальные списки связок (чтобы всё видно без перезагрузки)
    const [subList, setSubList] = useState(form.sub_widgets ?? []);
    const [treeList, setTreeList] = useState(form.tree_fields ?? []);

    const emitFormMutated = (formId: number) =>
        window.dispatchEvent(new CustomEvent('portal:form-mutated', { detail: { formId } }));

    // Синхронизация при открытии / смене формы
    useEffect(() => {
        if (!open) return;
        setErr(null);
        setInfo(null);
        setSubList(form.sub_widgets ?? []);
        setTreeList(form.tree_fields ?? []);
        setMainName(form.name);
        setMainDesc(form.description ?? '');
        setMainPath('' as any);
        setMainWidgetId(form.main_widget_id);
    }, [open, form]);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        (async () => {
            setListsLoading(true);
            try {
                const widgetsRes = await api.get<Widget[]>('/widgets');
                const widgets = widgetsRes.data.sort((a,b)=>a.id-b.id);
                const mainW = widgets.find(w => w.id === form.main_widget_id);
                const tableId = mainW?.table_id ?? widgets[0]?.table_id ?? null;
                const colsRes = tableId
                    ? await api.get<Column[]>(`/tables/${tableId}/columns`)
                    : { data: [] as Column[] };
                const cols = (colsRes as any).data.sort((a: Column,b: Column)=>a.id-b.id);

                if (!cancelled) {
                    setAvailableWidgets(widgets);
                    setAvailableColumns(cols);
                }
            } catch (e: any) {
                if (!cancelled) setErr('Не удалось загрузить списки виджетов/колонок');
            } finally {
                if (!cancelled) setListsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open, form.main_widget_id]);

    // ---------- SUB (существующие) ----------
    const [subId, setSubId] = useState<number>(subList[0]?.sub_widget_id ?? 0);
    useEffect(() => {
        // если список изменился и выбранный отсутствует — переключаемся
        if (subList.length === 0) {
            setSubId(0);
        } else if (!subList.some(s => s.sub_widget_id === subId)) {
            setSubId(subList[0].sub_widget_id);
        }
    }, [subList, subId]);

    const currentSub = useMemo(
        () => subList.find(s => s.sub_widget_id === subId) ?? subList[0],
        [subId, subList]
    );
    const [subOrder, setSubOrder] = useState<number>(currentSub?.widget_order ?? 0);
    const [subWhere, setSubWhere] = useState<string>(currentSub?.where_conditional ?? '');
    const [savingSub, setSavingSub] = useState(false);
    const [deletingSub, setDeletingSub] = useState(false);

    useEffect(() => {
        if (currentSub) {
            setSubOrder(currentSub.widget_order ?? 0);
            setSubWhere(currentSub.where_conditional ?? '');
        } else {
            setSubOrder(0);
            setSubWhere('');
        }
    }, [currentSub]);

    const saveSub = async () => {
        if (!subId) return;
        setSavingSub(true);
        setErr(null);
        try {
            const body = { widget_order: Number(subOrder), where_conditional: subWhere || null };
            await api.patch(`/forms/${form.form_id}/sub/${subId}`, body);
            // оптимистично правим локальный список
            setSubList(prev => prev.map(it =>
                it.sub_widget_id === subId ? { ...it, widget_order: body.widget_order, where_conditional: body.where_conditional } : it
            ));
            emitFormMutated(form.form_id);
            setInfo('Сохранено');
            await reloadWidgetForms(); // не обязателен для UI, но синхронизирует родителя
        } catch (e: any) {
            setErr('Не удалось сохранить sub');
        } finally {
            setSavingSub(false);
            // мелкий таймер скрыть "Сохранено"
            setTimeout(() => setInfo(null), 1200);
        }
    };

    // ---------- TREE (существующие) ----------
    const [treeColId, setTreeColId] = useState<number>(treeList[0]?.table_column_id ?? 0);
    useEffect(() => {
        if (treeList.length === 0) {
            setTreeColId(0);
        } else if (!treeList.some(t => t.table_column_id === treeColId)) {
            setTreeColId(treeList[0].table_column_id);
        }
    }, [treeList, treeColId]);

    const currentTree = useMemo(
        () => treeList.find(t => t.table_column_id === treeColId) ?? treeList[0],
        [treeColId, treeList]
    );
    const [treeOrder, setTreeOrder] = useState<number>(currentTree?.column_order ?? 0);
    const [savingTree, setSavingTree] = useState(false);
    const [deletingTree, setDeletingTree] = useState(false);

    useEffect(() => {
        if (currentTree) setTreeOrder(currentTree.column_order ?? 0);
        else setTreeOrder(0);
    }, [currentTree]);

    const saveTree = async () => {
        if (!treeColId) return;
        setSavingTree(true);
        setErr(null);
        try {
            const body = { column_order: Number(treeOrder) };
            await api.patch(`/forms/${form.form_id}/tree/${treeColId}`, body);
            setTreeList(prev => prev.map(it =>
                it.table_column_id === treeColId ? { ...it, column_order: body.column_order } : it
            ));
            setInfo('Сохранено');
            emitFormMutated(form.form_id);
            await reloadWidgetForms();
        } catch (e: any) {
            setErr('Не удалось сохранить tree');
        } finally {
            setSavingTree(false);
            setTimeout(() => setInfo(null), 1200);
        }
    };

    // ---------- Добавление новых ----------
    const [newSubOrder, setNewSubOrder] = useState<number>((subList?.length ?? 0) + 1);
    const [newSubWhere, setNewSubWhere] = useState<string>('');
    const [newSubWidget, setNewSubWidget] = useState<Widget | null>(null);
    const [addingSub, setAddingSub] = useState(false);

    const [newTreeOrder, setNewTreeOrder] = useState<number>((treeList?.length ?? 0) + 1);
    const [newTreeColumn, setNewTreeColumn] = useState<Column | null>(null);
    const [addingTree, setAddingTree] = useState(false);

    const addSub = async () => {
        setErr(null);
        if (!newSubWidget) return;
        // защита от дублей
        if (subList.some(s => s.sub_widget_id === newSubWidget.id)) {
            setErr('Этот sub-виджет уже добавлен');
            return;
        }
        setAddingSub(true);
        try {
            await api.post(`/forms/${form.form_id}/sub`, {
                sub_widget_id: newSubWidget.id,
                widget_order: Number(newSubOrder) || 0,
                where_conditional: newSubWhere || null,
            });
            // оптимистично добавляем
            const newItem = {
                sub_widget_id: newSubWidget.id,
                widget_order: Number(newSubOrder) || 0,
                where_conditional: newSubWhere || null,
            };
            // @ts-ignore
            setSubList(prev => [...prev, newItem].sort((a,b)=> (a.widget_order??0)-(b.widget_order??0)));
            setSubId(newSubWidget.id);
            emitFormMutated(form.form_id);
            setNewSubWidget(null);
            setNewSubWhere('');
            setNewSubOrder((prev)=> (prev||0) + 1);
            await reloadWidgetForms();
        } catch (e: any) {
            // если сервер вернул конфликт — покажем понятнее
            const status = e?.response?.status;
            if (status === 409 || status === 400) setErr('Этот sub-виджет уже существует в форме');
            else setErr('Не удалось добавить sub-виджет');
        } finally {
            setAddingSub(false);
        }
    };

    const addTree = async () => {
        setErr(null);
        if (!newTreeColumn) return;
        if (treeList.some(t => t.table_column_id === newTreeColumn.id)) {
            setErr('Это tree-поле уже добавлено');
            return;
        }
        setAddingTree(true);
        try {
            await api.post(`/forms/${form.form_id}/tree`, {
                table_column_id: newTreeColumn.id,
                column_order: Number(newTreeOrder) || 0,
            });
            const newItem = {
                table_column_id: newTreeColumn.id,
                column_order: Number(newTreeOrder) || 0,
            };
            setTreeList(prev => [...prev, newItem].sort((a,b)=> (a.column_order??0)-(b.column_order??0)));
            setTreeColId(newTreeColumn.id);
            setNewTreeColumn(null);
            emitFormMutated(form.form_id);
            setNewTreeOrder((prev)=> (prev||0) + 1);
            await reloadWidgetForms();
        } catch (e: any) {
            const status = e?.response?.status;
            if (status === 409 || status === 400) setErr('Это tree-поле уже существует в форме');
            else setErr('Не удалось добавить tree-поле');
        } finally {
            setAddingTree(false);
        }
    };

    // ---------- DELETE ----------
    const deleteCurrentSub = async () => {
        if (!subId) return;
        if (!confirm('Удалить выбранный sub-виджет из формы?')) return;
        setDeletingSub(true);
        setErr(null);
        try {
            await deleteSubWidgetFromForm(form.form_id, subId);
            // оптимистично удаляем
            setSubList(prev => prev.filter(it => it.sub_widget_id !== subId));
            setInfo('Удалено');
            emitFormMutated(form.form_id);
            await reloadWidgetForms();
        } catch {
            setErr('Не удалось удалить sub-виджет');
        } finally {
            setDeletingSub(false);
            setTimeout(() => setInfo(null), 1200);
        }
    };

    const deleteCurrentTree = async () => {
        if (!treeColId) return;
        if (!confirm('Удалить выбранное tree-поле из формы?')) return;
        setDeletingTree(true);
        setErr(null);
        try {
            await deleteTreeFieldFromForm(form.form_id, treeColId);
            setTreeList(prev => prev.filter(it => it.table_column_id !== treeColId));
            setInfo('Удалено');
            emitFormMutated(form.form_id);
            await reloadWidgetForms();
        } catch {
            setErr('Не удалось удалить tree-поле');
        } finally {
            setDeletingTree(false);
            setTimeout(() => setInfo(null), 1200);
        }
    };

    // удобные мапы
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

    // ---------- MAIN PATCH ----------
    const saveMain = async () => {
        setSavingMain(true);
        setErr(null);
        try {
            const patch: any = {};
            if (mainWidgetId !== form.main_widget_id) patch.main_widget_id = mainWidgetId;
            if (mainName !== form.name) patch.name = mainName;
            if ((mainDesc || null) !== (form.description ?? null)) patch.description = mainDesc || null;
            if (mainPath !== ('' as any)) patch.path = mainPath || null;

            if (Object.keys(patch).length > 0) {
                await api.patch(`/forms/${form.form_id}`, patch);
                await reloadWidgetForms();
            }
            onClose();
        } catch {
            setErr('Не удалось сохранить основные параметры формы');
        } finally {
            setSavingMain(false);
        }
    };




    return (
        <ThemeProvider theme={dark}>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
                <DialogTitle>Редактирование формы (ID: {form.form_id})</DialogTitle>

                <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
                    <Tab value="main" label="Main form" />
                    <Tab value="sub" label="Sub forms" />
                    <Tab value="tree" label="Tree fields" />
                </Tabs>

                <DialogContent dividers>
                    {!!err && <Alert severity="error" sx={{mb:2}}>{err}</Alert>}
                    {!!info && <Alert severity="success" sx={{mb:2}}>{info}</Alert>}

                    {/* MAIN */}
                    {tab === 'main' && (
                        <Box mt={1}>
                            <Stack spacing={2}>
                                <TextField
                                    label="Main widget ID"
                                    type="number"
                                    value={mainWidgetId}
                                    onChange={e => setMainWidgetId(Number(e.target.value))}
                                />
                                <TextField label="Name" value={mainName} onChange={e => setMainName(e.target.value)} />
                                <TextField label="Description" value={mainDesc} onChange={e => setMainDesc(e.target.value)} />
                                <TextField label="Path" value={mainPath} onChange={e => setMainPath(e.target.value)} />
                            </Stack>
                        </Box>
                    )}

                    {/* SUB */}
                    {tab === 'sub' && (
                        <Box mt={1}>
                            <Stack spacing={3}>
                                {subList.length > 0 ? (
                                    <>
                                        {/* Редактирование существующих — автосейв по blur */}
                                        <Stack spacing={2}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <FormControl fullWidth>
                                                    <InputLabel id="sub-select-label">Выбери sub-виджет (уже привязан)</InputLabel>
                                                    <Select
                                                        labelId="sub-select-label"
                                                        label="Выбери sub-виджет (уже привязан)"
                                                        value={subId || ''}
                                                        onChange={e => setSubId(Number(e.target.value))}
                                                    >
                                                        {subList.map(s => (
                                                            <MenuItem key={s.sub_widget_id} value={s.sub_widget_id}>
                                                                #{s.sub_widget_id} • order: {s.widget_order ?? 0}
                                                                {widgetById.get(s.sub_widget_id) ? ` • ${widgetById.get(s.sub_widget_id)!.name}` : ''}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>

                                                <Tooltip title="Удалить sub-виджет">
                          <span>
                            <IconButton
                                color="primary"
                                onClick={deleteCurrentSub}
                                disabled={!subId || deletingSub}
                                size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </span>
                                                </Tooltip>
                                            </Stack>

                                            <TextField
                                                label="widget_order"
                                                type="number"
                                                value={subOrder}
                                                onChange={e => setSubOrder(Number(e.target.value))}
                                                onBlur={saveSub}
                                                disabled={savingSub}
                                            />
                                            <TextField
                                                label="where_conditional"
                                                value={subWhere}
                                                onChange={e => setSubWhere(e.target.value)}
                                                onBlur={saveSub}
                                                disabled={savingSub}
                                            />
                                        </Stack>

                                        <Divider />
                                    </>
                                ) : null}

                                {/* Добавление нового — показывается всегда (и единственный блок если нет ни одного) */}
                                <Stack spacing={2}>
                                    <strong>Добавить новый sub-виджет</strong>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{flexWrap:'wrap', rowGap:1}}>
                                        <TextField
                                            label="Порядок (widget_order)"
                                            type="number"
                                            size="small"
                                            value={newSubOrder}
                                            onChange={e => setNewSubOrder(Number(e.target.value))}
                                            sx={{ width: 210 }}
                                        />

                                        <Autocomplete
                                            sx={{ minWidth: 320, flex: '0 0 auto' }}
                                            options={availableWidgets.filter(w => w.id !== form.main_widget_id)}
                                            loading={listsLoading}
                                            value={newSubWidget}
                                            onChange={(_, val) => setNewSubWidget(val)}
                                            getOptionLabel={(w) => w ? `${w.name}  (#${w.id}) · tbl:${w.table_id}` : ''}
                                            isOptionEqualToValue={(a,b)=> a.id === b.id}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Sub-widget (по имени)"
                                                    size="small"
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
                                            value={newSubWhere}
                                            onChange={e => setNewSubWhere(e.target.value)}
                                            sx={{ flex: 1, minWidth: 240 }}
                                        />

                                        <Button
                                            startIcon={<AddIcon/>}
                                            variant="outlined"
                                            onClick={addSub}
                                            disabled={addingSub || !newSubWidget}
                                        >
                                            {addingSub ? 'Добавляю…' : 'Добавить sub-виджет'}
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Stack>
                        </Box>
                    )}

                    {/* TREE */}
                    {tab === 'tree' && (
                        <Box mt={1}>
                            <Stack spacing={3}>
                                {treeList.length > 0 ? (
                                    <>
                                        {/* Редактирование существующих — автосейв по blur */}
                                        <Stack spacing={2}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <FormControl fullWidth>
                                                    <InputLabel id="tree-select-label">Выбери tree-поле (уже привязано)</InputLabel>
                                                    <Select
                                                        labelId="tree-select-label"
                                                        label="Выбери tree-поле (уже привязано)"
                                                        value={treeColId || ''}
                                                        onChange={e => setTreeColId(Number(e.target.value))}
                                                    >
                                                        {treeList.map(tf => (
                                                            <MenuItem key={tf.table_column_id} value={tf.table_column_id}>
                                                                #{tf.table_column_id} • order: {tf.column_order ?? 0}
                                                                {columnById.get(tf.table_column_id) ? ` • ${columnById.get(tf.table_column_id)!.name}` : ''}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>

                                                <Tooltip title="Удалить tree-поле">
                          <span>
                            <IconButton
                                color="primary"
                                onClick={deleteCurrentTree}
                                disabled={!treeColId || deletingTree}
                                size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </span>
                                                </Tooltip>
                                            </Stack>

                                            <TextField
                                                label="column_order"
                                                type="number"
                                                value={treeOrder}
                                                onChange={e => setTreeOrder(Number(e.target.value))}
                                                onBlur={saveTree}
                                                disabled={savingTree}
                                            />
                                        </Stack>

                                        <Divider />
                                    </>
                                ) : null}

                                {/* Добавление нового — показывается всегда */}
                                <Stack spacing={2}>
                                    <strong>Добавить новое tree-поле</strong>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{flexWrap:'wrap', rowGap:1}}>
                                        <TextField
                                            label="Порядок (column_order)"
                                            type="number"
                                            size="small"
                                            value={newTreeOrder}
                                            onChange={e => setNewTreeOrder(Number(e.target.value))}
                                            sx={{ width: 260 }}
                                        />

                                        <Autocomplete
                                            sx={{ minWidth: 320, flex: '0 0 auto' }}
                                            options={availableColumns}
                                            loading={listsLoading}
                                            value={newTreeColumn}
                                            onChange={(_, val) => setNewTreeColumn(val)}
                                            getOptionLabel={(c) => c ? `${c.name}  (#${c.id})` : ''}
                                            isOptionEqualToValue={(a,b)=> a.id === b.id}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Колонка (по имени)"
                                                    size="small"
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

                                        <Button
                                            startIcon={<AddIcon/>}
                                            variant="outlined"
                                            onClick={addTree}
                                            disabled={addingTree || !newTreeColumn}
                                        >
                                            {addingTree ? 'Добавляю…' : 'Добавить tree-поле'}
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Stack>
                        </Box>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={onClose}>Отмена</Button>
                    {tab === 'main' && (
                        <Button onClick={saveMain} variant="contained" disabled={savingMain}>
                            {savingMain ? 'Сохраняю…' : 'Сохранить Main'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </ThemeProvider>
    );
};
