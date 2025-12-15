// реэкспорт

// src/shared/hooks/stores/index.ts

/**
 * Доменные хуки для работы с данными
 *
 * Вместо одного монолитного useWorkSpaces используем:
 * - useWorkspacesStore — рабочие пространства
 * - useTablesStore — таблицы и колонки
 * - useWidgetsStore — виджеты и их колонки
 * - useFormsStore — формы и их отображение
 * - useConnectionsStore — подключения к БД
 */

// Stores
export { useWorkspacesStore } from './useWorkspacesStore';
export { useTablesStore } from './useTablesStore';
export { useWidgetsStore } from './useWidgetsStore';
export { useFormsStore } from './useFormsStore';
export { useConnectionsStore } from './useConnectionsStore';

// Types
export type {
    // Entities
    DTable,
    Column,
    Widget,
    WidgetColumn,
    ReferenceItem,
    WidgetForm,
    Connection,

    // Form Display
    FormColumn,
    FormRow,
    DisplayedWidget,
    FormDisplay,
    SubDisplayedWidget,
    SubFormColumn,
    SubFormRow,
    SubDisplay,
    FormTreeColumn,

    // Payloads
    NewFormPayload,
    NewSubWidgetItem,
    NewTreeFieldItem,
    AddFormRequest,
    RefPatch,

    // Utils
    LoadStatus,
    StoreState,
} from './types';

// Return types для удобства типизации в компонентах
export type { UseWorkspacesStoreReturn } from './useWorkspacesStore';
export type { UseTablesStoreReturn } from './useTablesStore';
export type { UseWidgetsStoreReturn } from './useWidgetsStore';
export type { UseFormsStoreReturn } from './useFormsStore';
export type { UseConnectionsStoreReturn } from './useConnectionsStore';