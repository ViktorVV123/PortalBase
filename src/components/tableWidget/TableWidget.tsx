import React from 'react';
import * as s from "@/components/tableColumn/TableColumn.module.scss";
import {Widget, WidgetColumn} from "@/shared/hooks/useWorkSpaces";

type TableWidgetProps = {
    wColsLoading: boolean;
    wColsError: string | null;
    handleSelectWidget: (w: Widget) => void;
    widgetColumns: WidgetColumn[];
}

export const TableWidget = ({wColsLoading,wColsError,widgetColumns}:TableWidgetProps) => {
    return (
        <div className={s.widgetBlock}>
            {wColsLoading && <p>Загрузка виджета…</p>}
            {wColsError && <p className={s.error}>{wColsError}</p>}
            {!wColsLoading && !wColsError && widgetColumns.length > 0 && (
                <div>

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
                    {widgetColumns.map(wc => (
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
                    ))}
                    </tbody>
                </table>
            </div> )}
        </div>
    );
};

