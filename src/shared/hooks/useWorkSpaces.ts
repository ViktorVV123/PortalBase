// src/shared/hooks/useWorkSpaces.ts

/**
 * ФАСАД для обратной совместимости
 *
 * Этот хук объединяет все доменные хуки в один интерфейс,
 * чтобы существующий код продолжал работать без изменений.
 *
 * РЕКОМЕНДАЦИЯ: В новом коде используйте отдельные хуки напрямую:
 * - useWorkspacesStore
 * - useTablesStore
 * - useWidgetsStore
 * - useFormsStore
 * - useConnectionsStore
 */

import { useCallback } from 'react';
import { api } from '@/services/api';

import { useWorkspacesStore } from './stores/useWorkspacesStore';
import { useTablesStore } from './stores/useTablesStore';
import { useWidgetsStore } from './stores/useWidgetsStore';
import { useFormsStore } from './stores/useFormsStore';
import { useConnectionsStore } from './stores/useConnectionsStore';

import type { DTable, Widget } from './stores/types';

// Re-export types for backward compatibility
export type {
    DTable,
    Column,
    Widget,
    WidgetColumn,
    ReferenceItem,
    WidgetForm,
    FormColumn,
    FormRow,
    DisplayedWidget,
    FormDisplay,
    SubDisplayedWidget,
    SubFormColumn,
    SubFormRow,
    SubDisplay,
    FormTreeColumn,
    NewFormPayload,
    NewSubWidgetItem,
    NewTreeFieldItem,
    AddFormRequest,
} from './stores/types';

export const useWorkSpaces = () => {
    // ─────────────────────────────────────────────────────────────
    // Инициализируем все доменные хуки
    // ─────────────────────────────────────────────────────────────

    const workspacesStore = useWorkspacesStore();
    const tablesStore = useTablesStore();
    const widgetsStore = useWidgetsStore();
    const formsStore = useFormsStore();
    const connectionsStore = useConnectionsStore();

    // ─────────────────────────────────────────────────────────────
    // Комбинированный loading/error (для обратной совместимости)
    // ─────────────────────────────────────────────────────────────

    const loading =
        workspacesStore.loading ||
        tablesStore.loading ||
        widgetsStore.loading ||
        formsStore.formLoading ||
        connectionsStore.loading;

    const error =
        workspacesStore.error ||
        tablesStore.error ||
        widgetsStore.error ||
        formsStore.formError ||
        connectionsStore.error;

    // ─────────────────────────────────────────────────────────────
    // Адаптеры для совместимости API
    // ─────────────────────────────────────────────────────────────

    /**
     * fetchWidgetAndTable — возвращает { widget, table }
     * Старый API ожидает table, а не tableId
     */
    const fetchWidgetAndTable = useCallback(async (widgetId: number) => {
        const { widget, tableId } = await widgetsStore.fetchWidgetAndTable(widgetId);

        // Ищем таблицу в кэше
        let table = Object.values(tablesStore.tablesByWs)
            .flat()
            .find(t => t?.id === tableId);

        // Если нет в кэше — загружаем
        if (!table) {
            const { data } = await api.get<DTable>(`/tables/${tableId}`);
            table = data;

            // Кэшируем
            tablesStore.setTablesByWs(prev => ({
                ...prev,
                [data.workspace_id]: [...(prev[data.workspace_id] ?? []), data],
            }));
        }

        return { widget, table };
    }, [widgetsStore, tablesStore]);

    // ─────────────────────────────────────────────────────────────
    // Возвращаем объединённый API (полная обратная совместимость)
    // ─────────────────────────────────────────────────────────────

    return {
        // ═══════════════════════════════════════════════════════════
        // WORKSPACES
        // ═══════════════════════════════════════════════════════════
        workSpaces: workspacesStore.workSpaces,
        loadWorkSpaces: workspacesStore.loadWorkSpaces,
        deleteWorkspace: workspacesStore.deleteWorkspace,

        // ═══════════════════════════════════════════════════════════
        // TABLES
        // ═══════════════════════════════════════════════════════════
        tablesByWs: tablesStore.tablesByWs,
        loadTables: tablesStore.loadTables,
        deleteTable: tablesStore.deleteTable,
        updateTableMeta: tablesStore.updateTableMeta,
        publishTable: tablesStore.publishTable,
        selectedTable: tablesStore.selectedTable,

        // ═══════════════════════════════════════════════════════════
        // COLUMNS (table)
        // ═══════════════════════════════════════════════════════════
        columns: tablesStore.columns,
        loadColumns: tablesStore.loadColumns,
        updateTableColumn: tablesStore.updateTableColumn,
        deleteColumnTable: tablesStore.deleteColumnTable,

        // ═══════════════════════════════════════════════════════════
        // WIDGETS
        // ═══════════════════════════════════════════════════════════
        widgetsByTable: widgetsStore.widgetsByTable,
        loadWidgetsForTable: widgetsStore.loadWidgetsForTable,
        deleteWidget: widgetsStore.deleteWidget,
        updateWidgetMeta: widgetsStore.updateWidgetMeta,
        fetchWidgetAndTable, // Адаптированная версия
        setWidgetsByTable: widgetsStore.setWidgetsByTable,

        // ═══════════════════════════════════════════════════════════
        // WIDGET COLUMNS
        // ═══════════════════════════════════════════════════════════
        widgetColumns: widgetsStore.widgetColumns,
        wColsLoading: widgetsStore.loading,
        wColsError: widgetsStore.error,
        loadColumnsWidget: widgetsStore.loadColumnsWidget,
        updateWidgetColumn: widgetsStore.updateWidgetColumn,
        deleteColumnWidget: widgetsStore.deleteColumnWidget,
        addWidgetColumn: widgetsStore.addWidgetColumn,

        // ═══════════════════════════════════════════════════════════
        // REFERENCES
        // ═══════════════════════════════════════════════════════════
        fetchReferences: widgetsStore.fetchReferences,
        updateReference: widgetsStore.updateReference,
        deleteReference: widgetsStore.deleteReference,

        // ═══════════════════════════════════════════════════════════
        // FORMS
        // ═══════════════════════════════════════════════════════════
        formsByWidget: formsStore.formsByWidget,
        formsById: formsStore.formsById,
        formsListByWidget: formsStore.formsListByWidget,
        loadWidgetForms: formsStore.loadWidgetForms,
        reloadWidgetForms: formsStore.reloadWidgetForms,
        addForm: formsStore.addForm,
        deleteForm: formsStore.deleteForm,
        deleteSubWidgetFromForm: formsStore.deleteSubWidgetFromForm,
        deleteTreeFieldFromForm: formsStore.deleteTreeFieldFromForm,

        // ═══════════════════════════════════════════════════════════
        // FORM DISPLAY
        // ═══════════════════════════════════════════════════════════
        formDisplay: formsStore.formDisplay,
        formLoading: formsStore.formLoading,
        formError: formsStore.formError,
        loadFormDisplay: formsStore.loadFormDisplay,
        loadFilteredFormDisplay: formsStore.loadFilteredFormDisplay,
        setFormDisplay: formsStore.setFormDisplay,

        // ═══════════════════════════════════════════════════════════
        // SUB DISPLAY
        // ═══════════════════════════════════════════════════════════
        subDisplay: formsStore.subDisplay,
        subLoading: formsStore.subLoading,
        subError: formsStore.subError,
        loadSubDisplay: formsStore.loadSubDisplay,
        setSubDisplay: formsStore.setSubDisplay,

        // ═══════════════════════════════════════════════════════════
        // FORM TREE
        // ═══════════════════════════════════════════════════════════
        formTrees: formsStore.formTrees,
        loadFormTree: formsStore.loadFormTree,

        // ═══════════════════════════════════════════════════════════
        // CONNECTIONS
        // ═══════════════════════════════════════════════════════════
        connections: connectionsStore.connections,
        loadConnections: connectionsStore.loadConnections,
        deleteConnection: connectionsStore.deleteConnection,

        // ═══════════════════════════════════════════════════════════
        // COMBINED STATE
        // ═══════════════════════════════════════════════════════════
        loading,
        error,
    };
};