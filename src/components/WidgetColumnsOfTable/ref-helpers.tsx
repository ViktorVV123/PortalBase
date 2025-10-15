import {api} from '@/services/api';
import type {RefItem, RefPatch} from './types';

export const DEBUG = typeof window !== 'undefined'
    ? (window as any).__WIDGET_REFS_DEBUG__ ?? true
    : true;

export function logApi(action: string, details: Record<string, unknown>) {
    if (!DEBUG) return;
    const tag = `%c[WidgetRefs] %c${action}`;
    // eslint-disable-next-line no-console
    console.groupCollapsed(tag, 'color:#7aa2ff', 'color:#9aa4af');
    try { console.log(JSON.parse(JSON.stringify(details, (_k, v) => (v ?? null)))); }
    catch { console.log(details); }
    // eslint-disable-next-line no-console
    console.groupEnd();
}

export const reindex = (arr: RefItem[]) =>
    arr.map((r, idx) => ({...r, ref_column_order: idx}));

export const toFullPatch = (r: RefItem, ref_column_order?: number): Required<RefPatch> => ({
    ref_alias: r.ref_alias ?? null,
    type: r.type ?? null,
    width: Number(r.width ?? 1),
    default: r.default ?? null,
    placeholder: r.placeholder ?? null,
    visible: r.visible ?? true,
    readonly: !!r.readonly,
    ref_column_order: Number.isFinite(ref_column_order) ? (ref_column_order as number) : (r.ref_column_order ?? 0),
    form_id: getFormId((r as any).form ?? (r as any).form_id ?? null),
});

export const getFormId = (raw: unknown): number | null => {
    if (raw == null) return null;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'object' && raw !== null && 'form_id' in (raw as any)) {
        const v = (raw as any).form_id;
        return typeof v === 'number' ? v : (Number.isFinite(+v) ? +v : null);
    }
    return null;
};

export const toCreatePayload = (r: RefItem, order: number) => ({
    width: Number(r.width ?? 1),
    ref_column_order: Number.isFinite(order) ? order : Number(r.ref_column_order ?? 0),
    type: r.type?.trim() || null,
    ref_alias: r.ref_alias?.trim() || null,
    default: r.default?.trim() || null,
    placeholder: r.placeholder?.trim() || null,
    visible: r.visible ?? true,
    readonly: !!r.readonly,
    form_id: getFormId((r as any).form ?? (r as any).form_id ?? null),
});

export const createReference = async (wcId: number, tableColumnId: number, r: RefItem, order: number) => {
    const payload = toCreatePayload(r, order);
    logApi('POST createReference:REQ', {wcId, tableColumnId, payload});
    const {data} = await api.post<RefItem>(`/widgets/tables/references/${wcId}/${tableColumnId}`, payload);
    logApi('POST createReference:OK', {wcId, tableColumnId});
    return data;
};
