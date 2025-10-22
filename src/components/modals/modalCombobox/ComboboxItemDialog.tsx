import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, FormControlLabel, Checkbox, Stack,
    CircularProgress, InputAdornment
} from '@mui/material';
import { api } from '@/services/api';

type Props = {
    open: boolean;
    value: {
        combobox_width: number;
        combobox_column_order: number;
        combobox_alias: string;
        is_primary: boolean;
        is_show: boolean;
        is_show_hidden: boolean;

        combobox_column_id: number | null;        // только выводим
        combobox_column_name?: string | null;     // только выводим
    };
    onChange: (patch: Partial<Props['value']>) => void; // нужен, чтобы мы могли дописать name после lookup
    onClose: () => void;
    onSave: () => void;
    saving?: boolean;
};

export const ComboboxItemDialog: React.FC<Props> = ({
                                                        open, value, onChange, onClose, onSave, saving
                                                    }) => {
    const [nameLoading, setNameLoading] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);

    // Авто-подтяжка имени по ID, если его не передали извне
    useEffect(() => {
        let cancelled = false;

        const fetchName = async (id: number) => {
            setNameLoading(true);
            setNameError(null);
            try {
                const { data } = await api.get(`/tables/columns/${id}`);
                if (!cancelled) {
                    const name = (data as any)?.name ?? '';
                    onChange({ combobox_column_name: name });
                }
            } catch {
                if (!cancelled) setNameError('Не удалось получить имя колонки');
            } finally {
                if (!cancelled) setNameLoading(false);
            }
        };

        if (
            open &&
            value.combobox_column_id &&
            (!value.combobox_column_name || value.combobox_column_name.trim() === '')
        ) {
            fetchName(value.combobox_column_id);
        }

        return () => { cancelled = true; };
    }, [open, value.combobox_column_id, value.combobox_column_name, onChange]);

    return (
        <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
            <DialogTitle>Редактирование поля combobox</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        type="number"
                        label="combobox_width"
                        size="small"
                        value={value.combobox_width}
                        onChange={e => {
                            const n = parseInt(e.target.value, 10);
                            onChange({ combobox_width: Number.isFinite(n) ? Math.max(1, n) : 1 });
                        }}
                        inputProps={{ min: 1 }}
                    />

                    <TextField
                        type="number"
                        label="combobox_column_order"
                        size="small"
                        value={value.combobox_column_order}
                        onChange={e => {
                            const n = parseInt(e.target.value, 10);
                            onChange({ combobox_column_order: Number.isFinite(n) ? Math.max(0, n) : 0 });
                        }}
                        inputProps={{ min: 0 }}
                    />

                    <TextField
                        label="combobox_alias"
                        size="small"
                        value={value.combobox_alias ?? ''}
                        onChange={e => onChange({ combobox_alias: e.target.value })}
                        placeholder="Подпись столбца"
                    />

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={!!value.is_primary}
                                onChange={e => onChange({ is_primary: e.target.checked })}
                            />
                        }
                        label="is_primary"
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={!!value.is_show}
                                onChange={e => onChange({ is_show: e.target.checked })}
                            />
                        }
                        label="is_show"
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={!!value.is_show_hidden}
                                onChange={e => onChange({ is_show_hidden: e.target.checked })}
                            />
                        }
                        label="is_show_hidden"
                    />

                    {/* ↓↓↓ ТОЛЬКО ПРОСМОТР: combobox_column_id */}
                    <TextField
                        label="combobox_column_id"
                        size="small"
                        value={value.combobox_column_id ?? ''}
                        InputProps={{ readOnly: true }}

                    />

                    {/* ↓↓↓ ТОЛЬКО ПРОСМОТР: combobox_column_name */}
                    <TextField
                        label="combobox_column_name"
                        size="small"
                        value={value.combobox_column_name ?? ''}
                        InputProps={{
                            readOnly: true,
                            endAdornment: (
                                <InputAdornment position="end">
                                    {nameLoading ? <CircularProgress size={16} /> : null}
                                </InputAdornment>
                            ),
                        }}
                        error={!!nameError}

                    />
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={!!saving}>Отмена</Button>
                <Button type="button" onClick={onSave} disabled={!!saving} variant="contained">
                    {saving ? 'Сохр...' : 'Сохранить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
