import React, {useEffect, useLayoutEffect, useMemo, useRef, useState, ReactNode} from 'react';
import {createPortal} from 'react-dom';
import * as s from './TopComponent.module.scss';
import {WorkSpaceTypes} from '@/types/typesWorkSpaces';
import {DTable, NewFormPayload, Widget, WidgetForm} from '@/shared/hooks/useWorkSpaces';

import WorkspacesIcon from '@/assets/image/WorkspacesIcon.svg';
import TableIcon from '@/assets/image/TableIcon.svg';
import WidgetsIcon from '@/assets/image/WidgetsIcon.svg';
import FormIcon from '@/assets/image/FormaIcon1.svg';
import AddIcon from '@/assets/image/AddIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import EditIcon from "@/assets/image/EditIcon.svg";

import {SideNav} from "@/components/sideNav/SideNav";
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
    loadWidgetsForTable: (tableId: number, force?: boolean) => void;
    wsHover: number | null; setWsHover: (v: number | null) => void;
    tblHover: number | null; setTblHover: (v: number | null) => void;
    formsByWidget: Record<number, any>;

    setShowCreateTable: (v: boolean) => void;
    setCreateTblWs: (ws: WorkSpaceTypes) => void;
    setShowCreateWidget: (v: boolean) => void;
    setCreateWidgetTable: (t: DTable) => void;
    deleteTable: (t: DTable) => void;
    deleteWorkspace: (id: number) => void;
    changeStatusModal: () => void
    setNavOpen: (value: boolean) => void;
    navOpen: boolean;

    deleteWidget: (widgetId: number, tableId: number) => void;

    loadFormTree: (formId: number) => Promise<void>;
    loadWorkSpaces: () => void

    addForm: (payload: NewFormPayload) => Promise<WidgetForm>;
    setShowCreateFormModal: (v: boolean) => void;
    setCreateFormWidget: (w: Widget) => void;
    formsListByWidget: Record<number, WidgetForm[]>;
    deleteForm: (formId: number) => Promise<void>;
    formsById: Record<number, WidgetForm>;
    setFormToEdit: (f: WidgetForm) => void;
    setEditFormOpen: (v: boolean) => void;
};

type Side = 'right' | 'left';

/** Плавающее окно подменю в портале: считает позицию от anchor и даёт свою прокрутку */
const Floating: React.FC<{
    anchor: HTMLElement | null;
    side: Side;
    children: ReactNode;
    setNode?: (el: HTMLDivElement | null) => void;
}> = ({anchor, side, children, setNode}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<{top: number; left: number}>({top: 0, left: 0});

    const updatePos = () => {
        if (!anchor || !ref.current) return;
        const ar = anchor.getBoundingClientRect();
        const menuEl = ref.current;
        const menuW = menuEl.offsetWidth || 360;
        const menuH = menuEl.offsetHeight || 300;

        const padding = 8;
        const maxLeft = window.innerWidth - menuW - padding;
        const maxTop = window.innerHeight - menuH - padding;

        const top = Math.max(padding, Math.min(maxTop, ar.top));
        const left = side === 'right'
            ? Math.min(maxLeft, ar.right + padding)
            : Math.max(padding, ar.left - menuW - padding);

        setPos({top, left});
    };

    useLayoutEffect(() => {
        setNode?.(ref.current);
        updatePos();
        const onScroll = () => updatePos();
        const onResize = () => updatePos();
        // слушаем скролл на фазе capture, чтобы ловить скролл контейнеров
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            setNode?.(null);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [anchor, side, children]);

    return createPortal(
        <div ref={ref} className={s.floatingMenu} style={{top: pos.top, left: pos.left}}>
            <div className={s.floatingScroll}>
                {children}
            </div>
        </div>,
        document.body
    );
};

export const TopComponent: React.FC<Props> = (props) => {
    const {
        workSpaces, addForm, setFormToEdit, setEditFormOpen,
        setShowCreateFormModal, setCreateFormWidget,
        tablesByWs, loadTables, handleSelectTable, handleSelectWidget, handleSelectForm,
        widgetsByTable, loadWidgetsForTable,
        wsHover, setWsHover, tblHover, setTblHover, formsByWidget,
        setShowCreateTable, setCreateTblWs, setShowCreateWidget, setCreateWidgetTable,
        deleteWorkspace, deleteTable, changeStatusModal,
        setNavOpen, navOpen, deleteWidget,
        formsListByWidget, loadFormTree, loadWorkSpaces, deleteForm, formsById
    } = props;

    const [open, setOpen] = useState(false);

    // текущие открытые уровни и их якоря + сторона
    const [wsOpen, setWsOpen]   = useState<{ id: number | null, anchor: HTMLElement | null, side: Side }>({ id: null, anchor: null, side: 'right' });
    const [tblOpen, setTblOpen] = useState<{ id: number | null, anchor: HTMLElement | null, side: Side }>({ id: null, anchor: null, side: 'right' });
    const [wOpen, setWOpen]     = useState<{ id: number | null, anchor: HTMLElement | null, side: Side }>({ id: null, anchor: null, side: 'right' });

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedWS, setSelectedWS] = useState<WorkSpaceTypes | null>(null);

    const menuRef = useRef<HTMLDivElement>(null);
    const isDesktop = useMemo(() => typeof window !== 'undefined'
        ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
        : true, []);

    // refs пикетов root-уровня для клавиатурной навигации
    const rootItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [rootFocus, setRootFocus] = useState(0);

    // DOM-узлы плавающих окон — чтобы «клик-вне» не закрывал их
    const [wsNode, setWsNode]   = useState<HTMLDivElement | null>(null);
    const [tblNode, setTblNode] = useState<HTMLDivElement | null>(null);
    const [wNode, setWNode]     = useState<HTMLDivElement | null>(null);

    const clip = (str: string, n = 18) => str.length > n ? str.slice(0, n) + '…' : str;

    const computeSide = (anchor: HTMLElement | null, approxWidth = 360): Side => {
        if (!anchor) return 'right';
        const rect = anchor.getBoundingClientRect();
        const rightSpace = window.innerWidth - rect.right;
        const leftSpace = rect.left;
        return rightSpace < approxWidth && leftSpace > rightSpace ? 'left' : 'right';
    };

    const closeAll = () => {
        setOpen(false);
        setWsOpen({ id: null, anchor: null, side: 'right' });
        setTblOpen({ id: null, anchor: null, side: 'right' });
        setWOpen({ id: null, anchor: null, side: 'right' });
        setWsHover(null);
        setTblHover(null);
    };

    const handleTriggerClick = () => {
        if (open) closeAll();
        else {
            setNavOpen(false);
            setOpen(true);
            setRootFocus(0);
            setWsOpen({ id: null, anchor: null, side: 'right' });
            setTblOpen({ id: null, anchor: null, side: 'right' });
            setWOpen({ id: null, anchor: null, side: 'right' });
        }
    };

    // Клик-вне (учитываем root и все плавающие окна)
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (!open) return;
            const t = e.target as Node;
            const insideRoot = !!menuRef.current && menuRef.current.contains(t);
            const insideWs   = !!wsNode && wsNode.contains(t);
            const insideTbl  = !!tblNode && tblNode.contains(t);
            const insideW    = !!wNode && wNode.contains(t);
            if (!insideRoot && !insideWs && !insideTbl && !insideW) closeAll();
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open, wsNode, tblNode, wNode]);

    // ESC закрывает всё
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.preventDefault();
                closeAll();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    // Открыватели уровней
    const openWs = async (ws: WorkSpaceTypes, anchor: HTMLElement | null) => {
        setWsHover(ws.id);
        await loadTables(ws.id);
        setWsOpen({ id: ws.id, anchor, side: computeSide(anchor) });
        setTblOpen({ id: null, anchor: null, side: 'right' });
        setWOpen({ id: null, anchor: null, side: 'right' });
    };

    const openTbl = async (t: DTable, anchor: HTMLElement | null) => {
        setTblHover(t.id);
        if (!widgetsByTable[t.id]) await loadWidgetsForTable(t.id);
        setTblOpen({ id: t.id, anchor, side: computeSide(anchor) });
        setWOpen({ id: null, anchor: null, side: 'right' });
    };

    const openWidget = (w: Widget, anchor: HTMLElement | null) => {
        setWOpen({ id: w.id, anchor, side: computeSide(anchor) });
    };

    // Клава по root-уровню
    const focusRootIndex = (idx: number) => {
        const list = rootItemRefs.current;
        const next = Math.max(0, Math.min(idx, list.length - 1));
        setRootFocus(next);
        const el = list[next];
        if (el) {
            el.focus({ preventScroll: true });
            el.scrollIntoView({ block: 'nearest' });
        }
    };
    const onRootKeyDown = (e: React.KeyboardEvent) => {
        const key = e.key;
        if (key === 'ArrowDown') { e.preventDefault(); focusRootIndex(rootFocus + 1); }
        else if (key === 'ArrowUp') { e.preventDefault(); focusRootIndex(rootFocus - 1); }
        else if (key === 'Home') { e.preventDefault(); focusRootIndex(0); }
        else if (key === 'End') { e.preventDefault(); focusRootIndex(999); }
        else if (key === 'ArrowRight') {
            const ws = workSpaces[rootFocus];
            if (ws) {
                const btn = rootItemRefs.current[rootFocus];
                openWs(ws, btn || null);
            }
        } else if (key === 'Escape') {
            closeAll();
        }
    };

    // SideNav open by button
    type ApiWidget = Widget & { table_id: number };
    type ApiTable = DTable & { workspace_id: number };
    const openFormWithPreload = async (widgetId: number, formId: number) => {
        try {
            const { data: widget } = await api.get<ApiWidget>(`/widgets/${widgetId}`);
            const { data: table } = await api.get<ApiTable>(`/tables/${widget.table_id}`);
            await loadTables(table.workspace_id, true);
            await loadWidgetsForTable(table.id, true);
            handleSelectTable(table);
            handleSelectWidget(widget);
            handleSelectForm(formId);
            await loadFormTree(formId);
        } catch (e) {
            console.warn('openFormWithPreload error:', e);
        } finally {
            setNavOpen(false);
            closeAll();
        }
    };

    return (
        <div className={s.bar}>
            <div className={s.logo}>Портал ввода данных</div>

            <div className={s.menuWrapper} ref={menuRef}>
                <button
                    className={s.trigger}
                    onClick={handleTriggerClick}
                    aria-haspopup="menu"
                    aria-expanded={open}
                >
                    Рабочие&nbsp;пространства ▾
                </button>

                <SideNav
                    open={navOpen}
                    toggle={() => { setNavOpen(!navOpen); closeAll(); }}
                    forms={Object.values(formsById)}
                    openForm={openFormWithPreload}
                />

                {open && (
                    <div className={s.menuRoot} role="menu" aria-label="Рабочие пространства" onKeyDown={onRootKeyDown}>
                        <div className={s.scrollArea}>
                            <div className={s.sectionTitle}>Действия</div>
                            <ul className={s.list} role="none">
                                <li className={s.item} data-disabled="true" role="none">
                                    <button
                                        className={s.itemBtn}
                                        role="menuitem"
                                        onClick={(e) => { e.stopPropagation(); changeStatusModal(); closeAll(); }}
                                    >
                                        <AddIcon className={s.icon} />
                                        <span className={s.label}>Создать рабочее пространство</span>
                                    </button>
                                </li>
                            </ul>

                            <div className={s.sectionTitle}>Рабочее пространство</div>
                            <ul className={s.list} role="none">
                                {workSpaces.map((ws, idx) => {
                                    const tables = tablesByWs[ws.id];
                                    return (
                                        <li
                                            key={ws.id}
                                            className={s.item}
                                            role="none"
                                            onMouseEnter={isDesktop ? (e) => openWs(ws, e.currentTarget as HTMLElement) : undefined}
                                        >
                                            <button
                                                className={`${s.itemBtn} ${s.hasSub}`}
                                                role="menuitem"
                                                aria-haspopup="menu"
                                                aria-expanded={wsOpen.id === ws.id}
                                                ref={(el: HTMLButtonElement | null) => {
                                                    rootItemRefs.current[idx] = el;
                                                }}
                                                tabIndex={idx === rootFocus ? 0 : -1}
                                                onClick={(e) => {
                                                    if (!isDesktop) {
                                                        if (wsOpen.id === ws.id) {
                                                            setWsOpen({ id: null, anchor: null, side: 'right' });
                                                            setTblOpen({ id: null, anchor: null, side: 'right' });
                                                            setWOpen({ id: null, anchor: null, side: 'right' });
                                                        } else {
                                                            openWs(ws, e.currentTarget as HTMLElement);
                                                        }
                                                    }
                                                }}
                                                title={ws.description || ws.name}
                                            >
                                                <WorkspacesIcon className={s.icon} />
                                                <span className={s.label}>{ws.name}</span>

                                                <span className={s.actions} aria-hidden>
                          <EditIcon
                              className={s.actionIcon}
                              onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedWS(ws);
                                  setEditModalOpen(true);
                                  closeAll();
                              }}

                          />
                          <DeleteIcon
                              className={`${s.actionIcon} ${s.actionDanger}`}
                              onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Удалить workspace «${ws.name}»?`)) deleteWorkspace(ws.id);
                              }}

                          />
                        </span>
                                            </button>

                                            {/* ── LVL-3: TABLES (плавающее окно) ── */}
                                            {wsOpen.id === ws.id && (
                                                <Floating anchor={wsOpen.anchor} side={wsOpen.side} setNode={setWsNode}>
                                                    <div className={s.sectionTitle}>Действия</div>

                                                    <ul className={s.list} role="none">
                                                        <li className={s.item} data-disabled="true" role="none">
                                                            <button
                                                                className={s.itemBtn}
                                                                role="menuitem"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setCreateTblWs(ws);
                                                                    setShowCreateTable(true);
                                                                    closeAll();
                                                                }}
                                                            >
                                                                <AddIcon className={s.icon}/>
                                                                <span className={s.label}>Создать таблицу</span>
                                                            </button>
                                                        </li>
                                                        <div className={s.sectionTitle}>Таблицы</div>
                                                        {(tables ?? []).map((t) => (
                                                            <li
                                                                key={t.id}
                                                                className={s.item}
                                                                role="none"
                                                                onMouseEnter={isDesktop ? (e) => openTbl(t, e.currentTarget as HTMLElement) : undefined}
                                                            >

                                                                <button
                                                                    className={`${s.itemBtn} ${s.hasSub}`}
                                                                    role="menuitem"
                                                                    aria-haspopup="menu"
                                                                    aria-expanded={tblOpen.id === t.id}
                                                                    onClick={async (e) => {
                                                                        if (!isDesktop) {
                                                                            if (tblOpen.id === t.id) {
                                                                                setTblOpen({
                                                                                    id: null,
                                                                                    anchor: null,
                                                                                    side: 'right'
                                                                                });
                                                                                setWOpen({
                                                                                    id: null,
                                                                                    anchor: null,
                                                                                    side: 'right'
                                                                                });
                                                                            } else {
                                                                                await openTbl(t, e.currentTarget as HTMLElement);
                                                                            }
                                                                            return;
                                                                        }
                                                                        handleSelectTable(t);
                                                                        closeAll();
                                                                    }}
                                                                    title={t.description || t.name}
                                                                >

                                                                    <TableIcon className={s.icon}/>
                                                                    <span className={s.label}>{t.name}</span>
                                                                    <span className={s.actions}>
                                    <DeleteIcon
                                        className={`${s.actionIcon} ${s.actionDanger}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Удалить таблицу «${t.name}»?`)) deleteTable(t);
                                        }}

                                    />
                                  </span>
                                                                </button>

                                                                {/* ── LVL-4: WIDGETS (плавающее окно) ── */}
                                                                {tblOpen.id === t.id && (
                                                                    <Floating anchor={tblOpen.anchor}
                                                                              side={tblOpen.side} setNode={setTblNode}>
                                                                        <div className={s.sectionTitle}>Действия</div>
                                                                        <ul className={s.list} role="none">
                                                                            <li className={s.item} data-disabled="true"
                                                                                role="none">
                                                                                <button
                                                                                    className={s.itemBtn}
                                                                                    role="menuitem"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setCreateWidgetTable(t);
                                                                                        setShowCreateWidget(true);
                                                                                        closeAll();
                                                                                    }}
                                                                                >
                                                                                    <AddIcon className={s.icon}/>
                                                                                    <span className={s.label}>Создать виджет</span>
                                                                                </button>
                                                                            </li>
                                                                            <div className={s.sectionTitle}>
                                                                                Виджеты
                                                                            </div>
                                                                            {(widgetsByTable[t.id] ?? []).map((w) => {
                                                                                const formObj = props.formsByWidget[w.id];
                                                                                const formName = formObj ? (typeof formObj === 'string' ? formObj : formObj.name) : 'нет формы';
                                                                                return (
                                                                                    <li
                                                                                        key={w.id}
                                                                                        className={s.item}
                                                                                        role="none"
                                                                                        onMouseEnter={isDesktop ? (e) => openWidget(w, e.currentTarget as HTMLElement) : undefined}
                                                                                    >
                                                                                        <button
                                                                                            className={`${s.itemBtn} ${s.hasSub}`}
                                                                                            role="menuitem"
                                                                                            aria-haspopup="menu"
                                                                                            aria-expanded={wOpen.id === w.id}
                                                                                            onClick={(e) => {
                                                                                                if (!isDesktop) {
                                                                                                    if (wOpen.id === w.id) {
                                                                                                        setWOpen({
                                                                                                            id: null,
                                                                                                            anchor: null,
                                                                                                            side: 'right'
                                                                                                        });
                                                                                                    } else {
                                                                                                        openWidget(w, e.currentTarget as HTMLElement);
                                                                                                    }
                                                                                                    return;
                                                                                                }
                                                                                                handleSelectTable(t);
                                                                                                handleSelectWidget(w);
                                                                                                closeAll();
                                                                                            }}
                                                                                            title={w.description || w.name}
                                                                                        >

                                                                                            <WidgetsIcon
                                                                                                className={s.icon}/>
                                                                                            <span
                                                                                                className={s.label}>{w.name}</span>
                                                                                            <span className={s.actions}>
                                                <DeleteIcon
                                                    className={`${s.actionIcon} ${s.actionDanger}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm('Удалить виджет?')) props.deleteWidget(w.id, t.id);
                                                    }}
                                                />
                                              </span>
                                                                                        </button>

                                                                                        {/* ── LVL-5: FORMS (плавающее окно) ── */}
                                                                                        {wOpen.id === w.id && (
                                                                                            <Floating
                                                                                                anchor={wOpen.anchor}
                                                                                                side={wOpen.side}
                                                                                                setNode={setWNode}>
                                                                                                <div
                                                                                                    className={s.sectionTitle}>Действия
                                                                                                </div>
                                                                                                <ul className={s.list}
                                                                                                    role="none">
                                                                                                    <li className={s.item}
                                                                                                        data-disabled="true"
                                                                                                        role="none">
                                                                                                        <button
                                                                                                            className={s.itemBtn}
                                                                                                            role="menuitem"
                                                                                                            onClick={(e) => {
                                                                                                                e.stopPropagation();
                                                                                                                setCreateFormWidget(w);
                                                                                                                setShowCreateFormModal(true);
                                                                                                                closeAll();
                                                                                                            }}
                                                                                                        >
                                                                                                            <AddIcon
                                                                                                                className={s.icon}/>
                                                                                                            <span
                                                                                                                className={s.label}>Создать форму</span>
                                                                                                        </button>
                                                                                                    </li>
                                                                                                    <div
                                                                                                        className={s.sectionTitle}>Формы
                                                                                                    </div>
                                                                                                    {(props.formsListByWidget[w.id] ?? []).map((form) => (
                                                                                                        <li key={form.form_id}
                                                                                                            className={s.item}
                                                                                                            role="none">
                                                                                                            <button
                                                                                                                className={s.itemBtn}
                                                                                                                role="menuitem"
                                                                                                                onClick={async (e) => {
                                                                                                                    e.stopPropagation();
                                                                                                                    handleSelectTable(t);
                                                                                                                    handleSelectWidget(w);
                                                                                                                    handleSelectForm(form.form_id);
                                                                                                                    await loadFormTree(form.form_id);
                                                                                                                    closeAll();
                                                                                                                }}
                                                                                                                title={form.name}
                                                                                                            >

                                                                                                                <FormIcon
                                                                                                                    className={s.icon}/>
                                                                                                                <span
                                                                                                                    className={s.label}>{clip(form.name)}</span>
                                                                                                                <span
                                                                                                                    className={s.actions}>
                                                          <EditIcon
                                                              className={s.actionIcon}
                                                              onClick={(e) => {
                                                                  e.stopPropagation();
                                                                  props.setFormToEdit(form);
                                                                  props.setEditFormOpen(true);
                                                                  closeAll();
                                                              }}

                                                          />
                                                          <DeleteIcon
                                                              className={`${s.actionIcon} ${s.actionDanger}`}
                                                              onClick={async (e) => {
                                                                  e.stopPropagation();
                                                                  if (confirm(`Удалить форму «${form.name}»?`)) {
                                                                      await deleteForm(form.form_id);
                                                                  }
                                                              }}

                                                          />
                                                        </span>
                                                                                                            </button>
                                                                                                        </li>
                                                                                                    ))}
                                                                                                    {(props.formsListByWidget[w.id]?.length ?? 0) === 0 && (
                                                                                                        <li className={s.item}
                                                                                                            role="none">
                                                                                                            <div

                                                                                                                role="menuitem"
                                                                                                                style={{cursor: 'default'}}>

                                                                                                              {/*  <span
                                                                                                                    className={s.label}
                                                                                                                    style={{opacity: .7}}>нет форм</span>
                                                                                                                <span className={s.icon} aria-hidden />  пустой плейсхолдер 22px */}
                                                                                                            </div>
                                                                                                        </li>
                                                                                                    )}
                                                                                                </ul>
                                                                                            </Floating>
                                                                                        )}
                                                                                    </li>
                                                                                );
                                                                            })}
                                                                        </ul>
                                                                    </Floating>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </Floating>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {selectedWS && (
                <EditWorkspaceModal
                    open={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    defaultName={selectedWS.name}
                    defaultDescription={selectedWS.description}
                    onSubmit={async ({name, description}) => {
                        try {
                            await api.patch(`/workspaces/${selectedWS.id}`, {
                                name,
                                description,
                                connection_id: selectedWS.connection_id ?? 0,
                                group: selectedWS.group ?? 'default'
                            });
                            await loadWorkSpaces();
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
