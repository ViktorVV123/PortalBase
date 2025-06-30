import React from 'react';
import { UseWidgetType, WidgetColumn } from '@/shared/hooks/useWidget';
import * as s from './Widget.module.scss';

interface Props {
    widget: UseWidgetType | null;
    columns: WidgetColumn[];

}

const Widget = ({ widget, columns }: Props) => {

    if (!widget) return <p>Для выбранной таблицы виджет не найден</p>;

    return (
        <div >
            <h3 className="mb-2 font-semibold">
                Widget: {widget.name} (id: {widget.id})
            </h3>

            {!columns.length ? (
                <p>Столбцов нет</p>
            ) : (
                <table className="w-full border-collapse">
                    <thead className="bg-gray-50 text-sm">
                    <tr>
                        <th>ID</th><th>alias</th><th>default</th><th>prompt</th>
                        <th>published</th><th>refs</th>
                    </tr>
                    </thead>
                    <tbody>
                    {columns.map(col => (
                        <tr key={col.id} className="odd:bg-gray-50">
                            <td>{col.id}</td>
                            <td>{col.alias ?? '—'}</td>
                            <td>{col.default ?? '—'}</td>
                            <td>{col.promt ?? '—'}</td>
                            <td>{col.published ? '✔︎' : ''}</td>
                            <td>
                                {col.reference.length
                                    ? col.reference.map((r, i) => (
                                        <span key={i}>
                          {r.primary && <b>*</b>}
                                            {r.table_column_id}
                                            {i < col.reference.length - 1 && ', '}
                        </span>
                                    ))
                                    : '—'}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default Widget;
