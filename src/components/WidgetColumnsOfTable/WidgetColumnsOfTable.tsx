import React, {useCallback, useEffect, useMemo, useState} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {
    Column, HeaderGroup,
    Widget,
    WidgetColumn, WidgetForm,
} from '@/shared/hooks/useWorkSpaces';
import {TableColumn} from '@/components/tableColumn/TableColumn';
import {
    Box,
    Button, Checkbox, Chip,
    createTheme,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle, FormControlLabel,
    Modal,
    Stack, Switch,
    TextField,
    ThemeProvider,
    Typography,
} from '@mui/material';
import {WidgetColumnsMainTable} from "@/components/WidgetColumnsOfTable/WidgetColumnsMainTable";
import EditIcon from '@/assets/image/EditIcon.svg';

export type WcReference = WidgetColumn['reference'][number];

interface Props {
    deleteColumnWidget: (id: number) => void;

    widgetColumns: WidgetColumn[];
    selectedWidget: Widget | null;
    columns: Column[];

    loadColumnsWidget: (widgetId: number) => void;
    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: Partial<Pick<WcReference, 'width' | 'ref_column_order'>>
    ) => Promise<WcReference>;

    fetchReferences: (widgetColumnId: number) => Promise<WcReference[]>;
    deleteReference: (widgetColumnId: number, tableColumnId: number) => Promise<void>;
    updateWidgetMeta: (id: number, patch: Partial<Widget>) => Promise<Widget>;
    updateWidgetColumn: (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => Promise<void> | void;

    updateTableColumn: (id: number, p: Partial<Omit<Column, 'id'>>) => void;
    deleteColumnTable: (id: number) => void;
    setSelectedWidget: React.Dispatch<React.SetStateAction<Widget | null>>;
    setWidgetsByTable: React.Dispatch<React.SetStateAction<Record<number, Widget[]>>>;
    addWidgetColumn: (payload: {
        widget_id: number;
        alias: string;
        column_order: number;
    }) => Promise<WidgetColumn>;
    setLiveRefsForHeader: React.Dispatch<React.SetStateAction<Record<number, WcReference[]>>>;
    setReferencesMap: React.Dispatch<React.SetStateAction<Record<number, WcReference[]>>>;
    referencesMap: Record<number, WcReference[]>;
    headerGroups: HeaderGroup[];
    formsById: Record<number, WidgetForm>;
    loadWidgetForms: () => Promise<void> | void;
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
    color: 'white',
};

const dark = createTheme({
    palette: {mode: 'dark', primary: {main: '#ffffff'}},
    components: {
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {borderColor: '#ffffff'},
                },
            },
        },
        MuiInputLabel: {styleOverrides: {root: {'&.Mui-focused': {color: '#ffffff'}}}},
        MuiSelect: {styleOverrides: {icon: {color: '#ffffff'}}},
    },
});

export const WidgetColumnsOfTable: React.FC<Props> = ({
                                                          deleteColumnWidget,
                                                          widgetColumns,
                                                          selectedWidget,
                                                          columns,
                                                          loadColumnsWidget,

                                                          fetchReferences,
                                                          deleteReference,
                                                          updateWidgetMeta,
                                                          updateTableColumn,
                                                          deleteColumnTable,
                                                          setSelectedWidget,
                                                          setWidgetsByTable,
                                                          addWidgetColumn,
                                                          updateWidgetColumn,
                                                          updateReference,
                                                          setLiveRefsForHeader,
                                                          setReferencesMap,
                                                          referencesMap,
                                                          headerGroups,
                                                          formsById,
                                                          loadWidgetForms,
                                                      }) => {


    const [addOpen, setAddOpen] = useState(false);
    const [newCol, setNewCol] = useState({
        alias: '',
        column_order: widgetColumns.length + 1,
    });

    // подгружаем reference для всех wc
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





    // ───────── Метаданные виджета ─────────
    const [modalOpen, setModalOpen] = useState(false);
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);
    const [widgetMeta, setWidgetMeta] = useState<Partial<Widget>>({
        name: selectedWidget?.name ?? '',
        description: selectedWidget?.description ?? '',
        table_id: selectedWidget?.table_id ?? 0,
        published: selectedWidget.published ,
    });

    const saveWidgetMeta = useCallback(async () => {
        if (!selectedWidget) return;
        try {
            const upd = await updateWidgetMeta(selectedWidget.id, {
                name: widgetMeta.name,
                description: widgetMeta.description,
                table_id: widgetMeta.table_id,
            });
            setSelectedWidget(upd);
            setWidgetsByTable(prev => {
                const tblId = upd.table_id;
                const updated = (prev[tblId] ?? []).map(w => w.id === upd.id ? upd : w);
                return {...prev, [tblId]: updated};
            });
            await loadColumnsWidget(upd.id);
            setWidgetModalOpen(false);
        } catch (e) {
            console.warn('❌ Ошибка при сохранении метаданных виджета:', e);
        }
    }, [selectedWidget, widgetMeta, updateWidgetMeta, loadColumnsWidget, setWidgetsByTable, setSelectedWidget]);

    // ───────── Удаление reference ─────────
    const handleDeleteReference = async (wcId: number, tblColId: number) => {
        if (!selectedWidget) return;
        if (!confirm('Удалить связь столбца?')) return;
        try {
            await deleteReference(wcId, tblColId);
            setReferencesMap(prev => ({
                ...prev,
                [wcId]: (prev[wcId] ?? []).filter(r => r.table_column.id !== tblColId),
            }));
            await loadColumnsWidget(selectedWidget.id);
        } catch (e) {
            console.warn('❌ не удалось удалить reference', e);
            alert('Ошибка при удалении');
        }
    };


    return (
        <div className={s.tableWrapperWidget}>
            {/* Верхние ссылки */}
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
                        gap: 1
                    }}
                >
                    Посмотреть таблицу
                    <EditIcon/>
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
                        gap: 1
                    }}
                >
                    Метаданные widget
                    <EditIcon/>
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
                        gap: 1
                    }}
                >
                    Добавить столбец
                    <EditIcon/>
                </Typography>
            </div>

            <div style={{margin: '12px 0 20px'}}>
                <div style={{opacity: 0.8, fontSize: 12, marginBottom: 6}}>Шапка формы (превью)</div>
                <table className={s.tbl}>
                    <thead>
                    <tr>
                        {headerGroups.map(g => (
                            <th key={`g-top-${g.id}`} colSpan={g.span}>
                                {g.title}
                            </th>
                        ))}
                    </tr>
                    <tr>
                        {headerGroups.map(g =>
                            g.labels.map((label, idx) => (
                                <th key={`g-sub-${g.id}-${idx}`}>{label}</th>
                            ))
                        )}
                    </tr>
                    </thead>
                </table>

            </div>

            {/* Основная таблица */}
            <WidgetColumnsMainTable formsById={formsById} loadWidgetForms={loadWidgetForms}  onRefsChange={setLiveRefsForHeader}
                                    deleteColumnWidget={deleteColumnWidget}
                                    updateReference={updateReference}
                                    refreshReferences={async (wcId) => {
                                        const fresh = await fetchReferences(wcId);
                                        setReferencesMap(prev => ({...prev, [wcId]: fresh ?? []}));
                                        if (selectedWidget) await loadColumnsWidget(selectedWidget.id);
                                    }}
                                    updateWidgetColumn={updateWidgetColumn}
                                    widgetColumns={widgetColumns}
                                    handleDeleteReference={handleDeleteReference}
                                    referencesMap={referencesMap}
            />

            {/* Modal «Посмотреть таблицу» */}
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

            {/* Dialog «Метаданные widget» */}
            <ThemeProvider theme={dark}>
                <Dialog open={widgetModalOpen} onClose={() => setWidgetModalOpen(false)} fullWidth maxWidth="sm">
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        saveWidgetMeta();
                    }}>
                        <DialogTitle>Редактирование виджета</DialogTitle>
                        <DialogContent dividers>
                            <Stack spacing={2}>
                                <TextField label="Название" size="small" fullWidth required
                                           value={widgetMeta.name}
                                           onChange={(e) => setWidgetMeta(v => ({...v, name: e.target.value}))}
                                />
                                <TextField label="Описание" size="small" fullWidth multiline rows={3}
                                           value={widgetMeta.description ?? ''}
                                           onChange={(e) => setWidgetMeta(v => ({...v, description: e.target.value}))}
                                />

                                <FormControlLabel
                                    label="Опубликован"
                                    control={
                                        <Checkbox
                                            checked={Boolean(widgetMeta?.published)}
                                            // кастомные иконки: ✓ для true, ✕ для false
                                            checkedIcon={
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        border: '1px solid', borderColor: 'divider', borderRadius: 0.75
                                                    }}
                                                >
                                                    ✓
                                                </Box>
                                            }
                                            icon={
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        border: '1px solid', borderColor: 'divider', borderRadius: 0.75
                                                    }}
                                                >
                                                    ✕
                                                </Box>
                                            }
                                            // делаем «read-only» (не кликается)
                                            disableRipple
                                            sx={{
                                                pointerEvents: 'none',
                                                '&.Mui-disabled': { opacity: 1 }, // если вдруг добавишь disabled — не бледнить
                                            }}
                                        />
                                    }
                                />
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{pr: 3, pb: 2}}>
                            <Button onClick={() => setWidgetModalOpen(false)}>Отмена</Button>
                            <Button type="submit" variant="contained">Сохранить</Button>
                        </DialogActions>
                    </form>
                </Dialog>
            </ThemeProvider>

            {/* Dialog «Добавить столбец» */}
            <ThemeProvider theme={dark}>
                <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
                    <form
                        onSubmit={async e => {
                            e.preventDefault();
                            if (!selectedWidget) return;
                            await addWidgetColumn({...newCol, widget_id: selectedWidget.id});
                            await loadColumnsWidget(selectedWidget.id);
                            setNewCol({
                                alias: '',
                                column_order: widgetColumns.length + 1,
                            });
                            setAddOpen(false);
                        }}
                    >
                        <DialogTitle>Новый столбец</DialogTitle>
                        <DialogContent dividers>
                            <Stack spacing={2}>
                                <TextField label="Alias" size="small" required
                                           value={newCol.alias}
                                           onChange={e => setNewCol(v => ({...v, alias: e.target.value}))}
                                />
                                {/*<TextField label="Default" size="small"
                                           value={newCol.default}
                                           onChange={e => setNewCol(v => ({...v, default: e.target.value}))}
                                />
                                <TextField label="Placeholder" size="small"
                                           value={newCol.placeholder}
                                           onChange={e => setNewCol(v => ({...v, placeholder: e.target.value}))}
                                />
                                <TextField label="Тип" size="small" required
                                           value={newCol.type}
                                           onChange={e => setNewCol(v => ({...v, type: e.target.value}))}
                                />*/}
                                <TextField label="Порядок (column_order)" type="number" size="small" required
                                           value={newCol.column_order}
                                           onChange={e => setNewCol(v => ({
                                               ...v,
                                               column_order: Number(e.target.value)
                                           }))}
                                />
                                {/*<Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography>Visible</Typography>
                                    <input
                                        type="checkbox"
                                        checked={newCol.visible}
                                        onChange={e => setNewCol(v => ({...v, visible: e.target.checked}))}
                                    />
                                </Stack>*/}
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{pr: 3, pb: 2}}>
                            <Button onClick={() => setAddOpen(false)}>Отмена</Button>
                            <Button type="submit" variant="contained">Сохранить</Button>
                        </DialogActions>
                    </form>
                </Dialog>
            </ThemeProvider>
        </div>
    );
};
