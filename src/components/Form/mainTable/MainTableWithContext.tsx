// src/components/Form/mainTable/MainTableWithContext.tsx

import React, { useCallback } from 'react';
import { useFormContext } from '@/components/Form/context';
import { MainTable } from './MainTable';
import type { DrillOpenMeta } from '@/components/Form/context';

type Props = {
    onOpenDrill?: (fid?: number | null, meta?: DrillOpenMeta) => void;
    comboReloadToken?: number;
    /** Для DrillDialog: отключить drill при редактировании */
    disableDrillWhileEditing?: boolean;
};

export const MainTableWithContext: React.FC<Props> = ({
                                                          onOpenDrill,
                                                          comboReloadToken = 0,
                                                          disableDrillWhileEditing = false,
                                                      }) => {
    const ctx = useFormContext();

    const {
        headerPlan: hp,
        search,
        selection,
        mainAdding,
        mainEditing,
        deletingRowIdx,
        pkToKey, // ← Берём отсюда, не из selection
        // Actions
        startEdit,
        cancelEdit,
        submitEdit,
        deleteRow,
        setDraft,
        setEditDraft,
        setLastPrimary,
        setSelectedKey,
        loadSubDisplay,
        config,
    } = ctx;

    const { headerPlan, flatColumnsInRenderOrder, valueIndexByKey, isColReadOnly } = hp;
    const { filteredRows } = search;
    const { selectedKey, activeSubOrder } = selection;

    // ═══════════════════════════════════════════════════════════
    // LOCAL STATE FOR SUB HEADERS TOGGLE
    // ═══════════════════════════════════════════════════════════

    const [showSubHeaders, setShowSubHeaders] = React.useState(false);

    // ═══════════════════════════════════════════════════════════
    // ROW CLICK HANDLER
    // ═══════════════════════════════════════════════════════════

    const handleRowClick = useCallback((view: { row: any; idx: number }) => {
        const primary = view.row.primary_keys as Record<string, unknown>;
        if (!primary) return;

        setLastPrimary(primary);
        setSelectedKey(pkToKey(primary));

        const fid = config.selectedFormId;

        if (fid && activeSubOrder != null) {
            loadSubDisplay(fid, activeSubOrder, primary);
        }
    }, [pkToKey, setLastPrimary, setSelectedKey, config.selectedFormId, activeSubOrder, loadSubDisplay]);

    // ═══════════════════════════════════════════════════════════
    // PLACEHOLDER
    // ═══════════════════════════════════════════════════════════

    const placeholderFor = useCallback((c: any) => c.placeholder ?? c.column_name, []);

    return (
        <MainTable
            headerPlan={headerPlan as any}
            showSubHeaders={showSubHeaders}
            onToggleSubHeaders={() => setShowSubHeaders((v) => !v)}
            onOpenDrill={onOpenDrill}
            isAdding={mainAdding.isAdding}
            draft={mainAdding.draft}
            onDraftChange={(tcId, v) => setDraft((prev) => ({ ...prev, [tcId]: v }))}
            flatColumnsInRenderOrder={flatColumnsInRenderOrder}
            isColReadOnly={isColReadOnly}
            placeholderFor={placeholderFor}
            filteredRows={filteredRows}
            valueIndexByKey={valueIndexByKey}
            selectedKey={selectedKey}
            pkToKey={pkToKey}
            editingRowIdx={mainEditing.editingRowIdx}
            editDraft={mainEditing.editDraft}
            onEditDraftChange={(tcId, v) => setEditDraft((prev) => ({ ...prev, [tcId]: v }))}
            onSubmitEdit={submitEdit}
            onCancelEdit={cancelEdit}
            editSaving={mainEditing.editSaving}
            onRowClick={handleRowClick}
            onStartEdit={startEdit}
            onDeleteRow={deleteRow}
            deletingRowIdx={deletingRowIdx}
            disableDrillWhileEditing={disableDrillWhileEditing}
            comboReloadToken={comboReloadToken}
        />
    );
};