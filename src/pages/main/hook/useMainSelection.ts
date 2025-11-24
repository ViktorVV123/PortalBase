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
            setSelectedFormId(formId);
            // 👇 здесь уже прямой вызов /display/{formId}/main
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
            // 1) Пытаемся выбрать таблицу/виджет — но это не обязательно
            try {
                const { widget, table } = await fetchWidgetAndTable(widgetId);
                handleSelectTable(table);
                handleSelectWidget(widget);
            } catch (e) {
                console.warn(
                    '[useMainSelection.openForm] Не удалось загрузить widget/table, продолжаем только с form:',
                    { widgetId, formId, e }
                );
                // здесь ничего не делаем — просто идём дальше к форме
            }

            // 2) В любом случае — выбираем форму и грузим данные
            handleSelectForm(formId);

            // 3) Дерево фильтров для этой формы
            try {
                await loadFormTree(formId);
            } catch (e) {
                console.warn('[useMainSelection.openForm] Не удалось загрузить дерево формы:', {
                    formId,
                    e,
                });
            }
        },
        [fetchWidgetAndTable, handleSelectForm, handleSelectTable, handleSelectWidget, loadFormTree]
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
