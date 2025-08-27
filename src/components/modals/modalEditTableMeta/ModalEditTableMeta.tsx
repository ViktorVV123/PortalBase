// components/modals/ModalEditTableMeta.tsx
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Stack, ThemeProvider, CssBaseline, createTheme
} from '@mui/material';
import { useState } from 'react';
import { DTable } from "@/shared/hooks/useWorkSpaces";
import {dark} from "@/shared/themeUI/themeModal/ThemeModalUI";


type Props = {
    open: boolean;
    table: DTable;
    onClose: () => void;
    onSave: (patch: Partial<DTable>) => Promise<void>;
};

export const ModalEditTableMeta = ({ open, table, onClose, onSave }: Props) => {
    const [draft, setDraft] = useState<Partial<DTable>>(table);

    const handleChange = (field: keyof DTable, value: string) => {
        setDraft(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        await onSave(draft);
        onClose();
    };

    return (
        <ThemeProvider theme={dark}>

            <Dialog
                open={open}
                onClose={onClose}
                fullWidth
                maxWidth="md"
                scroll="paper"
                disableScrollLock
            >

            <DialogTitle>Редактировать метаданные таблицы </DialogTitle>

                <DialogContent dividers>
                    <Stack spacing={2} mt={1}>
                        <TextField
                            label="Название"
                            fullWidth
                            value={draft.name ?? ''}
                            onChange={e => handleChange('name', e.target.value)}
                        />
                        <TextField
                            label="Описание"
                            fullWidth
                            value={draft.description ?? ''}
                            onChange={e => handleChange('description', e.target.value)}
                        />
                        <TextField
                            label="SELECT"
                            multiline
                            minRows={3}
                            fullWidth
                            value={draft.select_query ?? ''}
                            onChange={e => handleChange('select_query', e.target.value)}
                        />
                        <TextField
                            label="INSERT"
                            multiline
                            minRows={3}
                            fullWidth
                            value={draft.insert_query ?? ''}
                            onChange={e => handleChange('insert_query', e.target.value)}
                        />
                        <TextField
                            label="UPDATE"
                            multiline
                            minRows={3}
                            fullWidth
                            value={draft.update_query ?? ''}
                            onChange={e => handleChange('update_query', e.target.value)}
                        />
                        <TextField
                            label="DELETE"
                            multiline
                            minRows={3}
                            fullWidth
                            value={draft.delete_query ?? ''}
                            onChange={e => handleChange('delete_query', e.target.value)}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ pr: 3, pb: 2 }}>
                    <Button onClick={onClose}>Отмена</Button>
                    <Button variant="contained" onClick={handleSubmit}>
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>
        </ThemeProvider>
    );
};
