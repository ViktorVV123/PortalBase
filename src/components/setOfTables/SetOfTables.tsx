import React, {useEffect, useMemo, useState} from 'react';
import * as s from './SetOfTables.module.scss';
import {
    Column, DTable,
    FormDisplay, FormTreeColumn,
    SubDisplay,
    Widget,
    WidgetColumn,
    WidgetForm
} from '@/shared/hooks/useWorkSpaces';
import {FormTable} from "@/components/formTable/FormTable";
import {TableColumn} from "@/components/tableColumn/TableColumn";
import {WcReference, WidgetColumnsOfTable} from '@/components/WidgetColumnsOfTable/WidgetColumnsOfTable'
import {TableListView} from "@/components/tableColumn/TableListView";
import {buildHeaderGroupsFromWidgetColumns, HeaderGroup} from "@/shared/headerGroups";
import {api} from "@/services/api";

type Props = {
    columns: Column[];
    tableName: string;
    workspaceName: string;
    loading: boolean;
    error: string | null;
    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: Partial<Pick<WcReference, 'width'|'ref_column_order'>>
    ) => Promise<WcReference>;

    addReference: (
        widgetColId: number,
        tblColId: number,
        payload: { width: number; ref_column_order: number }
    ) => Promise<void>;
    /* widget */
    widgetColumns: WidgetColumn[];
    wColsLoading: boolean;
    wColsError: string | null;
    selectedWidget: Widget | null;
    handleClearWidget: () => void;
    handleSelectWidget: (widget: Widget | null) => void;   // ← добавили
    /* form */
    selectedFormId: number | null;
    formDisplay: FormDisplay
    formLoading: boolean;
    formError: string | null;
    formName: string;

    loadSubDisplay: (
        formId: number,
        subOrder: number,
        primary: Record<string, unknown>
    ) => void;
    subDisplay: SubDisplay | null;
    subLoading: boolean;
    subError: string | null;
    formsByWidget: Record<number, WidgetForm>;   // нужен order
    openForm: (widgetId: number, formId: number) => void;
    deleteColumnTable: (id: number) => void;
    deleteColumnWidget: (id: number) => void;
    updateTableColumn: (id: number, p: Partial<Omit<Column, 'id'>>) => void;
    updateWidgetColumn: (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => Promise<void> | void;

    loadColumnsWidget: (widgetId: number) => void;
    formTrees: Record<number, FormTreeColumn[]>
    loadFilteredFormDisplay: (formId: number, filter: {
        table_column_id: number;
        value: string | number
    }) => Promise<void>;
    setFormDisplay: (value: FormDisplay | null) => void
    setSubDisplay: (value: SubDisplay | null) => void;
    selectedTable: DTable | null;
    updateTableMeta: (id: number, patch: Partial<DTable>) => void;
    setSelectedWidget: any
    setWidgetsByTable: React.Dispatch<React.SetStateAction<Record<number, Widget[]>>>
    fetchReferences: any

    deleteReference: any
    updateWidgetMeta: any
    addWidgetColumn: (payload: {
        widget_id: number;
        alias: string;
        default: string;
        placeholder: string;
        visible: boolean;
        type: string;
        column_order: number;
    }) => Promise<WidgetColumn>;
    tablesByWs: Record<number, DTable[]>;
    publishTable: (id: number) => void
};

export const SetOfTables: React.FC<Props> = ({
                                                 /* базовые */
                                                 fetchReferences,
                                                 deleteReference,
                                                 updateWidgetMeta,
                                                 columns,
                                                 setWidgetsByTable,
                                                 tableName,
                                                 workspaceName,
                                                 loading,
                                                 error,
                                                 /* widget */
                                                 widgetColumns,
                                                 wColsLoading,
                                                 wColsError,
                                                 selectedWidget,
                                                 handleClearWidget,
                                                 /* form */
                                                 selectedFormId,
                                                 formDisplay,
                                                 formLoading,
                                                 formError,
                                                 formName,
                                                 subDisplay,
                                                 subLoading,
                                                 subError,
                                                 formsByWidget,
                                                 loadSubDisplay,
                                                 deleteColumnTable,
                                                 deleteColumnWidget,
                                                 updateTableColumn,
                                                 updateWidgetColumn,
                                                 addReference,
                                                 loadColumnsWidget,
                                                 formTrees,
                                                 loadFilteredFormDisplay,
                                                 setFormDisplay,
                                                 setSubDisplay,
                                                 selectedTable,
                                                 updateTableMeta,
                                                 setSelectedWidget,
                                                 addWidgetColumn,

                                                 publishTable,
                                                 updateReference

                                             }) => {

    const [editingWcId] = useState<number | null>(null);
    const [wcValues] = useState<Partial<WidgetColumn>>({});
    const [referencesMap, setReferencesMap] = useState<Record<number, WcReference[]>>({});
    // состояние для актуальных ссылок с фронта
    const [liveRefsForHeader, setLiveRefsForHeader] = useState<Record<number, WcReference[]> | null>(null);
    const [subHeaderGroups, setSubHeaderGroups] = useState<HeaderGroup[] | null>(null);

    const subWidgetIdByOrder = useMemo(() => {
        const map: Record<number, number> = {};
        const wf = selectedWidget ? formsByWidget[selectedWidget.id] : undefined;
        wf?.sub_widgets.forEach(sw => {
            map[sw.widget_order] = sw.sub_widget_id;
        });
        return map;
    }, [selectedWidget, formsByWidget]);

    const currentSubOrder = subDisplay?.displayed_widget?.widget_order ?? null;
    const currentSubWidgetId = currentSubOrder != null ? subWidgetIdByOrder[currentSubOrder] : null;




    // ───────── Заголовок-превью ─────────
// ───────── Заголовок-превью ─────────
    const headerGroups = useMemo(() => {
        const items = widgetColumns
            .map((wc) => {
                const effectiveOrder =
                    editingWcId === wc.id
                        ? (wcValues.column_order ?? wc.column_order ?? 0)
                        : (wc.column_order ?? 0);

                const effectiveVisible =
                    editingWcId === wc.id
                        ? (wcValues.visible ?? wc.visible)
                        : wc.visible;

                if (!effectiveVisible) return null;

                const refs =
                    liveRefsForHeader?.[wc.id] ??
                    referencesMap[wc.id] ??
                    wc.reference ??
                    [];

                const span = Math.max(1, refs.length || 1);
                const effectiveAlias = (editingWcId === wc.id ? wcValues.alias : wc.alias)?.trim();
                const title = effectiveAlias || refs[0]?.table_column?.name || `Колонка #${wc.id}`;

                const labels =
                    refs.length > 0
                        ? refs.map(r => r.ref_alias || '')
                        : ['—'];

                // ⬅️ ДОБАВЛЕНО: порядок reference по table_column_id
                const refIds =
                    refs.length > 0
                        ? refs.map(r => r.table_column?.id).filter((id): id is number => !!id)
                        : [];

                return { id: wc.id, order: effectiveOrder, title, span, labels, refIds };
            })
            .filter(Boolean) as {
            id: number; order: number; title: string; span: number; labels: string[]; refIds: number[];
        }[];

        items.sort((a, b) => (a.order - b.order) || (a.id - b.id));
        return items;
    }, [widgetColumns, referencesMap, liveRefsForHeader, editingWcId, wcValues]);

    useEffect(() => {
        let aborted = false;

        async function loadSubHeaderGroups() {
            if (!currentSubWidgetId) { setSubHeaderGroups(null); return; }

            // 1) колонки саб-виджета
            // предполагаемый эндпойнт; если у тебя другой — подставь свой
            const { data: widgetColumns } = await api.get(`/widgets/${currentSubWidgetId}/columns`);

            // 2) refs для каждой wc (используем твой fetchReferences)
            const referencesMap: Record<number, any[]> = {};
            for (const wc of widgetColumns) {
                try {
                    // ожидаем, что fetchReferences(wc.id) вернёт массив ссылок (WcReference[])
                    referencesMap[wc.id] = await fetchReferences(wc.id);
                } catch (e) {
                    referencesMap[wc.id] = wc.reference ?? [];
                }
            }

            if (aborted) return;
            setSubHeaderGroups(buildHeaderGroupsFromWidgetColumns(widgetColumns, referencesMap));
        }

        loadSubHeaderGroups().catch(console.warn);
        return () => { aborted = true; };
    }, [currentSubWidgetId, fetchReferences]);


    if (loading) return <p>Загрузка…</p>;
    if (error) return <p className={s.error}>{error}</p>;

    /* =====  UI  ===== */
    return (
        <div className={s.wrapper}>
            {/* ─── breadcrumb ─── */}
            <div className={s.headRow}>
                <div className={s.breadcrumb}>
                    {workspaceName} <span className={s.arrow}>→</span>

                    {selectedWidget ? (
                        <>
                            <span onClick={handleClearWidget}>{tableName}</span>
                            <span className={s.arrow}>→</span>
                            {selectedFormId ? (
                                <span onClick={() => handleClearWidget()}>
       {selectedWidget.name}
                                         </span>
                            ) : (
                                <span>{selectedWidget.name}</span>
                            )}


                            {formName && (
                                <>
                                    <span className={s.arrow}>→</span>
                                    <span>{formName}</span>
                                </>
                            )}
                        </>
                    ) : (
                        <span>{tableName}</span>
                    )}
                </div>
            </div>

            {/* ─── PRIORITY 1 : FORM ─── */}
            {selectedFormId ? (
                    formLoading ? (
                        <p>Загрузка формы…</p>
                    ) : formError ? (
                        <p className={s.error}>{formError}</p>
                    ) : formDisplay ? (
                        <FormTable subHeaderGroups={subHeaderGroups || undefined}  headerGroups={headerGroups}  setSubDisplay={setSubDisplay} formTrees={formTrees} selectedFormId={selectedFormId}
                                   subDisplay={subDisplay} subError={subError} subLoading={subLoading}
                                   selectedWidget={selectedWidget} formsByWidget={formsByWidget}
                                   loadFilteredFormDisplay={loadFilteredFormDisplay} setFormDisplay={setFormDisplay}
                                   loadSubDisplay={loadSubDisplay} formDisplay={formDisplay}/>
                    ) : null
                )

                /* ─── PRIORITY 2 : WIDGET ─── */
                : selectedWidget ? (
                        wColsLoading ? (
                            <p>Загрузка виджета…</p>
                        ) : wColsError ? (
                            <p className={s.error}>{wColsError}</p>
                        ) : (
                            <WidgetColumnsOfTable headerGroups={headerGroups} referencesMap={referencesMap} setLiveRefsForHeader={setLiveRefsForHeader} setReferencesMap={setReferencesMap} updateReference={updateReference} updateWidgetColumn={updateWidgetColumn}
                addWidgetColumn={addWidgetColumn}
                                                  deleteReference={deleteReference} fetchReferences={fetchReferences}
                                                  updateWidgetMeta={updateWidgetMeta}
                                                  setWidgetsByTable={setWidgetsByTable}
                                                  setSelectedWidget={setSelectedWidget} columns={columns}
                                                  updateTableColumn={updateTableColumn}
                                                  deleteColumnTable={deleteColumnTable}
                                                  deleteColumnWidget={deleteColumnWidget} addReference={addReference}
                                                  widgetColumns={widgetColumns}
                                                  loadColumnsWidget={loadColumnsWidget} selectedWidget={selectedWidget}/>
                        )
                    )

                    /* ─── PRIORITY 3 : TABLE COLUMNS ─── */
                    : (
                        columns.length === 0
                            ? <p>Нет выбранных форм</p>
                            : (
                                <div>
                                    <TableListView publishTable={publishTable} selectedTable={selectedTable}
                                                   updateTableMeta={updateTableMeta}/>
                                    <TableColumn
                                        updateTableColumn={updateTableColumn}
                                        columns={columns}
                                        deleteColumnTable={deleteColumnTable}/>
                                </div>
                            )
                    )}


        </div>
    );
};
