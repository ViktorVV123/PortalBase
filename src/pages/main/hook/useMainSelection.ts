import { useCallback, useMemo, useState } from 'react';
import type { DTable, Widget, WidgetForm } from '@/shared/hooks/useWorkSpaces';

type Deps = {
    loadColumns: (t: DTable) => void;
    loadWidgetsForTable: (tableId: number, force?: boolean) => void;
    loadColumnsWidget: (widgetId: number) => void;
    loadFormDisplay: (formId: number) => void;
    loadFormTree: (formId: number) => Promise<void>;
    fetchWidgetAndTable: (widgetId: number) => Promise<{ widget: Widget; table: DTable }>;
    formsByWidget: Record<number, WidgetForm>;
};

export function useMainSelection({
                                     loadColumns,
                                     loadWidgetsForTable,
                                     loadColumnsWidget,
                                     loadFormDisplay,
                                     loadFormTree,
                                     fetchWidgetAndTable,
                                     formsByWidget,
                                 }: Deps) {
    const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
    const [selectedFormId, setSelectedFormId] = useState<number | null>(null);

    const clearFormSelection = useCallback(() => setSelectedFormId(null), []);

    const handleSelectTable = useCallback(
        (table: DTable) => {
            setSelectedWidget(null);
            setSelectedFormId(null);
            loadColumns(table);
            loadWidgetsForTable(table.id);
        },
        [loadColumns, loadWidgetsForTable]
    );

    const handleSelectWidget = useCallback(
        (w: Widget) => {
            setSelectedWidget(w);
            setSelectedFormId(null);
            loadColumnsWidget(w.id);
        },
        [loadColumnsWidget]
    );

    const handleClearWidget = useCallback(() => {
        setSelectedWidget(null);
        setSelectedFormId(null);
    }, []);

    const handleSelectForm = useCallback(
        (formId: number) => {
            // ═══════════════════════════════════════════════════════════
            // ИСПРАВЛЕНИЕ: Сбрасываем widget при смене формы
            // Это предотвращает рассинхронизацию widget_id и form_id
            // ═══════════════════════════════════════════════════════════
            setSelectedWidget(null);
            setSelectedFormId(formId);
            loadFormDisplay(formId);
        },
        [loadFormDisplay]
    );

    const formName = useMemo(() => {
        if (!selectedWidget || !selectedFormId) return '';
        return formsByWidget[selectedWidget.id]?.name ?? '';
    }, [formsByWidget, selectedFormId, selectedWidget]);

    /**
     * Открытие формы (SideNav / модалки и т.п.).
     * ВАЖНО: даже если нет прав на /widgets или /tables,
     * мы всё равно должны открыть форму по formId.
     */
    const openForm = useCallback(
        async (widgetId: number, formId: number) => {
            // ═══════════════════════════════════════════════════════════
            // ИСПРАВЛЕНИЕ: Сначала сбрасываем состояние, потом загружаем
            // Это гарантирует что старые данные не останутся при ошибке
            // ═══════════════════════════════════════════════════════════
            setSelectedWidget(null);
            setSelectedFormId(null);

            // 1) Пытаемся загрузить widget/table
            let loadedWidget: Widget | null = null;
            let loadedTable: DTable | null = null;

            try {
                const { widget, table } = await fetchWidgetAndTable(widgetId);
                loadedWidget = widget;
                loadedTable = table;
            } catch (e) {
                console.warn(
                    '[useMainSelection.openForm] Не удалось загрузить widget/table, продолжаем только с form:',
                    { widgetId, formId, e }
                );
            }

            // 2) Если загрузили — устанавливаем table и widget
            if (loadedTable) {
                loadColumns(loadedTable);
                loadWidgetsForTable(loadedTable.id);
            }

            if (loadedWidget) {
                setSelectedWidget(loadedWidget);
                loadColumnsWidget(loadedWidget.id);
            }

            // 3) В любом случае — устанавливаем форму и загружаем данные
            setSelectedFormId(formId);
            loadFormDisplay(formId);

            // 4) Дерево фильтров для этой формы
            try {
                await loadFormTree(formId);
            } catch (e) {
                console.warn('[useMainSelection.openForm] Не удалось загрузить дерево формы:', {
                    formId,
                    e,
                });
            }
        },
        [fetchWidgetAndTable, loadColumns, loadWidgetsForTable, loadColumnsWidget, loadFormDisplay, loadFormTree]
    );

    return {
        // state
        selectedWidget,
        selectedFormId,

        // actions
        setSelectedWidget,
        setSelectedFormId,
        clearFormSelection,
        handleSelectTable,
        handleSelectWidget,
        handleClearWidget,
        handleSelectForm,
        openForm,

        // derived
        formName,
    };
}