import React, { useMemo, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Tabs, Tab, Box, Stack, TextField, Button, MenuItem,
    FormControl, InputLabel, Select, createTheme, ThemeProvider,
    IconButton, Tooltip
} from '@mui/material';
import DeleteIcon from "@mui/icons-material/Delete";
import { WidgetForm } from '@/shared/hooks/useWorkSpaces';
import { api } from '@/services/api';

const dark = createTheme({ palette: { mode: 'dark', primary: { main: '#ffffff' } } });

type Props = {
    open: boolean;
    onClose: () => void;
    form: WidgetForm;
    reloadWidgetForms: () => Promise<void>;
    // 🔹 новые пропсы — удаление через хук
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

    // ---------- SUB ----------
    const subOptions = form.sub_widgets ?? [];
    const [subId, setSubId] = useState<number>(subOptions[0]?.sub_widget_id ?? 0);
    const currentSub = useMemo(
        () => subOptions.find(s => s.sub_widget_id === subId) ?? subOptions[0],
        [subId, subOptions]
    );
    const [subOrder, setSubOrder] = useState<number>(currentSub?.widget_order ?? 0);
    const [subWhere, setSubWhere] = useState<string>(currentSub?.where_conditional ?? '');
    const [savingSub, setSavingSub] = useState(false);
    const [deletingSub, setDeletingSub] = useState(false);

    React.useEffect(() => {
        if (currentSub) {
            setSubOrder(currentSub.widget_order ?? 0);
            setSubWhere(currentSub.where_conditional ?? '');
        }
    }, [currentSub]);

    // ---------- TREE ----------
    const treeOptions = form.tree_fields ?? [];
    const [treeColId, setTreeColId] = useState<number>(treeOptions[0]?.table_column_id ?? 0);
    const currentTree = useMemo(
        () => treeOptions.find(t => t.table_column_id === treeColId) ?? treeOptions[0],
        [treeColId, treeOptions]
    );
    const [treeOrder, setTreeOrder] = useState<number>(currentTree?.column_order ?? 0);
    const [savingTree, setSavingTree] = useState(false);
    const [deletingTree, setDeletingTree] = useState(false);

    React.useEffect(() => {
        if (currentTree) setTreeOrder(currentTree.column_order ?? 0);
    }, [currentTree]);

    // ---------- PATCH handlers ----------
    const saveMain = async () => {
        setSavingMain(true);
        try {
            const patch: any = {};
            if (mainWidgetId !== form.main_widget_id) patch.main_widget_id = mainWidgetId;
            if (mainName !== form.name) patch.name = mainName;
            if ((mainDesc || null) !== (form.description ?? null)) patch.description = mainDesc || null;
            if (mainPath !== ('' as any)) patch.path = mainPath || null;

            await api.patch(`/forms/${form.form_id}`, patch);
            await reloadWidgetForms();
            onClose();
        } finally {
            setSavingMain(false);
        }
    };

    const saveSub = async () => {
        if (!subId) return;
        setSavingSub(true);
        try {
            const body = { widget_order: Number(subOrder), where_conditional: subWhere || null };
            await api.patch(`/forms/${form.form_id}/sub/${subId}`, body);
            await reloadWidgetForms();
            onClose();
        } finally {
            setSavingSub(false);
        }
    };

    const saveTree = async () => {
        if (!treeColId) return;
        setSavingTree(true);
        try {
            const body = { column_order: Number(treeOrder) };
            await api.patch(`/forms/${form.form_id}/tree/${treeColId}`, body);
            await reloadWidgetForms();
            onClose();
        } finally {
            setSavingTree(false);
        }
    };

    // ---------- DELETE handlers ----------
    const deleteCurrentSub = async () => {
        if (!subId) return;
        if (!confirm('Удалить выбранный sub-виджет из формы?')) return;
        setDeletingSub(true);
        try {
            await deleteSubWidgetFromForm(form.form_id, subId);
            await reloadWidgetForms();
            onClose(); // можно оставить открытую — по желанию
        } finally {
            setDeletingSub(false);
        }
    };

    const deleteCurrentTree = async () => {
        if (!treeColId) return;
        if (!confirm('Удалить выбранное tree-поле из формы?')) return;
        setDeletingTree(true);
        try {
            await deleteTreeFieldFromForm(form.form_id, treeColId);
            await reloadWidgetForms();
            onClose();
        } finally {
            setDeletingTree(false);
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
                            <Stack spacing={2}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <FormControl fullWidth>
                                        <InputLabel id="sub-select-label">Выбери sub-виджет</InputLabel>
                                        <Select
                                            labelId="sub-select-label"
                                            label="Выбери sub-виджет"
                                            value={subId || ''}
                                            onChange={e => setSubId(Number(e.target.value))}
                                        >
                                            {subOptions.map(s => (
                                                <MenuItem key={s.sub_widget_id} value={s.sub_widget_id}>
                                                    #{s.sub_widget_id} • order: {s.widget_order ?? 0}
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
                                />
                                <TextField
                                    label="where_conditional"
                                    value={subWhere}
                                    onChange={e => setSubWhere(e.target.value)}
                                />
                            </Stack>
                        </Box>
                    )}

                    {/* TREE */}
                    {tab === 'tree' && (
                        <Box mt={1}>
                            <Stack spacing={2}>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <FormControl fullWidth>
                                        <InputLabel id="tree-select-label">Выбери tree-поле</InputLabel>
                                        <Select
                                            labelId="tree-select-label"
                                            label="Выбери tree-поле"
                                            value={treeColId || ''}
                                            onChange={e => setTreeColId(Number(e.target.value))}
                                        >
                                            {treeOptions.map(tf => (
                                                <MenuItem key={tf.table_column_id} value={tf.table_column_id}>
                                                    table_column_id: {tf.table_column_id} • order: {tf.column_order ?? 0}
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
                                />
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
                    {tab === 'sub' && (
                        <Button onClick={saveSub} variant="contained" disabled={savingSub || !subId}>
                            {savingSub ? 'Сохраняю…' : 'Сохранить Sub'}
                        </Button>
                    )}
                    {tab === 'tree' && (
                        <Button onClick={saveTree} variant="contained" disabled={savingTree || !treeColId}>
                            {savingTree ? 'Сохраняю…' : 'Сохранить Tree'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </ThemeProvider>
    );
};
