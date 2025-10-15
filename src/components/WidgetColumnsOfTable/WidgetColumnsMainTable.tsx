import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {Column, WidgetColumn} from '@/shared/hooks/useWorkSpaces';
import {createTheme, ThemeProvider} from '@mui/material';
import {api} from '@/services/api';

import {EditReferenceDialog} from '@/components/modals/modalWidget/EditReferenceDialog';
import {AliasDialog} from '@/components/modals/modalWidget/AliasDialog';
import {FormPickerDialog} from '@/components/modals/modalWidget/FormPickerDialog';
import {AddReferenceDialog} from '@/components/modals/modalWidget/AddReferenceDialog';


import {logApi, reindex, toFullPatch, getFormId, createReference} from './ref-helpers';
import type {RefItem, RefPatch, FormOption, ColumnOption, Props, EditState, AddDlgState} from './types';
import {useRefsDnd} from "@/components/WidgetColumnsOfTable/ hooks/useRefsDnd";
import {WidgetGroup} from "@/components/WidgetColumnsOfTable/parts/WidgetGroups";

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

    /** ——— Alias диалог ——— */
    const [aliasOverrides, setAliasOverrides] = useState<Record<number, string | null>>({});
    const [aliasDlg, setAliasDlg] = useState<{ open: boolean; wcId: number | null; value: string }>({open: false, wcId: null, value: ''});
    const openAliasDialog = (wc: WidgetColumn) => setAliasDlg({open: true, wcId: wc.id, value: wc.alias ?? ''});
    const closeAliasDialog = () => setAliasDlg(d => ({...d, open: false}));
    const saveAlias = async () => {
        if (aliasDlg.wcId == null) return;
        const val = aliasDlg.value.trim();
        await callUpdateWidgetColumn(aliasDlg.wcId, {alias: val || null});
        setAliasOverrides(prev => ({...prev, [aliasDlg.wcId!]: val || null}));
        closeAliasDialog();
    };

    /** ——— refs локально + снапшот ——— */
    const [localRefs, setLocalRefs] = useState<Record<number, RefItem[]>>({});
    const localRefsRef = useRef<Record<number, RefItem[]>>({});
    useEffect(() => { localRefsRef.current = localRefs; onRefsChange?.(localRefs); }, [localRefs, onRefsChange]);

    const snapshotRef = useRef<Record<number, number[]>>({});

    /** ——— Инициализация из props ——— */
    useEffect(() => {
        const next: Record<number, RefItem[]> = {};
        const snap: Record<number, number[]> = {};

        for (const wc of orderedWc) {
            const src = (referencesMap[wc.id] ?? wc.reference ?? []);
            const normalized = src.map((r) => {
                const copy: RefItem = {
                    ...r,
                    table_column: r.table_column ? {...r.table_column} : r.table_column,
                    combobox: typeof (r as any).combobox === 'object' && (r as any).combobox !== null
                        ? ((r as any).combobox.id ?? (r as any).combobox.code ?? 1)
                        : (r as any).combobox,
                } as RefItem;

                const fid = getFormId((r as any).form ?? (r as any).form_id ?? null);
                (copy as any).form = fid;
                (copy as any).form_id = fid;
                return copy;
            });

            const sorted = normalized.sort((a, b) => (a.ref_column_order ?? 0) - (b.ref_column_order ?? 0));
            next[wc.id] = reindex(sorted);
            snap[wc.id] = sorted.map(r => r.table_column?.id).filter(Boolean) as number[];
        }

        setLocalRefs(next);
        snapshotRef.current = snap;
        logApi('INIT:localRefs', {snapshot: snap});
    }, [orderedWc, referencesMap]);

    /** ——— уже занятые колонки ——— */
    const usedColumnIds = useMemo(() => {
        const ids = new Set<number>();
        Object.values(localRefs).forEach(list => list?.forEach(r => {
            const id = r.table_column?.id;
            if (typeof id === 'number') ids.add(id);
        }));
        return ids;
    }, [localRefs]);

    /** ——— опции для AddReferenceDialog ——— */
    const columnOptions: ColumnOption[] = useMemo(() => {
        return (allColumns ?? []).map(c => ({
            id: c.id,
            name: c.name,
            datatype: c.datatype,
            disabled: usedColumnIds.has(c.id),
        }));
    }, [allColumns, usedColumnIds]);
    const getColLabel = (o?: ColumnOption | null) => o ? `${o.name} (id:${o.id}, ${o.datatype})` : '';

    /** ——— индексация по id ——— */
    const getIdxById = useCallback((wcId: number, tableColumnId: number) => {
        const list = localRefsRef.current[wcId] ?? [];
        return list.findIndex(r => r.table_column?.id === tableColumnId);
    }, []);

    /** ——— DnD (без DELETE: бэк чистит исходную группу сам) ——— */
    const {onDragStart, onDragEnd, onDragOver, onDropRow, onDropTbodyEnd, queueSyncRef} =
        useRefsDnd({ setLocalRefs, localRefsRef, getIdxById, snapshotRef, callUpdateReference, createReference });

    /** ——— Edit reference ——— */
    const [edit, setEdit] = useState<EditState>({
        open: false, wcId: null, tableColumnId: null,
        ref_alias: '', ref_type: '', ref_width: 1, ref_order: 0,
        ref_default: '', ref_placeholder: '', ref_visible: true, ref_readOnly: false
    });

    const openEditById = (wcId: number, tableColumnId: number) => {
        const listNow = localRefsRef.current[wcId] ?? [];
        const current = listNow.find(x => x.table_column?.id === tableColumnId);
        const idxNow = listNow.findIndex(x => x.table_column?.id === tableColumnId);
        if (!current) return;

        setEdit({
            open: true,
            wcId,
            tableColumnId,
            ref_alias: current.ref_alias ?? '',
            ref_type: current.type ?? '',
            ref_width: Number(current.width ?? 1),
            ref_order: idxNow < 0 ? (current.ref_column_order ?? 0) : idxNow,
            ref_default: current.default ?? '',
            ref_placeholder: current.placeholder ?? '',
            ref_visible: current.visible ?? true,
            ref_readOnly: !!current.readonly,
        });
    };

    const closeEdit = () => setEdit(e => ({...e, open: false}));
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

    const saveEdit = async () => {
        if (!edit.wcId || !edit.tableColumnId) return;
        const wcId = edit.wcId, tableColumnId = edit.tableColumnId;

        const list = localRefsRef.current[wcId] ?? [];
        const current = list.find(x => x.table_column?.id === tableColumnId);
        if (!current) { closeEdit(); return; }

        const to = clamp(Number.isFinite(edit.ref_order) ? Number(edit.ref_order) : 0, 0, Math.max(0, list.length - 1));

        const patch: RefPatch = {
            ref_alias: (edit.ref_alias ?? '').trim() || null,
            type: (edit.ref_type ?? '').trim() || null,
            width: Number(edit.ref_width) || 1,
            default: (edit.ref_default ?? '').trim() || null,
            placeholder: (edit.ref_placeholder ?? '').trim() || null,
            visible: !!edit.ref_visible,
            readonly: !!edit.ref_readOnly,
        };

        await callUpdateReference(wcId, tableColumnId, patch);

        // локально применим всё кроме порядка — порядок пустим через очередь
        setLocalRefs(prev => {
            const list = prev[wcId] ?? [];
            const filtered = list.filter(x => x.table_column?.id !== tableColumnId);
            const updated: RefItem = {
                ...current,
                ref_alias: patch.ref_alias ?? null,
                type: patch.type ?? null,
                width: patch.width ?? 1,
                default: patch.default ?? null,
                placeholder: patch.placeholder ?? null,
                visible: patch.visible ?? true,
                readonly: patch.readonly ?? false,
            };
            const next = [...filtered];
            next.splice(to, 0, updated);
            return {...prev, [wcId]: reindex(next)};
        });

        queueSyncRef.current?.(); // перестановка — PATCH в дебаунсе
        closeEdit();
    };

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

    /** ——— Формы ——— */
    const formOptions: FormOption[] = useMemo(() => {
        const base: FormOption[] = [{id: null, name: '— Без формы —'}];
        const rest = Object.values(formsById ?? {}).map(f => ({id: f.form_id as number | null, name: f.name || `Форма #${f.form_id}`}));
        return base.concat(rest);
    }, [formsById]);

    const formNameById = useMemo(() => {
        const map: Record<string, string> = {'null': '— Без формы —'};
        for (const f of formOptions) map[String(f.id)] = f.name;
        return map;
    }, [formOptions]);

    useEffect(() => {
        if (!formsById || Object.keys(formsById).length === 0) loadWidgetForms?.();
    }, [formsById, loadWidgetForms]);

    /** ——— Form picker ——— */
    const [formDlg, setFormDlg] = useState<{ open: boolean; wcId: number | null; tblColId: number | null; value: number | null; }>({
        open: false, wcId: null, tblColId: null, value: null
    });

    const openFormDialog = useCallback((wcId: number, tblColId: number, currentVal?: number | null) => {
        setFormDlg({open: true, wcId, tblColId, value: currentVal ?? null});
    }, []);
    const closeFormDialog = useCallback(() => setFormDlg(p => ({...p, open: false})), []);
    const saveFormDialog = useCallback(async () => {
        const {wcId, tblColId, value} = formDlg;
        if (!wcId || !tblColId) return;
        const normalized: number | null = value == null ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
        try {
            await callUpdateReference(wcId, tblColId, {form_id: normalized});
            setLocalRefs(prev => ({
                ...prev,
                [wcId]: (prev[wcId] ?? []).map(item =>
                    item.table_column?.id === tblColId ? ({...item, form: normalized, form_id: normalized} as RefItem) : item
                )
            }));
            closeFormDialog();
        } catch (e) {
            console.warn('[formDlg] save failed:', e);
        }
    }, [formDlg, callUpdateReference, closeFormDialog]);

    /** ——— Add reference ——— */
    const [addDlg, setAddDlg] = useState<AddDlgState>({
        open: false,
        wcId: null,
        table_column_id: null,
        width: 1,
        ref_column_order: 0,
        type: '',
        ref_alias: '',
        default: '',
        placeholder: '',
        visible: true,
        readonly: false,
        form_id: null
    });

    const openAddDialog = (wcId: number) => {
        const current = localRefsRef.current[wcId] ?? [];
        setAddDlg({
            open: true,
            wcId,
            table_column_id: null,
            width: 1,
            ref_column_order: current.length,
            type: '',
            ref_alias: '',
            default: '',
            placeholder: '',
            visible: true,
            readonly: false,
            form_id: null,
        });
    };
    const closeAddDialog = () => setAddDlg(d => ({...d, open: false}));

    const saveAddDialog = async () => {
        const {wcId, table_column_id} = addDlg;
        if (!wcId || !table_column_id) return;

        const payload = {
            width: Number.isFinite(addDlg.width) ? addDlg.width : 1,
            ref_column_order: Number.isFinite(addDlg.ref_column_order) ? addDlg.ref_column_order : 0,
            type: addDlg.type.trim() ? addDlg.type.trim() : null,
            ref_alias: addDlg.ref_alias.trim() ? addDlg.ref_alias.trim() : null,
            default: addDlg.default.trim() ? addDlg.default.trim() : null,
            placeholder: addDlg.placeholder.trim() ? addDlg.placeholder.trim() : null,
            visible: !!addDlg.visible,
            readonly: !!addDlg.readonly,
            form_id: addDlg.form_id ?? null,
        };

        logApi('POST addReference:REQ', {wcId, table_column_id, payload});
        try {
            const {data} = await api.post<RefItem>(`/widgets/tables/references/${wcId}/${table_column_id}`, payload);
            logApi('POST addReference:OK', {result: data});

            const normalizedFormId = getFormId((data as any).form ?? (data as any).form_id ?? null);

            setLocalRefs(prev => {
                const list = prev[wcId] ?? [];
                const to = Math.max(0, Math.min(addDlg.ref_column_order, list.length));
                const created: RefItem = {...data, ...( { form: normalizedFormId, form_id: normalizedFormId } as any )};
                const next = [...list];
                next.splice(to, 0, created);
                const reindexed = reindex(next);
                const nextState = {...prev, [wcId]: reindexed};

                // починить снапшот — чтобы очередь не прислала лишний PATCH
                const ids = reindexed.map(r => r.table_column?.id).filter(Boolean) as number[];
                snapshotRef.current = {...snapshotRef.current, [wcId]: ids};

                return nextState;
            });

            await refreshReferences?.(wcId);
            closeAddDialog();
        } catch (e: any) {
            console.warn('POST addReference:ERR', e?.response?.status, e);
            alert('Не удалось добавить поле в группу');
        }
    };

    /** ——— Render ——— */
    return (
        <div>
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
                            getIdxById, onDragStart, onDragEnd, onDragOver, onDropRow, onDropTbodyEnd
                        }}
                    />
                );
            })}

            <ThemeProvider theme={dark}>
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
