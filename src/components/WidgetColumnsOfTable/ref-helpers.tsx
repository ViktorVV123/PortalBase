import { api } from '@/services/api';
import type { RefItem, RefPatch } from './types';

export const DEBUG = typeof window !== 'undefined'
    ? (window as any).__WIDGET_REFS_DEBUG__ ?? true
    : true;

export function logApi(action: string, details: Record<string, unknown>) {
    if (!DEBUG) return;
    const tag = `%c[WidgetRefs] %c${action}`;
    // eslint-disable-next-line no-console
    console.groupCollapsed(tag, 'color:#7aa2ff', 'color:#9aa4af');
    try {
        console.log(JSON.parse(JSON.stringify(details, (_k, v) => (v ?? null))));
    } catch {
        console.log(details);
    }
    // eslint-disable-next-line no-console
    console.groupEnd();
}

/**
 * Переиндексирует массив ссылок: каждый элемент получает ref_column_order = его индекс
 *
 * ВАЖНО: Это меняет порядок СТРОК внутри группы (ref_column_order),
 * НЕ порядок групп (column_order)!
 */
export const reindex = (arr: RefItem[]) =>
    arr.map((r, idx) => ({ ...r, ref_column_order: idx }));

/**
 * Извлекает form_id из разных форматов
 */
export const getFormId = (raw: unknown): number | null => {
    if (raw == null) return null;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'object' && raw !== null && 'form_id' in (raw as any)) {
        const v = (raw as any).form_id;
        return typeof v === 'number' ? v : (Number.isFinite(+v) ? +v : null);
    }
    return null;
};

/**
 * Создаёт полный patch для обновления Reference (строки внутри группы)
 *
 * ВАЖНО:
 * - Это для updateReference(), а НЕ для updateWidgetColumn()!
 * - ref_column_order — порядок СТРОКИ внутри группы
 * - НЕ включает column_order (это порядок ГРУППЫ)!
 *
 * @param r - текущий RefItem
 * @param ref_column_order - новый порядок строки внутри группы
 */
export const toFullPatch = (r: RefItem, ref_column_order?: number): Required<RefPatch> => {
    const patch: Required<RefPatch> = {
        ref_alias: r.ref_alias ?? null,
        type: r.type ?? null,
        width: Number(r.width ?? 1),
        default: r.default ?? null,
        placeholder: r.placeholder ?? null,
        visible: r.visible ?? true,
        readonly: !!r.readonly,
        ref_column_order: Number.isFinite(ref_column_order)
            ? (ref_column_order as number)
            : (r.ref_column_order ?? 0),
        form_id: getFormId((r as any).form ?? (r as any).form_id ?? null),
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // ЗАЩИТА: Убеждаемся что patch НЕ содержит column_order!
    // column_order — это порядок ГРУППЫ, не строки!
    // ═══════════════════════════════════════════════════════════════════════════
    if ('column_order' in (patch as any)) {
        console.error('[ref-helpers] WARNING: toFullPatch содержит column_order! Удаляем.');
        delete (patch as any).column_order;
    }

    return patch;
};

/**
 * Создаёт payload для POST createReference
 */
export const toCreatePayload = (r: RefItem, order: number) => {
    const payload = {
        width: Number(r.width ?? 1),
        ref_column_order: Number.isFinite(order) ? order : Number(r.ref_column_order ?? 0),
        type: r.type?.trim() || null,
        ref_alias: r.ref_alias?.trim() || null,
        default: r.default?.trim() || null,
        placeholder: r.placeholder?.trim() || null,
        visible: r.visible ?? true,
        readonly: !!r.readonly,
        form_id: getFormId((r as any).form ?? (r as any).form_id ?? null),
    };

    // ЗАЩИТА: НЕ включаем column_order в payload для создания reference
    if ('column_order' in (payload as any)) {
        console.error('[ref-helpers] WARNING: toCreatePayload содержит column_order! Удаляем.');
        delete (payload as any).column_order;
    }

    return payload;
};

/**
 * POST /widgets/tables/references/{wcId}/{tableColumnId}
 * Создаёт новую связь (reference)
 */
export const createReference = async (
    wcId: number,
    tableColumnId: number,
    r: RefItem,
    order: number
) => {
    const payload = toCreatePayload(r, order);
    logApi('POST createReference:REQ', { wcId, tableColumnId, payload });
    const { data } = await api.post<RefItem>(
        `/widgets/tables/references/${wcId}/${tableColumnId}`,
        payload
    );
    logApi('POST createReference:OK', { wcId, tableColumnId });
    return data;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ЗАЩИТА от случайного изменения column_order группы
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Проверяет что patch НЕ содержит column_order
 * Вызывается перед отправкой PATCH на reference
 */
export function assertNoColumnOrder(patch: Record<string, any>, context: string): void {
    if ('column_order' in patch) {
        console.error(
            `[ref-helpers] ⚠️ WARNING: ${context} содержит column_order!`,
            '\nЭто поле ГРУППЫ (WidgetColumn), не строки (Reference).',
            '\nПатч:', patch
        );
        // Удаляем чтобы не сломать данные
        delete patch.column_order;
    }
}

/**
 * Создаёт patch для обновления WidgetColumn (группы)
 * ИСПОЛЬЗУЕТСЯ ТОЛЬКО при перетаскивании ЦЕЛЫХ ГРУПП!
 */
export function toGroupPatch(
    newColumnOrder: number,
    alias?: string | null
): { column_order: number; alias?: string | null } {
    const patch: { column_order: number; alias?: string | null } = {
        column_order: newColumnOrder,
    };

    if (alias !== undefined) {
        patch.alias = alias;
    }

    return patch;
}