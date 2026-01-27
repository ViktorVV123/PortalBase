import React, { useCallback, useMemo } from 'react';
import { WidgetColumn } from '@/shared/hooks/useWorkSpaces';

import { EditReferenceDialog } from '@/components/modals/modalWidget/EditReferenceDialog';
import { AliasDialog } from '@/components/modals/modalWidget/AliasDialog';
import { FormPickerDialog } from '@/components/modals/modalWidget/FormPickerDialog';
import { AddReferenceDialog } from '@/components/modals/modalWidget/AddReferenceDialog';

import { logApi, createReference } from './ref-helpers';
import type { RefPatch, Props } from './types';

import { WidgetGroup } from '@/components/WidgetColumnsOfTable/parts/WidgetGroups';
import { useAliasDialog } from '@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useAliasDialog';
import { useFormPicker } from '@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useFormPicker';
import { useLocalRefs } from '@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useLocalRefs';
import { useEditReference } from '@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useEditReference';
import { useAddReference } from '@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useAddReference';
import { ComboboxItemDialog } from '@/components/modals/modalCombobox/ComboboxItemDialog';
import { useComboboxEditor } from '@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useComboboxEditor';
import {
    OpenComboResult,
    useComboboxCreate
} from '@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useComboboxCreate';

import { ComboboxAddDialog } from "@/components/modals/modalCombobox/ComboboxAddDialog";
import { useRefsDnd } from "@/components/WidgetColumnsOfTable/ hooks/useRefsDnd";

export const WidgetColumnsMainTable: React.FC<Props> = ({
                                                            widgetColumns,
                                                            referencesMap,
                                                            handleDeleteReference,
                                                            updateWidgetColumn,
                                                            updateReference,
                                                            refreshReferences,
                                                            onRefsChange,
                                                            formsById,
                                                            loadWidgetForms,
                                                            allColumns,
                                                            deleteColumnWidget,
                                                            workspaceId,
                                                        }) => {
    /** ——— API wrappers ——— */
    const callUpdateReference = useCallback(async (wcId: number, tblColId: number, patch: RefPatch) => {
        logApi('PATCH updateReference:REQ', { wcId, tableColumnId: tblColId, patch });
        const res = await updateReference(wcId, tblColId, patch);
        logApi('PATCH updateReference:OK', { wcId, tableColumnId: tblColId });
        return res;
    }, [updateReference]);

    const callUpdateWidgetColumn = useCallback(async (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => {
        logApi('PATCH updateWidgetColumn:REQ', { widget_column_id: id, patch });
        const res = await updateWidgetColumn(id, patch);
        logApi('PATCH updateWidgetColumn:OK', { widget_column_id: id });
        return res;
    }, [updateWidgetColumn]);

    /** ——— Порядок групп ——— */
    const orderedWc = useMemo(
        () => [...widgetColumns].sort((a, b) => (a.column_order ?? 0) - (b.column_order ?? 0) || a.id - b.id),
        [widgetColumns]
    );

    const {
        localRefs, setLocalRefs, localRefsRef,
        snapshotRef,
        columnOptions, getColLabel,
        getIdxById,
    } = useLocalRefs({
        orderedWc,
        referencesMap,
        allColumns,
        onRefsChange,
    });

    /** ——— Alias диалог ——— */
    const {
        aliasOverrides,
        aliasDlg,
        setAliasDlg,
        openAliasDialog,
        closeAliasDialog,
        saveAlias,
    } = useAliasDialog(callUpdateWidgetColumn);

    /** ——— DnD ——— */
    const { onDragStart, onDragEnd, onDragOver, onDropRow, onDropTbodyEnd, queueSyncRef } =
        useRefsDnd({ setLocalRefs, localRefsRef, getIdxById, snapshotRef, callUpdateReference, createReference });

    const {
        edit, setEdit,
        openEditById,
        closeEdit,
        saveEdit,
    } = useEditReference({
        localRefsRef,
        setLocalRefs,
        callUpdateReference,
        queueSyncRef,
    });

    const {
        addDlg, setAddDlg,
        openAddDialog, closeAddDialog, saveAddDialog,
    } = useAddReference({
        localRefsRef,
        setLocalRefs,
        snapshotRef,
        refreshReferences,
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Перемещение групп с переиндексацией
    // ═══════════════════════════════════════════════════════════════════════════
    const moveGroup = useCallback(async (wcId: number, dir: 'up' | 'down') => {
        const list = [...orderedWc];
        const currentIdx = list.findIndex((w) => w.id === wcId);

        if (currentIdx < 0) return;

        const targetIdx = dir === 'up' ? currentIdx - 1 : currentIdx + 1;

        if (targetIdx < 0 || targetIdx >= list.length) return;

        const temp = list[currentIdx];
        list[currentIdx] = list[targetIdx];
        list[targetIdx] = temp;

        const updates: Promise<any>[] = [];

        for (let i = 0; i < list.length; i++) {
            const wc = list[i];
            const newOrder = i;

            if (wc.column_order !== newOrder) {
                logApi('moveGroup:reindex', { wcId: wc.id, oldOrder: wc.column_order, newOrder });
                updates.push(callUpdateWidgetColumn(wc.id, { column_order: newOrder }));
            }
        }

        if (updates.length > 0) {
            try {
                for (const update of updates) {
                    await update;
                }
                logApi('moveGroup:complete', { movedWcId: wcId, direction: dir });
            } catch (e) {
                console.error('[moveGroup] Error updating column_order:', e);
            }
        }
    }, [orderedWc, callUpdateWidgetColumn]);

    const {
        formOptions,
        formNameById,
        formDlg,
        setFormDlg,
        openFormDialog,
        closeFormDialog,
        saveFormDialog,
    } = useFormPicker({
        workspaceId,
        formsById,
        loadWidgetForms,
        callUpdateReference: (wcId, tblColId, patch) =>
            callUpdateReference(wcId, tblColId, patch as any),
        setLocalRefs,
    });

    const { dlg, open: openComboEditor, close: closeComboEditor, onChange: changeComboEditor, save: saveComboEditor } =
        useComboboxEditor({
            localRefsRef,
            setLocalRefs,
            refreshReferences: async (wcId) => {
                await refreshReferences(wcId);
            },
        });

    const {
        dlg: dlgCreate,
        open: openComboCreate,
        close: closeComboCreate,
        onChange: changeComboCreate,
        save: saveComboCreate,
    } = useComboboxCreate({
        localRefsRef,
        setLocalRefs,
        refreshReferences: async (wcId) => { await refreshReferences(wcId); },
        formsById,
    });

    const onOpenComboCreateGuarded = async (wcId: number, tblColId: number, preset?: any) => {
        const res: OpenComboResult = await openComboCreate(wcId, tblColId, preset);

        if (!res.ok && 'reason' in res) {
            if (res.reason === 'NO_FORM' || res.reason === 'NO_TYPE') {
                alert(
                    'Для этой строки не выбрана форма или тип поля. ' +
                    'Сначала выбери форму и укажи тип "combobox" — тогда станет доступно создание combobox.'
                );
            } else if (res.reason === 'NO_TABLE') {
                alert('У выбранной формы не определена таблица. Свяжи форму с таблицей и повтори.');
            }
            return;
        }
    };

    /** ——— Render ——— */
    return (
        <div style={{ padding: 5 }}>
            <h3 style={{ margin: '24px 0 8px', textAlign: 'center', color: 'var(--theme-text-primary)' }}>
                Настройка формы
            </h3>

            {orderedWc.map((wc, idx) => {
                const refs = localRefs[wc.id] ?? [];
                const displayAlias = aliasOverrides[wc.id] ?? wc.alias;

                return (
                    <WidgetGroup
                        key={wc.id}
                        wcId={wc.id}
                        onOpenComboCreate={(wcId, tblColId, preset) => onOpenComboCreateGuarded(wcId, tblColId, preset)}
                        title={displayAlias ?? `Колонка #${wc.id}`}
                        order={wc.column_order ?? 0}
                        refs={refs}
                        isFirst={idx === 0}
                        isLast={idx === orderedWc.length - 1}
                        moveGroup={moveGroup}
                        onOpenAlias={() => openAliasDialog(wc)}
                        onDeleteGroup={() => deleteColumnWidget(wc.id)}
                        onAddField={() => openAddDialog(wc.id)}
                        formNameById={formNameById}
                        rowProps={{
                            setLocalRefs, localRefsRef, callUpdateReference,
                            onOpenEdit: openEditById,
                            onDelete: handleDeleteReference,
                            onOpenForm: openFormDialog,
                            onOpenComboItem: (wcId, tblColId, item) => openComboEditor(wcId, tblColId, item),
                            onOpenComboCreate: onOpenComboCreateGuarded,
                            getIdxById, onDragStart, onDragEnd, onDragOver, onDropRow, onDropTbodyEnd,
                        }}
                    />
                );
            })}

            {/* Диалоги теперь используют CSS переменные, ThemeProvider не нужен */}
            <ComboboxItemDialog
                open={dlg.open}
                value={dlg.value}
                onChange={changeComboEditor}
                onClose={closeComboEditor}
                onSave={saveComboEditor}
                saving={dlg.saving}
            />

            <EditReferenceDialog
                value={edit}
                onChange={(patch) => setEdit(prev => ({ ...prev, ...patch }))}
                onClose={closeEdit}
                onSave={saveEdit}
            />

            <AliasDialog
                open={aliasDlg.open}
                value={aliasDlg.value}
                onChange={(v) => setAliasDlg(p => ({ ...p, value: v }))}
                onClose={closeAliasDialog}
                onSave={saveAlias}
            />

            <FormPickerDialog
                open={formDlg.open}
                value={formDlg.value}
                options={formOptions}
                onOpen={() => {
                    if (!formOptions.length) loadWidgetForms?.();
                }}
                onChange={(v) => setFormDlg(p => ({ ...p, value: v }))}
                onClear={() => setFormDlg(p => ({ ...p, value: null }))}
                onClose={closeFormDialog}
                onSave={saveFormDialog}
            />

            <AddReferenceDialog
                value={addDlg}
                columnOptions={columnOptions}
                formOptions={formOptions}
                getColLabel={getColLabel}
                onOpenForms={() => {
                    if (!formOptions.length) loadWidgetForms?.();
                }}
                onChange={(patch) => setAddDlg(prev => ({ ...prev, ...patch }))}
                onClose={closeAddDialog}
                onSave={saveAddDialog}
            />

            <ComboboxAddDialog
                open={dlgCreate.open}
                value={dlgCreate.value}
                onChange={changeComboCreate}
                onClose={closeComboCreate}
                onSave={saveComboCreate}
                saving={dlgCreate.saving}
            />
        </div>
    );
};