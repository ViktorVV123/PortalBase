// components/modals/editWorkspaceModal/EditWorkspaceModal.tsx
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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import { dark } from '@/shared/themeUI/themeModal/ThemeModalUI';
import type { Connection } from '@/types/typesConnection';

type FormState = {
    name: string;
    description: string;
    group: string;
    connection_id: number | null;
};

type Props = {
    open: boolean;
    onClose: () => void;

    onSubmit: (form: FormState) => void;

    defaultName: string;
    defaultDescription: string;
    defaultGroup: string;

    connections: Connection[];
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
                                                        connections,
                                                        connectionId,
                                                        onEditConnection,
                                                    }) => {
    const [name, setName] = useState(defaultName);
    const [description, setDescription] = useState(defaultDescription);
    const [group, setGroup] = useState(defaultGroup);

    // 👇 Храним id подключения как СТРОКУ (Select работает со строками)
    const [selectedConnectionId, setSelectedConnectionId] = useState<string>(
        connectionId != null ? String(connectionId) : ''
    );

    useEffect(() => {
        if (open) {
            setName(defaultName);
            setDescription(defaultDescription);
            setGroup(defaultGroup);
            setSelectedConnectionId(
                connectionId != null ? String(connectionId) : ''
            );
        }
    }, [open, defaultName, defaultDescription, defaultGroup, connectionId]);

    const handleSubmit = () => {
        onSubmit({
            name,
            description,
            group,
            connection_id:
                selectedConnectionId === '' ? null : Number(selectedConnectionId),
        });
    };

    const handleEditConnectionClick = () => {
        if (!onEditConnection) return;
        if (selectedConnectionId === '') return;

        onEditConnection(Number(selectedConnectionId));
    };

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
                            onChange={(e) => setName(e.target.value)}
                        />
                        <TextField
                            fullWidth
                            margin="dense"
                            label="Описание"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <TextField
                            fullWidth
                            margin="dense"
                            label="Группа"
                            value={group}
                            onChange={(e) => setGroup(e.target.value)}
                        />

                        <FormControl fullWidth margin="dense" size="small">
                            <InputLabel id="workspace-connection-select-label">
                                Подключение
                            </InputLabel>
                            <Select
                                labelId="workspace-connection-select-label"
                                label="Подключение"
                                value={selectedConnectionId}
                                onChange={(e) => {
                                    const v = e.target.value as string; // ← строка
                                    setSelectedConnectionId(v);
                                }}
                            >
                                <MenuItem value="">
                                    <em>Без подключения</em>
                                </MenuItem>
                                {connections.map((conn) => (
                                    <MenuItem key={conn.id} value={String(conn.id)}>
                                        {conn.name ?? `Подключение #${conn.id}`}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {onEditConnection && (
                            <Button
                                variant="outlined"
                                size="small"
                                sx={{ mt: 1, alignSelf: 'flex-start' }}
                                onClick={handleEditConnectionClick}
                                disabled={selectedConnectionId === ''}
                            >
                                Изменить настройки подключения
                            </Button>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Отмена</Button>
                    <Button onClick={handleSubmit} variant="contained">
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>
        </ThemeProvider>
    );
};
