import React, { useEffect, useMemo, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, FormControl, InputLabel, Select, MenuItem, TextField,
    FormHelperText, Checkbox, FormControlLabel, CircularProgress
} from '@mui/material';
import { api } from '@/services/api';

type ComboboxAddValue = {
    table_id: number | null;                 // ← приходит из useComboboxCreate, руками не вводим
    combobox_column_id: number | null;
    combobox_width: number;
    combobox_column_order: number;
    combobox_alias: string;
    is_primary: boolean;
    is_show: boolean;
    is_show_hidden: boolean;
};

type Props = {
    open: boolean;
    value: ComboboxAddValue;
    saving?: boolean;
    onChange: (patch: Partial<ComboboxAddValue>) => void;
    onClose: () => void;
    onSave: () => void;
};

type ColumnOption = { id: number; name: string };

export const ComboboxAddDialog: React.FC<Props> = ({
                                                       open, value, saving = false, onChange, onClose, onSave
                                                   }) => {
    const [loadingCols, setLoadingCols] = useState(false);
    const [cols, setCols] = useState<ColumnOption[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Грузим только колонки конкретной таблицы формы
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!open) return;

            const tid = value.table_id ?? null;
            if (!Number.isFinite(tid as number) || (tid as number) <= 0) {
                setCols([]);
                setError('Форма не выбрана или не удалось определить таблицу для формы.');
                return;
            }

            setLoadingCols(true);
            setError(null);
            setCols([]);
            try {
                const { data } = await api.get(`/tables/${tid}/columns`);
                const arr = (data ?? []).map((c: any) => ({ id: c.id, name: c.name })) as ColumnOption[];
                if (!cancelled) setCols(arr);
            } catch {
                if (!cancelled) setError('Не удалось загрузить колонки таблицы.');
            } finally {
                if (!cancelled) setLoadingCols(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [open, value.table_id]);

    const canSave = useMemo(() => {
        const idOk = Number.isFinite(value.combobox_column_id as number) && (value.combobox_column_id as number) > 0;
        const tableOk = Number.isFinite(value.table_id as number) && (value.table_id as number) > 0;
        return idOk && tableOk && !saving;
    }, [value.combobox_column_id, value.table_id, saving]);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Добавить элемент Combobox</DialogTitle>
            <DialogContent dividers>

                <FormHelperText sx={{ mb: 1 }}>
                    {Number.isFinite(value.table_id as number) && (value.table_id as number) > 0
                        ? `Колонки формы: таблица #${value.table_id}`
                        : 'Форма не выбрана — выбор колонок недоступен'}
                </FormHelperText>

                <FormControl fullWidth size="small" margin="dense" disabled={!Number.isFinite(value.table_id as number)}>
                    <InputLabel id="combo-col-id-label">combobox_column_id</InputLabel>
                    <Select
                        labelId="combo-col-id-label"
                        label="combobox_column_id"
                        value={value.combobox_column_id ?? ''}
                        onChange={(e) => {
                            const n = parseInt(String(e.target.value), 10);
                            onChange({ combobox_column_id: Number.isFinite(n) ? n : null });
                        }}
                        MenuProps={{
                            PaperProps: { sx: { bgcolor: '#0f0f0f', color: '#fff', maxHeight: 420 } },
                            MenuListProps: { sx: { bgcolor: '#0f0f0f', color: '#fff' } },
                        }}
                    >
                        {loadingCols ? (
                            <MenuItem disabled>
                                <CircularProgress size={16} sx={{ mr: 1 }} /> Загрузка…
                            </MenuItem>
                        ) : error ? (
                            <MenuItem disabled>{error}</MenuItem>
                        ) : (
                            cols.map(opt => (
                                <MenuItem key={opt.id} value={opt.id}>
                                    #{opt.id} · {opt.name}
                                </MenuItem>
                            ))
                        )}
                    </Select>
                    <FormHelperText>
                        Выберите колонку **из таблицы формы** (список формируется автоматически).
                    </FormHelperText>
                </FormControl>

                <FormControl fullWidth margin="dense">
                    <TextField
                        type="number"
                        label="combobox_width"
                        size="small"
                        value={value.combobox_width}
                        onChange={e => onChange({ combobox_width: Math.max(1, Math.trunc(+e.target.value || 1)) })}
                    />
                </FormControl>

                <FormControl fullWidth margin="dense">
                    <TextField
                        type="number"
                        label="combobox_column_order"
                        size="small"
                        value={value.combobox_column_order}
                        onChange={e => onChange({ combobox_column_order: Math.max(0, Math.trunc(+e.target.value || 0)) })}
                    />
                </FormControl>

                <FormControl fullWidth margin="dense">
                    <TextField
                        label="combobox_alias"
                        size="small"
                        value={value.combobox_alias}
                        onChange={e => onChange({ combobox_alias: e.target.value })}
                    />
                </FormControl>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                    <FormControlLabel
                        control={<Checkbox checked={!!value.is_primary} onChange={e => onChange({ is_primary: e.target.checked })} />}
                        label="is_primary"
                    />
                    <FormControlLabel
                        control={<Checkbox checked={!!value.is_show} onChange={e => onChange({ is_show: e.target.checked })} />}
                        label="is_show"
                    />
                    <FormControlLabel
                        control={<Checkbox checked={!!value.is_show_hidden} onChange={e => onChange({ is_show_hidden: e.target.checked })} />}
                        label="is_show_hidden"
                    />
                </div>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={saving}>Отмена</Button>
                <Button onClick={onSave} disabled={!canSave} variant="contained">
                    {saving ? 'Сохранение…' : 'Сохранить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
