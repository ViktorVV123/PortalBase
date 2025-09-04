import React, { useMemo, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Tabs, Tab, Box, Stack, TextField, Button, MenuItem,
    FormControl, InputLabel, Select, createTheme, ThemeProvider
} from '@mui/material';
import { WidgetForm } from '@/shared/hooks/useWorkSpaces';
import { api } from '@/services/api';

const dark = createTheme({
    palette: { mode: 'dark', primary: { main: '#ffffff' } },
});

type Props = {
    open: boolean;
    onClose: () => void;
    form: WidgetForm;
    /** обновить кэш форм после изменения */
    reloadWidgetForms: () => Promise<void>;
};

type MainPatch = Partial<{
    main_widget_id: number;
    name: string;
    description: string | null;
    path: string | null;
}>;

type SubPatch = Partial<{
    widget_order: number;
    where_conditional: string | null;
}>;

type TreePatch = Partial<{
    column_order: number;
}>;

export const ModalEditForm: React.FC<Props> = ({ open, onClose, form, reloadWidgetForms }) => {
    const [tab, setTab] = useState<'main' | 'sub' | 'tree'>('main');

    // ---------- MAIN ----------
    const [mainName, setMainName] = useState(form.name);
    const [mainDesc, setMainDesc] = useState(form.description ?? '');
    const [mainPath, setMainPath] = useState<string>(/* может быть undefined на бэке */ '' as any);
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

    // синхронизируем поля при смене выбранного sub
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

    React.useEffect(() => {
        if (currentTree) {
            setTreeOrder(currentTree.column_order ?? 0);
        }
    }, [currentTree]);

    // ---------- handlers ----------
    const saveMain = async () => {
        setSavingMain(true);
        try {
            const patch: MainPatch = {};
            if (mainWidgetId !== form.main_widget_id) patch.main_widget_id = mainWidgetId;
            if (mainName !== form.name) patch.name = mainName;
            if ((mainDesc || null) !== (form.description ?? null)) patch.description = mainDesc || null;
            // path в типе WidgetForm у тебя может отсутствовать; если нужен — редактируем
            // отправляем только если не пустая строка или если хочешь явно очищать — поставь null:
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
            const body: SubPatch = {
                widget_order: Number(subOrder),
                where_conditional: subWhere || null,
            };
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
            const body: TreePatch = { column_order: Number(treeOrder) };
            await api.patch(`/forms/${form.form_id}/tree/${treeColId}`, body);
            await reloadWidgetForms();
            onClose();
        } finally {
            setSavingTree(false);
        }
    };

    return (
        <ThemeProvider theme={dark}>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
                <DialogTitle>Редактирование формы (ID: {form.form_id})</DialogTitle>

                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    aria-label="edit form tabs"
                    variant="fullWidth"
                >
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
                                <TextField
                                    label="Name"
                                    value={mainName}
                                    onChange={e => setMainName(e.target.value)}
                                />
                                <TextField
                                    label="Description"
                                    value={mainDesc}
                                    onChange={e => setMainDesc(e.target.value)}
                                />
                                <TextField
                                    label="Path"
                                    value={mainPath}
                                    onChange={e => setMainPath(e.target.value)}
                                />
                            </Stack>
                        </Box>
                    )}

                    {/* SUB */}
                    {tab === 'sub' && (
                        <Box mt={1}>
                            <Stack spacing={2}>
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
