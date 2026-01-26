// src/components/Form/drillDialog/DrillDialogWithContext.tsx

import React, { useCallback } from 'react';
import { useFormContext } from '@/components/Form/context';
import { DrillDialog } from './DrillDialog';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';

type Props = {
    onSyncParentMain?: () => Promise<void>;
    onComboboxChanged?: () => void;
};

export const DrillDialogWithContext: React.FC<Props> = ({
                                                            onSyncParentMain,
                                                            onComboboxChanged,
                                                        }) => {
    const ctx = useFormContext();

    const {
        config,
        drill,
        closeDrill,
        loadSubDisplay,
        comboReloadToken,
        // Main CRUD
        mainAdding,
        mainEditing,
        setDraft,
        setEditDraft,
        // Sub CRUD
        subAdding,
        subEditing,
        setDraftSub,
        setSubEditDraft,
    } = ctx;

    const { formsById, formsByWidget, selectedWidget } = config;

    // ═══════════════════════════════════════════════════════════
    // HANDLE PICK FROM DRILL
    // Определяем куда вставить выбранное значение:
    // - Main (add/edit)
    // - Sub (add/edit)
    // ═══════════════════════════════════════════════════════════

    const handlePickFromDrill = useCallback((payload: {
        row: FormDisplay['data'][number];
        primary: Record<string, unknown>;
    }) => {
        const targetWriteTcId = drill.targetWriteTcId;

        if (targetWriteTcId == null) {
            console.warn('[DrillDialogWithContext] handlePickFromDrill: no targetWriteTcId');
            return;
        }

        // Получаем ID выбранной строки (первый primary key)
        const pkEntries = Object.entries(payload.primary);
        const selectedId = pkEntries.length > 0 ? String(pkEntries[0][1]) : '';

        console.log('[DrillDialogWithContext] handlePickFromDrill:', {
            targetWriteTcId,
            selectedId,
            primary: payload.primary,
            // Main state
            isMainAdding: mainAdding.isAdding,
            mainEditingRowIdx: mainEditing.editingRowIdx,
            // Sub state
            isSubAdding: subAdding.isAddingSub,
            subEditingRowIdx: subEditing.editingRowIdx,
        });

        // ═══════════════════════════════════════════════════════════
        // Приоритет определения куда вставлять:
        // 1. Если Sub в режиме добавления — в draftSub
        // 2. Если Sub в режиме редактирования — в subEditDraft
        // 3. Если Main в режиме добавления — в draft
        // 4. Если Main в режиме редактирования — в editDraft
        // ═══════════════════════════════════════════════════════════

        // Проверяем Sub сначала (т.к. drill мог быть открыт из Sub)
        if (subAdding.isAddingSub) {
            console.log('[DrillDialogWithContext] → updating Sub draftSub');
            setDraftSub((prev) => ({
                ...prev,
                [targetWriteTcId]: selectedId,
            }));
            return;
        }

        if (subEditing.editingRowIdx != null) {
            console.log('[DrillDialogWithContext] → updating Sub editDraft');
            setSubEditDraft((prev) => ({
                ...prev,
                [targetWriteTcId]: selectedId,
            }));
            return;
        }

        // Проверяем Main
        if (mainAdding.isAdding) {
            console.log('[DrillDialogWithContext] → updating Main draft');
            setDraft((prev) => ({
                ...prev,
                [targetWriteTcId]: selectedId,
            }));
            return;
        }

        if (mainEditing.editingRowIdx != null) {
            console.log('[DrillDialogWithContext] → updating Main editDraft');
            setEditDraft((prev) => ({
                ...prev,
                [targetWriteTcId]: selectedId,
            }));
            return;
        }

        console.warn('[DrillDialogWithContext] handlePickFromDrill: no active add/edit mode found');
    }, [
        drill.targetWriteTcId,
        mainAdding.isAdding,
        mainEditing.editingRowIdx,
        subAdding.isAddingSub,
        subEditing.editingRowIdx,
        setDraft,
        setEditDraft,
        setDraftSub,
        setSubEditDraft,
    ]);

    if (!drill.open || !drill.formId) return null;

    return (
        <DrillDialog
            open={drill.open}
            onClose={closeDrill}
            formId={drill.formId}
            formsById={formsById}
            comboboxMode={drill.comboboxMode}
            disableNestedDrill={drill.disableNestedDrill}
            initialPrimary={drill.initialPrimary}
            selectedWidget={selectedWidget ? { id: selectedWidget.id } : null}
            formsByWidget={formsByWidget}
            loadSubDisplay={loadSubDisplay}
            onSyncParentMain={onSyncParentMain}
            onPickFromDrill={handlePickFromDrill}
            onComboboxChanged={onComboboxChanged}
            comboReloadToken={comboReloadToken}
        />
    );
};