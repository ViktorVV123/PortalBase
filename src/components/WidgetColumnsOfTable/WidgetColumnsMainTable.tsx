import React, {useCallback, useMemo, useState} from 'react';
import { WidgetColumn} from '@/shared/hooks/useWorkSpaces';
import {createTheme, ThemeProvider} from '@mui/material';
import {api} from '@/services/api';

import {EditReferenceDialog} from '@/components/modals/modalWidget/EditReferenceDialog';
import {AliasDialog} from '@/components/modals/modalWidget/AliasDialog';
import {FormPickerDialog} from '@/components/modals/modalWidget/FormPickerDialog';
import {AddReferenceDialog} from '@/components/modals/modalWidget/AddReferenceDialog';


import {logApi, reindex, getFormId, createReference} from './ref-helpers';
import type {RefPatch, Props} from './types';
import {useRefsDnd} from "@/components/WidgetColumnsOfTable/ hooks/useRefsDnd";
import {WidgetGroup} from "@/components/WidgetColumnsOfTable/parts/WidgetGroups";
import {useAliasDialog} from "@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useAliasDialog";
import {useFormPicker} from "@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useFormPicker";
import {useLocalRefs} from "@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useLocalRefs";
import {useEditReference} from "@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useEditReference";
import {useAddReference} from "@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useAddReference";
import {ComboboxItemDialog} from "@/components/modals/modalCombobox/ComboboxItemDialog";
import {useComboboxEditor} from "@/components/WidgetColumnsOfTable/WidgetColumnTable/hook/useComboboxEditor";

/** ——— UI theme (для твоих модалок) ——— */
const dark = createTheme({
    palette: {mode: 'dark', primary: {main: '#ffffff'}},
    components: {
        MuiOutlinedInput: {styleOverrides: {root: {'&.Mui-focused .MuiOutlinedInput-notchedOutline': {borderColor: '#ffffff'}}}},
        MuiInputLabel:     {styleOverrides: {root: {'&.Mui-focused': {color: '#ffffff'}}}},
        MuiSelect:         {styleOverrides: {icon: {color: '#ffffff'}}},
    },
});

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
                                                            deleteColumnWidget
                                                        }) => {
    /** ——— API wrappers ——— */
    const callUpdateReference = useCallback(async (wcId: number, tblColId: number, patch: RefPatch) => {
        logApi('PATCH updateReference:REQ', {wcId, tableColumnId: tblColId, patch});
        const res = await updateReference(wcId, tblColId, patch);
        logApi('PATCH updateReference:OK', {wcId, tableColumnId: tblColId});
        return res;
    }, [updateReference]);

    const callUpdateWidgetColumn = useCallback(async (id: number, patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>) => {
        logApi('PATCH updateWidgetColumn:REQ', {widget_column_id: id, patch});
        const res = await updateWidgetColumn(id, patch);
        logApi('PATCH updateWidgetColumn:OK', {widget_column_id: id});
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


    /** ——— DnD (без DELETE: бэк чистит исходную группу сам) ——— */
    const {onDragStart, onDragEnd, onDragOver, onDropRow, onDropTbodyEnd, queueSyncRef} =
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




    /** ——— Перемещение групп ——— */
    const moveGroup = async (wcId: number, dir: 'up' | 'down') => {
        const list = orderedWc;
        const i = list.findIndex((w) => w.id === wcId);
        if (i < 0) return;
        const j = dir === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return;
        const A = list[i], B = list[j];
        await Promise.all([
            callUpdateWidgetColumn(A.id, {column_order: B.column_order ?? 0}),
            callUpdateWidgetColumn(B.id, {column_order: A.column_order ?? 0}),
        ]);
    };

    const {
        formOptions,
        formNameById,
        formDlg,
        setFormDlg,
        openFormDialog,
        closeFormDialog,
        saveFormDialog,
    } = useFormPicker({
        formsById,
        loadWidgetForms,
        callUpdateReference: (wcId, tblColId, patch) => callUpdateReference(wcId, tblColId, patch as any),
        setLocalRefs,
    });
    const { dlg, open: openComboEditor, close: closeComboEditor, onChange: changeComboEditor, save: saveComboEditor } =
        useComboboxEditor({ localRefsRef, setLocalRefs, callUpdateReference });

    /** ——— Render ——— */
    return (
        <div style={{padding:5}}>
            <h3 style={{margin: '24px 0 8px'}}>Настройка формы</h3>

            {orderedWc.map((wc, idx) => {
                const refs = localRefs[wc.id] ?? [];
                const displayAlias = aliasOverrides[wc.id] ?? wc.alias;

                return (
                    <WidgetGroup
                        key={wc.id}
                        wcId={wc.id}
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
                            getIdxById, onDragStart, onDragEnd, onDragOver, onDropRow, onDropTbodyEnd
                        }}
                    />
                );
            })}

            <ThemeProvider theme={dark}>

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
                    onChange={(patch) => setEdit(prev => ({...prev, ...patch}))}
                    onClose={closeEdit}
                    onSave={saveEdit}
                />

                <AliasDialog
                    open={aliasDlg.open}
                    value={aliasDlg.value}
                    onChange={(v) => setAliasDlg(p => ({...p, value: v}))}
                    onClose={closeAliasDialog}
                    onSave={saveAlias}
                />

                <FormPickerDialog
                    open={formDlg.open}
                    value={formDlg.value}
                    options={formOptions}
                    onOpen={() => { if (!formOptions.length) loadWidgetForms?.(); }}
                    onChange={(v) => setFormDlg(p => ({...p, value: v}))}
                    onClear={() => setFormDlg(p => ({...p, value: null}))}
                    onClose={closeFormDialog}
                    onSave={saveFormDialog}
                />

                <AddReferenceDialog
                    value={addDlg}
                    columnOptions={columnOptions}
                    formOptions={formOptions}
                    getColLabel={getColLabel}
                    onOpenForms={() => { if (!formOptions.length) loadWidgetForms?.(); }}
                    onChange={(patch) => setAddDlg(prev => ({...prev, ...patch}))}
                    onClose={closeAddDialog}
                    onSave={saveAddDialog}
                />
            </ThemeProvider>
        </div>
    );
};
