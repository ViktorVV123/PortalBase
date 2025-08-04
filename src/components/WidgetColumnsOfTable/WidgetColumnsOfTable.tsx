import React, {useCallback, useEffect, useState} from 'react';
import * as s from "@/components/setOfTables/SetOfTables.module.scss";
import {Column, Widget, WidgetColumn} from "@/shared/hooks/useWorkSpaces";
import EditIcon from "@/assets/image/EditIcon.svg";
import DeleteIcon from "@/assets/image/DeleteIcon.svg";
import {api} from "@/services/api";
import {TableColumn} from "@/components/tableColumn/TableColumn";
import {
    Box,
    Button,
    createTheme,
    Dialog,
    DialogActions, DialogContent, DialogTitle,
    Modal, Stack,
    TextField,
    ThemeProvider,
    Typography
} from "@mui/material";
import Editicon from "@/assets/image/EditIcon.svg";
import ConColumnIcon from '@/assets/image/ConColumnIcon.svg'


type WidgetColumnsProps = {
    updateWidgetColumn: (id: number,
                         patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>) => void;
    widgetColumns: WidgetColumn[];
    selectedWidget: Widget | null;
    loadColumnsWidget: any
    addReference: (widgetColId: number, tblColId: number, payload: {
        width: number;
        visible: boolean;
        primary: boolean;
    }) => Promise<void>;
    deleteColumnWidget: (id: number) => void;
    columns: any;
    updateTableColumn: any;
    deleteColumnTable: any;
    setSelectedWidget:any;
    setWidgetsByTable: React.Dispatch<React.SetStateAction<Record<number, Widget[]>>>

}

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
    color: 'white'
};

const dark = createTheme({
    palette: {
        mode: 'dark',
        primary: {main: '#ffffff'},  // ← чтобы все focus-ring были белые
    },
    components: {
        /* белый бордер при фокусе */
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#ffffff',
                    },
                },
            },
        },
        /* белая подпись (label) в фокусе */
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    '&.Mui-focused': {color: '#ffffff'},
                },
            },
        },
        /* белая стрелочка у Select */
        MuiSelect: {
            styleOverrides: {icon: {color: '#ffffff'}},
        },
    },
});

export const WidgetColumnsOfTable = ({
                                         updateWidgetColumn,
                                         widgetColumns,
                                         selectedWidget,
                                         loadColumnsWidget,
                                         addReference,
                                         deleteColumnWidget,
                                         columns,
                                         updateTableColumn,
                                         deleteColumnTable,setSelectedWidget,setWidgetsByTable

                                     }: WidgetColumnsProps) => {


    const [colValues, setColValues] = useState<Partial<Column>>({});
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);
    const openWidgetModal = () => setWidgetModalOpen(true);
    const closeWidgetModal = () => setWidgetModalOpen(false);

    const [widgetMeta, setWidgetMeta] = useState<Partial<Widget>>({
        name: selectedWidget?.name ?? '',
        description: selectedWidget?.description ?? '',
        table_id: selectedWidget?.table_id ?? 0
    });

    const saveWidgetMeta = useCallback(async () => {
        if (!selectedWidget) return;

        try {
            await api.patch(`/widgets/${selectedWidget.id}`, {
                name: widgetMeta.name,
                description: widgetMeta.description,
                table_id: widgetMeta.table_id,
            });

            const { data: updatedWidget } = await api.get<Widget>(`/widgets/${selectedWidget.id}`);
            setSelectedWidget(updatedWidget);

            // 👇 обновим виджет в списке
            setWidgetsByTable(prev => {
                const tableId = updatedWidget.table_id;
                const updated = (prev[tableId] ?? []).map(w =>
                    w.id === updatedWidget.id ? updatedWidget : w
                );
                return { ...prev, [tableId]: updated };
            });

            await loadColumnsWidget(updatedWidget.id);
        } catch (e) {
            console.warn('❌ Ошибка при сохранении метаданных виджета:', e);
        }
    }, [selectedWidget, widgetMeta, loadColumnsWidget, setWidgetsByTable]);




    const cleanPatch = (p: Partial<Column>): Partial<Column> => {
        const patch: any = {...p};
        ['length', 'precision'].forEach(k => {
            if (patch[k] === '' || patch[k] === undefined) delete patch[k];
        });
        return patch;
    };


    const [editingWcId, setEditingWcId] = useState<number | null>(null);
    const [wcValues, setWcValues] = useState<Partial<WidgetColumn>>({});
    const [modalOpen, setModalOpen] = useState(false);
    const openModal = () => setModalOpen(true);
    const closeModal = () => setModalOpen(false);

    const startWcEdit = (wc: WidgetColumn) => {
        setEditingWcId(wc.id);
        setWcValues({
            alias: wc.alias ?? '',
            default: wc.default ?? '',
            placeholder: wc.default ?? '',
            published: wc.published,
            type: wc.type,
        });
    };
    const cancelWcEdit = () => {
        setEditingWcId(null);
        setWcValues({});
    };

    const saveWcEdit = async () => {
        if (editingWcId == null) return;

        // 1. Обновляем только виджет-колонку
        await updateWidgetColumn(editingWcId, wcValues);

        // 2. Проверяем, редактировал ли пользователь table_column (colValues)
        const ref = widgetColumns.find(w => w.id === editingWcId)?.reference[0];
        const tableColumnId = ref?.table_column?.id;

        const hasTableColumnChanges =
            colValues && Object.values(colValues).some(v => v !== undefined && v !== null && v !== '');

        // 3. Отправляем PATCH на reference ТОЛЬКО если есть изменения
        if (ref && tableColumnId && hasTableColumnChanges) {
            try {
                await api.patch(`/widgets/tables/references/${editingWcId}/${tableColumnId}`, {
                    width: ref.width ?? 1,
                    visible: ref.visible ?? false,
                    primary: ref.primary ?? false,
                    table_column: cleanPatch(colValues),
                });
            } catch (e) {
                console.error('Ошибка при сохранении table_column:', e);
            }
        }

        // 👇 Подгружаем обновлённые данные
        if (selectedWidget) {
            await loadColumnsWidget(selectedWidget.id);
        }

        cancelWcEdit();
    };


    const handleMerge = async (wColId: number) => {
        if (!selectedWidget) return;

        const input = prompt('Введите *имя* столбца (name), который нужно привязать:');
        if (!input) return;

        const found = columns.find((col: Column) => col.name === input.trim());
        if (!found) {
            alert(`Столбец с именем "${input}" не найден`);
            return;
        }

        try {
            await addReference(wColId, found.id, {
                width: 33,
                visible: false,
                primary: false,
            });

            await loadColumnsWidget(selectedWidget.id);
        } catch (e) {
            alert('Не удалось добавить reference');
            console.error(e);
        }
    };


    return (
        <div className={s.tableWrapperWidget}>
            <div style={{display: 'flex'}}>
                <Typography
                    onClick={openModal}
                    variant="h6"
                    gutterBottom
                    sx={{ cursor: 'pointer', textDecoration: 'underline', color: '#8ac7ff',display:'flex', alignItems: 'center',gap:1, width:'15%' }}
                >
                    Посмотреть таблицу
                    <Editicon />
                </Typography>
                <Typography
                    onClick={openWidgetModal}
                    variant="h6"
                    gutterBottom
                    sx={{ cursor: 'pointer', textDecoration: 'underline', color: '#8ac7ff', display: 'flex', alignItems: 'center', gap: 1, width: '15%' }}
                >
                    Метаданные widget
                    <Editicon />
                </Typography>

            </div>

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
                {widgetColumns.map(wc => {
                    const isEd = editingWcId === wc.id;

                    const colValues = (field: keyof Column) =>
                        wc.reference.map(r => r.table_column?.[field] ?? '—').join(', ');

                    const refValues = (field: 'primary' | 'visible') =>
                        wc.reference.map(r => (r[field] ? '✔︎' : '')).join(', ');


                    return (
                        <tr key={wc.id}>
                            <td>{wc.id}</td>
                            <td>{wc.widget_id}</td>

                            <td>
                                {isEd ? (
                                    <input value={wcValues.alias ?? ''}
                                           onChange={e => setWcValues(v => ({
                                               ...v,
                                               alias: e.target.value
                                           }))}
                                           className={s.inp}/>
                                ) : wc.alias ?? '—'}
                            </td>
                            <td>
                                {isEd ? (
                                    <input value={wcValues.default ?? ''}
                                           onChange={e => setWcValues(v => ({
                                               ...v,
                                               default: e.target.value
                                           }))}
                                           className={s.inp}/>
                                ) : wc.default ?? '—'}
                            </td>
                            <td>
                                {isEd ? (
                                    <input value={wcValues.placeholder ?? ''}
                                           onChange={e => setWcValues(v => ({
                                               ...v,
                                               placeholder: e.target.value
                                           }))}
                                           className={s.inp}/>
                                ) : wc.placeholder ?? '—'}
                            </td>
                            <td>
                                {isEd ? (
                                    <input type="checkbox"
                                           checked={wcValues.published ?? false}
                                           onChange={e => setWcValues(v => ({
                                               ...v,
                                               published: e.target.checked
                                           }))}/>
                                ) : wc.published ? '✔︎' : ''}
                            </td>
                            <td>
                                {isEd ? (
                                    <input value={wcValues.type ?? ''}
                                           onChange={e => setWcValues(v => ({
                                               ...v,
                                               type: e.target.value
                                           }))}
                                           className={s.inp}/>
                                ) : wc.type ?? '—'}
                            </td>

                            <td>{colValues('id')}</td>
                            <td>{colValues('table_id')}</td>
                            <td>{colValues('name')}</td>
                            <td>{colValues('datatype')}</td>
                            <td>{colValues('length')}</td>
                            <td>{colValues('precision')}</td>
                            <td>{refValues('primary')}</td>
                            <td>{refValues('visible')}</td>

                            <td className={s.actionsCell}>
                                {isEd ? (
                                    <>
                                        <button className={s.okBtn} onClick={saveWcEdit}>✓</button>
                                        <button className={s.cancelBtn} onClick={cancelWcEdit}>✕
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <ConColumnIcon className={s.actionIcon} onClick={() => handleMerge(wc.id)}/>
                                        <EditIcon className={s.actionIcon}
                                                  onClick={() => startWcEdit(wc)}/>
                                        <DeleteIcon className={s.actionIcon}
                                                    onClick={() => confirm('Удалить?') && deleteColumnWidget(wc.id)}/>
                                    </>
                                )}
                            </td>
                        </tr>
                    );
                })}
                </tbody>

                <Modal open={modalOpen} onClose={closeModal}>
                    <Box sx={modalStyle}>
                        <h3 style={{marginBottom: '15px'}}>Таблица</h3>
                        {columns?.length && updateTableColumn && deleteColumnTable ? (
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
                <ThemeProvider theme={dark}>
                    <Dialog open={widgetModalOpen} onClose={closeWidgetModal} fullWidth maxWidth="sm">
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            saveWidgetMeta();
                        }}>

                            <DialogTitle>Редактирование виджета</DialogTitle>

                            <DialogContent dividers>
                                <Stack spacing={2}>
                                    <TextField
                                        label="Название"
                                        name="name"
                                        size="small"
                                        fullWidth
                                        value={widgetMeta.name}
                                        onChange={e => setWidgetMeta(v => ({...v, name: e.target.value}))}
                                        required
                                    />

                                    <TextField
                                        label="Описание"
                                        name="description"
                                        size="small"
                                        fullWidth
                                        multiline rows={3}
                                        value={widgetMeta.description}
                                        onChange={e => setWidgetMeta(v => ({...v, description: e.target.value}))}
                                    />
                                </Stack>
                            </DialogContent>

                            <DialogActions sx={{pr: 3, pb: 2}}>
                                <Button onClick={closeWidgetModal}>Отмена</Button>
                                <Button type="submit" variant="contained">
                                    Сохранить
                                </Button>
                            </DialogActions>
                        </form>
                    </Dialog>
                </ThemeProvider>


            </table>
        </div>
    );
};

