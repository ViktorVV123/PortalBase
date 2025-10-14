import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import EditIcon from '@/assets/image/EditIcon.svg';
import {WidgetColumn} from '@/shared/hooks/useWorkSpaces';
import type {DebouncedFunc} from 'lodash';
import debounce from 'lodash/debounce';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Stack, TextField, FormControlLabel, Checkbox,
    createTheme, ThemeProvider, Autocomplete
} from '@mui/material';
import {api} from '@/services/api'; // ⬅️ нужен для POST create

type ReferenceItem = WidgetColumn['reference'][number];

const dark = createTheme({
    palette: {mode: 'dark', primary: {main: '#ffffff'}},
    components: {
        MuiOutlinedInput: {styleOverrides: {root: {'&.Mui-focused .MuiOutlinedInput-notchedOutline': {borderColor: '#ffffff'}}}},
        MuiInputLabel: {styleOverrides: {root: {'&.Mui-focused': {color: '#ffffff'}}}},
        MuiSelect: {styleOverrides: {icon: {color: '#ffffff'}}},
    },
});

/* ----------------------- DEBUG helpers ----------------------- */
const DEBUG = true;

function logApi(action: string, details: Record<string, unknown>) {
    if (!DEBUG) return;
    const tag = `%c[WidgetRefs] %c${action}`;
    console.groupCollapsed(tag, 'color:#7aa2ff', 'color:#9aa4af');
    try {
        const safe = JSON.parse(JSON.stringify(details, (_k, v) => (v ?? null)));
        console.log(safe);
    } catch {
        console.log(details);
    }
    console.groupEnd();
}

function logStateSnapshot(
    wcId: number,
    local: Record<number, any[]>,
    snap: Record<number, number[]>
) {
    if (!DEBUG) return;
    const rows = (local[wcId] ?? []).map((r: ReferenceItem) => ({
        table_column_id: r.table_column?.id ?? null,
        name: r.table_column?.name ?? null,
        ref_alias: r.ref_alias ?? null,
        visible: r.visible ?? null,
        readonly: r.readonly ?? null,
        width: r.width ?? null,
        order: r.ref_column_order ?? null,
    }));
    logApi('STATE', {wcId, rows, orderIds: snap[wcId] ?? []});
}

/* ------------------------------------------------------------ */

/** Полный payload для создания reference */
type RefCreatePayload = {
    width: number;
    ref_column_order: number;
    type: string | null;
    ref_alias: string | null;
    default: string | null;
    placeholder: string | null;
    visible: boolean;
    readonly: boolean;
    form_id?: number | null;
};

type Props = {
    widgetColumns: WidgetColumn[];
    referencesMap: Record<number, ReferenceItem[]>;
    handleDeleteReference: (wcId: number, tblColId: number) => void;

    updateWidgetColumn: (
        id: number,
        patch: Partial<Omit<WidgetColumn, 'id' | 'widget_id' | 'reference'>>
    ) => Promise<void> | void;

    // разрешаем form_id в PATCH
    updateReference: (
        widgetColumnId: number,
        tableColumnId: number,
        patch: Partial<Pick<ReferenceItem,
            'ref_column_order' | 'width' | 'type' | 'ref_alias' |
            'default' | 'placeholder' | 'visible' | 'readonly'
        >> & { form_id?: number | null }
    ) => Promise<ReferenceItem>;

    refreshReferences?: (wcId: number) => Promise<void> | void;
    onRefsChange?: (refsMap: Record<number, ReferenceItem[]>) => void;
    deleteColumnWidget: (id: number) => void;

    // формы (id -> meta)
    formsById: Record<number, { form_id: number; name: string }>;
    loadWidgetForms: () => Promise<void> | void;
};

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
                                                            deleteColumnWidget
                                                        }) => {

    /* -------- wrappers with logs for API calls -------- */
    const callUpdateReference = useCallback(async (
        wcId: number,
        tblColId: number,
        patch: Partial<Pick<ReferenceItem, 'ref_column_order' | 'width' | 'type' | 'ref_alias' | 'default' | 'placeholder' | 'visible' | 'readonly'>> & {
            form_id?: number | null
        }
    ) => {
        logApi('PATCH updateReference:REQ', {wcId, tableColumnId: tblColId, patch});
        const res = await updateReference(wcId, tblColId, patch);
        logApi('PATCH updateReference:OK', {
            wcId, tableColumnId: tblColId,
            result: {
                ref_alias: res?.ref_alias ?? null,
                type: res?.type ?? null,
                width: res?.width ?? null,
                default: res?.default ?? null,
                placeholder: res?.placeholder ?? null,
                visible: res?.visible ?? null,
                readonly: res?.readonly ?? null,
                ref_column_order: res?.ref_column_order ?? null,
            }
        });
        return res;
    }, [updateReference]);

    const callUpdateWidgetColumn = useCallback(async (id: number, patch: any) => {
        logApi('PATCH updateWidgetColumn:REQ', {widget_column_id: id, patch});
        const res = await updateWidgetColumn(id, patch);
        logApi('PATCH updateWidgetColumn:OK', {widget_column_id: id});
        return res;
    }, [updateWidgetColumn]);
    /* -------------------------------------------------- */

    /** сортируем группы стабильно */
    const orderedWc = useMemo(
        () => [...widgetColumns].sort(
            (a, b) => (a.column_order ?? 0) - (b.column_order ?? 0) || a.id - b.id
        ),
        [widgetColumns]
    );

    /** alias диалог для группы */
    const [aliasOverrides, setAliasOverrides] = useState<Record<number, string | null>>({});
    const [aliasDlg, setAliasDlg] = useState<{ open: boolean; wcId: number | null; value: string }>({
        open: false, wcId: null, value: '',
    });
    const openAliasDialog = (wc: WidgetColumn) => setAliasDlg({open: true, wcId: wc.id, value: wc.alias ?? ''});
    const closeAliasDialog = () => setAliasDlg(d => ({...d, open: false}));
    const saveAlias = async () => {
        if (aliasDlg.wcId == null) return;
        const val = aliasDlg.value.trim();
        await callUpdateWidgetColumn(aliasDlg.wcId, {alias: val || null});
        setAliasOverrides(prev => ({...prev, [aliasDlg.wcId!]: val || null}));
        closeAliasDialog();
    };

    /** локальная копия reference + снапшот порядка */
    const [localRefs, setLocalRefs] = useState<Record<number, ReferenceItem[]>>({});
    const localRefsRef = useRef<Record<number, ReferenceItem[]>>({});
    useEffect(() => {
        localRefsRef.current = localRefs;
        onRefsChange?.(localRefs);
    }, [localRefs, onRefsChange]);

    const snapshotRef = useRef<Record<number, number[]>>({});

    const reindex = useCallback((arr: ReferenceItem[]) =>
        arr.map((r, idx) => ({...r, ref_column_order: idx})), []);

    // извлечь form_id как число|null
    const getFormId = (raw: unknown): number | null => {
        if (raw == null) return null;
        if (typeof raw === 'number') return raw;
        if (typeof raw === 'object' && 'form_id' in (raw as any)) {
            const v = (raw as any).form_id;
            return typeof v === 'number' ? v : (Number.isFinite(+v) ? +v : null);
        }
        return null;
    };

    /** первичная инициализация локального состояния из props (+ нормализация form -> id) */
    useEffect(() => {
        const next: Record<number, ReferenceItem[]> = {};
        const snap: Record<number, number[]> = {};

        orderedWc.forEach((wc) => {
            const src = (referencesMap[wc.id] ?? wc.reference ?? []);

            const deep = src.map(r => {
                const copy: any = {
                    ...r,
                    table_column: r.table_column ? {...r.table_column} : r.table_column,
                };
                const fid = getFormId((r as any).form ?? (r as any).form_id ?? null);
                copy.form = fid;
                copy.form_id = fid;
                if (typeof (copy.combobox) === 'object' && copy.combobox !== null) {
                    copy.combobox = (copy.combobox as any).id ?? (copy.combobox as any).code ?? 1;
                }
                return copy as ReferenceItem;
            });

            const sorted = deep.sort((a: any, b: any) => (a.ref_column_order ?? 0) - (b.ref_column_order ?? 0));
            next[wc.id] = reindex(sorted);
            snap[wc.id] = sorted.map((r: any) => r.table_column?.id).filter(Boolean) as number[];
        });

        setLocalRefs(next);
        snapshotRef.current = snap;
        logApi('INIT:localRefs', {snapshot: snap});
    }, [orderedWc, referencesMap, reindex]);

    /** быстрый поиск индекса по table_column.id */
    const getIdxById = useCallback((wcId: number, tableColumnId: number) => {
        const list = localRefsRef.current[wcId] ?? [];
        return list.findIndex(r => r.table_column?.id === tableColumnId);
    }, []);

    /** дебаунс-синк reorder/add */
    const queueSyncRef = useRef<DebouncedFunc<() => Promise<void>> | null>(null);
    if (!queueSyncRef.current) {
        queueSyncRef.current = debounce(async () => {
            const state = localRefsRef.current;
            const snapshot = snapshotRef.current;

            Object.keys(state).forEach(k => logStateSnapshot(Number(k), state, snapshot));

            // добавленные (через UI DnD; модалка сама чинит снапшот — см. ниже)
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                const nextOrder = (state[wcId] ?? []).map(r => r.table_column!.id);
                const prevOrder = snapshot[wcId] ?? [];
                const addedIds = nextOrder.filter(id => !prevOrder.includes(id));
                if (addedIds.length) logApi('SYNC:additions', {wcId, addedIds, nextOrder, prevOrder});

                for (const id of addedIds) {
                    const toIdx = nextOrder.indexOf(id);
                    const refObj = (state[wcId] ?? [])[toIdx] as any;
                    if (!refObj) continue;
                    await callUpdateReference(wcId, id, toFullPatch(refObj, toIdx));
                }
            }

            // перестановки
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                const nextOrder = (state[wcId] ?? []).map(r => r.table_column!.id);
                const prevOrder = snapshot[wcId] ?? [];
                const commonIds = nextOrder.filter(id => prevOrder.includes(id));
                for (const id of commonIds) {
                    const newIdx = nextOrder.indexOf(id);
                    const oldIdx = prevOrder.indexOf(id);
                    if (newIdx !== oldIdx) {
                        const row = (state[wcId] ?? [])[newIdx];
                        if (!row) continue;
                        logApi('SYNC:reorder', {wcId, tableColumnId: id, from: oldIdx, to: newIdx});
                        try {
                            await callUpdateReference(wcId, id, toFullPatch(row, newIdx));
                        } catch (e) {
                            console.warn('[order-sync] wc=', wcId, 'col=', id, e);
                        }
                    }
                }
            }

            // новый снапшот
            const nextSnap: Record<number, number[]> = {};
            for (const wcIdStr of Object.keys(state)) {
                const wcId = Number(wcIdStr);
                nextSnap[wcId] = (state[wcId] ?? []).map(r => r.table_column!.id);
            }
            snapshotRef.current = nextSnap;
            logApi('SYNC:snapshot:update', nextSnap);
        }, 250);
    }
    useEffect(() => () => queueSyncRef.current?.cancel(), []);

    /** toFullPatch для PATCH */
    const toFullPatch = (r: ReferenceItem, ref_column_order?: number): Required<Pick<ReferenceItem,
        'ref_alias' | 'type' | 'width' | 'default' | 'placeholder' | 'visible' | 'readonly' | 'ref_column_order'
    >> => ({
        ref_alias: r.ref_alias ?? null,
        type: r.type ?? null,
        width: Number(r.width ?? 1),
        default: r.default ?? null,
        placeholder: r.placeholder ?? null,
        visible: (r.visible ?? true),
        readonly: !!r.readonly,
        ref_column_order: Number.isFinite(ref_column_order) ? (ref_column_order as number) : (r.ref_column_order ?? 0),
    });

    /** DnD */
    type DragData = { srcWcId: number; fromIdx: number; tableColumnId: number };
    const [drag, setDrag] = useState<DragData | null>(null);

    const onDragStart = (srcWcId: number, fromIdx: number, tableColumnId: number) => (e: React.DragEvent) => {
        const payload: DragData = {srcWcId, fromIdx, tableColumnId};
        e.dataTransfer.setData('application/json', JSON.stringify(payload));
        e.dataTransfer.effectAllowed = 'move';
        setDrag(payload);
        logApi('UI:dragStart', payload);
    };
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
    };

    const applyCrossReorder = async (d: DragData, target: { dstWcId: number; toIdx: number }) => {
        const {srcWcId, fromIdx} = d;
        const {dstWcId, toIdx} = target;

        if (srcWcId === dstWcId) {
            setLocalRefs(prev => {
                const src = prev[srcWcId] ?? [];
                const next = [...src];
                const [rm] = next.splice(fromIdx, 1);
                if (!rm) return prev;
                next.splice(toIdx, 0, rm);
                logApi('UI:reorder:inside', {wcId: srcWcId, fromIdx, toIdx});
                return {...prev, [srcWcId]: reindex(next)};
            });
        } else {
            setLocalRefs(prev => {
                const src = prev[srcWcId] ?? [];
                const dst = prev[dstWcId] ?? [];
                const moved = src[fromIdx];
                if (!moved) return prev;
                if (dst.some(r => r.table_column?.id === moved.table_column?.id)) return prev;
                const nextSrc = [...src];
                nextSrc.splice(fromIdx, 1);
                const nextDst = [...dst];
                nextDst.splice(toIdx, 0, moved as any);
                logApi('UI:reorder:cross', {
                    fromWcId: srcWcId,
                    toWcId: dstWcId,
                    fromIdx,
                    toIdx,
                    tableColumnId: (moved as any).table_column?.id
                });
                return {
                    ...prev,
                    [srcWcId]: reindex(nextSrc),
                    [dstWcId]: reindex(nextDst),
                };
            });
        }
        queueSyncRef.current?.();
    };

    const onDropRow = (dstWcId: number, toIdx: number) => async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        let data = drag;
        try {
            if (!data) {
                const raw = e.dataTransfer.getData('application/json');
                if (raw) data = JSON.parse(raw);
            }
        } catch { /* noop */
        }
        if (!data) return;
        try {
            await applyCrossReorder(data, {dstWcId, toIdx});
        } finally {
            try {
                e.dataTransfer.clearData();
            } catch {
            }
            setDrag(null);
            queueSyncRef.current?.flush();
        }
    };

    const onDropTbodyEnd = (dstWcId: number) => async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        let data: DragData | null = drag;
        try {
            if (!data) {
                const raw = e.dataTransfer.getData('application/json');
                if (raw) data = JSON.parse(raw);
            }
        } catch { /* noop */
        }
        if (!data) return;
        const toIdx = localRefsRef.current[dstWcId]?.length ?? 0;
        await applyCrossReorder(data, {dstWcId, toIdx});
        try {
            e.dataTransfer.clearData();
        } catch {
        }
        setDrag(null);
        queueSyncRef.current?.flush();
    };

    /** модалка правки — ОТКРЫВАЕМ СТРОГО ПО ID */
    type EditState = {
        open: boolean;
        wcId: number | null;
        tableColumnId: number | null;
        ref_alias: string;
        ref_type: string;
        ref_width: number;
        ref_order: number;
        ref_default: string;
        ref_placeholder: string;
        ref_visible: boolean;
        ref_readOnly: boolean;
    };
    const [edit, setEdit] = useState<EditState>({
        open: false, wcId: null, tableColumnId: null,
        ref_alias: '', ref_type: '', ref_width: 1, ref_order: 0,
        ref_default: '', ref_placeholder: '', ref_visible: true, ref_readOnly: false
    });

    const openEditById = (wcId: number, tableColumnId: number) => {
        const listNow = localRefsRef.current[wcId] ?? [];
        const current = listNow.find(x => x.table_column?.id === tableColumnId);
        const idxNow = listNow.findIndex(x => x.table_column?.id === tableColumnId);

        if (!current) {
            logApi('UI:openEdit:WARN:notFoundById', {wcId, tableColumnId});
            return;
        }

        logApi('UI:openEdit:init', {
            wcId,
            tableColumnId,
            tableColumnName: current.table_column?.name ?? null,
            fromRow: {
                ref_alias: current.ref_alias ?? null,
                type: current.type ?? null,
                width: current.width ?? null,
                default: current.default ?? null,
                placeholder: current.placeholder ?? null,
                visible: current.visible ?? null,
                readonly: current.readonly ?? null,
                order: current.ref_column_order ?? null,
            }
        });

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
            ref_visible: (current.visible ?? true),
            ref_readOnly: !!current.readonly,
        });
    };

    const closeEdit = () => setEdit(e => ({...e, open: false}));
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

    const saveEdit = async () => {
        if (!edit.wcId || !edit.tableColumnId) return;

        const wcId = edit.wcId;
        const tableColumnId = edit.tableColumnId;

        const list = localRefsRef.current[wcId] ?? [];
        const current = list.find(x => x.table_column?.id === tableColumnId);
        if (!current) {
            closeEdit();
            return;
        }

        const to = clamp(
            Number.isFinite(edit.ref_order) ? Number(edit.ref_order) : 0,
            0,
            Math.max(0, list.length - 1)
        );

        const base = {
            ref_alias: current.ref_alias ?? null,
            type: current.type ?? null,
            width: Number((current as any).ref_width ?? current.width ?? 1),
            default: current.default ?? null,
            placeholder: current.placeholder ?? null,
            visible: (current.visible ?? true),
            readonly: !!current.readonly,
        };

        const patch = {
            ...base,
            ref_alias: (edit.ref_alias ?? '').trim() || null,
            type: (edit.ref_type ?? '').trim() || null,
            width: Number(edit.ref_width) || 1,
            default: (edit.ref_default ?? '').trim() || null,
            placeholder: (edit.ref_placeholder ?? '').trim() || null,
            visible: !!edit.ref_visible,
            readonly: !!edit.ref_readOnly,
            ref_column_order: to,
        } as const;

        // как и раньше: не шлём ref_column_order из ручного диалога
        const safePatch: any = {...patch};
        delete safePatch.ref_column_order;

        await callUpdateReference(wcId, tableColumnId, safePatch);

        setLocalRefs(prev => {
            const list = prev[wcId] ?? [];
            const filtered = list.filter(x => x.table_column?.id !== tableColumnId);
            const updated: any = {
                ...current,
                ref_alias: patch.ref_alias,
                type: patch.type,
                width: patch.width,
                default: patch.default,
                placeholder: patch.placeholder,
                visible: patch.visible,
                readonly: patch.readonly,
                ref_column_order: to,
            };
            const next = [...filtered];
            next.splice(to, 0, updated);
            return {...prev, [wcId]: reindex(next)};
        });

        closeEdit();
    };

    /** перемещение групп */
    const moveGroup = async (wcId: number, dir: 'up' | 'down') => {
        const list = orderedWc;
        const i = list.findIndex((w) => w.id === wcId);
        if (i < 0) return;
        const j = dir === 'up' ? i - 1 : i + 1;
        if (j < 0 || j >= list.length) return;
        const A = list[i], B = list[j];
        logApi('GROUP:move', {from: A.id, to: B.id, dir, aOrder: A.column_order, bOrder: B.column_order});
        await Promise.all([
            callUpdateWidgetColumn(A.id, {column_order: B.column_order ?? 0}),
            callUpdateWidgetColumn(B.id, {column_order: A.column_order ?? 0}),
        ]);
    };

    /* ───────────────── формы ───────────────── */
    const formOptions = useMemo(
        () => [{id: null as number | null, name: '—'}].concat(
            Object.values(formsById ?? {}).map(f => ({
                id: f.form_id as number | null,
                name: f.name || `Форма #${f.form_id}`,
            }))
        ),
        [formsById]
    );

    const formNameById = useMemo(() => {
        const map: Record<string, string> = {'null': '— Без формы —'};
        for (const f of formOptions) map[String(f.id)] = f.name;
        return map;
    }, [formOptions]);

    useEffect(() => {
        if (!formsById || Object.keys(formsById).length === 0) {
            loadWidgetForms?.();
        }
    }, [formsById, loadWidgetForms]);

    const [formDlg, setFormDlg] = useState<{
        open: boolean;
        wcId: number | null;
        tblColId: number | null;
        value: number | null;
    }>({open: false, wcId: null, tblColId: null, value: null});

    const openFormDialog = useCallback((wcId: number, tblColId: number, currentVal?: number | null) => {
        setFormDlg({open: true, wcId, tblColId, value: currentVal ?? null});
    }, []);
    const closeFormDialog = useCallback(() => setFormDlg(p => ({...p, open: false})), []);
    const saveFormDialog = useCallback(async () => {
        const {wcId, tblColId, value} = formDlg;
        if (!wcId || !tblColId) return;
        const normalized: number | null =
            value == null ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
        try {
            await callUpdateReference(wcId, tblColId, {form_id: normalized});
            setLocalRefs(prev => ({
                ...prev,
                [wcId]: (prev[wcId] ?? []).map(item => {
                    if (item.table_column?.id !== tblColId) return item;
                    const copy: any = {...item, form: normalized, form_id: normalized};
                    return copy as ReferenceItem;
                })
            }));
            closeFormDialog();
        } catch (e) {
            console.warn('[formDlg] save failed:', e);
        }
    }, [formDlg, callUpdateReference, setLocalRefs, closeFormDialog]);
    /* ──────────────────────────────────────── */

    /* ──────────────── ДОБАВЛЕНИЕ reference (POST) ──────────────── */
    const [addDlg, setAddDlg] = useState<{
        open: boolean;
        wcId: number | null;
        table_column_id: number | null;
        width: number;
        ref_column_order: number;
        type: string;
        ref_alias: string;
        default: string;
        placeholder: string;
        visible: boolean;
        readonly: boolean;
        form_id: number | null;
    }>({
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

    /** открыть модалку добавления в конкретную группу */
    const openAddDialog = (wcId: number) => {
        const current = localRefsRef.current[wcId] ?? [];
        setAddDlg({
            open: true,
            wcId,
            table_column_id: null,
            width: 1,
            ref_column_order: current.length, // по умолчанию в конец
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

    /** сохранить (POST create) */
    const saveAddDialog = async () => {
        const {wcId, table_column_id} = addDlg;
        if (!wcId || !table_column_id) return;

        const payload: RefCreatePayload = {
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
            const {data} = await api.post<ReferenceItem>(
                `/widgets/tables/references/${wcId}/${table_column_id}`,
                payload
            );
            logApi('POST addReference:OK', {result: data});

            // нормализуем form → form_id
            const normalizedFormId = getFormId((data as any).form ?? (data as any).form_id ?? null);

            // вставляем локально по order
            setLocalRefs(prev => {
                const list = prev[wcId] ?? [];
                const to = Math.max(0, Math.min(addDlg.ref_column_order, list.length));
                const created: any = {
                    ...data,
                    form: normalizedFormId,
                    form_id: normalizedFormId,
                };
                const next = [...list];
                next.splice(to, 0, created);
                const reindexed = reindex(next);
                const nextState = {...prev, [wcId]: reindexed};

                // чинить снапшот — чтобы дебаунс не отправил лишний PATCH
                const ids = reindexed.map(r => r.table_column?.id).filter(Boolean) as number[];
                snapshotRef.current = {...snapshotRef.current, [wcId]: ids};

                return nextState;
            });

            // опционально обновить внешний источник
            await refreshReferences?.(wcId);

            closeAddDialog();
        } catch (e: any) {
            console.warn('POST addReference:ERR', e?.response?.status, e);
            alert('Не удалось добавить поле в группу');
        }
    };
    /* ─────────────────────────────────────────────────────────────── */

    return (
        <div>
            <h3 style={{margin: '24px 0 8px'}}>Настройка формы</h3>

            {orderedWc.map((wc, idx) => {
                const refs = localRefs[wc.id] ?? [];
                const isFirst = idx === 0;
                const isLast = idx === orderedWc.length - 1;
                const displayAlias = aliasOverrides[wc.id] ?? wc.alias;

                return (
                    <div key={wc.id} style={{marginBottom: 24}}>
                        <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                            <h4 style={{margin: 0}}>{displayAlias ?? `Колонка #${wc.id}`}</h4>
                            <span style={{color: 'grey'}}>({wc.column_order ?? 0})</span>
                            <div style={{display: 'flex', gap: 6, marginLeft: 8, alignItems: 'center'}}>
                                <button title="Переместить вверх" disabled={isFirst}
                                        onClick={() => moveGroup(wc.id, 'up')}
                                        style={{opacity: isFirst ? 0.4 : 1}}>↑
                                </button>
                                <button title="Переместить вниз" disabled={isLast}
                                        onClick={() => moveGroup(wc.id, 'down')}
                                        style={{opacity: isLast ? 0.4 : 1}}>↓
                                </button>

                                <EditIcon className={s.actionIcon} onClick={() => openAliasDialog(wc)}/>
                                <DeleteIcon className={s.actionIcon} onClick={() => deleteColumnWidget(wc.id)}/>

                                {/* ⬇️ Новое: добавить reference в группу */}
                                <button
                                    className={s.okBtn}
                                    style={{marginLeft: 12}}
                                    onClick={() => openAddDialog(wc.id)}
                                    title="Добавить поле в эту группу"
                                >
                                    + поле
                                </button>
                            </div>
                        </div>

                        <table className={s.tbl} style={{marginTop: 8}}>
                            <thead>
                            <tr>
                                <th style={{width: 28}}/>
                                <th>Название</th>
                                <th>Подзаголовок</th>
                                <th style={{width: 80, opacity: .6}}>colId</th>
                                <th>Тип</th>
                                <th>Только чтение</th>
                                <th>width</th>
                                <th>default</th>
                                <th>placeholder</th>
                                <th>Видимость</th>
                                <th>Очередность</th>
                                <th>Combobox</th>
                                <th>Form</th>
                                <th/>
                            </tr>
                            </thead>

                            <tbody onDragOver={onDragOver} onDrop={onDropTbodyEnd(wc.id)}>
                            {refs.length > 0 ? refs.map((r: any) => {
                                const tblCol = r.table_column;
                                const tblColId = tblCol?.id;
                                if (!tblColId) return null;

                                const rowKey = `${wc.id}:${tblColId}`;
                                const type = r.type ?? '—';
                                const visible = (r.visible ?? true);
                                const formId = getFormId(r.form ?? r.form_id);

                                return (
                                    <tr
                                        key={rowKey}
                                        draggable
                                        onDragStart={onDragStart(wc.id, getIdxById(wc.id, tblColId), tblColId)}
                                        onDrop={onDropRow(wc.id, getIdxById(wc.id, tblColId))}
                                        style={{cursor: 'move'}}
                                    >
                                        <td style={{textAlign: 'center', opacity: 0.6}}>⋮⋮</td>
                                        <td>{tblCol?.name ?? '—'}</td>
                                        <td>{r.ref_alias ?? '—'}</td>
                                        <td style={{opacity: .6, fontSize: 12}}>{tblColId}</td>
                                        <td>{type}</td>

                                        {/* readonly toggle */}
                                        <td style={{textAlign: 'center'}}>
                                            <div onMouseDown={(e) => e.stopPropagation()}
                                                 onClick={(e) => e.stopPropagation()} draggable={false}
                                                 style={{
                                                     display: 'inline-flex',
                                                     alignItems: 'center',
                                                     justifyContent: 'center'
                                                 }}>
                                                <Checkbox
                                                    size="small"
                                                    sx={{
                                                        color: 'common.white',
                                                        '&.Mui-checked': {color: 'common.white'}
                                                    }}
                                                    checked={!!r.readonly}
                                                    onChange={async (e) => {
                                                        const nextVal = e.target.checked;
                                                        setLocalRefs(prev => ({
                                                            ...prev,
                                                            [wc.id]: (prev[wc.id] ?? []).map(item =>
                                                                item.table_column?.id === tblColId ? {
                                                                    ...item,
                                                                    readonly: nextVal
                                                                } : item
                                                            )
                                                        }));
                                                        try {
                                                            const currentRow = (localRefsRef.current[wc.id] ?? []).find(x => x.table_column?.id === tblColId);
                                                            if (currentRow) {
                                                                await callUpdateReference(wc.id, tblColId, {
                                                                    ...toFullPatch({
                                                                        ...currentRow,
                                                                        readonly: nextVal
                                                                    })
                                                                });
                                                            } else {
                                                                await callUpdateReference(wc.id, tblColId, {readonly: nextVal});
                                                            }
                                                        } catch {
                                                            setLocalRefs(prev => ({
                                                                ...prev,
                                                                [wc.id]: (prev[wc.id] ?? []).map(item =>
                                                                    item.table_column?.id === tblColId ? {
                                                                        ...item,
                                                                        readonly: !nextVal
                                                                    } : item
                                                                )
                                                            }));
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </td>

                                        <td>{r.width ?? '—'}</td>
                                        <td>{r.default ?? '—'}</td>
                                        <td>{r.placeholder ?? '—'}</td>

                                        {/* visible toggle */}
                                        <td style={{textAlign: 'center'}}>
                                            <div onMouseDown={(e) => e.stopPropagation()}
                                                 onClick={(e) => e.stopPropagation()} draggable={false}
                                                 style={{
                                                     display: 'inline-flex',
                                                     alignItems: 'center',
                                                     justifyContent: 'center'
                                                 }}>
                                                <Checkbox
                                                    size="small"
                                                    sx={{
                                                        color: 'common.white',
                                                        '&.Mui-checked': {color: 'common.white'}
                                                    }}
                                                    checked={visible}
                                                    onChange={async (e) => {
                                                        const nextVal = e.target.checked;
                                                        if (visible === nextVal) return;
                                                        setLocalRefs(prev => ({
                                                            ...prev,
                                                            [wc.id]: (prev[wc.id] ?? []).map(item =>
                                                                item.table_column?.id === tblColId ? {
                                                                    ...item,
                                                                    visible: nextVal
                                                                } : item
                                                            )
                                                        }));
                                                        try {
                                                            const currentRow = (localRefsRef.current[wc.id] ?? []).find(x => x.table_column?.id === tblColId);
                                                            if (currentRow) {
                                                                await callUpdateReference(wc.id, tblColId, {
                                                                    ...toFullPatch({
                                                                        ...currentRow,
                                                                        visible: nextVal
                                                                    })
                                                                });
                                                            } else {
                                                                await callUpdateReference(wc.id, tblColId, {visible: nextVal});
                                                            }
                                                        } catch {
                                                            setLocalRefs(prev => ({
                                                                ...prev,
                                                                [wc.id]: (prev[wc.id] ?? []).map(item =>
                                                                    item.table_column?.id === tblColId ? {
                                                                        ...item,
                                                                        visible: !nextVal
                                                                    } : item
                                                                )
                                                            }));
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </td>

                                        <td>{r.ref_column_order ?? 0}</td>
                                        <td>{typeof r.combobox === 'object' ? (r.combobox?.id ?? '—') : (r.combobox ?? '—')}</td>

                                        {/* Form — кликабельно */}
                                        <td
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openFormDialog(wc.id, tblColId, formId);
                                            }}
                                            title="Выбрать форму"
                                            style={{cursor: 'pointer', textDecoration: 'underline dotted'}}
                                        >
                                            {formId != null ? (formNameById[String(formId)] ?? `#${formId}`) : formNameById['null']}
                                        </td>

                                        <td>
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 10
                                            }}>
                                                <EditIcon className={s.actionIcon}
                                                          onClick={(e) => {
                                                              e.stopPropagation();
                                                              openEditById(wc.id, tblColId);
                                                          }}/>
                                                <DeleteIcon className={s.actionIcon}
                                                            onClick={() => handleDeleteReference(wc.id, tblColId)}/>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={13} style={{textAlign: 'center', opacity: 0.7}}>
                                        Нет связей — перетащите сюда строку из другого блока или нажмите «+ поле»
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                );
            })}

            {/* Диалог правки reference */}
            <ThemeProvider theme={dark}>
                <Dialog open={edit.open} onClose={closeEdit} fullWidth maxWidth="sm">
                    <DialogTitle>Правка reference</DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={2}>
                            <TextField label="ref_alias" size="small" value={edit.ref_alias}
                                       onChange={e => setEdit(s => ({...s, ref_alias: e.target.value}))}/>
                            <TextField label="type" size="small" value={edit.ref_type}
                                       onChange={e => setEdit(s => ({...s, ref_type: e.target.value}))}/>
                            <TextField type="number" label="width" size="small" value={edit.ref_width}
                                       onChange={e => setEdit(s => ({...s, ref_width: Number(e.target.value)}))}/>
                            <TextField label="default" size="small" value={edit.ref_default}
                                       onChange={e => setEdit(s => ({...s, ref_default: e.target.value}))}/>
                            <TextField label="placeholder" size="small" value={edit.ref_placeholder}
                                       onChange={e => setEdit(s => ({...s, ref_placeholder: e.target.value}))}/>
                            <FormControlLabel control={
                                <Checkbox checked={edit.ref_visible}
                                          onChange={e => setEdit(v => ({...v, ref_visible: e.target.checked}))}/>
                            } label="visible"/>
                            <FormControlLabel control={
                                <Checkbox checked={edit.ref_readOnly}
                                          onChange={e => setEdit(v => ({...v, ref_readOnly: e.target.checked}))}/>
                            } label="только чтение"/>
                            <TextField type="number" label="ref_column_order" size="small" value={edit.ref_order}
                                       onChange={e => setEdit(s => ({...s, ref_order: Number(e.target.value)}))}/>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeEdit}>Отмена</Button>
                        <Button variant="contained" onClick={saveEdit}>Сохранить</Button>
                    </DialogActions>
                </Dialog>
            </ThemeProvider>

            {/* Диалог alias группы */}
            <ThemeProvider theme={dark}>
                <Dialog open={aliasDlg.open} onClose={closeAliasDialog} fullWidth maxWidth="xs">
                    <DialogTitle>Изменить alias</DialogTitle>
                    <DialogContent dividers>
                        <TextField autoFocus fullWidth size="small" label="Alias"
                                   value={aliasDlg.value}
                                   onChange={e => setAliasDlg(v => ({...v, value: e.target.value}))}
                                   placeholder="Пусто = сбросить alias"/>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeAliasDialog}>Отмена</Button>
                        <Button onClick={saveAlias} variant="contained">Сохранить</Button>
                    </DialogActions>
                </Dialog>
            </ThemeProvider>

            {/* Диалог выбора формы */}
            <ThemeProvider theme={dark}>
                <Dialog open={formDlg.open} onClose={closeFormDialog} fullWidth maxWidth="sm">
                    <DialogTitle>Выбор формы</DialogTitle>
                    <DialogContent dividers>
                        <Autocomplete
                            options={formOptions}
                            value={formOptions.find(f => String(f.id) === String(formDlg.value)) ?? formOptions[0]}
                            getOptionLabel={(o) => o?.name ?? ''}
                            onOpen={() => {
                                if (!formOptions.length) loadWidgetForms?.();
                            }}
                            onChange={(_e, val) => setFormDlg(p => ({...p, value: (val?.id ?? null)}))}
                            isOptionEqualToValue={(a, b) => String(a.id) === String(b.id)}
                            renderInput={(params) => (
                                <TextField {...params} label="Форма" size="small" placeholder="Начните вводить…"/>
                            )}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setFormDlg(p => ({...p, value: null}))}>Очистить</Button>
                        <Button onClick={closeFormDialog}>Отмена</Button>
                        <Button variant="contained" onClick={saveFormDialog}>Сохранить</Button>
                    </DialogActions>
                </Dialog>
            </ThemeProvider>

            {/* Диалог ДОБАВЛЕНИЯ reference */}
            <ThemeProvider theme={dark}>
                <Dialog open={addDlg.open} onClose={closeAddDialog} fullWidth maxWidth="sm">
                    <DialogTitle>Добавить поле в группу</DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={2}>
                            <TextField
                                label="table_column_id"
                                type="number"
                                size="small"
                                required
                                value={addDlg.table_column_id ?? ''}
                                // 🔧 БЫЛО: e.currentTarget.valueAsNumber
                                onChange={(e) => {
                                    const v = (e.target as HTMLInputElement).value;
                                    setAddDlg(d => ({ ...d, table_column_id: v === '' ? null : Number(v) }));
                                }}
                                placeholder="ID столбца таблицы"
                            />

                            <TextField label="ref_alias" size="small" value={addDlg.ref_alias}
                                       onChange={e => setAddDlg(d => ({...d, ref_alias: e.target.value}))}/>
                            <TextField label="type" size="small" value={addDlg.type}
                                       onChange={e => setAddDlg(d => ({...d, type: e.target.value}))}/>
                            <TextField
                                label="width"
                                type="number"
                                size="small"
                                value={addDlg.width}
                                // 🔧 БЫЛО: e.currentTarget.valueAsNumber || 1
                                onChange={(e) => {
                                const v = (e.target as HTMLInputElement).value;
                                setAddDlg(d => ({ ...d, width: v === '' ? 1 : Number(v) }));
                            }}
                                />
                            <TextField label="default" size="small" value={addDlg.default}
                                       onChange={e => setAddDlg(d => ({...d, default: e.target.value}))}/>
                            <TextField label="placeholder" size="small" value={addDlg.placeholder}
                                       onChange={e => setAddDlg(d => ({...d, placeholder: e.target.value}))}/>
                            <FormControlLabel control={
                                <Checkbox checked={addDlg.visible}
                                          onChange={e => setAddDlg(v => ({...v, visible: e.target.checked}))}/>
                            } label="visible"/>
                            <FormControlLabel control={
                                <Checkbox checked={addDlg.readonly}
                                          onChange={e => setAddDlg(v => ({...v, readonly: e.target.checked}))}/>
                            } label="только чтение"/>

                            <TextField
                                type="number"
                                label="ref_column_order"
                                size="small"
                                value={addDlg.ref_column_order}
                                // 🔧 БЫЛО: Number.isFinite(e.currentTarget.valueAsNumber) ? ...
                                onChange={(e) => {
                                    const v = (e.target as HTMLInputElement).value;
                                    setAddDlg(d => ({ ...d, ref_column_order: v === '' ? 0 : Number(v) }));
                                }}
                                helperText="Позиция в группе (0…N). По умолчанию — в конец."
                            />

                            {/* выбор формы */}
                            <Autocomplete
                                options={formOptions}
                                value={formOptions.find(f => String(f.id) === String(addDlg.form_id)) ?? formOptions[0]}
                                getOptionLabel={(o) => o?.name ?? ''}
                                onOpen={() => {
                                    if (!formOptions.length) loadWidgetForms?.();
                                }}
                                onChange={(_e, val) => setAddDlg(p => ({...p, form_id: (val?.id ?? null)}))}
                                isOptionEqualToValue={(a, b) => String(a.id) === String(b.id)}
                                renderInput={(params) => (
                                    <TextField {...params} label="Форма" size="small" placeholder="— Без формы —"/>
                                )}
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closeAddDialog}>Отмена</Button>
                        <Button variant="contained" onClick={saveAddDialog}
                                disabled={!addDlg.table_column_id}>Добавить</Button>
                    </DialogActions>
                </Dialog>
            </ThemeProvider>
        </div>
    );
};
