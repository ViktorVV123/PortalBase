/* ModalAddTable.tsx */
import { ChangeEvent, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Stack, CircularProgress, Box,
} from '@mui/material';

import { api } from '@/services/api';
import { WorkSpaceTypes } from '@/types/typesWorkSpaces';
import { DTable } from "@/shared/hooks/useWorkSpaces";

type Props = {
    open: boolean;
    workspace: WorkSpaceTypes;
    onSuccess: (table: DTable) => void;
    onCancel: () => void;
};

// ═══════════════════════════════════════════════════════════
// Парсинг ошибки из бэкенда + перевод на русский
// ═══════════════════════════════════════════════════════════

/** Переводим типичные Postgres / бэкенд ошибки на понятный язык */
function humanizeError(raw: string): string {
    const s = raw.split('\n')[0].trim(); // берём только первую строку

    if (/can'?t execute an empty query/i.test(s))
        return 'Запрос пустой — введите SQL-выражение';

    if (/syntax error at or near/i.test(s)) {
        const m = s.match(/near\s+"([^"]+)"/i);
        return m ? `Синтаксическая ошибка рядом с «${m[1]}»` : 'Синтаксическая ошибка в запросе';
    }

    if (/relation "([^"]+)" does not exist/i.test(s)) {
        const m = s.match(/relation "([^"]+)"/i);
        return m ? `Таблица «${m[1]}» не найдена` : 'Указанная таблица не найдена';
    }

    if (/column "([^"]+)" does not exist/i.test(s)) {
        const m = s.match(/column "([^"]+)"/i);
        return m ? `Колонка «${m[1]}» не найдена` : 'Указанная колонка не найдена';
    }

    if (/permission denied/i.test(s))
        return 'Недостаточно прав для выполнения запроса';

    if (/unterminated quoted string/i.test(s))
        return 'Незакрытая кавычка в запросе';

    if (/division by zero/i.test(s))
        return 'Деление на ноль в запросе';

    if (/duplicate key/i.test(s))
        return 'Запись с таким ключом уже существует';

    if (/connection refused|could not connect/i.test(s))
        return 'Не удалось подключиться к базе данных';

    // Если ничего не распознали — возвращаем первую строку как есть
    return s;
}

function parseApiError(err: unknown): string {
    const response = (err as any)?.response;
    const status = response?.status;
    const detail = response?.data?.detail;

    // detail — объект с error_msg (новый формат)
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
        const errorMsg = detail.error_msg as string | undefined;
        if (errorMsg) return humanizeError(errorMsg);
    }

    // detail — строка
    if (typeof detail === 'string') return detail;

    // Fallback по статусу
    if (status === 500) return 'Внутренняя ошибка сервера';
    if (status === 422) return 'Некорректные данные';
    if (status === 403) return 'Недостаточно прав';

    return 'Не удалось создать таблицу';
}

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

export const ModalAddTable = ({
                                  open, workspace, onSuccess, onCancel,
                              }: Props) => {
    const [form, setForm] = useState({
        name: '',
        description: '',
        select_query: '',
        insert_query: '',
        update_query: '',
        delete_query: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handle = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) {
            setError('Введите название таблицы');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const { data } = await api.post<DTable>('/tables/', {
                workspace_id: workspace.id,
                ...form,
            });
            onSuccess(data);
        } catch (err) {
            setError(parseApiError(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            fullWidth
            maxWidth="sm"
            PaperProps={{ sx: dialogPaperSx }}
        >
            <DialogTitle>Новая таблица в «{workspace.name}»</DialogTitle>

            <form onSubmit={submit}>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <TextField
                            label="Название"
                            name="name"
                            size="small"
                            fullWidth
                            value={form.name}
                            onChange={handle}
                            required
                            sx={textFieldSx}
                        />

                        <TextField
                            label="Описание"
                            name="description"
                            size="small"
                            fullWidth
                            value={form.description}
                            onChange={handle}
                            sx={textFieldSx}
                        />

                        <TextField
                            label="SELECT query"
                            name="select_query"
                            size="small"
                            fullWidth
                            multiline
                            rows={2}
                            value={form.select_query}
                            onChange={handle}
                            sx={textFieldSx}
                        />

                        <TextField
                            label="INSERT query"
                            name="insert_query"
                            size="small"
                            fullWidth
                            multiline
                            rows={2}
                            value={form.insert_query}
                            onChange={handle}
                            sx={textFieldSx}
                        />

                        <TextField
                            label="UPDATE query"
                            name="update_query"
                            size="small"
                            fullWidth
                            multiline
                            rows={2}
                            value={form.update_query}
                            onChange={handle}
                            sx={textFieldSx}
                        />

                        <TextField
                            label="DELETE query"
                            name="delete_query"
                            size="small"
                            fullWidth
                            multiline
                            rows={2}
                            value={form.delete_query}
                            onChange={handle}
                            sx={textFieldSx}
                        />

                        {error && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    px: 1.5,
                                    py: 1,
                                    borderRadius: '6px',
                                    fontSize: '0.82rem',
                                    backgroundColor: 'color-mix(in srgb, var(--theme-error) 10%, transparent)',
                                    color: 'var(--theme-error)',
                                    border: '1px solid color-mix(in srgb, var(--theme-error) 25%, transparent)',
                                }}
                            >
                                <span style={{ flexShrink: 0 }}>⚠</span>
                                <span>{error}</span>
                            </Box>
                        )}
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ pr: 3, pb: 2 }}>
                    <Button
                        onClick={onCancel}
                        sx={{ color: 'var(--theme-text-secondary)' }}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        type="submit"
                        disabled={loading || !form.name.trim()}
                        startIcon={loading && <CircularProgress size={16} />}
                        sx={{
                            backgroundColor: 'var(--button-primary-bg)',
                            color: 'var(--button-primary-text)',
                            '&:hover': {
                                backgroundColor: 'var(--button-primary-hover)',
                            },
                            '&.Mui-disabled': {
                                backgroundColor: 'var(--checkbox-disabled)',
                            },
                        }}
                    >
                        {loading ? 'Создаю…' : 'Создать'}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};
