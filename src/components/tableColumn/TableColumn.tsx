// components/TableColumns/TableColumns.tsx
import React, {useState} from 'react';
import * as s from './TableColumn.module.scss';
import {Column, DTable, Widget, WidgetColumn} from '@/shared/hooks/useWorkSpaces';
import {WidgetSelect} from "@/components/widgetSelect/WidgetSelect";
import {TableWidget} from "@/components/tableWidget/TableWidget";

type Props = {
    columns: Column[];
    tableName: string;
    loading: boolean;
    error: string | null;
    workspaceName: string;
    widgetColumns: WidgetColumn[];
    wColsLoading: boolean;
    wColsError: string | null;
    handleSelectWidget: (w: Widget) => void;
    selectedWidget: Widget | null;
    handleClearWidget: () => void;

};

export const TableColumn: React.FC<Props> = ({
                                                 columns, tableName, loading, error, workspaceName,
                                                 widgetColumns,
                                                 wColsLoading,
                                                 wColsError,
                                                 handleSelectWidget,
                                                 selectedWidget,
                                                 handleClearWidget,
                                             }) => {


    if (!tableName) return <p className={s.placeholder}>Выберите таблицу…</p>;
    if (loading) return <p>Загрузка столбцов…</p>;
    if (error) return <p className={s.error}>{error}</p>;

    return (
        <div className={s.wrapper}>
            <div className={s.headRow}>
                <div className={s.breadcrumb}>
                    {workspaceName} <span className={s.arrow}>→</span>
                    {selectedWidget ? (
                        <>
                            {/* кликаем — возвращаемся к таблице */}
                            <span className={s.link} onClick={handleClearWidget}>
                {tableName}
              </span>

                            <span className={s.arrow}>→</span>
                            {/* имя выбранного widget */}
                            <span>{selectedWidget.name}</span>
                        </>
                    ) : (
                        <span>{tableName}</span>
                    )}
                </div>
            </div>
            {/* ────────── таблица для виджета ────────── */}
            {selectedWidget ? (<TableWidget widgetColumns={widgetColumns} handleSelectWidget={handleSelectWidget}
                                            wColsError={wColsError}
                                            wColsLoading={wColsLoading}/>)
                :

                (columns.length === 0
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
                    ))}


        </div>
    );
};
