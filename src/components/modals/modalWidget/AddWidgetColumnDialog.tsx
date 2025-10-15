import React, {useEffect, useMemo, useState} from 'react';
import {Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, ThemeProvider, createTheme} from '@mui/material';
import {Widget, WidgetColumn} from '@/shared/hooks/useWorkSpaces';

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

    const [form, setForm] = useState<{alias: string; column_order: number}>({
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
        <ThemeProvider theme={dark}>
            <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
                <form onSubmit={handleSubmit}>
                    <DialogTitle>Новый столбец</DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={2}>
                            <TextField
                                label="Alias"
                                size="small"
                                required
                                value={form.alias}
                                onChange={(e) => setForm(v => ({...v, alias: e.target.value}))}
                            />
                            <TextField
                                label="Порядок (column_order)"
                                type="number"
                                size="small"
                                required
                                value={form.column_order}
                                onChange={(e) => setForm(v => ({...v, column_order: Number(e.target.value)}))}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{pr: 3, pb: 2}}>
                        <Button onClick={onClose}>Отмена</Button>
                        <Button type="submit" variant="contained">Сохранить</Button>
                    </DialogActions>
                </form>
            </Dialog>
        </ThemeProvider>
    );
};
