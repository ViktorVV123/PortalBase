// components/headerComponent/topComponent.tsx
import React, {useState} from 'react';
import * as s from './TopComponent.module.scss'
import {WorkSpaceTypes} from '@/types/typesWorkSpaces';
import {DTable, Widget, WidgetForm} from '@/shared/hooks/useWorkSpaces';

type Props = {
    workSpaces: WorkSpaceTypes[];
    tablesByWs: Record<number, DTable[]>;
    loadTables: (wsId: number) => void;
    handleSelectTable: (table: DTable) => void;
    handleSelectWidget: (w: Widget) => void;
    widgetsByTable: Record<number, Widget[]>;
    loadWidgetsForTable: (tableId: number) => void;
    wsHover: number | null;
    tblHover: number | null;
    setWsHover:(value:number | null) => void;
    setTblHover:(value:number | null) => void;
    formsByWidget:any;
    handleSelectForm:(formId:number) => void;


}

export const TopComponent = ({
                                 workSpaces,
                                 tablesByWs,
                                 loadTables,
                                 handleSelectTable,
                                 handleSelectWidget,
                                 widgetsByTable,
                                 loadWidgetsForTable,wsHover,tblHover,setWsHover,setTblHover,formsByWidget,handleSelectForm

                             }: Props) => {
    const [open, setOpen] = useState(false);
    const [wHover,   setWHover]   = useState<number|null>(null);   // ← новый: hover-widget

    return (
        <div className={s.bar}>
            <div className={s.logo}>Портал ввода данных</div>

            <div className={s.menuWrapper}>
                <button className={s.trigger} onClick={() => setOpen(o => !o)}>
                    Рабочие&nbsp;пространства▾
                </button>

                {open && (
                    <ul className={s.menuLv2}>
                        {workSpaces.map(ws => (
                            <li
                                key={ws.id}
                                onMouseEnter={async () => { setWsHover(ws.id); await loadTables(ws.id); }}
                            >
                                {ws.name}

                                {wsHover === ws.id && tablesByWs[ws.id] && (
                                    <ul className={s.menuLv3}>
                                        {tablesByWs[ws.id].map(t => (
                                            <li
                                                key={t.id}
                                                onMouseEnter={async () => {
                                                    setTblHover(t.id);
                                                    if (!widgetsByTable[t.id]) await loadWidgetsForTable(t.id);
                                                }}
                                                onClick={async e => {
                                                    // если виджеты для этой таблицы ещё не загружены —
                                                    // сначала подгружаем и НИЧЕГО больше не делаем
                                                    if (!widgetsByTable[t.id]) {
                                                        await loadWidgetsForTable(t.id);
                                                        setTblHover(t.id);         // чтобы сразу показать подпункт
                                                        return;                    // выходим, таблицу НЕ выбираем
                                                    }
                                                    // если уже загружены — обычный выбор таблицы
                                                    handleSelectTable(t);
                                                    setOpen(false);
                                                }}
                                            >
                                                {t.name}

                                                {tblHover === t.id && (
                                                    <ul className={s.menuLv3}>
                                                        {(!widgetsByTable[t.id] || widgetsByTable[t.id].length === 0) && (
                                                            <li className={s.disabled} >нет виджетов</li>
                                                        )}

                                                        {widgetsByTable[t.id]?.map(w => {
                                                            const formEntry = formsByWidget[w.id];
                                                            const formObj  = formsByWidget[w.id];
                                                            const formName  =
                                                                formEntry ? (typeof formEntry === 'string' ? formEntry : formEntry.name)
                                                                    : <span >нет формы</span>;

                                                            return (
                                                                <li
                                                                    key={w.id}
                                                                    onMouseEnter={() => setWHover(w.id)}
                                                                    onMouseLeave={() => setWHover(null)}
                                                                    onClick={e => {
                                                                        e.stopPropagation();
                                                                        handleSelectTable(t);
                                                                        handleSelectWidget(w);
                                                                        setOpen(false);
                                                                    }}
                                                                >
                                                                    {w.name}

                                                                    {/* ───────── меню-5: формы ───────── */}
                                                                    {wHover === w.id && (
                                                                        <ul className={s.menuLv3}>
                                                                            <li
                                                                                className={formObj ? '' : s.disabled}
                                                                                onClick={e => {
                                                                                    e.stopPropagation();          // не всплываем к widget-LI
                                                                                    if (!formObj) return;         // если формы нет — выходим

                                                                                    /* 1. выбираем таблицу и виджет */
                                                                                    handleSelectTable(t);         // выставляет selectedTable + columns
                                                                                    handleSelectWidget(w);        // выставляет selectedWidget + widgetColumns

                                                                                    /* 2. загружаем и показываем форму */
                                                                                    handleSelectForm(formObj.form_id);

                                                                                    setOpen(false);               // закрываем всё меню
                                                                                }}
                                                                            >
                                                                                {formName}
                                                                            </li>
                                                                        </ul>
                                                                    )}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};
