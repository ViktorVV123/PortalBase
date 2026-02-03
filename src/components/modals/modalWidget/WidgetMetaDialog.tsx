import React, { useEffect, useMemo, useState } from 'react';
import {
    Chip, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControlLabel, Stack, Switch, TextField, Button, Box
} from '@mui/material';
import { Widget } from '@/shared/hooks/useWorkSpaces';
import { api } from '@/services/api';

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

    useEffect(() => {
        if (open) setForm(init);
    }, [open, init]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWidget) return;

        setSaving(true);
        const origPublished = !!selectedWidget.published;
        const nextPublished = !!form.published;

        try {
            const upd = await updateWidgetMeta(selectedWidget.id, {
                name: form.name,
                description: form.description,
                table_id: form.table_id,
            });

            let finalWidget = upd;

            if (origPublished !== nextPublished) {
                await api.patch(`/widgets/${selectedWidget.id}/publish`, { published: nextPublished });
                finalWidget = { ...upd, published: nextPublished };
            }

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
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            PaperProps={{ sx: dialogPaperSx }}
        >
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
                            onChange={(e) => setForm(v => ({ ...v, name: e.target.value }))}
                            sx={textFieldSx}
                        />
                        <TextField
                            label="Описание"
                            size="small"
                            fullWidth
                            multiline
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm(v => ({ ...v, description: e.target.value }))}
                            sx={textFieldSx}
                        />

                        {/*<FormControlLabel*/}
                        {/*    label={*/}
                        {/*        <Stack direction="row" spacing={1} alignItems="center">*/}
                        {/*            <Box component="span" sx={{ color: 'var(--theme-text-primary)' }}>*/}
                        {/*                Опубликован*/}
                        {/*            </Box>*/}
                        {/*            <Chip*/}
                        {/*                size="small"*/}
                        {/*                label={form.published ? 'Да' : 'Нет'}*/}
                        {/*                color={form.published ? 'success' : 'default'}*/}
                        {/*                variant="outlined"*/}
                        {/*                sx={{*/}
                        {/*                    borderColor: form.published ? 'var(--theme-success)' : 'var(--theme-border)',*/}
                        {/*                    color: form.published ? 'var(--theme-success)' : 'var(--theme-text-secondary)',*/}
                        {/*                }}*/}
                        {/*            />*/}
                        {/*        </Stack>*/}
                        {/*    }*/}
                        {/*    control={*/}
                        {/*        <Switch*/}
                        {/*            checked={!!form.published}*/}
                        {/*            onChange={(e) => setForm(v => ({ ...v, published: e.target.checked }))}*/}
                        {/*            sx={switchSx}*/}
                        {/*        />*/}
                        {/*    }*/}
                        {/*/>*/}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ pr: 3, pb: 2, gap: 1 }}>
                    <Button
                        onClick={onClose}
                        disabled={saving}
                        sx={{ color: 'var(--theme-text-secondary)' }}
                    >
                        Отмена
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={saving}
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
                        {saving ? 'Сохранение…' : 'Сохранить'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};