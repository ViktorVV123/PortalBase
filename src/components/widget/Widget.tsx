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
    addReference:any
    loadColumns:any
}

const Widget = ({
                    widgets,
                    selectedWidgetId,
                    onSelectWidget,
                    columns,
                    loading,
                    error,
                    loadColumns,
                    addReference
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

    const handleMerge = async (wColId: number) => {
        if (selectedWidgetId == null) return;

        /* спрашиваем у пользователя ID колонки таблицы */
        const input = prompt('Введите tbl_col ID, который нужно привязать:');
        const tblId = Number(input);
        if (!tblId) return;

        try {
            await addReference(wColId, tblId, {
                width: 33,
                visible: false,
                primary: false,
            });

            /* подтянуть обновлённые колонки */
            await loadColumns(selectedWidgetId);
        } catch (e) {
            alert('Не удалось добавить reference');
            console.error(e);
        }
    };



    /** расплющиваем reference-массивы всех колонок *+/** для каждой widget-колонки собираем агрегаты */
        const rows = columns.map(col => {
          const refs = col.reference;

              const join = <T,>(arr: T[], sep = ', ') =>
                arr.map(v => (v ?? '—') as string).join(sep);

              return {
                colId: col.id,
                ids:       join(refs.map(r => r.table_column.id)),
                names:     join(refs.map(r => r.table_column.name)),
                descr:     join(refs.map(r => r.table_column.description ?? '—'), ' | '),
                dtypes:    join(refs.map(r => r.table_column.datatype)),
                lengths:   join(refs.map(r => r.table_column.length ?? '—')),
                precs:     join(refs.map(r => r.table_column.precision ?? '—')),
                incr:      refs.some(r => r.table_column.increment) ? '✔︎' : '',
                dt:        refs.some(r => r.table_column.datetime)  ? '✔︎' : '',
                req:       refs.some(r => r.table_column.required)  ? '✔︎' : '',
              };
        });


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
                      {/*  <th>primary</th>*/}
                        <th>increment</th>
                        <th>datetime</th>
                        <th>required</th>
                        <th>объединить</th>
           {/*             <th>width</th>*/}
                     {/*   <th>visible</th>*/}
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map(r => (
                        <tr key={r.colId}>
                            <td>{r.colId}</td>
                            <td>{r.ids}</td>
                            <td>{r.names}</td>
                            <td>{r.descr}</td>
                            <td>{r.dtypes}</td>
                            <td>{r.lengths}</td>
                            <td>{r.precs}</td>
                            {/*<td>primary — если нужно, аналогично ↑</td>*/}
                            <td>{r.incr}</td>
                            <td>{r.dt}</td>
                            <td>{r.req}</td>
                            <td> <button onClick={() => handleMerge(r.colId)}>+</button></td>
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
