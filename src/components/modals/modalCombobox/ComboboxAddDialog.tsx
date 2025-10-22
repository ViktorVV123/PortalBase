import React, { useEffect, useMemo, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, FormControl, InputLabel, Select, MenuItem, TextField,
    FormHelperText, Checkbox, FormControlLabel, CircularProgress
} from '@mui/material';
import { api } from '@/services/api';

type ComboboxAddValue = {
    // table_id больше не обязателен — можно не передавать
    table_id?: number | null;

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

type ColumnOption = {
    id: number;
    name: string;
    table_id: number;
    table_name: string;
};

export const ComboboxAddDialog: React.FC<Props> = ({
                                                       open, value, saving = false, onChange, onClose, onSave
                                                   }) => {
    const [loadingCols, setLoadingCols] = useState(false);
    const [cols, setCols] = useState<ColumnOption[]>([]);
    const [colsError, setColsError] = useState<string | null>(null);
    const [lookupName, setLookupName] = useState<string | null>(null);
    const [query, setQuery] = useState('');

    // загружаем ВСЕ таблицы и их колонки
    useEffect(() => {
        let cancelled = false;
        const loadAllColumns = async () => {
            if (!open) return;
            setLoadingCols(true);
            setColsError(null);
            setCols([]);
            try {
                // 1) список таблиц
                const tablesRes = await api.get<{ id: number; name: string }[]>('/tables');
                const tables = tablesRes.data ?? [];

                // 2) параллельные запросы на колонки каждой таблицы
                const perTableCols = await Promise.all(
                    tables.map(async t => {
                        try {
                            const res = await api.get<{ id: number; name: string }[]>(`/tables/${t.id}/columns`);
                            return (res.data ?? []).map(c => ({
                                id: (c as any).id,
                                name: (c as any).name,
                                table_id: t.id,
                                table_name: t.name,
                            }) as ColumnOption);
                        } catch {
                            return [] as ColumnOption[];
                        }
                    })
                );

                const flat = perTableCols.flat().sort((a, b) => {
                    // сначала по имени таблицы, затем по имени колонки, затем по id
                    const tn = a.table_name.localeCompare(b.table_name, 'ru');
                    if (tn !== 0) return tn;
                    const cn = a.name.localeCompare(b.name, 'ru');
                    if (cn !== 0) return cn;
                    return a.id - b.id;
                });

                if (!cancelled) setCols(flat);
            } catch {
                if (!cancelled) {
                    setColsError('Не удалось загрузить перечень колонок. Можно ввести ID вручную.');
                }
            } finally {
                if (!cancelled) setLoadingCols(false);
            }
        };

        loadAllColumns();
        return () => { cancelled = true; };
    }, [open]);

    useEffect(() => { setLookupName(null); }, [value.combobox_column_id]);

    const filteredCols = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return cols;
        return cols.filter(o =>
            String(o.id).includes(q) ||
            o.name.toLowerCase().includes(q) ||
            o.table_name.toLowerCase().includes(q)
        );
    }, [cols, query]);

    const canSave = useMemo(() => {
        return Number.isFinite(value.combobox_column_id as number)
            && (value.combobox_column_id as number) > 0
            && !saving;
    }, [value.combobox_column_id, saving]);

    // ручной lookup по /tables/columns/{id}
    const handleLookup = async () => {
        const id = Number(value.combobox_column_id);
        if (!Number.isFinite(id) || id <= 0) {
            setLookupName('Введите корректный ID');
            return;
        }
        try {
            const { data } = await api.get(`/tables/columns/${id}`);
            const name = (data as any)?.name ?? '(без имени)';
            setLookupName(`${name}`);
        } catch {
            setLookupName('Колонка не найдена');
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Добавить элемент Combobox</DialogTitle>
            <DialogContent dividers>

                {/* combobox_column_id: Select со всеми колонками, либо TextField с lookup при ошибке */}
                {!colsError ? (
                    <>


                        <FormControl fullWidth size="small" margin="dense">
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
                                ) : (
                                    filteredCols.map(opt => (
                                        <MenuItem key={opt.id} value={opt.id}>
                                            #{opt.id} · {opt.table_name} · {opt.name}
                                        </MenuItem>
                                    ))
                                )}
                            </Select
                                >
                            <FormHelperText>Выберите колонку из всех таблиц</FormHelperText>
                        </FormControl>
                    </>
                ) : (
                    <>
                        <FormControl fullWidth margin="dense">
                            <TextField
                                type="number"
                                label="combobox_column_id"
                                size="small"
                                value={value.combobox_column_id ?? ''}
                                onChange={e => {
                                    const n = parseInt(e.target.value, 10);
                                    onChange({ combobox_column_id: Number.isFinite(n) ? n : null });
                                }}
                                required
                                helperText={colsError}
                            />
                        </FormControl>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Button onClick={handleLookup} variant="outlined" size="small">
                                Проверить имя по ID
                            </Button>
                            {lookupName && (
                                <FormHelperText sx={{ m: 0 }}>Колонка: {lookupName}</FormHelperText>
                            )}
                        </div>
                    </>
                )}

                {/* Остальные поля */}
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
