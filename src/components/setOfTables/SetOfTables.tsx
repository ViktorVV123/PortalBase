import React, {useState} from 'react';
import * as s from './SetOfTables.module.scss';
import {Column, FormDisplay, SubDisplay, Widget, WidgetColumn, WidgetForm} from '@/shared/hooks/useWorkSpaces';
import {FormTable} from "@/components/formTable/FormTable";
import DeleteIcon from '@/assets/image/DeleteIcon.svg'
import EditIcon from '@/assets/image/EditIcon.svg'
import {TableColumn} from "@/components/tableColumn/TableColumn";

type Props = {
    columns: Column[];
    tableName: string;
    workspaceName: string;
    loading: boolean;
    error: string | null;

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
    updateWidgetColumn:any
};

export const SetOfTables: React.FC<Props> = ({
                                                 /* базовые */
                                                 columns,
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
                                                 updateTableColumn,updateWidgetColumn
                                             }) => {


    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<Partial<Column>>({});
    const startEdit = (col: Column) => {
        setEditingId(col.id);
        setEditValues({        // копируем все редактируемые поля
            name: col.name,
            description: col.description ?? '',
            datatype: col.datatype,
            length: col.length ?? '',
            precision: col.precision ?? '',
            primary: col.primary,
            increment: col.increment,
            required: col.required,
            datetime: col.datetime,
        });
    };
    const cancelEdit = () => {
        setEditingId(null);
        setEditValues({});
    };

    const handleChange = (field: keyof Column, value: any) =>
        setEditValues(prev => ({...prev, [field]: value}));

    const cleanPatch = (p: Partial<Column>): Partial<Column> => {
        const patch: any = {...p};

        // ↴ превращаем '' → null  /  убираем поля, которые не меняли
        ['length', 'precision'].forEach(k => {
            if (patch[k] === '' || patch[k] === undefined) delete patch[k];
        });

        return patch;
    };

    const saveEdit = async () => {
        if (editingId == null) return;
        await updateTableColumn(editingId, cleanPatch(editValues));
        cancelEdit();
    };


    const [editingWcId,  setEditingWcId]  = useState<number|null>(null);
    const [wcValues,     setWcValues]     = useState<Partial<WidgetColumn>>({});

    const startWcEdit = (wc: WidgetColumn) => {
        setEditingWcId(wc.id);
        setWcValues({
            alias:   wc.alias   ?? '',
            default: wc.default ?? '',
            promt:   wc.promt   ?? '',
            published: wc.published,
        });
    };
    const cancelWcEdit = () => { setEditingWcId(null); setWcValues({}); };

    const saveWcEdit   = async () => {
        if (editingWcId == null) return;
        await updateWidgetColumn(editingWcId, wcValues);
        cancelWcEdit();
    };



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
                            <span className={s.link} onClick={handleClearWidget}>{tableName}</span>
                            <span className={s.arrow}>→</span>
                            {selectedFormId ? (
                                <span className={s.link} onClick={() => handleClearWidget()}>
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
                        <FormTable subDisplay={subDisplay} subError={subError} subLoading={subLoading}
                                   selectedWidget={selectedWidget} formsByWidget={formsByWidget}
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
                            <table className={s.tbl}>
                                <thead>
                                <tr>
                                    <th>alias</th>
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
                                    /* ― 1. берём первую связь, если она есть ― */
                                    const ref = wc.reference[0];          // undefined | { … }
                                    const col = ref?.table_column;        // undefined | TableColumn

                                    const isEd = editingWcId === wc.id;

                                    return (
                                        <tr key={wc.id}>
                                            {/* alias ─────────────────────────────────── */}
                                            <td>
                                                {isEd
                                                    ? <input value={wcValues.alias as string}
                                                             onChange={e => setWcValues(v => ({
                                                                 ...v,
                                                                 alias: e.target.value
                                                             }))}
                                                             className={s.inp}/>
                                                    : wc.alias ?? '—'}
                                            </td>

                                            {/* name (может быть undefined) ───────────── */}
                                            <td>{col?.name ?? '—'}</td>

                                            {/* datatype ─────────────────────────────── */}
                                            <td>{col?.datatype ?? '—'}</td>

                                            {/* length / precision ───────────────────── */}
                                            <td>{col?.length ?? '—'}</td>
                                            <td>{col?.precision ?? '—'}</td>

                                            {/* flags (тоже с ?) ─────────────────────── */}
                                            <td>{ref?.primary ? '✔︎' : ''}</td>
                                            <td>{ref?.visible ? '✔︎' : ''}</td>

                                            {/* actions ──────────────────────────────── */}
                                            <td className={s.actionsCell}>
                                                {isEd ? (
                                                    <>
                                                        <button className={s.okBtn} onClick={saveWcEdit}>✓</button>
                                                        <button className={s.cancelBtn} onClick={cancelWcEdit}>✕
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
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

                            </table>
                        )
                    )

                    /* ─── PRIORITY 3 : TABLE COLUMNS ─── */
                    : (
                        columns.length === 0
                            ? <p>Нет выбранных форм</p>
                            : (
                                <TableColumn cancelEdit={cancelEdit} saveEdit={saveEdit} startEdit={startEdit}
                                             columns={columns}
                                             deleteColumnTable={deleteColumnTable} editingId={editingId}
                                             editValues={editValues} handleChange={handleChange}/>
                            )
                    )}


        </div>
    );
};
