import React, {useEffect} from 'react';
import * as s from './Widget.module.scss';
import {WidgetColumn, Widget} from "@/shared/hooks/useWidget";


interface Props {
    widgets: Widget[];
    selectedWidgetId: number | null;
    onSelectWidget: (id: number) => void;
    columns: WidgetColumn[];
    loading: boolean;
    error: string | null;
}

const Widget = ({
                    widgets,
                    selectedWidgetId,
                    onSelectWidget,
                    columns,
                    loading,
                    error,
                }: Props) => {
    /* ────────── авто-выбор ────────── */
    useEffect(() => {
        if (widgets.length && selectedWidgetId === null) {
            onSelectWidget(widgets[0].id);    // подгружаем 1-й widget
        }
    }, [widgets, selectedWidgetId, onSelectWidget]);

    /* ────────── список widgets ────────── */
    const renderWidgetList = () => {
        if (!widgets.length) return <p>Виджетов нет</p>;

        return widgets.map(w => (
            <div

                key={w.id}
                className={`${s.item} ${w.id === selectedWidgetId ? s.active : ''}`}
                onClick={() => onSelectWidget(w.id)}
            >
                {w.name}
            </div>
        ));
    };

    if (!columns.length) return <p>References нет</p>;

    /** расплющиваем reference-массивы всех колонок */
    const refs = columns.flatMap(c =>
        c.reference.map(r => ({
            columnId: c.id,
            width: r.width,
            primary: r.primary,
            visible: r.visible,
            tc: r.table_column,
        })),
    );

    /* ────────── таблица колонок ────────── */
    const renderColumns = () => {
        if (loading) return <p>Загрузка…</p>;
        if (error) return <p className={s.error}>{error}</p>;
        if (!widgets.length) return null;
        if (selectedWidgetId === null) return <p>Выберите widget…</p>;
        if (!columns.length) return <p>Столбцов нет</p>;

        return (
            <div className={s.tableWrapper}>
                <table className={s.table}>
                    <thead>
                    <tr>
                        <th>w_col&nbsp;ID</th>
                        <th>tbl_col&nbsp;ID</th>
                        <th>name</th>
                        <th>description</th>
                        <th>datatype</th>
                        <th>length</th>
                        <th>precision</th>
                        <th>primary</th>
                        <th>increment</th>
                        <th>datetime</th>
                        <th>required</th>
                        <th>width</th>
                        <th>visible</th>
                    </tr>
                    </thead>
                    <tbody>
                    {refs.map(r => (
                        <tr key={`${r.columnId}-${r.tc.id}`}>
                            <td>{r.columnId}</td>
                            <td>{r.tc.id}</td>
                            <td>{r.tc.name}</td>
                            <td>{r.tc.description ?? '—'}</td>
                            <td>{r.tc.datatype}</td>
                            <td>{r.tc.length ?? '—'}</td>
                            <td>{r.tc.precision ?? '—'}</td>
                            <td>{r.tc.primary ? '✔︎' : ''}</td>
                            <td>{r.tc.increment ? '✔︎' : ''}</td>
                            <td>{r.tc.datetime ? '✔︎' : ''}</td>
                            <td>{r.tc.required ? '✔︎' : ''}</td>
                            <td>{r.width}</td>
                            <td>{r.visible ? '👁' : ''}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        );
    };

    /* ────────── UI ────────── */
    return (
        <div className={s.container}>
            <div className={s.list}>{renderWidgetList()}</div>
            <div className={s.columns}>{renderColumns()}</div>
        </div>
    );
};

export default Widget;
