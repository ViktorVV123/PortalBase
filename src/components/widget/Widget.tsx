/* components/widget/Widget.tsx */
import React from 'react';
import * as s from './Widget.module.scss';
import {WidgetColumn} from "@/shared/hooks/useWidget";
import {Widget} from "@/shared/hooks/useWidget";

interface Props {
    widgets: Widget[];                     // список всех виджетов таблицы
    selectedWidgetId: number | null;       // выбранный widget (id)
    onSelectWidget: (id: number) => void;  // обработчик клика
    columns: WidgetColumn[];               // столбцы выбранного виджета
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
    /* ─────────── левая панель (список виджетов) ─────────── */
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

    /* ─────────── правая панель (колонки) ─────────── */
    const renderColumns = () => {
        if (loading)           return <p>Загрузка…</p>;
        if (error)             return <p className={s.error}>{error}</p>;
        if (!widgets.length)   return null;                    // список уже сказал «нет виджетов»
        if (selectedWidgetId === null) return <p>Выберите widget…</p>;
        if (!columns.length)   return <p>Столбцов нет</p>;

        return (
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
        );
    };

    /* ─────────── UI ─────────── */
    return (
        <div className={s.container}>
            <div className={s.list}>{renderWidgetList()}</div>
            <div className={s.columns}>{renderColumns()}</div>
        </div>
    );
};

export default Widget;
