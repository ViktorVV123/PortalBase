// components/modals/editWorkspaceModal/EditWorkspaceModal.tsx
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Stack,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import { Connection } from "@/shared/hooks/stores";

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

const selectSx = {
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
    '& .MuiSelect-icon': {
        color: 'var(--icon-primary)',
    },
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
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            PaperProps={{ sx: dialogPaperSx }}
        >
            <DialogTitle>Редактировать workspace</DialogTitle>
            <DialogContent>
                <Stack spacing={2} mt={1}>
                    <TextField
                        fullWidth
                        margin="dense"
                        label="Название"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        sx={textFieldSx}
                    />
                    <TextField
                        fullWidth
                        margin="dense"
                        label="Описание"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        sx={textFieldSx}
                    />
                    <TextField
                        fullWidth
                        margin="dense"
                        label="Группа"
                        value={group}
                        onChange={(e) => setGroup(e.target.value)}
                        sx={textFieldSx}
                    />

                    <FormControl fullWidth margin="dense" size="small">
                        <InputLabel
                            id="workspace-connection-select-label"
                            sx={{
                                color: 'var(--theme-text-secondary)',
                                '&.Mui-focused': { color: 'var(--theme-primary)' },
                            }}
                        >
                            Подключение
                        </InputLabel>
                        <Select
                            labelId="workspace-connection-select-label"
                            label="Подключение"
                            value={selectedConnectionId}
                            onChange={(e) => setSelectedConnectionId(e.target.value as string)}
                            sx={selectSx}
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
                            sx={{
                                mt: 1,
                                alignSelf: 'flex-start',
                                color: 'var(--theme-primary)',
                                borderColor: 'var(--theme-primary)',
                                '&:hover': {
                                    borderColor: 'var(--theme-primary)',
                                    backgroundColor: 'var(--theme-hover)',
                                },
                            }}
                            onClick={handleEditConnectionClick}
                            disabled={selectedConnectionId === ''}
                        >
                            Изменить настройки подключения
                        </Button>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={onClose}
                    sx={{ color: 'var(--theme-text-secondary)' }}
                >
                    Отмена
                </Button>
                <Button
                    onClick={handleSubmit}
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
        </Dialog>
    );
};