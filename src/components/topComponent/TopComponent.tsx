// components/headerComponent/TopComponent.tsx
import React, {useEffect, useRef, useState} from 'react';
import * as s from './TopComponent.module.scss';
import {WorkSpaceTypes} from '@/types/typesWorkSpaces';
import {DTable, Widget} from '@/shared/hooks/useWorkSpaces';

import WorkspacesIcon from '@/assets/image/WorkspacesIcon.svg';
import TableIcon from '@/assets/image/TableIcon.svg';
import WidgetsIcon from '@/assets/image/WidgetsIcon.svg';
import FormIcon from '@/assets/image/FormaIcon.svg';
import AddIcon from '@/assets/image/AddIcon.svg';

type Props = {
    workSpaces: WorkSpaceTypes[];
    tablesByWs: Record<number, DTable[]>;
    loadTables: (wsId: number, force?: boolean) => Promise<DTable[]>;


    handleSelectTable: (t: DTable) => void;
    handleSelectWidget: (w: Widget) => void;
    handleSelectForm: (formId: number) => void;

    widgetsByTable: Record<number, Widget[]>;
    loadWidgetsForTable: (tableId: number) => void;

    /** hover-state */
    wsHover: number | null; setWsHover: (v: number | null) => void;
    tblHover: number | null; setTblHover: (v: number | null) => void;

    /** формы (чтобы найти form_id) */
    formsByWidget: Record<number, any>;

    /** модалка «создать таблицу» */
    setShowCreateTable: (v: boolean) => void;
    setCreateTblWs: (ws: WorkSpaceTypes) => void;
    setShowCreateWidget: (v: boolean) => void;
    setCreateWidgetTable: (t: DTable) => void;
};

export const TopComponent: React.FC<Props> = ({
                                                  workSpaces, tablesByWs, loadTables,
                                                  handleSelectTable, handleSelectWidget, handleSelectForm,
                                                  widgetsByTable, loadWidgetsForTable,
                                                  wsHover, setWsHover, tblHover, setTblHover,
                                                  formsByWidget,
                                                  setShowCreateTable, setCreateTblWs,setShowCreateWidget,setCreateWidgetTable
                                              }) => {

    const [open, setOpen] = useState(false);
    const [wHover, setWHover] = useState<number | null>(null);

    const menuRef = useRef<HTMLDivElement>(null);

    /* ——— закрыть меню полностью ——— */
    const closeMenu = () => {
        setOpen(false);
        setWsHover(null);
        setTblHover(null);
        setWHover(null);
    };

    /* ——— клик вне меню ——— */
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (open && menuRef.current && !menuRef.current.contains(e.target as Node))
                closeMenu();
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);


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
                        {workSpaces.map(ws => {
                            const tables = tablesByWs[ws.id];      // может быть undefined
                            const hasTables = !!tables?.length;

                            return (
                                <li
                                    key={ws.id}
                                    onMouseEnter={async () => {
                                        setWsHover(ws.id);
                                        await loadTables(ws.id);           // если ещё не загружали
                                    }}
                                >
                                    <div>
                                        <WorkspacesIcon width={16} height={16}/>
                                        {ws.name}
                                    </div>

                                    {/* ───── LVL-3 : TABLES ───── */}
                                    {wsHover === ws.id && (
                                        <ul className={s.menuLv3}>
                                            <span className={s.spanName}>Таблицы</span>
                                            {/* — пункт «создать», когда таблиц нет — */}
                                            {!hasTables && (
                                                <li
                                                    className={s.disabled}
                                                    onClick={(e) => {
                                                        closeMenu();
                                                        setCreateTblWs(ws);
                                                        setShowCreateTable(true);
                                                        e.stopPropagation()
                                                    }}
                                                >
                                                    <AddIcon width={16} height={16}/> создать
                                                </li>
                                            )}

                                            {/* — сами таблицы — */}
                                            {tables?.map(t => (
                                                <li
                                                    key={t.id}
                                                    onMouseEnter={async () => {
                                                        setTblHover(t.id);
                                                        if (!widgetsByTable[t.id])
                                                            await loadWidgetsForTable(t.id);
                                                    }}
                                                    onClick={async e => {
                                                        /* если виджеты ещё не пришли — просто показываем подпункт */
                                                        if (!widgetsByTable[t.id]) {
                                                            await loadWidgetsForTable(t.id);
                                                            setTblHover(t.id);
                                                            return;
                                                        }
                                                        handleSelectTable(t);
                                                        closeMenu();
                                                    }}
                                                >
                                                    <div>
                                                        <TableIcon width={16} height={16}/>
                                                        {t.name}
                                                    </div>

                                                    {/* ───── LVL-4 : WIDGETS ───── */}
                                                    {tblHover === t.id && (
                                                        <ul className={s.menuLv3}>
                                                            <span className={s.spanName}>Виджеты</span>
                                                            {/* — если виджетов нет → «создать» — */}
                                                            {(!widgetsByTable[t.id] || widgetsByTable[t.id].length === 0) && (
                                                                <li
                                                                    className={s.disabled}
                                                                    onClick={(e) => {
                                                                        closeMenu();
                                                                        setCreateWidgetTable(t);       // передаём таблицу
                                                                        setShowCreateWidget(true);
                                                                        e.stopPropagation()

                                                                    }}
                                                                >
                                                                    <AddIcon width={16} height={16}/> создать
                                                                </li>
                                                            )}

                                                            {widgetsByTable[t.id]?.map(w => {
                                                                const formObj = formsByWidget[w.id];
                                                                const formName = formObj
                                                                    ? (typeof formObj === 'string' ? formObj : formObj.name)
                                                                    : 'нет формы';

                                                                return (
                                                                    <li
                                                                        key={w.id}
                                                                        onMouseEnter={() => setWHover(w.id)}
                                                                        onMouseLeave={() => setWHover(null)}
                                                                        onClick={e => {
                                                                            e.stopPropagation();
                                                                            handleSelectTable(t);
                                                                            handleSelectWidget(w);
                                                                            closeMenu();
                                                                        }}
                                                                    >
                                                                        <div>
                                                                            <WidgetsIcon width={16} height={16}/>
                                                                            {w.name}
                                                                        </div>

                                                                        {/* ───── LVL-5 : FORM ───── */}
                                                                        {wHover === w.id && (
                                                                            <ul className={s.menuLv3}>
                                                                                <span className={s.spanName}>Формы</span>
                                                                                <li
                                                                                    className={formObj ? '' : s.disabled}
                                                                                    onClick={e => {
                                                                                        e.stopPropagation();
                                                                                        if (!formObj) return;

                                                                                        handleSelectTable(t);
                                                                                        handleSelectWidget(w);
                                                                                        handleSelectForm(formObj.form_id);
                                                                                        closeMenu();
                                                                                    }}
                                                                                >
                                                                                    <FormIcon/>
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
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};
