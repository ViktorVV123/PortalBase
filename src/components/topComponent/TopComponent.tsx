// components/headerComponent/topComponent.tsx
import React, {useEffect, useRef, useState} from 'react';
import * as s from './TopComponent.module.scss'
import {WorkSpaceTypes} from '@/types/typesWorkSpaces';
import {DTable, Widget} from '@/shared/hooks/useWorkSpaces';
import FormIcon from '@/assets/image/FormaIcon.svg'
import TableIcon from '@/assets/image/TableIcon.svg'
import WorkspacesIcon from '@/assets/image/WorkspacesIcon.svg'
import WidgetsIcon from '@/assets/image/WidgetsIcon.svg'
import {WidgetSelect} from "@/components/widgetSelect/WidgetSelect";

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
    setWsHover: (value: number | null) => void;
    setTblHover: (value: number | null) => void;
    formsByWidget: any;
    handleSelectForm: (formId: number) => void;


}

export const TopComponent = ({
                                 workSpaces,
                                 tablesByWs,
                                 loadTables,
                                 handleSelectTable,
                                 handleSelectWidget,
                                 widgetsByTable,
                                 loadWidgetsForTable,
                                 wsHover,
                                 tblHover,
                                 setWsHover,
                                 setTblHover,
                                 formsByWidget,
                                 handleSelectForm

                             }: Props) => {
    const [open, setOpen] = useState(false);
    const [wHover, setWHover] = useState<number | null>(null);   // ← новый: hover-widget
    const menuRef = useRef<HTMLDivElement>(null);

    const closeMenu = () => {
        setOpen(false);
        setWsHover(null);
        setTblHover(null);
        setWHover(null);
    };

    /* ───────── 2. глобальный клик «вне меню» ───────── */
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (open && menuRef.current && !menuRef.current.contains(e.target as Node)) {
                closeMenu();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    /* ───────── 3. обработчик триггера ───────── */
    const handleTriggerClick = () => {
        if (open) {
            closeMenu();        // было открыто → полностью закрываем
        } else {
            setOpen(true);      // было закрыто → открываем с «чистого» состояния
        }
    };
    return (
        <div className={s.bar}>
            <div className={s.logo}>Портал ввода данных</div>

            <div className={s.menuWrapper} ref={menuRef}>
                <button className={s.trigger} onClick={handleTriggerClick}>
                    Рабочие&nbsp;пространства▾
                </button>

                {open && (
                    <ul className={s.menuLv2}>
                        {workSpaces.map(ws => (
                            <li
                                key={ws.id}
                                onMouseEnter={async () => {
                                    setWsHover(ws.id);
                                    await loadTables(ws.id);
                                }}
                            >
                                <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                                    <WorkspacesIcon width={16} height={16}/>
                                    {ws.name}
                                </div>


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
                                                    closeMenu()
                                                }}
                                            >
                                                <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
                                                    <TableIcon width={16} height={16}/>
                                                    {t.name}
                                                </div>

                                                {tblHover === t.id && (
                                                    <ul className={s.menuLv3}>
                                                        {(!widgetsByTable[t.id] || widgetsByTable[t.id].length === 0) && (
                                                            <li className={s.disabled}>нет виджетов</li>
                                                        )}

                                                        {widgetsByTable[t.id]?.map(w => {
                                                            const formEntry = formsByWidget[w.id];
                                                            const formObj = formsByWidget[w.id];
                                                            const formName =
                                                                formEntry ? (typeof formEntry === 'string' ? formEntry : formEntry.name)
                                                                    : <span>нет формы</span>;

                                                            return (
                                                                <li
                                                                    key={w.id}
                                                                    onMouseEnter={() => setWHover(w.id)}
                                                                    onMouseLeave={() => setWHover(null)}
                                                                    onClick={e => {
                                                                        e.stopPropagation();
                                                                        handleSelectTable(t);
                                                                        handleSelectWidget(w);
                                                                        closeMenu()
                                                                    }}
                                                                >
                                                                    <div style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: 4
                                                                    }}>
                                                                        <WidgetsIcon width={16} height={16}/>
                                                                        {w.name}
                                                                    </div>
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

                                                                                    closeMenu()             // закрываем всё меню
                                                                                }}
                                                                            >
                                                                                <div style={{
                                                                                    display: 'flex',
                                                                                    alignItems: 'center',
                                                                                    gap: 4
                                                                                }}>
                                                                                    <FormIcon/>
                                                                                    {formName}
                                                                                </div>
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
