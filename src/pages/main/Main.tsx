// Main.tsx
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import * as styles from './Main.module.scss';
import {UseLoadConnections} from '@/shared/hooks/UseLoadConnections';
import {useWorkSpaces} from '@/shared/hooks/UseWorkSpaces';
import {useWidget} from '@/shared/hooks/useWidget';
import {useOutsideClick} from '@/shared/hooks/useOutsideClick';
import {useDefaultWorkspace} from '@/shared/hooks/useDefaultWorkspace';

import Header from '@/components/header/Header';
import {TablesRow} from '@/components/TablesRow/TablesRow';
import Widget from '@/components/widget/Widget';
import {MenuTableWidget} from '@/components/menuTableWidget/MenuTableWidget';
import {ModalAddWorkspace} from '@/components/modals/modalAddWorkspace/ModalAddWorkspace';
import {ModalAddConnection} from '@/components/modals/modalAddConnection/ModalAddConnection';
import {Connection} from '@/types/typesConnection';
import {WorkSpaceTypes} from '@/types/typesWorkSpaces';
import {SideNav} from "@/components/SideNav/SideNav";

export const Main = () => {
    /* ---------- data hooks ---------- */
    const {
        loadConnections,
        connections,
        loading: connLoading,
        error: connError,
    } = UseLoadConnections();

    const {
        loadWorkSpaces,
        workSpaces,
        deleteWorkspace,
        updateWorkspace,
        tables,
        loadTables,
        loading: wsLoading,
        error: wsError,
    } = useWorkSpaces();

    const {
        widgets,
        columns: widgetColumns,
        loading: widgetLoading,
        error: widgetError,
        loadWidgetsForTable,
        loadColumns,
        reset
    } = useWidget();

    /* ---------- local state ---------- */
    const [selectedWsId, setSelectedWsId] = useState<number | null>(null);
    const [selectedWidgetId, setSelectedWidgetId] = useState<number | null>(null);
    const [view, setView] = useState<'table' | 'widget'>('table');   // ← переключатель
    const [openDropdown, setOpenDropdown] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showConnForm, setShowConnForm] = useState(false);
    const [navOpen, setNavOpen] = useState(false);

    /* выбранный workspace / connection */
    const selectedWs = useMemo(
        () => workSpaces.find(w => w.id === selectedWsId) ?? null,
        [workSpaces, selectedWsId],
    );
    const selectedConn: Connection | null = useMemo(() => {
        if (!selectedWs) return null;
        return connections.find(c => c.id === selectedWs.connection_id) ?? null;
    }, [selectedWs, connections]);

    /* ---------- refs / helpers ---------- */
    const wrapperRef = useRef<HTMLDivElement>(null);
    useOutsideClick(wrapperRef, () => setOpenDropdown(false));

    /* авто-выбор первого workspace */
    useDefaultWorkspace(
        workSpaces,
        selectedWsId,
        id => setSelectedWsId(id),
        () => {
        },
    );

    /* ---------- effects ---------- */
    useEffect(() => {
        loadConnections();      // вызываем, но НЕ возвращаем промис
    }, [loadConnections]);

    /* загрузка workspaces */
    useEffect(() => {
        loadWorkSpaces();
    }, [loadWorkSpaces]);

    /* при смене WS — подтягиваем таблицы */
    useEffect(() => {
        if (selectedWsId != null) loadTables(selectedWsId);
    }, [selectedWsId, loadTables]);

    /* ---------- callbacks ---------- */
    /* таблица → список widgets (НЕ меняем view) */
    const handleTableSelect = useCallback(
        (tableId: number | null) => {
            setSelectedWidgetId(null);

            if (tableId != null) {
                loadWidgetsForTable(tableId);
            } else {
                reset();              // reset уже стабильный
            }
        },
        [loadWidgetsForTable],     // ← reset убрали
    );

    /* widget → его столбцы */
    const handleWidgetSelect = (id: number) => {
        setSelectedWidgetId(id);
        loadColumns(id);
    };
    // 2. выносим переключение view, чтобы не пересоздавалось каждую отрисовку
    const swapTableWidget = useCallback(
        (v: number) => setView(v === 0 ? 'table' : 'widget'),
        [],
    );

    /* ---------- early states ---------- */
    if (connLoading || wsLoading) return <p>Загрузка…</p>;
    if (connError || wsError) return <p style={{color: 'red'}}>{connError || wsError}</p>;

    /* ---------- UI ---------- */
    return (
        <div className={styles.layout}>

            <SideNav open={navOpen} toggle={() => setNavOpen(o => !o)}/>
            <div className={styles.container}>
                <Header
                    wrapperRef={wrapperRef}
                    open={openDropdown}
                    setOpen={setOpenDropdown}
                    workSpaces={workSpaces}
                    selectWorkspace={(ws: WorkSpaceTypes) => {
                        setSelectedWsId(ws.id);
                        setOpenDropdown(false);
                        setView('table');              // показываем таблицы нового WS
                    }}
                    selected={selectedWs}
                    deleteWorkspace={deleteWorkspace}
                    updateWorkspace={updateWorkspace}
                    selectedConnection={selectedConn}
                    onAddClickWorkspace={() => {
                        setShowCreateForm(true);
                        setOpenDropdown(false);
                    }}
                />

                <div style={{padding: '15px'}}>
                    <MenuTableWidget
                        view={view}
                        setSwapTableWidget={swapTableWidget}
                    />

                    {view === 'table' ? (
                        <TablesRow
                            workspaceId={selectedWsId}
                            tables={tables}
                            loadTables={loadTables}
                            onTableSelect={handleTableSelect}
                        />
                    ) : (
                        <Widget
                            widgets={widgets}
                            selectedWidgetId={selectedWidgetId}
                            onSelectWidget={handleWidgetSelect}
                            columns={widgetColumns}
                            loading={widgetLoading}
                            error={widgetError}
                        />
                    )}

                    {/* ---------- modals ---------- */}
                    {showConnForm && (
                        <ModalAddConnection
                            onSuccess={() => {
                                setShowConnForm(false);
                                loadConnections();
                            }}
                            onCancel={() => setShowConnForm(false)}
                        />
                    )}

                    {showCreateForm && (
                        <ModalAddWorkspace
                            setShowConnForm={setShowConnForm}
                            connections={connections}
                            onSuccess={() => {
                                setShowCreateForm(false);
                                loadWorkSpaces();
                            }}
                            onCancel={() => setShowCreateForm(false)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
