// src/components/topComponent/TopComponent.tsx

import React, { useState, useEffect } from 'react';
import * as s from './TopComponent.module.scss';

import { WorkSpaceTypes } from '@/types/typesWorkSpaces';
import { DTable, NewFormPayload, Widget, WidgetForm } from '@/shared/hooks/useWorkSpaces';

import { SideNav } from '@/components/topComponent/sideNav/SideNav';
import { EditWorkspaceModal } from '@/components/modals/editWorkspaceModal/EditWorkspaceModal';
import { api } from '@/services/api';
import { useTopMenuState } from '@/components/topComponent/hook/useTopMenuState';
import { WorkspaceMenu } from '@/components/topComponent/workspaceMenu/WorkspaceMenu';
import { Floating } from '@/components/topComponent/floating/Floating';
import { TablesMenu } from '@/components/topComponent/tablesMenu/TablesMenu';
import { WidgetsMenu } from '@/components/topComponent/widgetsMenu/WidgetsMenu';
import { FormsMenu } from '@/components/topComponent/formsMenu/FormsMenu';
import { ModalEditConnection } from "@/components/modals/modalEditConnection/ModalEditConnection";
import { Connection } from "@/shared/hooks/stores";
import { ThemeToggle } from '@/shared/ui/ThemeToggle/ThemeToggle';


type Props = {
    workSpaces: WorkSpaceTypes[];
    tablesByWs: Record<number, DTable[]>;
    loadTables: (wsId: number, force?: boolean) => Promise<DTable[]>;
    handleSelectTable: (t: DTable) => void;
    handleSelectWidget: (w: Widget) => void;
    handleSelectForm: (formId: number) => void;
    widgetsByTable: Record<number, Widget[]>;
    loadWidgetsForTable: (tableId: number, force?: boolean) => void;
    wsHover: number | null;
    setWsHover: (v: number | null) => void;
    tblHover: number | null;
    setTblHover: (v: number | null) => void;
    formsByWidget: Record<number, any>;

    setShowCreateTable: (v: boolean) => void;
    setCreateTblWs: (ws: WorkSpaceTypes) => void;
    setShowCreateWidget: (v: boolean) => void;
    setCreateWidgetTable: (t: DTable) => void;
    deleteTable: (t: DTable) => void;
    deleteWorkspace: (id: number) => void;
    changeStatusModal: () => void;
    setNavOpen: (value: boolean) => void;
    navOpen: boolean;

    deleteWidget: (widgetId: number, tableId: number) => void;

    loadFormTree: (formId: number) => Promise<void>;
    loadWorkSpaces: (opts?: { force?: boolean }) => void;
    addForm: (payload: NewFormPayload) => Promise<WidgetForm>;
    setShowCreateFormModal: (v: boolean) => void;
    setCreateFormWidget: (w: Widget) => void;
    formsListByWidget: Record<number, WidgetForm[]>;
    deleteForm: (formId: number) => Promise<void>;
    formsById: Record<number, WidgetForm>;
    setFormToEdit: (f: WidgetForm) => void;
    setEditFormOpen: (v: boolean) => void;
    loadConnections: (opts?: { force?: boolean }) => void;
    connections: Connection[];

    // Callback для уведомления родителя об открытии/закрытии меню
    onMenuOpenChange?: (isOpen: boolean) => void;
};

/**
 * Проверяет, есть ли у пользователя админские права (Admin или SuperAdmin)
 */
function hasAdminGroup(groups: string[]): boolean {
    return groups.some(group => {
        const lower = group.toLowerCase();
        return lower.endsWith('admin') || lower.endsWith('superadmin');
    });
}

/**
 * Проверяет, есть ли у пользователя супер-админские права (только SuperAdmin)
 */
function hasSuperAdminGroup(groups: string[]): boolean {
    return groups.some(group => {
        const lower = group.toLowerCase();
        return lower.endsWith('superadmin');
    });
}

export const TopComponent: React.FC<Props> = (props) => {
    const {
        workSpaces,
        connections,
        tablesByWs,
        widgetsByTable,
        loadTables,
        loadWidgetsForTable,
        handleSelectTable,
        handleSelectWidget,
        handleSelectForm,
        setShowCreateTable,
        setCreateTblWs,
        setShowCreateWidget,
        setCreateWidgetTable,
        deleteWorkspace,
        deleteTable,
        changeStatusModal,
        setNavOpen,
        navOpen,
        formsListByWidget,
        loadFormTree,
        loadWorkSpaces,
        deleteWidget,
        deleteForm,
        formsById,
        setFormToEdit,
        setEditFormOpen,
        setShowCreateFormModal,
        setCreateFormWidget,
        setWsHover,
        setTblHover,
        loadConnections,
        onMenuOpenChange,
    } = props;

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedWS, setSelectedWS] = useState<WorkSpaceTypes | null>(null);
    const [editConnOpen, setEditConnOpen] = useState(false);
    const [connToEditId, setConnToEditId] = useState<number | null>(null);

    // ═══════════════════════════════════════════════════════════════════════════
    // Состояние для проверки прав
    // ═══════════════════════════════════════════════════════════════════════════
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

    useEffect(() => {
        let mounted = true;

        const checkAdminGroups = async () => {
            try {
                const { data } = await api.get<string[]>('/groups');

                if (!mounted) return;

                const hasAdmin = hasAdminGroup(data);
                const hasSuperAdmin = hasSuperAdminGroup(data);

                setIsAdmin(hasAdmin);
                setIsSuperAdmin(hasSuperAdmin);

                console.debug('[TopComponent] User groups:', data);
                console.debug('[TopComponent] Is admin:', hasAdmin);
                console.debug('[TopComponent] Is super admin:', hasSuperAdmin);
            } catch (error) {
                console.error('[TopComponent] Failed to load user groups:', error);
                if (mounted) {
                    setIsAdmin(false);
                    setIsSuperAdmin(false);
                }
            }
        };

        checkAdminGroups();

        return () => {
            mounted = false;
        };
    }, []);

    const state = useTopMenuState({
        loadTables,
        loadWidgetsForTable,
        handleSelectTable,
        handleSelectWidget,
        handleSelectForm,
        loadFormTree,
        setNavOpen,
        setWsHover,
        setTblHover,
    });

    // Уведомляем родителя когда меню открывается/закрывается
    useEffect(() => {
        onMenuOpenChange?.(state.open);
    }, [state.open, onMenuOpenChange]);

    // вариант "без двойной загрузки": просто открываем форму и дерево
    const openFormWithPreload = async (_widgetId: number, formId: number) => {
        // 1) Сразу открываем форму — это дернёт POST /display/{formId}/main
        handleSelectForm(formId);

        try {
            // 2) При желании можно сразу подгрузить дерево формы
            await loadFormTree(formId);
        } catch (e: any) {
            console.warn('[TopComponent] openFormWithPreload: ошибка загрузки дерева формы', e?.response?.status ?? e);
            // даже если дерево не загрузилось — сама форма уже показана
        } finally {
            // 3) В любом случае закрываем сайдбар и верхнее меню
            setNavOpen(false);
            state.closeAll();
        }
    };

    const hasWorkspaces = workSpaces.length > 0;

    // Показываем кнопку "Рабочие пространства" только для админов
    const showWorkspacesButton = hasWorkspaces && isAdmin === true;

    return (
        <div className={s.bar}>
            <div className={s.logo}>Портал ввода данных</div>

            <div className={s.menuWrapper} ref={state.menuRef}>
                {showWorkspacesButton && (
                    <button
                        className={s.trigger}
                        onClick={state.handleTriggerClick}
                        aria-haspopup="menu"
                        aria-expanded={state.open}
                    >
                        Рабочие&nbsp;пространства ▾
                    </button>
                )}
                <SideNav
                    open={navOpen}
                    toggle={() => {
                        setNavOpen(!navOpen);
                        state.closeAll();
                    }}
                    forms={Object.values(formsById)}
                    openForm={openFormWithPreload}
                    label="Формы"
                    isAdmin={isAdmin === true}
                />

                {state.open && (
                    <WorkspaceMenu
                        workSpaces={workSpaces}
                        wsOpenId={state.wsOpen.id}
                        rootFocus={state.rootFocus}
                        rootItemRefs={state.rootItemRefs}
                        isDesktop={state.isDesktop}
                        isSuperAdmin={isSuperAdmin === true}
                        onRootKeyDown={(e) => state.onRootKeyDown(e, workSpaces)}
                        onOpenWs={(ws, anchor) => state.openWs(ws, anchor)}
                        onEditWs={(ws) => {
                            setSelectedWS(ws);
                            setEditModalOpen(true);
                            state.closeAll();
                        }}
                        onDeleteWs={(ws) => {
                            if (confirm(`Удалить workspace «${ws.name}»?`)) deleteWorkspace(ws.id);
                        }}
                        onCreateWorkspace={() => {
                            changeStatusModal();
                            state.closeAll();
                        }}
                    />
                )}

                {state.wsOpen.id != null && (
                    <Floating anchor={state.wsOpen.anchor} side={state.wsOpen.side} setNode={state.setWsNode}>
                        <TablesMenu
                            ws={workSpaces.find((w) => w.id === state.wsOpen.id)!}
                            tables={tablesByWs[state.wsOpen.id] ?? []}
                            isDesktop={state.isDesktop}
                            tblOpenId={state.tblOpen.id}
                            loading={state.tablesLoading}
                            onCreateTable={(ws) => {
                                setCreateTblWs(ws);
                                setShowCreateTable(true);
                                state.closeAll();
                            }}
                            onOpenTable={(t, anchor) => state.openTbl(t, anchor, widgetsByTable)}
                            onSelectTable={(t) => {
                                handleSelectTable(t);
                                state.closeAll();
                            }}
                            onDeleteTable={(t) => {
                                if (confirm(`Удалить таблицу «${t.name}»?`)) deleteTable(t);
                            }}
                        />
                    </Floating>
                )}

                {state.tblOpen.id != null && (
                    <Floating
                        anchor={state.tblOpen.anchor}
                        side={state.tblOpen.side}
                        setNode={state.setTblNode}
                    >
                        <WidgetsMenu
                            table={
                                Object.values(tablesByWs).flat().find((t) => t.id === state.tblOpen.id) as DTable
                            }
                            widgets={widgetsByTable[state.tblOpen.id] ?? []}
                            isDesktop={state.isDesktop}
                            wOpenId={state.wOpen.id}
                            loading={state.widgetsLoading}
                            onCreateWidget={(t) => {
                                setCreateWidgetTable(t);
                                setShowCreateWidget(true);
                                state.closeAll();
                            }}
                            onOpenWidget={(w, anchor) => state.openWidget(w, anchor)}
                            onSelectWidget={(t, w) => {
                                handleSelectTable(t);
                                handleSelectWidget(w);
                                state.closeAll();
                            }}
                            onDeleteWidget={(w, t) => {
                                if (confirm('Удалить виджет?')) deleteWidget(w.id, t.id);
                            }}
                        />
                    </Floating>
                )}

                {state.wOpen.id != null && (
                    <Floating anchor={state.wOpen.anchor} side={state.wOpen.side} setNode={state.setWNode}>
                        <FormsMenu
                            table={
                                Object.values(tablesByWs).flat().find((t) => t.id === state.tblOpen.id) as DTable
                            }
                            widget={
                                (widgetsByTable[state.tblOpen.id] ?? []).find((w) => w.id === state.wOpen.id) as Widget
                            }
                            forms={props.formsListByWidget[state.wOpen.id] ?? []}
                            onCreateForm={(w) => {
                                setCreateFormWidget(w);
                                setShowCreateFormModal(true);
                                state.closeAll();
                            }}
                            onSelectForm={async (t, w, form) => {
                                handleSelectTable(t);
                                handleSelectWidget(w);
                                handleSelectForm(form.form_id);
                                await loadFormTree(form.form_id);
                                state.closeAll();
                            }}
                            onEditForm={(form) => {
                                setFormToEdit(form);
                                setEditFormOpen(true);
                                state.closeAll();
                            }}
                            onDeleteForm={async (form) => {
                                if (confirm(`Удалить форму «${form.name}»?`)) {
                                    await deleteForm(form.form_id);
                                }
                            }}
                        />
                    </Floating>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
                ПРАВАЯ ЧАСТЬ: Кнопка переключения темы
                ═══════════════════════════════════════════════════════════════════════ */}
            <div className={s.rightSection}>
                <ThemeToggle size="small" />
            </div>

            {selectedWS && (
                <>
                    <EditWorkspaceModal
                        open={editModalOpen}
                        onClose={() => setEditModalOpen(false)}
                        defaultName={selectedWS.name}
                        defaultDescription={selectedWS.description}
                        defaultGroup={selectedWS.group}
                        connections={connections}
                        connectionId={selectedWS.connection_id ?? null}
                        onSubmit={async ({ name, description, group, connection_id }) => {
                            try {
                                await api.patch(`/workspaces/${selectedWS.id}`, {
                                    name,
                                    description,
                                    group,
                                    connection_id:
                                        connection_id ?? selectedWS.connection_id ?? 0,
                                });

                                // 🔥 форсим перезагрузку списка WS
                                await loadWorkSpaces({ force: true });

                                setEditModalOpen(false);
                            } catch (err) {
                                console.warn('Ошибка при обновлении:', err);
                            }
                        }}
                        onEditConnection={(connectionId) => {
                            setConnToEditId(connectionId);
                            setEditConnOpen(true);
                        }}
                    />

                    {connToEditId != null && (
                        <ModalEditConnection
                            open={editConnOpen}
                            connectionId={connToEditId}
                            onSuccess={async () => {
                                await loadConnections({ force: true });
                                await loadWorkSpaces({ force: true });
                                setEditConnOpen(false);
                            }}
                            onCancel={() => setEditConnOpen(false)}
                        />
                    )}
                </>
            )}
        </div>
    );
};