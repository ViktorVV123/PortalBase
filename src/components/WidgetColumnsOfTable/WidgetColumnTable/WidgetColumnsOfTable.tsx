// src/components/WidgetColumnsOfTable/WidgetColumnTable/WidgetColumnsOfTable.tsx

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import * as s from './WidgetColumnOfTable.module.scss';
import * as tblStyles from '@/components/setOfTables/SetOfTables.module.scss';
import {
    Column,
    Widget,
    WidgetColumn,
    WidgetForm,
} from '@/shared/hooks/useWorkSpaces';
import { TableColumn } from '@/components/table/tableColumn/TableColumn';
import {
    Box,
    createTheme,
    Modal,
    Typography,
} from '@mui/material';
import { WidgetColumnsMainTable } from '@/components/WidgetColumnsOfTable/WidgetColumnsMainTable';
import EditIcon from '@/assets/image/EditIcon.svg';
import { WidgetMetaDialog } from '@/components/modals/modalWidget/WidgetMetaDialog';
import { AddWidgetColumnDialog } from '@/components/modals/modalWidget/AddWidgetColumnDialog';
import { HeaderModelItem } from '@/components/Form/formTable/FormTable';

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
    addWidgetColumn: (payload: {
        widget_id: number;
        alias: string;
        column_order: number;
        default?: string;
        placeholder?: string;
        visible?: boolean;
        type?: string;
    }) => Promise<WidgetColumn>;
    setLiveRefsForHeader: React.Dispatch<
        React.SetStateAction<Record<number, WcReference[]> | null>
    >;
    setReferencesMap: React.Dispatch<React.SetStateAction<Record<number, WcReference[]>>>;
    referencesMap: Record<number, WcReference[]>;
    headerGroups: HeaderModelItem[];
    formsById: Record<number, WidgetForm>;
    loadWidgetForms: () => Promise<void> | void;
    workspaceId: number | null;
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
    palette: { mode: 'dark', primary: { main: '#ffffff' } },
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
                                                          workspaceId,
                                                          loadWidgetForms,
                                                      }) => {
    const [addOpen, setAddOpen] = useState(false);
    const [loadingRefs, setLoadingRefs] = useState(false);

    // ─────────────────────────────────────────────────────────────────────────
    // Загрузка references ПОСЛЕДОВАТЕЛЬНО
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!widgetColumns.length) return;

        let cancelled = false;

        const loadAllRefs = async () => {
            setLoadingRefs(true);

            const map: Record<number, WcReference[]> = {};

            for (const wc of widgetColumns) {
                if (cancelled) break;

                try {
                    const refs = await fetchReferences(wc.id);
                    map[wc.id] = refs;
                } catch (e: any) {
                    const status = e?.response?.status;
                    console.warn(`[WidgetColumnsOfTable] fetchReferences(${wc.id}) failed:`, status, e?.message);
                    map[wc.id] = wc.reference ?? [];

                    if (status === 401) {
                        console.log(`[WidgetColumnsOfTable] Got 401, waiting for token refresh...`);
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
            }

            if (cancelled) return;

            for (const wc of widgetColumns) {
                if (!map[wc.id]) {
                    console.warn(`[WidgetColumnsOfTable] No refs for wc ${wc.id}, using wc.reference`);
                    map[wc.id] = wc.reference ?? [];
                }
            }

            setReferencesMap(map);
            setLoadingRefs(false);
        };

        loadAllRefs();

        return () => {
            cancelled = true;
        };
    }, [widgetColumns, fetchReferences, setReferencesMap]);

    // ─────────────────────────────────────────────────────────────────────────
    // Метаданные виджета
    // ─────────────────────────────────────────────────────────────────────────
    const [modalOpen, setModalOpen] = useState(false);
    const [widgetModalOpen, setWidgetModalOpen] = useState(false);

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

    // ─────────────────────────────────────────────────────────────────────────
    // Удаление reference
    // ─────────────────────────────────────────────────────────────────────────
    const handleDeleteReference = useCallback(
        async (wcId: number, tblColId: number) => {
            if (!selectedWidget) return;
            if (!confirm('Удалить связь столбца?')) return;

            try {
                await deleteReference(wcId, tblColId);

                setReferencesMap((prev) => ({
                    ...prev,
                    [wcId]: (prev[wcId] ?? []).filter((r) => r.table_column?.id !== tblColId),
                }));

                await loadColumnsWidget(selectedWidget.id);
            } catch (e) {
                console.warn('❌ не удалось удалить reference', e);
                alert('Ошибка при удалении');
            }
        },
        [selectedWidget, deleteReference, setReferencesMap, loadColumnsWidget]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // refreshReferences с fallback
    // ─────────────────────────────────────────────────────────────────────────
    const refreshReferences = useCallback(
        async (wcId: number) => {
            try {
                const fresh = await fetchReferences(wcId);
                setReferencesMap((prev) => ({ ...prev, [wcId]: fresh ?? [] }));
            } catch (e) {
                console.warn(`[refreshReferences] Failed for wc ${wcId}:`, e);
            }

            if (selectedWidget) {
                try {
                    await loadColumnsWidget(selectedWidget.id);
                } catch (e) {
                    console.warn('[refreshReferences] loadColumnsWidget failed:', e);
                }
            }
        },
        [fetchReferences, setReferencesMap, selectedWidget, loadColumnsWidget]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Мержим referencesMap с wc.reference
    // ─────────────────────────────────────────────────────────────────────────
    const mergedReferencesMap = useMemo(() => {
        const merged: Record<number, WcReference[]> = {};

        for (const wc of widgetColumns) {
            const fromMap = referencesMap[wc.id];
            const fromWc = wc.reference ?? [];

            if (fromMap && fromMap.length > 0) {
                merged[wc.id] = fromMap;
            } else if (fromWc.length > 0) {
                merged[wc.id] = fromWc;
                console.log(`[mergedReferencesMap] Using wc.reference for wc ${wc.id}`);
            } else {
                merged[wc.id] = [];
            }
        }

        return merged;
    }, [widgetColumns, referencesMap]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER с новой структурой
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className={s.root}>
            {/* ═══════════════════════════════════════════════════════════
                HEADER — фиксированный блок с ссылками
            ═══════════════════════════════════════════════════════════ */}
            <div className={s.header}>
                <span className={s.headerLink} onClick={() => setModalOpen(true)}>
                    Посмотреть таблицу
                    <EditIcon />
                </span>

                <span className={s.headerLink} onClick={() => setWidgetModalOpen(true)}>
                    Метаданные widget
                    <EditIcon />
                </span>

                <span className={s.headerLink} onClick={() => setAddOpen(true)}>
                    Добавить столбец
                    <EditIcon />
                </span>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                PREVIEW — превью шапки формы (фиксированный)
            ═══════════════════════════════════════════════════════════ */}
            <div className={s.preview}>
                <div className={s.previewLabel}>Шапка формы (превью)</div>
                <table className={s.previewTable}>
                    <thead>
                    <tr>
                        {headerGroups.map((g) => (
                            <th key={`g-top-${g.id}`} colSpan={g.span}>
                                {g.title}
                            </th>
                        ))}
                    </tr>
                    <tr>
                        {headerGroups.map((g) =>
                            g.labels.map((label, idx) => (
                                <th key={`g-sub-${g.id}-${idx}`}>{label}</th>
                            ))
                        )}
                    </tr>
                    </thead>
                </table>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                CONTENT — скроллируемая область с группами
            ═══════════════════════════════════════════════════════════ */}
            <div className={s.content}>
                {loadingRefs ? (
                    <div className={s.loading}>Загрузка связей...</div>
                ) : (
                    <WidgetColumnsMainTable
                        workspaceId={workspaceId}
                        formsById={formsById}
                        loadWidgetForms={loadWidgetForms}
                        onRefsChange={setLiveRefsForHeader}
                        deleteColumnWidget={deleteColumnWidget}
                        updateReference={updateReference}
                        refreshReferences={refreshReferences}
                        updateWidgetColumn={updateWidgetColumn}
                        widgetColumns={widgetColumns}
                        handleDeleteReference={handleDeleteReference}
                        referencesMap={mergedReferencesMap}
                        allColumns={columns}
                    />
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════
                MODALS
            ═══════════════════════════════════════════════════════════ */}

            {/* Modal «Посмотреть таблицу» */}
            <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
                <Box sx={modalStyle}>
                    <h3 style={{ marginBottom: 15 }}>Таблица</h3>
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

            {/* Dialog «Добавить столбец» */}
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