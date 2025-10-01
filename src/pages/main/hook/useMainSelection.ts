import { useCallback, useMemo, useState } from 'react';
import type { DTable, Widget, WidgetForm } from '@/shared/hooks/useWorkSpaces';
import type { WorkSpaceTypes } from '@/types/typesWorkSpaces';

type Deps = {
    loadColumns: (t: DTable) => void;
    loadWidgetsForTable: (tableId: number, force?: boolean) => void;
    loadColumnsWidget: (widgetId: number) => void;
    loadFormDisplay: (formId: number) => void;
    loadFormTree: (formId: number) => Promise<void>;
    fetchWidgetAndTable: (widgetId: number) => Promise<{ widget: Widget; table: DTable }>;
    formsByWidget: Record<number, any>;
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
            loadFormDisplay(formId);
        },
        [loadFormDisplay]
    );

    const formName = useMemo(() => {
        if (!selectedWidget || !selectedFormId) return '';
        return formsByWidget[selectedWidget.id]?.name ?? '';
    }, [formsByWidget, selectedFormId, selectedWidget]);

    const openForm = useCallback(
        async (widgetId: number, formId: number) => {
            const { widget, table } = await fetchWidgetAndTable(widgetId);
            handleSelectTable(table);
            handleSelectWidget(widget);
            handleSelectForm(formId);
            await loadFormTree(formId);
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
