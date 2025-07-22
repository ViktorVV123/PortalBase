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
    addReference:any
    loadColumns:any
    loadColumnsWidget:any
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
                                                 updateTableColumn,updateWidgetColumn,addReference,loadColumns,loadColumnsWidget
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
            placeholder: wc.default ?? '',
            published: wc.published,
            type: wc.type,
        });
    };
    const cancelWcEdit = () => { setEditingWcId(null); setWcValues({}); };

    const saveWcEdit   = async () => {
        if (editingWcId == null) return;
        await updateWidgetColumn(editingWcId, wcValues);
        cancelWcEdit();
    };

    const handleMerge = async (wColId: number) => {
        if (selectedWidget == null) return;

        const input = prompt('Введите tbl_col ID, который нужно привязать:');
        const tblId = Number(input);
        if (!tblId) return;

        try {
            await addReference(wColId, tblId, {
                width: 33,
                visible: false,
                primary: false,
            });

            // 👇 обновляем именно виджет-колонки
            await loadColumnsWidget(selectedWidget.id);
        } catch (e) {
            alert('Не удалось добавить reference');
            console.error(e);
        }
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
                                {widgetColumns.flatMap(wc => {
                                    const isEd = editingWcId === wc.id;

                                    // если нет reference — рендерим одну строку
                                    if (!wc.reference.length) {
                                        return (
                                            <tr key={`${wc.id}-no-ref`}>
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
                                                               }))}
                                                        />
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
                                                <td colSpan={9} style={{textAlign: 'center', color: '#999'}}>нет
                                                    связей
                                                </td>
                                                <td className={s.actionsCell}>
                                                    {isEd ? (
                                                        <>
                                                            <button className={s.okBtn} onClick={saveWcEdit}>✓</button>
                                                            <button className={s.cancelBtn} onClick={cancelWcEdit}>✕
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => handleMerge(wc.id)}>+</button>
                                                            <EditIcon className={s.actionIcon}
                                                                      onClick={() => startWcEdit(wc)}/>
                                                            <DeleteIcon className={s.actionIcon} onClick={() =>
                                                                confirm('Удалить?') && deleteColumnWidget(wc.id)}/>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    }

                                    // если есть reference[] — делаем отдельную строку на каждую
                                    return wc.reference.map((ref, i) => {
                                        const col = ref.table_column;
                                        return (
                                            <tr key={`${wc.id}-${col.id}`}>
                                                <td>{wc.id}</td>
                                                <td>{wc.widget_id}</td>

                                                <td>{wc.alias ?? '—'}</td>
                                                <td>{wc.default ?? '—'}</td>
                                                <td>{wc.placeholder ?? '—'}</td>
                                                <td>{wc.published ? '✔︎' : ''}</td>
                                                <td>{wc.type ?? '—'}</td>

                                                <td>{col.id}</td>
                                                <td>{col.table_id}</td>
                                                <td>{col.name}</td>
                                                <td>{col.datatype}</td>
                                                <td>{col.length}</td>
                                                <td>{col.precision}</td>
                                                <td>{ref.primary ? '✔︎' : ''}</td>
                                                <td>{ref.visible ? '✔︎' : ''}</td>

                                                {i === 0 && (
                                                    <td rowSpan={wc.reference.length} className={s.actionsCell}>
                                                        <button onClick={() => handleMerge(wc.id)}>+</button>
                                                        <EditIcon className={s.actionIcon}
                                                                  onClick={() => startWcEdit(wc)}/>
                                                        <DeleteIcon className={s.actionIcon}
                                                                    onClick={() => confirm('Удалить?') && deleteColumnWidget(wc.id)}/>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    });
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
