// components/modals/EditWorkspaceModal.tsx
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField, createTheme, ThemeProvider
} from '@mui/material';

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (form: { name: string; description: string }) => void;
    defaultName: string;
    defaultDescription: string;
};

/* ── dark + белый фокус ── */
const dark = createTheme({
    palette:{ mode:'dark', primary:{ main:'#ffffff' } },
    components:{
        MuiOutlinedInput:{ styleOverrides:{ root:{
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline':{ borderColor:'#ffffff' }
                }}},
        MuiInputLabel:{ styleOverrides:{ root:{
                    '&.Mui-focused':{ color:'#ffffff' }
                }}},
    },
});

export const EditWorkspaceModal: React.FC<Props> = ({
                                                        open,
                                                        onClose,
                                                        onSubmit,
                                                        defaultName,
                                                        defaultDescription
                                                    }) => {
    const [name, setName] = useState(defaultName);
    const [description, setDescription] = useState(defaultDescription);

    useEffect(() => {
        if (open) {
            setName(defaultName);
            setDescription(defaultDescription);
        }
    }, [open, defaultName, defaultDescription]);

    return (
        <ThemeProvider theme={dark}>
        <Dialog open={open} onClose={onClose} fullWidth>
            <DialogTitle>Редактировать workspace</DialogTitle>
            <DialogContent>
                <TextField
                    fullWidth
                    margin="dense"
                    label="Название"
                    value={name}
                    onChange={e => setName(e.target.value)}
                />
                <TextField
                    fullWidth
                    margin="dense"
                    label="Описание"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Отмена</Button>
                <Button onClick={() => onSubmit({ name, description })} variant="contained">Сохранить</Button>
            </DialogActions>
        </Dialog>
        </ThemeProvider>
    );
};
