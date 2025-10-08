import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as s from './SetOfTables.module.scss';
import {
    Column,
    DTable,
    FormDisplay,
    FormTreeColumn, ReferenceItem,
    SubDisplay,
    Widget,
    WidgetColumn,
    WidgetForm,
} from '@/shared/hooks/useWorkSpaces';
import { FormTable } from '@/components/formTable/FormTable';
import { TableColumn } from '@/components/tableColumn/TableColumn';
import {
    WcReference,
    WidgetColumnsOfTable,
} from '@/components/WidgetColumnsOfTable/WidgetColumnsOfTable';
import { TableListView } from '@/components/tableColumn/TableListView';
import {
    buildHeaderGroupsFromWidgetColumns,
    HeaderGroup,
} from '@/shared/utils/headerGroups';
import { api } from '@/services/api';

type Props = {
    columns: Column[];
    tableName: string;
    workspaceName: string;
    loading: boolean;
    error: string | null;

    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: Partial<Pick<ReferenceItem, 'ref_column_order' | 'width' | 'type' | 'ref_alias' | 'default' | 'placeholder' | 'visible' | 'readonly'>>
    ) => Promise<ReferenceItem>;


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
    handleSelectWidget: (widget: Widget | null) => void; // остаётся в API, хотя тут не используется

    /* form */
    selectedFormId: number | null;
    clearFormSelection: () => void;
    formDisplay: FormDisplay;
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
    formsByWidget: Record<number, WidgetForm>; // нужен order
    openForm: (widgetId: number, formId: number) => void;

    deleteColumnTable: (id: number) => void;
    deleteColumnWidget: (id: number) => void;
    updateTableColumn: (id: number, p: Partial<Omit<Column, 'id'>>) => void;
    updateWidgetColumn: (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => Promise<void> | void;

    loadColumnsWidget: (widgetId: number) => void;
    formTrees: Record<number, FormTreeColumn[]>;
    loadFilteredFormDisplay: (
        formId: number,
        filter: { table_column_id: number; value: string | number }
    ) => Promise<void>;
    setFormDisplay: (value: FormDisplay | null) => void;
    setSubDisplay: (value: SubDisplay | null) => void;
    selectedTable: DTable | null;
    updateTableMeta: (id: number, patch: Partial<DTable>) => void;
    setSelectedWidget: React.Dispatch<React.SetStateAction<Widget | null>>;
    setWidgetsByTable: React.Dispatch<React.SetStateAction<Record<number, Widget[]>>>;
    fetchReferences: (widgetColumnId: number) => Promise<WcReference[]>;

    deleteReference: (widgetColumnId: number, tableColumnId: number) => Promise<void>;
    updateWidgetMeta: (id: number, patch: Partial<Widget>) => Promise<Widget>;
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
    publishTable: (id: number) => void;
    formsById: Record<number, WidgetForm>;
    loadWidgetForms: () => Promise<void> | void;
};

export const SetOfTables: React.FC<Props> = (props) => {
    const {
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
        formsById,
        publishTable,
        updateReference,
        clearFormSelection,
        loadWidgetForms,
    } = props;

    // локальные состояния рендера
    const [editingWcId] = useState<number | null>(null);
    const [wcValues] = useState<Partial<WidgetColumn>>({});
    const [referencesMap, setReferencesMap] = useState<Record<number, WcReference[]>>({});
    const [liveRefsForHeader, setLiveRefsForHeader] =
        useState<Record<number, WcReference[]> | null>(null);
    const [subHeaderGroups, setSubHeaderGroups] = useState<HeaderGroup[] | null>(null);

    const currentForm: WidgetForm | null =
        selectedFormId != null
            ? props.formsById[selectedFormId] ?? null
            : selectedWidget
                ? formsByWidget[selectedWidget.id] ?? null
                : null;

    const subWidgetIdByOrder = useMemo(() => {
        const map: Record<number, number> = {};
        currentForm?.sub_widgets?.forEach((sw) => {
            map[sw.widget_order] = sw.sub_widget_id;
        });
        return map;
    }, [currentForm]);

    const currentSubOrder = subDisplay?.displayed_widget?.widget_order ?? null;
    const currentSubWidgetId =
        currentSubOrder != null ? subWidgetIdByOrder[currentSubOrder] : null;

    // ───────── Заголовок-превью (верхняя строка) ─────────
    const headerGroups = useMemo(() => {
        if (!widgetColumns) return [];

        const items = widgetColumns
            .map((wc) => {
                // порядок группы (учитываем временные правки при редактировании)
                const effectiveOrder =
                    editingWcId === wc.id
                        ? (wcValues.column_order ?? wc.column_order ?? 0)
                        : (wc.column_order ?? 0);

                // берём ссылки в приоритете: живые из превью → карта → исходные из WC
                const refsRaw =
                    liveRefsForHeader?.[wc.id] ??
                    referencesMap[wc.id] ??
                    wc.reference ??
                    [];

                // фильтрация по видимости на уровне reference
                const visRefs = refsRaw.filter((r) => r?.visible !== false);
                if (visRefs.length === 0) return null; // вся группа скрыта

                // заголовок: alias из редактируемого значения, иначе имя первой видимой колонки
                const aliasFromState =
                    (editingWcId === wc.id ? wcValues.alias : wc.alias) ?? '';
                const effectiveAlias = typeof aliasFromState === 'string' ? aliasFromState.trim() : '';
                const title =
                    effectiveAlias ||
                    visRefs[0]?.table_column?.name ||
                    `Колонка #${wc.id}`;

                // подписи и список refIds — только по видимым ссылкам
                const labels = visRefs.map((r) => r.ref_alias || '');
                const refIds = visRefs
                    .map((r) => r.table_column?.id)
                    .filter((id): id is number => typeof id === 'number');

                // span равен числу видимых reference (минимум 1 по смыслу, но тут >0)
                const span = Math.max(1, visRefs.length);

                return { id: wc.id, order: effectiveOrder, title, span, labels, refIds };
            })
            .filter(Boolean) as {
            id: number;
            order: number;
            title: string;
            span: number;
            labels: string[];
            refIds: number[];
        }[];

        items.sort((a, b) => a.order - b.order || a.id - b.id);
        return items;
    }, [widgetColumns, referencesMap, liveRefsForHeader, editingWcId, wcValues]);


    // ───────── Саб-заголовки для subWidget (быстрее + безопаснее) ─────────
    useEffect(() => {
        let aborted = false;

        async function loadSubHeaderGroups() {
            try {
                if (!currentSubWidgetId) {
                    if (!aborted) setSubHeaderGroups(null);
                    return;
                }

                const { data: subWidgetColumns } = await api.get<WidgetColumn[]>(
                    `/widgets/${currentSubWidgetId}/columns`
                );

                const refsArr = await Promise.all(
                    subWidgetColumns.map(async (wc) => {
                        try {
                            const refs = await fetchReferences(wc.id);
                            return [wc.id, refs] as const;
                        } catch {
                            return [wc.id, wc.reference ?? []] as const;
                        }
                    })
                );

                const subRefsMap: Record<number, WcReference[]> = {};
                for (const [id, refs] of refsArr) subRefsMap[id] = refs;

                if (!aborted) {
                    const groups = buildHeaderGroupsFromWidgetColumns(subWidgetColumns, subRefsMap);
                    setSubHeaderGroups(groups);
                }
            } catch (err) {
                // Если запрос упал — просто сбрасываем группы
                if (!aborted) setSubHeaderGroups(null);
                console.warn('loadSubHeaderGroups error:', err);
            }
        }

        loadSubHeaderGroups();
        return () => {
            aborted = true;
        };
    }, [currentSubWidgetId, fetchReferences]);

    // Навигация в бредкрамбе
    const goToTable = useCallback(() => {
        setSubDisplay(null);
        setFormDisplay(null);
        handleClearWidget();
    }, [handleClearWidget, setFormDisplay, setSubDisplay]);

    const goToWidget = useCallback(() => {
        if (!selectedWidget) return;
        clearFormSelection();
        setSubDisplay(null);
        setFormDisplay(null);
        loadColumnsWidget(selectedWidget.id);
    }, [clearFormSelection, loadColumnsWidget, selectedWidget, setFormDisplay, setSubDisplay]);

    const widgetTitle = useMemo(() => selectedWidget?.name ?? 'Виджет', [selectedWidget]);
    const formTitle = useMemo(
        () =>
            selectedFormId != null
                ? props.formsById[selectedFormId]?.name ?? `Форма #${selectedFormId}`
                : null,
        [props.formsById, selectedFormId]
    );
    const subTitle = useMemo(
        () => subDisplay?.displayed_widget?.name ?? null,
        [subDisplay?.displayed_widget?.name]
    );

    if (loading) return <p>Загрузка…</p>;
    if (error) return <p className={s.error}>{error}</p>;

    return (
        <div className={s.wrapper}>
            {/* ─── breadcrumb ─── */}
            <div className={s.headRow}>
                <div className={s.breadcrumb}>
                    {workspaceName} <span className={s.arrow}>→</span>
                    {selectedWidget ? (
                        <>
              <span className={s.link} onClick={goToTable}>
                {tableName}
              </span>
                            <span className={s.arrow}>→</span>

                            <span className={s.link} onClick={goToWidget}>
                {widgetTitle}
              </span>

                            {formTitle && (
                                <>
                                    <span className={s.arrow}>→</span>
                                    <span>{formTitle}</span>
                                </>
                            )}

                            {subTitle && (
                                <>
                                    <span className={s.arrow}>→</span>
                                    <span>{subTitle}</span>
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
                    <FormTable
                        formsById={formsById}
                        subHeaderGroups={subHeaderGroups || undefined}
                        headerGroups={headerGroups}
                        setSubDisplay={setSubDisplay}
                        formTrees={formTrees}
                        selectedFormId={selectedFormId}
                        subDisplay={subDisplay}
                        subError={subError}
                        subLoading={subLoading}
                        selectedWidget={selectedWidget}
                        formsByWidget={formsByWidget}
                        loadFilteredFormDisplay={loadFilteredFormDisplay}
                        setFormDisplay={setFormDisplay}
                        loadSubDisplay={loadSubDisplay}
                        formDisplay={formDisplay}
                    />
                ) : null
            ) : /* ─── PRIORITY 2 : WIDGET ─── */ selectedWidget ? (
                wColsLoading ? (
                    <p>Загрузка виджета…</p>
                ) : wColsError ? (
                    <p className={s.error}>{wColsError}</p>
                ) : (
                    <WidgetColumnsOfTable loadWidgetForms={loadWidgetForms} formsById={formsById}
                        headerGroups={headerGroups}
                        referencesMap={referencesMap}
                        setLiveRefsForHeader={setLiveRefsForHeader}
                        setReferencesMap={setReferencesMap}
                        updateReference={updateReference}
                        updateWidgetColumn={updateWidgetColumn}
                        addWidgetColumn={addWidgetColumn}
                        deleteReference={deleteReference}
                        fetchReferences={fetchReferences}
                        updateWidgetMeta={updateWidgetMeta}
                        setWidgetsByTable={setWidgetsByTable}
                        setSelectedWidget={setSelectedWidget}
                        columns={columns}
                        updateTableColumn={updateTableColumn}
                        deleteColumnTable={deleteColumnTable}
                        deleteColumnWidget={deleteColumnWidget}
                        addReference={addReference}
                        widgetColumns={widgetColumns}
                        loadColumnsWidget={loadColumnsWidget}
                        selectedWidget={selectedWidget}
                    />
                )
            ) : /* ─── PRIORITY 3 : TABLE COLUMNS ─── */ columns.length === 0 ? (
                <p>Нет столбцов</p>
            ) : (
                <div>
                    <TableListView
                        publishTable={publishTable}
                        selectedTable={selectedTable}
                        updateTableMeta={updateTableMeta}
                    />
                    <TableColumn
                        updateTableColumn={updateTableColumn}
                        columns={columns}
                        deleteColumnTable={deleteColumnTable}
                    />
                </div>
            )}
        </div>
    );
};
