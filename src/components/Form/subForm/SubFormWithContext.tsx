// src/components/Form/subForm/SubFormWithContext.tsx

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFormContext } from '@/components/Form/context';
import { SubWormTable } from './SubFormTable';
import type { DrillOpenMeta } from '@/components/Form/context';

type Props = {
    onOpenDrill?: (fid?: number | null, meta?: DrillOpenMeta) => void;
    comboReloadToken?: number;
};

export const SubFormWithContext: React.FC<Props> = ({
                                                        onOpenDrill,
                                                        comboReloadToken = 0,
                                                    }) => {
    const ctx = useFormContext();

    const {
        config,
        data,
        loading,
        selection,
        subAdding,
        subEditing,
        setSubDisplay,
        // Actions
        setDraftSub,
        setSubEditDraft,
        setSubEditingRowIdx,
        setActiveSubOrder,
        loadSubDisplay,
    } = ctx;

    const { selectedFormId, currentForm } = config;
    const { subDisplay } = data;
    const { subLoading, subError } = loading;
    const { activeSubOrder, lastPrimary } = selection;

    // Трекаем предыдущий formId для сброса
    const prevFormIdRef = useRef<number | null>(selectedFormId);

    // ═══════════════════════════════════════════════════════════
    // СБРОС ПРИ СМЕНЕ ФОРМЫ
    // ═══════════════════════════════════════════════════════════

    useEffect(() => {
        // Если форма изменилась — сбрасываем всё связанное с сабом
        if (prevFormIdRef.current !== selectedFormId) {
            prevFormIdRef.current = selectedFormId;

            // Сбрасываем sub display
            setSubDisplay(null);

            // Сбрасываем editing состояние
            setSubEditingRowIdx(null);
            setSubEditDraft({});

            // Сбрасываем draft добавления
            setDraftSub({});
        }
    }, [selectedFormId, setSubDisplay, setSubEditingRowIdx, setSubEditDraft, setDraftSub]);

    // ═══════════════════════════════════════════════════════════
    // COMPUTED
    // ═══════════════════════════════════════════════════════════

    const formIdForSub = selectedFormId ?? currentForm?.form_id ?? null;

    const subWidgetIdByOrder = useMemo(() => {
        const map: Record<number, number> = {};
        currentForm?.sub_widgets?.forEach((sw) => {
            map[sw.widget_order] = sw.sub_widget_id;
        });
        return map;
    }, [currentForm]);

    const availableOrders = useMemo(
        () => (currentForm?.sub_widgets ?? [])
            .map((sw) => sw.widget_order)
            .sort((a, b) => a - b),
        [currentForm],
    );

    const currentOrder = useMemo(
        () => (availableOrders.includes(activeSubOrder) ? activeSubOrder : (availableOrders[0] ?? 0)),
        [activeSubOrder, availableOrders],
    );

    const currentWidgetId = currentOrder != null ? subWidgetIdByOrder[currentOrder] : undefined;

    // ═══════════════════════════════════════════════════════════
    // TAB CLICK
    // ═══════════════════════════════════════════════════════════

    const handleTabClick = useCallback((order: number) => {
        setActiveSubOrder(order);

        // Загружаем данные только если есть выбранная строка
        if (formIdForSub && Object.keys(lastPrimary).length > 0) {
            loadSubDisplay(formIdForSub, order, lastPrimary);
        }
    }, [setActiveSubOrder, formIdForSub, lastPrimary, loadSubDisplay]);

    // ═══════════════════════════════════════════════════════════
    // EARLY RETURN: не рендерим если нет выбранной строки
    // ═══════════════════════════════════════════════════════════

    const hasSelectedRow = Object.keys(lastPrimary).length > 0;

    if (!hasSelectedRow) {
        return null;
    }


    return (
        <SubWormTable
            subDisplay={subDisplay}
            handleTabClick={handleTabClick}
            subLoading={subLoading}
            subError={subError}
            formId={formIdForSub}
            currentWidgetId={currentWidgetId}
            currentOrder={currentOrder}
            comboReloadToken={comboReloadToken}
            // Editing
            editingRowIdx={subEditing.editingRowIdx}
            setEditingRowIdx={setSubEditingRowIdx}
            editDraft={subEditing.editDraft}
            setEditDraft={setSubEditDraft}
            editSaving={subEditing.editSaving}
            setEditSaving={() => {}} // TODO: добавить в контекст если нужно
            // Adding
            isAddingSub={subAdding.isAddingSub}
            setIsAddingSub={() => {}} // Управляется через контекст
            draftSub={subAdding.draftSub}
            setDraftSub={setDraftSub}
            // Drill
            onOpenDrill={onOpenDrill}
        />
    );
};