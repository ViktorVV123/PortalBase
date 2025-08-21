// components/headerComponent/TopComponent.tsx
import React, {useEffect, useRef, useState} from 'react';
import * as s from './TopComponent.module.scss';
import {WorkSpaceTypes} from '@/types/typesWorkSpaces';
import {DTable, Widget} from '@/shared/hooks/useWorkSpaces';

import WorkspacesIcon from '@/assets/image/WorkspacesIcon.svg';
import TableIcon from '@/assets/image/TableIcon.svg';
import WidgetsIcon from '@/assets/image/WidgetsIcon.svg';
import FormIcon from '@/assets/image/FormaIcon1.svg';
import AddIcon from '@/assets/image/AddIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import {SideNav} from "@/components/sideNav/SideNav";
import EditIcon from "@/assets/image/EditIcon.svg";
import {EditWorkspaceModal} from "@/components/modals/editWorkspaceModal/EditWorkspaceModal";
import {api} from "@/services/api";

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
    deleteTable: (t: DTable) => void;
    deleteWorkspace: (id: number) => void;
    changeStatusModal: () => void
    setNavOpen: (value: boolean) => void;
    navOpen: boolean;
    setShowCreateForm: (value: boolean) => void;

    deleteWidget: (widgetId: number, tableId: number) => void;
    loadFormTree: (formId: number) => Promise<void>;
    loadWorkSpaces:() =>void

};

export const TopComponent: React.FC<Props> = ({
                                                  workSpaces,
                                                  tablesByWs,
                                                  loadTables,
                                                  handleSelectTable,
                                                  handleSelectWidget,
                                                  handleSelectForm,
                                                  widgetsByTable,
                                                  loadWidgetsForTable,
                                                  wsHover,
                                                  setWsHover,
                                                  tblHover,
                                                  setTblHover,
                                                  formsByWidget,
                                                  setShowCreateTable,
                                                  setCreateTblWs,
                                                  setShowCreateWidget,
                                                  setCreateWidgetTable,
                                                  deleteWorkspace, deleteTable,
                                                  changeStatusModal,
                                                  setNavOpen,
                                                  navOpen,
                                                  setShowCreateForm,
                                                  deleteWidget,

                                                  loadFormTree,
                                                  loadWorkSpaces
                                              }) => {

    const [open, setOpen] = useState(false);
    const [wHover, setWHover] = useState<number | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedWS, setSelectedWS] = useState<WorkSpaceTypes | null>(null);


    const menuRef = useRef<HTMLDivElement>(null);

    const toogleOpenSide = () => {
        setNavOpen(!navOpen);
        closeMenu();

    }

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
            setNavOpen(false);
            setOpen(true);      // было закрыто → открываем с «чистого» состояния
        }
    };

    // Типы с полями, которые нам нужны из API
    type ApiWidget = Widget & { table_id: number };
    type ApiTable  = DTable  & { workspace_id: number }; // если у тебя другое имя поля — подставь его

    const openFormWithPreload = async (widgetId: number, formId: number) => {
        try {
            // 1) тянем метаданные виджета и таблицы
            const { data: widget } = await api.get<ApiWidget>(`/widgets/${widgetId}`);
            const { data: table  } = await api.get<ApiTable>(`/tables/${widget.table_id}`);

            // 2) заранее грузим таблицы ВП и виджеты таблицы — чтобы выпадашка имела данные
            await loadTables(table.workspace_id, true);   // force=true, если у тебя есть такая опция
            await loadWidgetsForTable(table.id);

            // 3) выставляем выбранные сущности
            handleSelectTable(table);
            handleSelectWidget(widget);
            handleSelectForm(formId);

            // (опц.) сразу загрузить дерево формы
            await loadFormTree(formId);

            // (опц.) можно подготовить ховеры, если меню уже открыто
            // setWsHover(table.workspace_id);
            // setTblHover(table.id);
        } catch (e) {
            console.warn('openFormWithPreload error:', e);
        } finally {
            // Закрыть все выпадашки/сайдбар, чтобы состояние было чистым
            setNavOpen(false);
            closeMenu();
        }
    };



    return (
        <div className={s.bar}>

            <div className={s.logo}>Портал ввода данных</div>

            <div className={s.menuWrapper} ref={menuRef}>
                <div style={{display: 'flex'}}>
                    <button className={s.trigger} onClick={handleTriggerClick}>
                        Рабочие&nbsp;пространства▾
                    </button>

                    <div>
                        <SideNav
                            open={navOpen}
                            toggle={toogleOpenSide}
                            formsByWidget={formsByWidget}
                            openForm={openFormWithPreload}
                        />

                    </div>

                </div>

                {open && (
                    <ul className={s.menuLv2}>
                        <li
                            className={s.disabled}
                            onClick={(e) => {
                                closeMenu();
                                changeStatusModal()
                                e.stopPropagation()
                            }}
                        >
                            <AddIcon className={s.actionIcon} width={16} height={16}/> создать
                        </li>
                        {workSpaces.map(ws => {
                            const tables = tablesByWs[ws.id];      // может быть undefined onClick={changeStatusModal}

                            return (
                                <li
                                    key={ws.id}
                                    onMouseEnter={async () => {
                                        setWsHover(ws.id);
                                        await loadTables(ws.id);           // если ещё не загружали
                                    }}>


                                    <div className={s.wsWrapper}>
                                        <div className={s.spaceWN}>
                                            <WorkspacesIcon className={s.actionIcon} width={16} height={16}/>

                                            {/* текст — отдельный элемент, чтобы управлять flex-свойствами */}
                                            <span className={s.wsName}>{ws.name}</span>

                                            <span className={s.tooltip}><strong>Описание:</strong>{ws.description}</span>


                                            <div style={{display: 'flex', gap:4, alignItems:'center'}}>
                                                <EditIcon
                                                    className={s.actionIcon}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedWS(ws);
                                                        setEditModalOpen(true);
                                                        closeMenu();
                                                    }}
                                                />
                                                <DeleteIcon

                                                    style={{cursor: 'pointer'}}
                                                    className={s.actionIcon}
                                                    width={16}
                                                    height={16}
                                                    onClick={e => {
                                                        e.stopPropagation();                   // не выбирать WS
                                                        if (confirm(`Удалить workspace «${ws.name}»?`)) {
                                                            deleteWorkspace(ws.id);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* ───── LVL-3 : TABLES ───── */}
                                    {wsHover === ws.id && (
                                        <ul className={s.menuLv3}>
                                            <span className={s.spanName}>Таблицы</span>
                                            {/* — пункт «создать», когда таблиц нет — */}

                                            <li
                                                className={s.disabled}
                                                onClick={(e) => {
                                                    closeMenu();
                                                    setCreateTblWs(ws);
                                                    setShowCreateTable(true);
                                                    e.stopPropagation()
                                                }}
                                            >
                                                <AddIcon className={s.actionIcon} width={16} height={16}/> создать
                                            </li>

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
                                                    <div className={s.spaceWN}>
                                                        <TableIcon className={s.actionIcon} width={16} height={16}/>
                                                        <span className={s.wsName}>{t.name}</span>
                                                        <div style={{display: 'flex', gap:4, alignItems:'center'}}>
                                                            <DeleteIcon
                                                                style={{cursor: 'pointer'}}
                                                                onClick={e => {
                                                                    e.stopPropagation();                       // не выбирать таблицу
                                                                    if (confirm(`Удалить таблицу «${t.name}»?`))
                                                                        deleteTable(t);
                                                                }}
                                                                className={s.actionIcon}
                                                                width={16}
                                                                height={16}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* ───── LVL-4 : WIDGETS ───── */}
                                                    {tblHover === t.id && (
                                                        <ul className={s.menuLv3}>
                                                            <span className={s.spanName}>Виджеты</span>
                                                            {/* — если виджетов нет → «создать» — */}

                                                            <li
                                                                className={s.disabled}
                                                                onClick={(e) => {
                                                                    closeMenu();
                                                                    setCreateWidgetTable(t);       // передаём таблицу
                                                                    setShowCreateWidget(true);
                                                                    e.stopPropagation()

                                                                }}
                                                            >
                                                                <AddIcon className={s.actionIcon} width={16}
                                                                         height={16}/> создать
                                                            </li>


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
                                                                        <div className={s.spaceWN}>
                                                                            <WidgetsIcon className={s.actionIcon}
                                                                                         width={16} height={16}/>
                                                                            <span
                                                                                className={s.wsName}>{w.name}</span>
                                                                            <DeleteIcon className={s.actionIcon}

                                                                                        onClick={e => {
                                                                                            e.stopPropagation();
                                                                                            if (confirm('Удалить виджет?'))
                                                                                                deleteWidget(w.id, t.id);     // ← передаём widgetId и tableId
                                                                                        }}
                                                                                        width={16}
                                                                                        height={16}
                                                                            />
                                                                        </div>

                                                                        {/* ───── LVL-5 : FORM ───── */}
                                                                        {wHover === w.id && (
                                                                            <ul className={s.menuLv3}>
                                                                                <span
                                                                                    className={s.spanName}>Формы</span>
                                                                                <li
                                                                                    className={formObj ? '' : s.disabled}
                                                                                    onClick={async e => {
                                                                                        e.stopPropagation();
                                                                                        if (!formObj) return;

                                                                                        handleSelectTable(t);
                                                                                        handleSelectWidget(w);
                                                                                        handleSelectForm(formObj.form_id);
                                                                                        await loadFormTree(formObj.form_id); // ← загружаем справочники

                                                                                        closeMenu();
                                                                                    }}
                                                                                >
                                                                                    <FormIcon
                                                                                        className={s.actionIcon}/>
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
            {selectedWS && (
                <EditWorkspaceModal
                    open={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    defaultName={selectedWS.name}
                    defaultDescription={selectedWS.description}
                    onSubmit={async ({ name, description }) => {
                        try {
                            await api.patch(`/workspaces/${selectedWS.id}`, {
                                name,
                                description,
                                connection_id: selectedWS.connection_id ?? 0,
                                group: selectedWS.group ?? 'default'
                            });

                            await loadWorkSpaces();  // или локально обнови workSpaces[]
                            setEditModalOpen(false);

                        } catch (err) {
                            console.warn('Ошибка при обновлении:', err);
                        }
                    }}
                />
            )}

        </div>
    );
};
