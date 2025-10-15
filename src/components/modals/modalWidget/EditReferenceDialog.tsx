import React from 'react';
import {Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, FormControlLabel, Checkbox} from '@mui/material';

export type EditState = {
    open: boolean;
    wcId: number | null;
    tableColumnId: number | null;
    ref_alias: string;
    ref_type: string;
    ref_width: number;
    ref_order: number;
    ref_default: string;
    ref_placeholder: string;
    ref_visible: boolean;
    ref_readOnly: boolean;
};

type Props = {
    value: EditState;
    onChange: (patch: Partial<EditState>) => void;
    onClose: () => void;
    onSave: () => void;
};

export const EditReferenceDialog: React.FC<Props> = ({ value, onChange, onClose, onSave }) => (
    <Dialog open={value.open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Правка reference</DialogTitle>
        <DialogContent dividers>
            <Stack spacing={2}>
                <TextField label="ref_alias" size="small" value={value.ref_alias}
                           onChange={e => onChange({ref_alias: e.target.value})}/>
                <TextField label="type" size="small" value={value.ref_type}
                           onChange={e => onChange({ref_type: e.target.value})}/>
                <TextField type="number" label="width" size="small" value={value.ref_width}
                           onChange={e => onChange({ref_width: Number(e.target.value)})}/>
                <TextField label="default" size="small" value={value.ref_default}
                           onChange={e => onChange({ref_default: e.target.value})}/>
                <TextField label="placeholder" size="small" value={value.ref_placeholder}
                           onChange={e => onChange({ref_placeholder: e.target.value})}/>
                <FormControlLabel control={
                    <Checkbox checked={value.ref_visible}
                              onChange={e => onChange({ref_visible: e.target.checked})}/>
                } label="visible"/>
                <FormControlLabel control={
                    <Checkbox checked={value.ref_readOnly}
                              onChange={e => onChange({ref_readOnly: e.target.checked})}/>
                } label="только чтение"/>
                <TextField type="number" label="ref_column_order" size="small" value={value.ref_order}
                           onChange={e => onChange({ref_order: Number(e.target.value)})}/>
            </Stack>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Отмена</Button>
            <Button variant="contained" onClick={onSave}>Сохранить</Button>
        </DialogActions>
    </Dialog>
);
