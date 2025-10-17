import React, {useCallback, useEffect, useState} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {
    Column,
    Widget,
    WidgetColumn,
    WidgetForm,
} from '@/shared/hooks/useWorkSpaces';
import {HeaderGroup} from '@/shared/utils/headerGroups';
import {TableColumn} from '@/components/tableColumn/TableColumn';
import {
    Box,
    createTheme,
    Modal,
    Typography,
} from '@mui/material';
import {WidgetColumnsMainTable} from '@/components/WidgetColumnsOfTable/WidgetColumnsMainTable';
import EditIcon from '@/assets/image/EditIcon.svg';
import {WidgetMetaDialog} from "@/components/modals/modalWidget/WidgetMetaDialog";
import {AddWidgetColumnDialog} from "@/components/modals/modalWidget/AddWidgetColumnDialog";

export type WcReference = WidgetColumn['reference'][number];

interface Props {
    deleteColumnWidget: (id: number) => void;

    widgetColumns: WidgetColumn[];
    selectedWidget: Widget | null;
    columns: Column[];

    loadColumnsWidget: (widgetId: number) => void;

    /** ВАЖНО: полная сигнатура patch + form_id, чтобы совпадать с WidgetColumnsMainTable */
    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: Partial<
            Pick<
                WcReference,
                | 'ref_column_order'
                | 'width'
                | 'type'
                | 'ref_alias'
                | 'default'
                | 'placeholder'
                | 'visible'
                | 'readonly'
            >
        > & { form_id?: number | null }
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

    /** Совместимо и с коротким, и с расширенным payload (поля optional) */
    addWidgetColumn: (payload: {
        widget_id: number;
        alias: string;
        column_order: number;
        default?: string;
        placeholder?: string;
        visible?: boolean;
        type?: string;
    }) => Promise<WidgetColumn>;

    /** ВАЖНО: тут допускаем null (как в SetOfTables) */
    setLiveRefsForHeader: React.Dispatch<
        React.SetStateAction<Record<number, WcReference[]> | null>
    >;

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

    // загрузка reference для всех wc
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
    }, [widgetColumns, fetchReferences, setReferencesMap]);

    // ───────── Метаданные виджета ─────────
    const [modalOpen, setModalOpen] = useState(false);
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);

    // форма метаданных (инициализируем при открытии диалога/смене виджета)
    const [widgetMeta, setWidgetMeta] = useState<Partial<Widget>>({
        name: selectedWidget?.name ?? '',
        description: selectedWidget?.description ?? '',
        table_id: selectedWidget?.table_id ?? 0,
        published: selectedWidget?.published ?? false,
    });

    useEffect(() => {
        if (!selectedWidget || !widgetModalOpen) return;
        setWidgetMeta({
            name: selectedWidget.name ?? '',
            description: selectedWidget.description ?? '',
            table_id: selectedWidget.table_id ?? 0,
            published: selectedWidget.published ?? false,
        });
    }, [selectedWidget, widgetModalOpen]);

    // ───────── Удаление reference ─────────
    const handleDeleteReference = async (wcId: number, tblColId: number) => {
        if (!selectedWidget) return;
        if (!confirm('Удалить связь столбца?')) return;
        try {
            await deleteReference(wcId, tblColId);
            setReferencesMap(prev => ({
                ...prev,
                [wcId]: (prev[wcId] ?? []).filter(r => r.table_column?.id !== tblColId),
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
            <WidgetColumnsMainTable
                formsById={formsById}
                loadWidgetForms={loadWidgetForms}
                onRefsChange={setLiveRefsForHeader}
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
                allColumns={columns}
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
            <WidgetMetaDialog
                open={widgetModalOpen}
                onClose={() => setWidgetModalOpen(false)}
                selectedWidget={selectedWidget}
                updateWidgetMeta={updateWidgetMeta}
                loadColumnsWidget={loadColumnsWidget}
                setSelectedWidget={setSelectedWidget}
                setWidgetsByTable={setWidgetsByTable}
            />

            {/* Dialog «Добавить столбец» — вынесен */}
            <AddWidgetColumnDialog
                open={addOpen}
                onClose={() => setAddOpen(false)}
                selectedWidget={selectedWidget}
                widgetColumns={widgetColumns}
                addWidgetColumn={addWidgetColumn}
                loadColumnsWidget={loadColumnsWidget}
            />

        </div>
    );
};
