// components/modals/ModalEditTableMeta.tsx
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Stack, ThemeProvider, Tooltip
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useEffect, useMemo, useState } from 'react';
import { DTable, Column } from "@/shared/hooks/useWorkSpaces";
import { dark } from "@/shared/themeUI/themeModal/ThemeModalUI";
import { generateTableSql, extractTableNameFromSelect } from '@/shared/utils/generateTableSql';

type Props = {
    open: boolean;
    table: DTable;
    columns: Column[];
    onClose: () => void;
    onSave: (patch: Partial<DTable>) => Promise<void>;
};

const isBlank = (v: unknown) => typeof v !== 'string' || v.trim() === '';

export const ModalEditTableMeta = ({ open, table, columns, onClose, onSave }: Props) => {
    const [draft, setDraft] = useState<Partial<DTable>>(table);

    // важно: когда открыли модалку для другой таблицы — обновляем draft
    useEffect(() => {
        if (open) setDraft(table);
    }, [open, table]);

    const handleChange = (field: keyof DTable, value: string) => {
        setDraft(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        await onSave(draft);
        onClose();
    };

    // имя таблицы берём из SELECT (после FROM), fallback — table.name
    const resolvedTableName = useMemo(() => {
        const fromSelect = extractTableNameFromSelect(String(draft.select_query ?? ''));
        return fromSelect ?? table.name ?? '';
    }, [draft.select_query, table.name]);

    const handleGenerateSql = () => {
        if (columns.length === 0) {
            alert('Нет колонок для генерации SQL');
            return;
        }

        if (!resolvedTableName.trim()) {
            alert('Не удалось определить имя таблицы из SELECT (нет FROM ...).');
            return;
        }

        const generated = generateTableSql(resolvedTableName, columns);

        // ✅ заполняем только пустые поля, заполненные не трогаем
        setDraft(prev => {
            const next: Partial<DTable> = { ...prev };

            if (isBlank(prev.select_query)) next.select_query = generated.select_query;
            if (isBlank(prev.insert_query)) next.insert_query = generated.insert_query;
            if (isBlank(prev.update_query)) next.update_query = generated.update_query;
            if (isBlank(prev.delete_query)) next.delete_query = generated.delete_query;

            return next;
        });
    };

    const hasAnyBlankQueries = useMemo(() => {
        return (
            isBlank(draft.select_query) ||
            isBlank(draft.insert_query) ||
            isBlank(draft.update_query) ||
            isBlank(draft.delete_query)
        );
    }, [draft.select_query, draft.insert_query, draft.update_query, draft.delete_query]);

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
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Редактировать метаданные таблицы</span>

                    <Tooltip title={hasAnyBlankQueries ? "Заполнить пустые SQL автоматически" : "Все SQL уже заполнены"}>
            <span>
              <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AutoFixHighIcon />}
                  onClick={handleGenerateSql}
                  disabled={columns.length === 0 || !hasAnyBlankQueries}
                  sx={{
                      borderColor: '#666',
                      color: '#8ac7ff',
                      '&:hover': {
                          borderColor: '#8ac7ff',
                          backgroundColor: 'rgba(138, 199, 255, 0.1)',
                      },
                  }}
              >
                Сгенерировать SQL
              </Button>
            </span>
                    </Tooltip>
                </DialogTitle>

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
