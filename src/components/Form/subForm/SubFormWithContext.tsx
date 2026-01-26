// src/components/Form/subForm/SubFormWithContext.tsx

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFormContext } from '@/components/Form/context';
import { SubWormTable } from './SubFormTable';
import { ValidationToast } from '@/components/Form/mainTable/ValidationToast';
import type { DrillOpenMeta } from '@/components/Form/context';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import * as cls from "@/components/table/tableToolbar/TableToolbar.module.scss";

type Props = {
    onOpenDrill?: (fid?: number | null, meta?: DrillOpenMeta) => void;
    comboReloadToken?: number;
    cancelAdd: any;
    startAdd: any;

    submitAdd: any;
    saving: any;
    selectedWidget: any;
    buttonClassName: any;
};

export const SubFormWithContext: React.FC<Props> = ({
                                                        onOpenDrill,
                                                        comboReloadToken = 0,
                                                        submitAdd,
                                                        saving,
                                                        selectedWidget,
                                                        buttonClassName,
                                                        startAdd,
                                                        cancelAdd,
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
        // Валидация Sub (отдельная от Main)
        showSubValidationErrors,
        subValidationMissingFields,
        setShowSubValidationErrors,
        setSubValidationMissingFields,
        resetSubValidation,
        // Drill state для получения targetWriteTcId
        drill,
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
    // VALIDATION TOAST CLOSE
    // ═══════════════════════════════════════════════════════════

    const handleCloseValidationToast = useCallback(() => {
        setShowSubValidationErrors(false);
    }, [setShowSubValidationErrors]);

    // ═══════════════════════════════════════════════════════════
    // HANDLE PICK FROM DRILL (для Sub)
    // Когда пользователь выбирает значение в DrillDialog для combobox
    // ═══════════════════════════════════════════════════════════

    const handlePickFromDrillForSub = useCallback((payload: {
        row: FormDisplay['data'][number];
        primary: Record<string, unknown>;
    }) => {
        // Получаем targetWriteTcId из drill state
        const targetWriteTcId = drill.targetWriteTcId;

        if (targetWriteTcId == null) {
            console.warn('[SubFormWithContext] handlePickFromDrillForSub: no targetWriteTcId');
            return;
        }

        // Получаем ID выбранной строки (первый primary key)
        const pkEntries = Object.entries(payload.primary);
        const selectedId = pkEntries.length > 0 ? String(pkEntries[0][1]) : '';

        console.log('[SubFormWithContext] handlePickFromDrillForSub:', {
            targetWriteTcId,
            selectedId,
            primary: payload.primary,
            isAddingSub: subAdding.isAddingSub,
            editingRowIdx: subEditing.editingRowIdx,
        });

        // Определяем, в какой draft записывать — добавления или редактирования
        if (subAdding.isAddingSub) {
            // Режим добавления — обновляем draftSub
            setDraftSub((prev) => ({
                ...prev,
                [targetWriteTcId]: selectedId,
            }));
        } else if (subEditing.editingRowIdx != null) {
            // Режим редактирования — обновляем editDraft
            setSubEditDraft((prev) => ({
                ...prev,
                [targetWriteTcId]: selectedId,
            }));
        }
    }, [drill.targetWriteTcId, subAdding.isAddingSub, subEditing.editingRowIdx, setDraftSub, setSubEditDraft]);

    // ═══════════════════════════════════════════════════════════
    // WRAPPED onOpenDrill для Sub
    // Передаём targetWriteTcId в meta
    // ═══════════════════════════════════════════════════════════

    const handleOpenDrillForSub = useCallback((
        fid?: number | null,
        meta?: DrillOpenMeta
    ) => {
        if (!onOpenDrill) return;

        // Вызываем родительский onOpenDrill с meta
        onOpenDrill(fid, {
            ...meta,
            // openedFromEdit: true говорит что мы в режиме выбора значения
            openedFromEdit: true,
        });
    }, [onOpenDrill]);

    // ═══════════════════════════════════════════════════════════
    // EARLY RETURN: не рендерим если нет выбранной строки
    // ═══════════════════════════════════════════════════════════

    const hasSelectedRow = Object.keys(lastPrimary).length > 0;

    if (!hasSelectedRow) {
        return null;
    }


    return (
        <>
            <SubWormTable
                selectFormId={selectedFormId}
                submitAdd={submitAdd}
                saving={saving}
                selectedWidget={selectedWidget}
                buttonClassName={buttonClassName}
                startAdd={startAdd}
                cancelAdd={cancelAdd}

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
                setEditSaving={() => {
                }} // TODO: добавить в контекст если нужно
                // Adding
                isAddingSub={subAdding.isAddingSub}
                setIsAddingSub={() => {
                }} // Управляется через контекст
                draftSub={subAdding.draftSub}
                setDraftSub={setDraftSub}
                // Drill — используем обёртку
                onOpenDrill={handleOpenDrillForSub}
                // Валидация Sub — передаём все функции
                showValidationErrors={showSubValidationErrors}
                setShowValidationErrors={setShowSubValidationErrors}
                setValidationMissingFields={setSubValidationMissingFields}
                resetValidation={resetSubValidation}
            />

            {/* Toast для ошибок валидации Sub */}
            <ValidationToast
                open={showSubValidationErrors && subValidationMissingFields.length > 0}
                onClose={handleCloseValidationToast}
                missingFields={subValidationMissingFields}
            />
        </>
    );
};

// ═══════════════════════════════════════════════════════════
// ЭКСПОРТ ХУКА для использования в родительском компоненте
// ═══════════════════════════════════════════════════════════

export function useSubPickFromDrill() {
    const ctx = useFormContext();

    const {
        drill,
        subAdding,
        subEditing,
        setDraftSub,
        setSubEditDraft,
    } = ctx;

    const handlePickFromDrill = useCallback((payload: {
        row: FormDisplay['data'][number];
        primary: Record<string, unknown>;
    }) => {
        const targetWriteTcId = drill.targetWriteTcId;

        if (targetWriteTcId == null) {
            console.warn('[useSubPickFromDrill] no targetWriteTcId');
            return;
        }

        const pkEntries = Object.entries(payload.primary);
        const selectedId = pkEntries.length > 0 ? String(pkEntries[0][1]) : '';

        console.log('[useSubPickFromDrill] picked:', {
            targetWriteTcId,
            selectedId,
            isAddingSub: subAdding.isAddingSub,
            editingRowIdx: subEditing.editingRowIdx,
        });

        if (subAdding.isAddingSub) {
            setDraftSub((prev) => ({
                ...prev,
                [targetWriteTcId]: selectedId,
            }));
        } else if (subEditing.editingRowIdx != null) {
            setSubEditDraft((prev) => ({
                ...prev,
                [targetWriteTcId]: selectedId,
            }));
        }
    }, [drill.targetWriteTcId, subAdding.isAddingSub, subEditing.editingRowIdx, setDraftSub, setSubEditDraft]);

    return { handlePickFromDrill };
}