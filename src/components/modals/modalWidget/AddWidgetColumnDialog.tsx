import React, { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { Widget, WidgetColumn } from '@/shared/hooks/useWorkSpaces';

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

type Props = {
    open: boolean;
    onClose: () => void;
    selectedWidget: Widget | null;
    widgetColumns: WidgetColumn[];
    addWidgetColumn: (payload: {
        widget_id: number;
        alias: string;
        column_order: number;
        default?: string;
        placeholder?: string;
        visible?: boolean;
        type?: string;
    }) => Promise<WidgetColumn>;
    loadColumnsWidget: (widgetId: number) => void;
};

export const AddWidgetColumnDialog: React.FC<Props> = ({
                                                           open,
                                                           onClose,
                                                           selectedWidget,
                                                           widgetColumns,
                                                           addWidgetColumn,
                                                           loadColumnsWidget,
                                                       }) => {
    const defaultOrder = useMemo(() => widgetColumns.length + 1, [widgetColumns.length]);

    const [form, setForm] = useState<{ alias: string; column_order: number }>({
        alias: '',
        column_order: defaultOrder,
    });

    useEffect(() => {
        if (open) {
            setForm({ alias: '', column_order: defaultOrder });
        }
    }, [open, defaultOrder]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWidget) return;

        await addWidgetColumn({
            widget_id: selectedWidget.id,
            alias: form.alias,
            column_order: Number(form.column_order),
        });

        await loadColumnsWidget(selectedWidget.id);
        onClose();
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
                <DialogTitle>Новый столбец</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <TextField
                            label="Alias"
                            size="small"
                            required
                            value={form.alias}
                            onChange={(e) => setForm(v => ({ ...v, alias: e.target.value }))}
                            sx={textFieldSx}
                        />
                        <TextField
                            label="Порядок (column_order)"
                            type="number"
                            size="small"
                            required
                            value={form.column_order}
                            onChange={(e) => setForm(v => ({ ...v, column_order: Number(e.target.value) }))}
                            sx={textFieldSx}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ pr: 3, pb: 2 }}>
                    <Button
                        onClick={onClose}
                        sx={{ color: 'var(--theme-text-secondary)' }}
                    >
                        Отмена
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        sx={{
                            backgroundColor: 'var(--button-primary-bg)',
                            color: 'var(--button-primary-text)',
                            '&:hover': {
                                backgroundColor: 'var(--button-primary-hover)',
                            },
                        }}
                    >
                        Сохранить
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};