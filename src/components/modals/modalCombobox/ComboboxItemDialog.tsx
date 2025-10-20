import React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, FormControlLabel, Checkbox, Stack
} from '@mui/material';

type Props = {
    open: boolean;
    value: {
        combobox_width: number;
        combobox_column_order: number;
        combobox_alias: string;
        is_primary: boolean;
        is_show: boolean;
        is_show_hidden: boolean;
    };
    onChange: (patch: Partial<Props['value']>) => void;
    onClose: () => void;
    onSave: () => void;
    saving?: boolean;
};

export const ComboboxItemDialog: React.FC<Props> = ({
                                                        open, value, onChange, onClose, onSave, saving
                                                    }) => {
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
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={!!saving}>Отмена</Button>
                <Button
                    type="button"
                    onClick={onSave}
                    disabled={!!saving}
                    variant="contained"
                >
                    {saving ? 'Сохр...' : 'Сохранить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
