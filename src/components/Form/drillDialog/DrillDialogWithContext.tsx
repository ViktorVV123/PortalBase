// src/components/Form/drillDialog/DrillDialogWithContext.tsx

import React from 'react';
import { useFormContext } from '@/components/Form/context';
import { DrillDialog } from './DrillDialog';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';

type Props = {
    onSyncParentMain?: () => Promise<void>;
    onPickFromDrill?: (payload: {
        row: FormDisplay['data'][number];
        primary: Record<string, unknown>;
    }) => void;
    onComboboxChanged?: () => void;
};

export const DrillDialogWithContext: React.FC<Props> = ({
                                                            onSyncParentMain,
                                                            onPickFromDrill,
                                                            onComboboxChanged,
                                                        }) => {
    const ctx = useFormContext();

    const {
        config,
        drill,
        closeDrill,
        loadSubDisplay,
        comboReloadToken,
    } = ctx;

    const { formsById, formsByWidget, selectedWidget } = config;

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
            onPickFromDrill={onPickFromDrill}
            onComboboxChanged={onComboboxChanged}
            comboReloadToken={comboReloadToken}
        />
    );
};
