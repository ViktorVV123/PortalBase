// src/pages/main/Main.tsx
import React, {
    useCallback, useEffect, useRef, useState,
} from 'react';
import * as styles      from './Main.module.scss';
import {useLoadConnections} from '@/shared/hooks/useLoadConnections';
import { useWidget }          from '@/shared/hooks/useWidget';
import { useOutsideClick }    from '@/shared/hooks/useOutsideClick';
import Header                 from '@/components/header/Header';
import { SideNav }            from '@/components/sideNav/SideNav';
import { PageNotVisible }     from '@/pages/pageNotVisible/PageNotVisible';
import { PageIsVisible }      from '@/pages/pageIsVisible/PageIsVisible';
import {useWorkspaceContext} from "@/shared/context/WorkspaceContext";
import {useForm} from "@/shared/hooks/useForm";



export const Main = () => {
    /* ---------- data hooks ---------- */
    const {
        loadConnections,
        connections,
        loading: connLoading,
        error  : connError,
    } = useLoadConnections();

    const {
        widgets,
        columns        : widgetColumns,
        loading        : widgetLoading,
        error          : widgetError,
        loadWidgetsForTable,
        loadColumns,
        reset,
        addReference,
    } = useWidget();

    /* ---------- context ---------- */
    const {
        workSpaces,
        selectedWs,
        selectWorkspace,
        tables,
        updateWorkspace,
        deleteWorkspace,
    } = useWorkspaceContext();

    /* ---------- local ui state ---------- */
    const [selectedWidgetId, setSelectedWidgetId] = useState<number | null>(null);
    const [view          , setView          ] = useState<'table' | 'widget'>('table');
    const [openDropdown  , setOpenDropdown  ] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showConnForm  , setShowConnForm  ] = useState(false);
    const [navOpen       , setNavOpen       ] = useState(false);
    const [page          , setPage          ] = useState(1);



    /* -------- refs / helpers -------- */
    const wrapperRef = useRef<HTMLDivElement>(null);
    useOutsideClick(wrapperRef, () => setOpenDropdown(false));

    /* ---------- effects ---------- */
    useEffect(loadConnections, [loadConnections]);   // единственный effect

    const formId = selectedWs?.id ?? null;
    const {
        loadForm,
        loadDisplayMain,
        selectedForm,
        columns,
        rows,
        loading,
        error,
    } = useForm(formId);

    useEffect(() => {
        loadForm();          // загружаем список форм
        loadDisplayMain();   // загружаем таблицу
    }, [loadForm, loadDisplayMain]);



    /* ---------- callbacks ---------- */
    const handleTableSelect = useCallback((tableId: number | null) => {
        setSelectedWidgetId(null);
        if (tableId != null) loadWidgetsForTable(tableId);
        else reset();
    }, [loadWidgetsForTable, reset]);

    const handleWidgetSelect = (id: number) => {
        setSelectedWidgetId(id);
        loadColumns(id);
    };

    const swapTableWidget = useCallback(
        (v: number) => setView(v === 0 ? 'table' : 'widget'),
        [],
    );

    /* ---------- early states ---------- */
    if (connLoading) return <p>Загрузка…</p>;
    if (connError)   return <p style={{ color: 'red' }}>{connError}</p>;


    /* ---------- UI ---------- */
    return (
        <div className={styles.layout}>
            <SideNav page={page} setPage={setPage}  open={navOpen} toggle={() => setNavOpen(o => !o)} />

            <div className={styles.container}>
                <Header
                    wrapperRef={wrapperRef}
                    open={openDropdown}
                    setOpen={setOpenDropdown}
                    workSpaces={workSpaces}
                    selected={selectedWs}
                    selectWorkspace={ws => {
                        selectWorkspace(ws.id);
                        setOpenDropdown(false);
                        setView('table');
                    }}
                    deleteWorkspace={deleteWorkspace}
                    updateWorkspace={updateWorkspace}
                    selectedConnection={
                        selectedWs
                            ? connections.find(c => c.id === selectedWs.connection_id) ?? null
                            : null
                    }
                    onAddClickWorkspace={() => {
                        setShowCreateForm(true);
                        setOpenDropdown(false);
                    }}
                />

                <div style={{ padding: 15 }}>
                    {page === 1 ? (
                        <PageNotVisible
                            view={view}
                            swapTableWidget={swapTableWidget}
                            addReference={addReference}
                            widgets={widgets}
                            selectedWidgetId={selectedWidgetId}
                            handleWidgetSelect={handleWidgetSelect}
                            handleTableSelect={handleTableSelect}
                            loadColumns={loadColumns}
                            loadConnections={loadConnections}
                            setShowConnForm={setShowConnForm}
                            showConnForm={showConnForm}
                            setShowCreateForm={setShowCreateForm}
                            showCreateForm={showCreateForm}
                            widgetColumns={widgetColumns}
                            widgetError={widgetError}
                            widgetLoading={widgetLoading}
                            connections={connections}
                        />
                    ) : (
                        <PageIsVisible formId={formId} columns={columns} selectedForm={selectedForm} rows={rows}  />
                    )}
                </div>
            </div>
        </div>
    );
};
