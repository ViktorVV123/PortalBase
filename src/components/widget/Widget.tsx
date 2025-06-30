import React, { useEffect } from 'react';
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

    /* ────────── таблица колонок ────────── */
    const renderColumns = () => {
        if (loading)  return <p>Загрузка…</p>;
        if (error)    return <p className={s.error}>{error}</p>;
        if (!widgets.length) return null;
        if (selectedWidgetId === null) return <p>Выберите widget…</p>;
        if (!columns.length)   return <p>Столбцов нет</p>;

        return (
            <div className={s.tableWrapper}>
                <table className={s.table}>
                    <thead>
                    <tr>
                        <th>ID</th><th>alias</th><th>default</th><th>prompt</th>
                        <th>published</th><th>refs</th>
                    </tr>
                    </thead>
                    <tbody>
                    {columns.map(c => (
                        <tr key={c.id}>
                            <td>{c.id}</td>
                            <td>{c.alias ?? '—'}</td>
                            <td>{c.default ?? '—'}</td>
                            <td>{c.promt ?? '—'}</td>
                            <td>{c.published ? '✔︎' : ''}</td>
                            <td>
                                {c.reference.length
                                    ? c.reference.map((r, i) => (
                                        <span key={i}>
                          {r.primary && <b>*</b>}
                                            {r.table_column_id}
                                            {i < c.reference.length - 1 && ', '}
                        </span>
                                    ))
                                    : '—'}
                            </td>
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
