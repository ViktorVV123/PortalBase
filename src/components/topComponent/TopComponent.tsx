// components/headerComponent/topComponent.tsx
import React, {useState} from 'react';
import * as s from './TopComponent.module.scss'
import {WorkSpaceTypes} from '@/types/typesWorkSpaces';
import {DTable, Widget} from '@/shared/hooks/useWorkSpaces';

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


}

export const TopComponent = ({
                                 workSpaces,
                                 tablesByWs,
                                 loadTables,
                                 handleSelectTable,
                                 handleSelectWidget,
                                 widgetsByTable,
                                 loadWidgetsForTable,wsHover,tblHover,setWsHover,setTblHover

                             }: Props) => {
    const [open, setOpen] = useState(false);


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
                                        {tablesByWs[ws.id].length === 0 && (
                                            <li>— таблиц нет —</li>
                                        )}

                                        {tablesByWs[ws.id].map(t => {
                                            const hasWidgets = widgetsByTable[t.id]?.length > 0;
                                            return(
                                            <li
                                                key={t.id}
                                                onMouseEnter={async () => { setTblHover(t.id); await loadWidgetsForTable(t.id); }}
                                                onClick={() => handleSelectTable(t)}
                                            >
                                                {t.name}

                                                {tblHover === t.id && widgetsByTable[t.id] && (
                                                    <ul className={s.menuLv3}>
                                                        {widgetsByTable[t.id].length === 0 && (
                                                            <li className={hasWidgets ? '' : s.disabled}   >— нет виджетов —</li>
                                                        )}

                                                        {widgetsByTable[t.id].map(w => (
                                                            <li
                                                                key={w.id}
                                                                onClick={e => {
                                                                         e.stopPropagation();      // ← блокируем всплытие к <li> таблицы
                                                                         handleSelectWidget(w);
                                                                         setOpen(false);
                                                                       }}
                                                            >
                                                                {w.name}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </li>
                                        )})}
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
