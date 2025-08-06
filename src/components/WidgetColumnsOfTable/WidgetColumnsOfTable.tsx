import React, {useCallback, useEffect, useState} from 'react';
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

import {TableColumn} from '@/components/tableColumn/TableColumn';
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
import {WidgetColumnsMainTable} from "@/components/WidgetColumnsOfTable/WidgetColumnsMainTable";

/* ──────────── TYPES & THEME ──────────── */

export type WcReference = WidgetColumn['reference'][number];

interface Props {
    /* базовые CRUD по widget-columns */
    updateWidgetColumn: any
    deleteColumnWidget: (id: number) => void;

    /* данные для отображения */
    widgetColumns: WidgetColumn[];
    selectedWidget: Widget | null;
    columns: Column[];

    /* побочные действия */
    loadColumnsWidget: (widgetId: number) => void;
    addReference: (
        widgetColId: number,
        tblColId: number,
        payload: { width: number; combobox_visible: boolean; combobox_primary: boolean; ref_column_order: number }
    ) => Promise<void>;

    /* API-методы, перенесённые в useWorkSpaces */
    fetchReferences: (
        widgetColumnId: number
    ) => Promise<WidgetColumn['reference'][number][]>;
    deleteReference: (widgetColumnId: number, tableColumnId: number) => Promise<void>;
    updateWidgetMeta: (id: number, patch: Partial<Widget>) => Promise<Widget>;

    /* вспомогательные set-еры */
    updateTableColumn: (id: number, p: Partial<Omit<Column, 'id'>>) => void;
    deleteColumnTable: (id: number) => void;
    setSelectedWidget: React.Dispatch<React.SetStateAction<Widget | null>>;
    setWidgetsByTable: React.Dispatch<
        React.SetStateAction<Record<number, Widget[]>>
    >;
    addWidgetColumn: (payload: {
        widget_id: number;
        alias: string;
        default: string;
        placeholder: string;
        visible: boolean;
        type: string;
        column_order: number;
    }) => Promise<WidgetColumn>;
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
    palette: {mode: 'dark', primary: {main: '#ffffff'}},
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
            styleOverrides: {root: {'&.Mui-focused': {color: '#ffffff'}}},
        },
        MuiSelect: {styleOverrides: {icon: {color: '#ffffff'}}},
    },
});

/* ═════════════════ COMPONENT ════════════════ */

export const WidgetColumnsOfTable: React.FC<Props> = ({
                                                          /* crud */
                                                          updateWidgetColumn,
                                                          deleteColumnWidget,
                                                          /* data */
                                                          widgetColumns,
                                                          selectedWidget,
                                                          columns,
                                                          /* workspace-api */
                                                          loadColumnsWidget,
                                                          addReference,
                                                          fetchReferences,
                                                          deleteReference,
                                                          updateWidgetMeta,
                                                          /* helpers */
                                                          updateTableColumn,
                                                          deleteColumnTable,
                                                          setSelectedWidget,
                                                          setWidgetsByTable,
                                                          addWidgetColumn
                                                      }) => {
    /* ───── state: reference cache ───── */
    const [referencesMap, setReferencesMap] = useState<
        Record<number, WcReference[]>
    >({});

    const [addOpen, setAddOpen] = useState(false);
    const [newCol, setNewCol] = useState({
        alias: '',
        default: '',
        placeholder: '',
        visible: false,
        type: '',
        column_order: widgetColumns.length + 1, // по умолчанию самый конец
    });

    /* загрузка reference-ов */
    useEffect(() => {
        if (!widgetColumns.length) return;

        (async () => {
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
        })();
    }, [widgetColumns, fetchReferences]);

    /* ───── state: редактирование WC ───── */
    const [editingWcId, setEditingWcId] = useState<number | null>(null);
    const [wcValues, setWcValues] = useState<Partial<WidgetColumn>>({});

    const startEdit = (wc: WidgetColumn) => {
        setEditingWcId(wc.id);
        setWcValues({
            alias: wc.alias ?? '',
            default: wc.default ?? '',
            placeholder: wc.placeholder ?? '',
            visible: wc.visible,
            type: wc.type,
        });
    };

    const cancelEdit = () => {
        setEditingWcId(null);
        setWcValues({});
    };
    const saveEdit = async () => {
        if (editingWcId == null) return;

        /* берём текущие вводимые значения */
        const patch: Partial<WidgetColumn> = { ...wcValues };

        /* '' → null  (или можно удалить поле) */
        (['alias', 'default', 'placeholder'] as const).forEach(f => {
            if (patch[f] === '') patch[f] = null as any;   // или: delete patch[f];
        });

        await updateWidgetColumn(editingWcId, patch);
        if (selectedWidget) await loadColumnsWidget(selectedWidget.id);
        cancelEdit();
    };

    /* ───── state: модалки ───── */
    const [modalOpen, setModalOpen] = useState(false);
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);

    const [widgetMeta, setWidgetMeta] = useState<Partial<Widget>>({
        name: selectedWidget?.name ?? '',
        description: selectedWidget?.description ?? '',
        table_id: selectedWidget?.table_id ?? 0,
    });

    /* PATCH /widgets/:id */
    const saveWidgetMeta = useCallback(async () => {
        if (!selectedWidget) return;

        try {
            const upd = await updateWidgetMeta(selectedWidget.id, {
                name: widgetMeta.name,
                description: widgetMeta.description,
                table_id: widgetMeta.table_id,
            });

            setSelectedWidget(upd);

            setWidgetsByTable((prev) => {
                const tblId = upd.table_id;
                const updated = (prev[tblId] ?? []).map((w) =>
                    w.id === upd.id ? upd : w
                );
                return {...prev, [tblId]: updated};
            });

            await loadColumnsWidget(upd.id);
            setWidgetModalOpen(false);
        } catch (e) {
            console.warn('❌ Ошибка при сохранении метаданных виджета:', e);
        }
    }, [
        selectedWidget,
        widgetMeta,
        updateWidgetMeta,
        loadColumnsWidget,
        setWidgetsByTable,
        setSelectedWidget,
    ]);

    /* ───── merge column → reference ───── */
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
                width: 1,
                ref_column_order: 0,
                combobox_visible: false,
                combobox_primary: false,
            });
            await loadColumnsWidget(selectedWidget.id);
        } catch (e) {
            alert('Не удалось добавить reference');
            console.error(e);
        }
    };

    /* ───── delete reference ───── */
    const handleDeleteReference = async (wcId: number, tblColId: number) => {
        if (!selectedWidget) return;
        if (!confirm('Удалить связь столбца?')) return;

        try {
            await deleteReference(wcId, tblColId);

            /* локально убираем из кэша */
            setReferencesMap((prev) => ({
                ...prev,
                [wcId]: (prev[wcId] ?? []).filter(
                    (r) => r.table_column.id !== tblColId
                ),
            }));

            /* перезагружаем столбцы для агрегатов */
            await loadColumnsWidget(selectedWidget.id);
        } catch (e) {
            console.warn('❌ не удалось удалить reference', e);
            alert('Ошибка при удалении');
        }
    };

    /* ─────────────────────────── UI ─────────────────────────── */
    return (
        <div className={s.tableWrapperWidget}>
            {/* ───── верхние ссылки ───── */}
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

                <Typography
                    variant="h6"
                    onClick={() => setAddOpen(true)}
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
                    Добавить столбец
                    <Editicon/>
                </Typography>
            </div>

            {/* ───── таблица Widget-columns ───── */}
            <table className={s.tbl}>
                <thead>
                <tr>
                    <th>id</th>
                    <th>id widget</th>
                    <th>column_order</th>
                    <th>alias</th>
                    <th>default</th>
                    <th>placeholder</th>
                    <th>visible</th>
                    <th>type</th>
                    <th>id</th>
                    <th>id table</th>
                    <th>name</th>
                    <th>datatype</th>
                    <th>length</th>
                    <th>precision</th>
                    <th>primary(test)</th>
                    <th>required</th>
                    <th></th>
                </tr>
                </thead>

                <tbody>
                {widgetColumns.map((wc) => {
                    const isEd = editingWcId === wc.id;

                    /* агрегаты по reference */
                    const agg = (k: keyof Column) =>
                        wc.reference
                            .map((r) => {
                                const val = r.table_column?.[k];
                                if (typeof val === 'boolean') return val ? '✔︎' : '';
                                return val ?? '—';
                            })
                            .filter(Boolean)
                            .join(', ');
                    return (
                        <tr key={wc.id}>
                            <td>{wc.id}</td>
                            <td>{wc.widget_id}</td>
                            <td>
                                {isEd ? (
                                    <input
                                        className={s.inp}
                                        value={wcValues.column_order ?? ''}
                                        onChange={(e) =>
                                            setWcValues((v) => ({...v, column_order: Number(e.target.value)}))
                                        }
                                    />
                                ) : (
                                    wc.column_order ?? '—'
                                )}
                            </td>
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
                                            setWcValues((v) => ({
                                                ...v,
                                                placeholder: e.target.value,
                                            }))
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
                                        checked={wcValues.visible ?? false}
                                        onChange={(e) =>
                                            setWcValues((v) => ({
                                                ...v,
                                                visible: e.target.checked,
                                            }))
                                        }
                                    />
                                ) : wc.visible ? (
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
                            <td>{agg('primary')}</td>
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

            <WidgetColumnsMainTable  widgetColumns={widgetColumns} handleDeleteReference={handleDeleteReference}
                                    referencesMap={referencesMap}/>

            {/* ───── Modal “Посмотреть таблицу” ───── */}
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

            {/* ───── Dialog “Метаданные widget” ───── */}
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

            <ThemeProvider theme={dark}>
                <Dialog
                    open={addOpen}
                    onClose={() => setAddOpen(false)}
                    fullWidth
                    maxWidth="sm"
                >
                    <form
                        onSubmit={async e => {
                            e.preventDefault();
                            if (!selectedWidget) return;

                            /* ① - отправляем payload сразу с widget_id */
                            await addWidgetColumn({
                                ...newCol,
                                widget_id: selectedWidget.id,
                            });

                            /* ② (по желанию) подтягиваем свежий список столбцов */
                            await loadColumnsWidget(selectedWidget.id);

                            /* ③ сбрасываем форму и закрываем модалку */
                            setNewCol({
                                alias: '',
                                default: '',
                                placeholder: '',
                                visible: false,
                                type: '',
                                column_order: widgetColumns.length + 1,
                            });
                            setAddOpen(false);
                        }}
                    >
                        <DialogTitle>Новый столбец</DialogTitle>

                        <DialogContent dividers>
                            <Stack spacing={2}>
                                <TextField
                                    label="Alias"
                                    size="small"
                                    value={newCol.alias}
                                    onChange={e =>
                                        setNewCol(v => ({ ...v, alias: e.target.value }))
                                    }
                                    required
                                />

                                <TextField
                                    label="Default"
                                    size="small"
                                    value={newCol.default}
                                    onChange={e =>
                                        setNewCol(v => ({ ...v, default: e.target.value }))
                                    }
                                />

                                <TextField
                                    label="Placeholder"
                                    size="small"
                                    value={newCol.placeholder}
                                    onChange={e =>
                                        setNewCol(v => ({ ...v, placeholder: e.target.value }))
                                    }
                                />

                                <TextField
                                    label="Тип"
                                    size="small"
                                    value={newCol.type}
                                    onChange={e =>
                                        setNewCol(v => ({ ...v, type: e.target.value }))
                                    }
                                    required
                                />

                                <TextField
                                    label="Порядок (column_order)"
                                    type="number"
                                    size="small"
                                    value={newCol.column_order}
                                    onChange={e =>
                                        setNewCol(v => ({
                                            ...v,
                                            column_order: Number(e.target.value),
                                        }))
                                    }
                                    required
                                />

                                {/* visible */}
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography>Visible</Typography>
                                    <input
                                        type="checkbox"
                                        checked={newCol.visible}
                                        onChange={e =>
                                            setNewCol(v => ({ ...v, visible: e.target.checked }))
                                        }
                                    />
                                </Stack>
                            </Stack>
                        </DialogContent>

                        <DialogActions sx={{ pr: 3, pb: 2 }}>
                            <Button onClick={() => setAddOpen(false)}>Отмена</Button>
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
