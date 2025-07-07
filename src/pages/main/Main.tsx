import React, {useEffect, useState} from 'react';
import {DTable, useWorkSpaces, Widget} from '@/shared/hooks/useWorkSpaces';
import {TopComponent} from "@/components/topComponent/TopComponent";
import * as styles from './Main.module.scss'
import {SideNav} from "@/components/sideNav/SideNav";
import {TableColumn} from "@/components/tableColumn/TableColumn";


export const Main = () => {

    const [navOpen, setNavOpen] = useState(false);
    const [selectedWidget, setSelectedWidget] = useState<Widget|null>(null);

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
          setSelectedWidget(null);            // сбрасываем прежний виджет
          loadColumns(table);                 // столбцы таблицы
          loadWidgetsForTable(table.id);      // список виджетов
        };

        const handleSelectWidget = (w: Widget) => {
          setSelectedWidget(w);
          loadColumnsWidget(w.id);            // столбцы виджета
        };



    if (loading) return <p>Загрузка…</p>;
    if (error) return <p style={{color: 'red'}}>{error}</p>;

    return (
        <div className={styles.layout}>
            <SideNav open={navOpen} toggle={() => setNavOpen(o => !o)}/>
            <div className={styles.container}>
                <TopComponent handleSelectTable={handleSelectTable} workSpaces={workSpaces} tablesByWs={tablesByWs}
                              loadTables={loadTables}/>
                <TableColumn columns={columns}
                             widgets={selectedTable ? widgetsByTable[selectedTable.id] ?? [] : []}
                             widgetsLoading={widgetsLoading}
                             widgetsError={widgetsError}
                             tableName={selectedTable?.name ?? ''}
                             loading={loading}
                             workspaceName={selectedWs?.name ?? ''}
                             error={error}
                             widgetColumns={widgetColumns}
                             wColsLoading={wColsLoading}
                             wColsError={wColsError}
                             handleSelectWidget={handleSelectWidget}
                             selectedWidget={selectedWidget}

                />
            </div>


        </div>

    );
};
