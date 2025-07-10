import React from 'react';
import * as s from './TableColumn.module.scss';
import {Column, FormDisplay, SubDisplay, Widget, WidgetColumn, WidgetForm} from '@/shared/hooks/useWorkSpaces';
import {FormTable} from "@/components/formTable/FormTable";

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
};

export const TableColumn: React.FC<Props> = ({
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
                                                 loadSubDisplay
                                             }) => {
    if (!tableName) return <p className={s.placeholder}>Выберите таблицу…</p>;
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
                        <FormTable subDisplay={subDisplay} subError={subError} subLoading={subLoading} selectedWidget={selectedWidget} formsByWidget={formsByWidget}
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
                                </tr>
                                </thead>
                                <tbody>
                                {widgetColumns.flatMap(wc =>
                                    wc.reference.map(ref => {
                                        const c = ref.table_column;
                                        return (
                                            <tr key={`${wc.id}-${c.id}`}>
                                                <td>{wc.alias ?? '—'}</td>
                                                <td>{c.name}</td>
                                                <td>{c.datatype}</td>
                                                <td>{c.length ?? '—'}</td>
                                                <td>{c.precision ?? '—'}</td>
                                                <td>{c.primary ? '✔︎' : ''}</td>
                                                <td>{c.required ? '✔︎' : ''}</td>
                                            </tr>
                                        );
                                    })
                                )}
                                </tbody>
                            </table>
                        )
                    )

                    /* ─── PRIORITY 3 : TABLE COLUMNS ─── */
                    : (
                        columns.length === 0
                            ? <p>Столбцы не найдены.</p>
                            : (
                                <table className={s.tbl}>
                                    <thead>
                                    <tr>
                                        <th>name</th>
                                        <th>datatype</th>
                                        <th>length</th>
                                        <th>precision</th>
                                        <th>primary</th>
                                        <th>required</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {columns.map(c => (
                                        <tr key={c.id}>
                                            <td>{c.name}</td>
                                            <td>{c.datatype}</td>
                                            <td>{c.length ?? '—'}</td>
                                            <td>{c.precision ?? '—'}</td>
                                            <td>{c.primary ? '✔︎' : ''}</td>
                                            <td>{c.required ? '✔︎' : ''}</td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            )
                    )}




        </div>
    );
};
