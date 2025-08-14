import React, {useCallback, useEffect, useMemo, useState} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {
    Column,
    Widget,
    WidgetColumn,
} from '@/shared/hooks/useWorkSpaces';
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
import Editicon from '@/assets/image/EditIcon.svg';

export type WcReference = WidgetColumn['reference'][number];

interface Props {
    deleteColumnWidget: (id: number) => void;

    widgetColumns: WidgetColumn[];
    selectedWidget: Widget | null;
    columns: Column[];

    loadColumnsWidget: (widgetId: number) => void;

    addReference: (
        widgetColId: number,
        tblColId: number,
        payload: { width: number; combobox_visible: boolean; combobox_primary: boolean; ref_column_order: number }
    ) => Promise<void>;

    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: Partial<Pick<WcReference, 'width'|'ref_column_order'>>
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
        default: string;
        placeholder: string;
        visible: boolean;
        type: string;
        column_order: number;
    }) => Promise<WidgetColumn>;
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
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ffffff' },
                },
            },
        },
        MuiInputLabel: { styleOverrides: { root: { '&.Mui-focused': { color: '#ffffff' } } } },
        MuiSelect: { styleOverrides: { icon: { color: '#ffffff' } } },
    },
});

export const WidgetColumnsOfTable: React.FC<Props> = ({
                                                          deleteColumnWidget,
                                                          widgetColumns,
                                                          selectedWidget,
                                                          columns,
                                                          loadColumnsWidget,
                                                          addReference,
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
                                                      }) => {
    const [referencesMap, setReferencesMap] = useState<Record<number, WcReference[]>>({});

    const [addOpen, setAddOpen] = useState(false);
    const [newCol, setNewCol] = useState({
        alias: '',
        default: '',
        placeholder: '',
        visible: false,
        type: '',
        column_order: widgetColumns.length + 1,
    });

    // подгружаем reference для всех wc
    useEffect(() => {
        if (!widgetColumns.length) return;
        (async () => {
            const map: Record<number, WcReference[]> = {};
            await Promise.all(
                widgetColumns.map(async (wc) => {
                    try { map[wc.id] = await fetchReferences(wc.id); }
                    catch (e) { console.warn(`reference load error (wc ${wc.id})`, e); map[wc.id] = []; }
                })
            );
            setReferencesMap(map);
        })();
    }, [widgetColumns, fetchReferences]);

    // ───────── Редактирование WC (alias/default/placeholder/visible) ─────────
    const [editingWcId, setEditingWcId] = useState<number | null>(null);
    const [wcValues, setWcValues] = useState<Partial<WidgetColumn>>({});

    const startEdit = (wc: WidgetColumn) => {
        setEditingWcId(wc.id);
        setWcValues({
            alias: wc.alias ?? '',
            default: wc.default ?? '',
            placeholder: wc.placeholder ?? '',
            visible: wc.visible,
        });
    };
    const cancelEdit = () => { setEditingWcId(null); setWcValues({}); };

    const saveEdit = async () => {
        if (editingWcId == null) return;
        const patch: Partial<WidgetColumn> = { ...wcValues };
        (['alias', 'default', 'placeholder'] as const).forEach(f => {
            if (patch[f] === '') patch[f] = null as any;
        });
        await updateWidgetColumn(editingWcId, patch);
        if (selectedWidget) await loadColumnsWidget(selectedWidget.id);
        cancelEdit();
    };

    // ───────── Метаданные виджета ─────────
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
            const upd = await updateWidgetMeta(selectedWidget.id, {
                name: widgetMeta.name,
                description: widgetMeta.description,
                table_id: widgetMeta.table_id,
            });
            setSelectedWidget(upd);
            setWidgetsByTable(prev => {
                const tblId = upd.table_id;
                const updated = (prev[tblId] ?? []).map(w => w.id === upd.id ? upd : w);
                return { ...prev, [tblId]: updated };
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

    // ───────── Заголовок-превью ─────────
    const headerGroups = useMemo(() => {
        const items = widgetColumns.map((wc) => {
            const effectiveOrder =
                editingWcId === wc.id
                    ? (wcValues.column_order ?? wc.column_order ?? 0)
                    : (wc.column_order ?? 0);

            const refs = referencesMap[wc.id] ?? wc.reference ?? [];
            const span = Math.max(1, refs.length || 1);

            const effectiveAlias = (editingWcId === wc.id ? wcValues.alias : wc.alias)?.trim();
            const title = effectiveAlias || refs[0]?.table_column?.name || `Колонка #${wc.id}`;

            // подписи под группой: ref_alias → table_column.name → '—'
            const labels =
                refs.length > 0
                    ? refs
                        .slice() // на всякий случай не мутируем
                        .sort((a, b) => (a.ref_column_order ?? 0) - (b.ref_column_order ?? 0))
                        .map(r => r.ref_alias || r.table_column?.name || '—')
                    : ['—'];

            return { id: wc.id, order: effectiveOrder, title, span, labels };
        });

        items.sort((a, b) => (a.order - b.order) || (a.id - b.id));
        return items;
    }, [widgetColumns, referencesMap, editingWcId, wcValues]);


    return (
        <div className={s.tableWrapperWidget}>
            {/* Верхние ссылки */}
            <div style={{display: 'flex', gap: 24}}>
                <Typography
                    variant="h6"
                    onClick={() => setModalOpen(true)}
                    gutterBottom
                    sx={{ cursor: 'pointer', textDecoration: 'underline', color: '#8ac7ff', display: 'flex', alignItems: 'center', gap: 1 }}
                >
                    Посмотреть таблицу
                    <Editicon/>
                </Typography>

                <Typography
                    variant="h6"
                    onClick={() => setWidgetModalOpen(true)}
                    gutterBottom
                    sx={{ cursor: 'pointer', textDecoration: 'underline', color: '#8ac7ff', display: 'flex', alignItems: 'center', gap: 1 }}
                >
                    Метаданные widget
                    <Editicon/>
                </Typography>

                <Typography
                    variant="h6"
                    onClick={() => setAddOpen(true)}
                    gutterBottom
                    sx={{ cursor: 'pointer', textDecoration: 'underline', color: '#8ac7ff', display: 'flex', alignItems: 'center', gap: 1 }}
                >
                    Добавить столбец
                    <Editicon/>
                </Typography>
            </div>

            <div style={{margin: '12px 0 20px'}}>
                <div style={{opacity: 0.8, fontSize: 12, marginBottom: 6}}>Шапка формы (превью)</div>
                <table className={s.tbl}>
                    <thead>
                    {/* верхняя строка — названия групп */}
                    <tr>
                        {headerGroups.map(g => (
                            <th key={`g-top-${g.id}`} colSpan={g.span}>
                                {g.title}
                            </th>
                        ))}
                    </tr>

                    {/* нижняя строка — подписи для каждой reference (ref_alias / name) */}
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
            <WidgetColumnsMainTable
                addReference={(wcId, tblColId, payloadMin) =>
                    // если на твоём бэке обязательны combobox-поля — можешь обернуть здесь
                    addReference(wcId, tblColId, {...payloadMin, combobox_visible: true, combobox_primary: false})
                }
                updateReference={updateReference}
                refreshReferences={async (wcId) => {
                    const fresh = await fetchReferences(wcId);
                    setReferencesMap(prev => ({ ...prev, [wcId]: fresh ?? [] }));
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
                    <form onSubmit={(e) => { e.preventDefault(); saveWidgetMeta(); }}>
                        <DialogTitle>Редактирование виджета</DialogTitle>
                        <DialogContent dividers>
                            <Stack spacing={2}>
                                <TextField label="Название" size="small" fullWidth required
                                           value={widgetMeta.name}
                                           onChange={(e) => setWidgetMeta(v => ({ ...v, name: e.target.value }))}
                                />
                                <TextField label="Описание" size="small" fullWidth multiline rows={3}
                                           value={widgetMeta.description ?? ''}
                                           onChange={(e) => setWidgetMeta(v => ({ ...v, description: e.target.value }))}
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
                            await addWidgetColumn({ ...newCol, widget_id: selectedWidget.id });
                            await loadColumnsWidget(selectedWidget.id);
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
                                <TextField label="Alias" size="small" required
                                           value={newCol.alias}
                                           onChange={e => setNewCol(v => ({...v, alias: e.target.value}))}
                                />
                                <TextField label="Default" size="small"
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
                                />
                                <TextField label="Порядок (column_order)" type="number" size="small" required
                                           value={newCol.column_order}
                                           onChange={e => setNewCol(v => ({...v, column_order: Number(e.target.value)}))}
                                />
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography>Visible</Typography>
                                    <input
                                        type="checkbox"
                                        checked={newCol.visible}
                                        onChange={e => setNewCol(v => ({...v, visible: e.target.checked}))}
                                    />
                                </Stack>
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
