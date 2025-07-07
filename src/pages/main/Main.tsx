import React, {useEffect, useState} from 'react';
import {DTable, useWorkSpaces} from '@/shared/hooks/useWorkSpaces';
import {TopComponent} from "@/components/TopComponent/TopComponent";
import * as styles from './Main.module.scss'
import {SideNav} from "@/components/sideNav/SideNav";
import {TableColumn} from "@/components/TableColumn/TableColumn";


export const Main = () => {

    const [navOpen, setNavOpen] = useState(false);

    const {
        loadWorkSpaces,
        columns,
        loadColumns,
        selectedTable,
        workSpaces,
        tablesByWs,
        loadTables,
        loading,
        error,
        loadWidgetsForTable,
        widgetsByTable,
        widgetsLoading,
        widgetsError,
        widgetColumns, wColsLoading, wColsError, loadColumnsWidget,
    } = useWorkSpaces();


    useEffect(() => {
            loadWorkSpaces()
        },
        [loadWorkSpaces]);

//показываем путь до таблицы workspace => table
    const selectedWs = selectedTable
        ? workSpaces.find(w => w.id === selectedTable.workspace_id) ?? null
        : null;


    const handleSelectTable = (table: DTable) => {
        loadColumns(table);              // столбцы
        loadWidgetsForTable(table.id);   // виджеты этой таблицы
    };

    if (loading) return <p>Загрузка…</p>;
    if (error) return <p style={{color: 'red'}}>{error}</p>;

    return (
        <div className={styles.layout}>
            <SideNav open={navOpen} toggle={() => setNavOpen(o => !o)}/>
            <div className={styles.container}>
                <TopComponent onSelectTable={handleSelectTable} workSpaces={workSpaces} tablesByWs={tablesByWs}
                              loadTables={loadTables}/>
                <TableColumn columns={columns}
                             widgets={selectedTable ? widgetsByTable[selectedTable.id] ?? [] : []}
                             widgetsLoading={widgetsLoading}
                             widgetsError={widgetsError}
                             tableName={selectedTable?.name ?? ''}
                             loading={loading}
                             workspaceName={selectedWs?.name ?? ''}
                             error={error}/>
            </div>


        </div>

    );
};
