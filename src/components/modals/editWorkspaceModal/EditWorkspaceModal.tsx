// components/modals/EditWorkspaceModal.tsx
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    ThemeProvider,
    Stack,
} from '@mui/material';
import { dark } from "@/shared/themeUI/themeModal/ThemeModalUI";

type Props = {
    open: boolean;
    onClose: () => void;
    onSubmit: (form: { name: string; description: string; group: string }) => void;
    defaultName: string;
    defaultDescription: string;
    defaultGroup: string;

    // 👇 НОВОЕ
    connectionId?: number | null;
    onEditConnection?: (connectionId: number) => void;
};

export const EditWorkspaceModal: React.FC<Props> = ({
                                                        open,
                                                        onClose,
                                                        onSubmit,
                                                        defaultName,
                                                        defaultDescription,
                                                        defaultGroup,
                                                        connectionId,
                                                        onEditConnection,
                                                    }) => {
    const [name, setName] = useState(defaultName);
    const [description, setDescription] = useState(defaultDescription);
    const [group, setGroup] = useState(defaultGroup);

    useEffect(() => {
        if (open) {
            setName(defaultName);
            setDescription(defaultDescription);
            setGroup(defaultGroup);
        }
    }, [open, defaultName, defaultDescription, defaultGroup]);

    return (
        <ThemeProvider theme={dark}>
            <Dialog open={open} onClose={onClose} fullWidth>
                <DialogTitle>Редактировать workspace</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} mt={1}>
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
                        <TextField
                            fullWidth
                            margin="dense"
                            label="Группы"
                            value={group}
                            onChange={e => setGroup(e.target.value)}
                        />

                        {/* 👇 Кнопка для открытия ModalEditConnection */}
                        {connectionId != null && onEditConnection && (
                            <Button
                                variant="outlined"
                                size="small"
                                sx={{ mt: 2, alignSelf: 'flex-start' }}
                                onClick={() => onEditConnection(connectionId)}
                            >
                                Изменить подключение
                            </Button>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Отмена</Button>
                    <Button
                        onClick={() => onSubmit({ name, description, group })}
                        variant="contained"
                    >
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>
        </ThemeProvider>
    );
};
