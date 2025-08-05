// components/WidgetColumnsOfTable/WidgetColumnsOfTable.tsx
import React, { useCallback, useEffect, useState } from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {
    Column,
    Widget,
    WidgetColumn,
} from '@/shared/hooks/useWorkSpaces';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import ConColumnIcon from '@/assets/image/ConColumnIcon.svg';
import Editicon from '@/assets/image/EditIcon.svg';

import { api } from '@/services/api';
import { TableColumn } from '@/components/tableColumn/TableColumn';

import {
    Box,
    Button,
    createTheme,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Modal,
    Stack,
    TextField,
    ThemeProvider,
    Typography,
} from '@mui/material';

type WcReference = WidgetColumn['reference'][number];

interface Props {
    updateWidgetColumn: (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => void;
    widgetColumns: WidgetColumn[];
    selectedWidget: Widget | null;
    loadColumnsWidget: (widgetId: number) => void;
    addReference: (
        widgetColId: number,
        tblColId: number,
        payload: { width: number; visible: boolean; primary: boolean }
    ) => Promise<void>;
    deleteColumnWidget: (id: number) => void;
    columns: Column[];
    updateTableColumn: (id: number, p: Partial<Omit<Column, 'id'>>) => void;
    deleteColumnTable: (id: number) => void;
    setSelectedWidget: React.Dispatch<React.SetStateAction<Widget | null>>;
    setWidgetsByTable: React.Dispatch<
        React.SetStateAction<Record<number, Widget[]>>
    >;
}

/* стили модалки */
const modalStyle = {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#1E1E1E',
    border: '1px solid #555',
    boxShadow: 24,
    maxHeight: '80vh',
    overflowY: 'auto',
    width: '90vw',
    padding: '20px',
    color: 'white',
};

/* тёмная тема для MUI-диалога */
const dark = createTheme({
    palette: { mode: 'dark', primary: { main: '#ffffff' } },
    components: {
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#ffffff',
                    },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: { '&.Mui-focused': { color: '#ffffff' } },
            },
        },
        MuiSelect: { styleOverrides: { icon: { color: '#ffffff' } } },
    },
});

export const WidgetColumnsOfTable: React.FC<Props> = ({
                                                          updateWidgetColumn,
                                                          widgetColumns,
                                                          selectedWidget,
                                                          loadColumnsWidget,
                                                          addReference,
                                                          deleteColumnWidget,
                                                          columns,
                                                          updateTableColumn,
                                                          deleteColumnTable,
                                                          setSelectedWidget,
                                                          setWidgetsByTable,
                                                      }) => {
    /* ───────────── reference cache ───────────── */
    const [referencesMap, setReferencesMap] = useState<
        Record<number, WcReference[]>
    >({});

    const fetchReferences = useCallback(async (wcId: number) => {
        const { data } = await api.get<WcReference[]>(
            `/widgets/tables/references/${wcId}`
        );
        return data;
    }, []);

    useEffect(() => {
        if (!widgetColumns.length) return;

        const loadAll = async () => {
            const map: Record<number, WcReference[]> = {};
            await Promise.all(
                widgetColumns.map(async (wc) => {
                    try {
                        map[wc.id] = await fetchReferences(wc.id);
                    } catch (e) {
                        console.warn(`reference load error (wc ${wc.id})`, e);
                        map[wc.id] = [];
                    }
                })
            );
            setReferencesMap(map);
        };

        loadAll();
    }, [widgetColumns, fetchReferences]);

    /* ───────────── state для редактирования WC ───────────── */
    const [editingWcId, setEditingWcId] = useState<number | null>(null);
    const [wcValues, setWcValues] = useState<Partial<WidgetColumn>>({});
    const startEdit = (wc: WidgetColumn) => {
        setEditingWcId(wc.id);
        setWcValues({
            alias: wc.alias ?? '',
            default: wc.default ?? '',
            placeholder: wc.placeholder ?? '',
            published: wc.published,
            type: wc.type,
        });
    };
    const cancelEdit = () => {
        setEditingWcId(null);
        setWcValues({});
    };
    const saveEdit = async () => {
        if (editingWcId == null) return;
        await updateWidgetColumn(editingWcId, wcValues);
        if (selectedWidget) await loadColumnsWidget(selectedWidget.id);
        cancelEdit();
    };

    /* ───────────── модалки ───────────── */
    const [modalOpen, setModalOpen] = useState(false);
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);

    const [widgetMeta, setWidgetMeta] = useState<Partial<Widget>>({
        name: selectedWidget?.name ?? '',
        description: selectedWidget?.description ?? '',
        table_id: selectedWidget?.table_id ?? 0,
    });

    const saveWidgetMeta = useCallback(async () => {
        if (!selectedWidget) return;

        try {
            await api.patch(`/widgets/${selectedWidget.id}`, {
                name: widgetMeta.name,
                description: widgetMeta.description,
                table_id: widgetMeta.table_id,
            });

            const { data: upd } = await api.get<Widget>(
                `/widgets/${selectedWidget.id}`
            );
            setSelectedWidget(upd);

            setWidgetsByTable((prev) => {
                const tblId = upd.table_id;
                const updated = (prev[tblId] ?? []).map((w) =>
                    w.id === upd.id ? upd : w
                );
                return { ...prev, [tblId]: updated };
            });

            await loadColumnsWidget(upd.id);
            setWidgetModalOpen(false);
        } catch (e) {
            console.warn('❌ Ошибка при сохранении метаданных виджета:', e);
        }
    }, [
        selectedWidget,
        widgetMeta,
        loadColumnsWidget,
        setWidgetsByTable,
        setSelectedWidget,
    ]);


    // сразу после saveEdit()
    const handleMerge = async (wcId: number) => {
        if (!selectedWidget) return;

        const input = prompt('Введите *имя* столбца (name), который нужно привязать:');
        if (!input) return;

        const found = columns.find((c) => c.name === input.trim());
        if (!found) {
            alert(`Столбец "${input}" не найден`);
            return;
        }

        try {
            await addReference(wcId, found.id, {
                width: 33,
                visible: false,
                primary: false,
            });
            await loadColumnsWidget(selectedWidget.id); // обновим reference
        } catch (e) {
            alert('Не удалось добавить reference');
            console.error(e);
        }
    };

    /** удалить один reference и обновить таблицы */
    const handleDeleteReference = async (wcId: number, tblColId: number) => {
        if (!selectedWidget) return;
        if (!confirm('Удалить связь столбца?')) return;

        try {
            await api.delete(
                `/widgets/tables/references/${wcId}/${tblColId}`
            );

            /* 1) локально убираем из карты */
            setReferencesMap(prev => ({
                ...prev,
                [wcId]: (prev[wcId] ?? []).filter(r => r.table_column.id !== tblColId)
            }));

            /* 2) чтобы агрегаты в первой таблице обновились — перезагрузим столбцы */
            await loadColumnsWidget(selectedWidget.id);

        } catch (e) {
            console.warn('❌ не удалось удалить reference', e);
            alert('Ошибка при удалении');
        }
    };

    /* ─────────────────────────── UI ─────────────────────────── */
    return (
        <div className={s.tableWrapperWidget}>
            {/* Верхние ссылки-триггеры */}
            <div style={{display: 'flex', gap: 24}}>
                <Typography
                    variant="h6"
                    onClick={() => setModalOpen(true)}
                    gutterBottom
                    sx={{
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        color: '#8ac7ff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                    }}
                >
                    Посмотреть таблицу
                    <Editicon/>
                </Typography>

                <Typography
                    variant="h6"
                    onClick={() => setWidgetModalOpen(true)}
                    gutterBottom
                    sx={{
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        color: '#8ac7ff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                    }}
                >
                    Метаданные widget
                    <Editicon/>
                </Typography>
            </div>

            {/* ───────── 1. Старая таблица ───────── */}
            <table className={s.tbl}>
                <thead>
                <tr>
                    <th>id</th>
                    <th>id widget</th>
                    <th>alias</th>
                    <th>default</th>
                    <th>placeholder</th>
                    <th>published</th>
                    <th>type</th>
                    <th>id</th>
                    <th>id table</th>
                    <th>name</th>
                    <th>datatype</th>
                    <th>length</th>
                    <th>precision</th>
                    <th>primary</th>
                    <th>required</th>
                    <th></th>
                </tr>
                </thead>

                <tbody>
                {widgetColumns.map((wc) => {
                    const isEd = editingWcId === wc.id;

                    /* агрегаты по reference */
                    const agg = (k: keyof Column) =>
                        wc.reference.map((r) => r.table_column?.[k] ?? '—').join(', ');
                    const refAgg = (k: 'primary' | 'visible') =>
                        wc.reference.map((r) => (r[k] ? '✔︎' : '')).join(', ');

                    return (
                        <tr key={wc.id}>
                            <td>{wc.id}</td>
                            <td>{wc.widget_id}</td>

                            {/* alias */}
                            <td>
                                {isEd ? (
                                    <input
                                        className={s.inp}
                                        value={wcValues.alias ?? ''}
                                        onChange={(e) =>
                                            setWcValues((v) => ({...v, alias: e.target.value}))
                                        }
                                    />
                                ) : (
                                    wc.alias ?? '—'
                                )}
                            </td>

                            {/* default */}
                            <td>
                                {isEd ? (
                                    <input
                                        className={s.inp}
                                        value={wcValues.default ?? ''}
                                        onChange={(e) =>
                                            setWcValues((v) => ({...v, default: e.target.value}))
                                        }
                                    />
                                ) : (
                                    wc.default ?? '—'
                                )}
                            </td>

                            {/* placeholder */}
                            <td>
                                {isEd ? (
                                    <input
                                        className={s.inp}
                                        value={wcValues.placeholder ?? ''}
                                        onChange={(e) =>
                                            setWcValues((v) => ({...v, placeholder: e.target.value}))
                                        }
                                    />
                                ) : (
                                    wc.placeholder ?? '—'
                                )}
                            </td>

                            {/* published */}
                            <td style={{textAlign: 'center'}}>
                                {isEd ? (
                                    <input
                                        type="checkbox"
                                        checked={wcValues.published ?? false}
                                        onChange={(e) =>
                                            setWcValues((v) => ({...v, published: e.target.checked}))
                                        }
                                    />
                                ) : wc.published ? (
                                    '✔︎'
                                ) : (
                                    ''
                                )}
                            </td>

                            {/* type */}
                            <td>
                                {isEd ? (
                                    <input
                                        className={s.inp}
                                        value={wcValues.type ?? ''}
                                        onChange={(e) =>
                                            setWcValues((v) => ({...v, type: e.target.value}))
                                        }
                                    />
                                ) : (
                                    wc.type ?? '—'
                                )}
                            </td>

                            {/* агрегированные reference-поля */}
                            <td>{agg('id')}</td>
                            <td>{agg('table_id')}</td>
                            <td>{agg('name')}</td>
                            <td>{agg('datatype')}</td>
                            <td>{agg('length')}</td>
                            <td>{agg('precision')}</td>
                            <td>{refAgg('primary')}</td>
                            <td>{agg('required')}</td>

                            {/* actions */}
                            <td className={s.actionsCell}>
                                {isEd ? (
                                    <>
                                        <button className={s.okBtn} onClick={saveEdit}>
                                            ✓
                                        </button>
                                        <button className={s.cancelBtn} onClick={cancelEdit}>
                                            ✕
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <ConColumnIcon
                                            className={s.actionIcon}
                                            onClick={() => handleMerge(wc.id)}
                                        />
                                        <EditIcon
                                            className={s.actionIcon}
                                            onClick={() => startEdit(wc)}
                                        />
                                        <DeleteIcon
                                            className={s.actionIcon}
                                            onClick={() =>
                                                confirm('Удалить?') && deleteColumnWidget(wc.id)
                                            }
                                        />
                                    </>
                                )}
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </table>

            {/* ───────── 2. Reference-таблицы ───────── */}
            <h3 style={{margin: '24px 0 8px'}}>References</h3>
            <Typography
                variant="h6"
                gutterBottom
                onClick={() => {}}      // 👈
                sx={{
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    color: '#8ac7ff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    width: '15%',
                }}
            >
                Добавить
                <Editicon />
            </Typography>

            {widgetColumns.map((wc) => {
                const refs = referencesMap[wc.id] ?? [];
                return (
                    <div key={`ref-${wc.id}`} style={{marginBottom: 24}}>
                        <h4 style={{marginBottom: 6}}>WidgetColumn&nbsp;{wc.id}</h4>
                        {refs.length ? (
                            <table className={s.tbl}>
                                <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Datatype</th>
                                    <th>Width</th>
                                    <th>Visible</th>
                                    <th>Primary</th>
                                    <th></th>
                                </tr>
                                </thead>
                                <tbody>
                                {refs.map((r, i) => (
                                    <tr key={i}>
                                        <td>{r.table_column.name}</td>
                                        <td>{r.table_column.datatype}</td>
                                        <td>{r.width}</td>
                                        <td style={{textAlign: 'center'}}>
                                            {r.visible ? '✔' : ''}
                                        </td>
                                        <td style={{textAlign: 'center'}}>
                                            {r.primary ? '✔' : ''}
                                        </td>
                                        <td style={{textAlign: 'center'}}>
                                            <Editicon/>
                                            <DeleteIcon
                                                className={s.actionIcon}
                                                onClick={() =>
                                                    handleDeleteReference(wc.id, r.table_column.id)
                                                }/>
                                        </td>

                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        ) : (
                            <p style={{fontStyle: 'italic', color: '#777'}}>
                                reference не найдены
                            </p>
                        )}
                    </div>
                );
            })}

            {/* ───────── Modal “Посмотреть таблицу” ───────── */}
            <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
                <Box sx={modalStyle}>
                    <h3 style={{marginBottom: 15}}>Таблица</h3>
                    {columns.length ? (
                        <TableColumn
                            columns={columns}
                            updateTableColumn={updateTableColumn}
                            deleteColumnTable={deleteColumnTable}
                        />
                    ) : (
                        <p>Нет данных для отображения</p>
                    )}
                </Box>
            </Modal>

            {/* ───────── Dialog “Метаданные widget” ───────── */}
            <ThemeProvider theme={dark}>
                <Dialog
                    open={widgetModalOpen}
                    onClose={() => setWidgetModalOpen(false)}
                    fullWidth
                    maxWidth="sm"
                >
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            saveWidgetMeta();
                        }}
                    >
                        <DialogTitle>Редактирование виджета</DialogTitle>
                        <DialogContent dividers>
                            <Stack spacing={2}>
                                <TextField
                                    label="Название"
                                    size="small"
                                    fullWidth
                                    value={widgetMeta.name}
                                    onChange={(e) =>
                                        setWidgetMeta((v) => ({...v, name: e.target.value}))
                                    }
                                    required
                                />
                                <TextField
                                    label="Описание"
                                    size="small"
                                    fullWidth
                                    multiline
                                    rows={3}
                                    value={widgetMeta.description}
                                    onChange={(e) =>
                                        setWidgetMeta((v) => ({
                                            ...v,
                                            description: e.target.value,
                                        }))
                                    }
                                />
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{pr: 3, pb: 2}}>
                            <Button onClick={() => setWidgetModalOpen(false)}>Отмена</Button>
                            <Button type="submit" variant="contained">
                                Сохранить
                            </Button>
                        </DialogActions>
                    </form>
                </Dialog>
            </ThemeProvider>
        </div>
    );
};
