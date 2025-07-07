// components/TableColumns/TableColumns.tsx
import React from 'react';
import * as s from './TableColumn.module.scss';
import {Column, DTable, Widget} from '@/shared/hooks/useWorkSpaces';
import {WidgetSelect} from "@/components/widgetSelect/WidgetSelect";

type Props = {
    columns: Column[];
    tableName: string;
    loading: boolean;
    error: string | null;
    workspaceName: string;
    widgets: Widget[];
    widgetsLoading: boolean;
    widgetsError: string | null;

};

export const TableColumn: React.FC<Props> = ({
                                                 columns, tableName, loading, error, workspaceName, widgets,

                                                 widgetsLoading,
                                                 widgetsError
                                             }) => {
    if (!tableName) return <p className={s.placeholder}>Выберите таблицу…</p>;
    if (loading) return <p>Загрузка столбцов…</p>;
    if (error) return <p className={s.error}>{error}</p>;

    return (
        <div className={s.wrapper}>
            <div className={s.headRow}>
                <div className={s.breadcrumb}>
                    {workspaceName} <span className={s.arrow}>→</span> {tableName}
                </div>
                {/* выпадающий список виджетов */}
                <WidgetSelect
                    widgets={widgets}
                    loading={widgetsLoading}
                    error={widgetsError}
                />
            </div>


            {columns.length === 0
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
                )}
        </div>
    );
};
