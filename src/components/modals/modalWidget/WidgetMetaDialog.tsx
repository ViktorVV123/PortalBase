import React, {useEffect, useMemo, useState} from 'react';
import {Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Switch, TextField, Button, ThemeProvider, createTheme} from '@mui/material';
import {Widget} from '@/shared/hooks/useWorkSpaces';
import {api} from '@/services/api';

const dark = createTheme({
    palette: {mode: 'dark', primary: {main: '#ffffff'}},
    components: {
        MuiOutlinedInput: {styleOverrides: {root: {'&.Mui-focused .MuiOutlinedInput-notchedOutline': {borderColor: '#ffffff'}}}},
        MuiInputLabel: {styleOverrides: {root: {'&.Mui-focused': {color: '#ffffff'}}}},
    },
});

type Props = {
    open: boolean;
    onClose: () => void;
    selectedWidget: Widget | null;

    updateWidgetMeta: (id: number, patch: Partial<Widget>) => Promise<Widget>;
    loadColumnsWidget: (widgetId: number) => void;
    setSelectedWidget: React.Dispatch<React.SetStateAction<Widget | null>>;
    setWidgetsByTable: React.Dispatch<React.SetStateAction<Record<number, Widget[]>>>;
};

export const WidgetMetaDialog: React.FC<Props> = ({
                                                      open,
                                                      onClose,
                                                      selectedWidget,
                                                      updateWidgetMeta,
                                                      loadColumnsWidget,
                                                      setSelectedWidget,
                                                      setWidgetsByTable,
                                                  }) => {
    const init = useMemo(() => ({
        name: selectedWidget?.name ?? '',
        description: selectedWidget?.description ?? '',
        table_id: selectedWidget?.table_id ?? 0,
        published: selectedWidget?.published ?? false,
    }), [selectedWidget]);

    const [form, setForm] = useState(init);
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (open) setForm(init); }, [open, init]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWidget) return;

        setSaving(true);
        const origPublished = !!selectedWidget.published;
        const nextPublished = !!form.published;

        try {
            // 1) PATCH meta (без published)
            const upd = await updateWidgetMeta(selectedWidget.id, {
                name: form.name,
                description: form.description,
                table_id: form.table_id,
            });

            let finalWidget = upd;

            // 2) publish toggle (если изменился)
            if (origPublished !== nextPublished) {
                await api.patch(`/widgets/${selectedWidget.id}/publish`, { published: nextPublished });
                finalWidget = { ...upd, published: nextPublished };
            }

            // 3) локальные сторы
            setSelectedWidget(finalWidget);
            setWidgetsByTable(prev => {
                const tblId = finalWidget.table_id;
                const updated = (prev[tblId] ?? []).map(w => w.id === finalWidget.id ? finalWidget : w);
                return { ...prev, [tblId]: updated };
            });

            await loadColumnsWidget(finalWidget.id);
            onClose();
        } catch (e) {
            console.warn('❌ save widget meta failed:', e);
            alert('Не удалось сохранить изменения');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ThemeProvider theme={dark}>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
                <form onSubmit={handleSubmit}>
                    <DialogTitle>Редактирование виджета</DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={2}>
                            <TextField
                                label="Название"
                                size="small"
                                fullWidth
                                required
                                value={form.name}
                                onChange={(e) => setForm(v => ({...v, name: e.target.value}))}
                            />
                            <TextField
                                label="Описание"
                                size="small"
                                fullWidth
                                multiline
                                rows={3}
                                value={form.description}
                                onChange={(e) => setForm(v => ({...v, description: e.target.value}))}
                            />

                            <FormControlLabel
                                label={
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <span>Опубликован</span>
                                        <Chip
                                            size="small"
                                            label={form.published ? 'Да' : 'Нет'}
                                            color={form.published ? 'success' : 'default'}
                                            variant="outlined"
                                        />
                                    </Stack>
                                }
                                control={
                                    <Switch
                                        checked={!!form.published}
                                        onChange={(e) => setForm(v => ({...v, published: e.target.checked}))}
                                    />
                                }
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ pr: 3, pb: 2, gap: 1 }}>
                        <Button onClick={onClose} disabled={saving}>Отмена</Button>
                        <Button type="submit" variant="contained" disabled={saving}>
                            {saving ? 'Сохранение…' : 'Сохранить'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </ThemeProvider>
    );
};
