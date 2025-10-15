// utils/cellFormat.ts
export const isPrimitive = (v: unknown): v is string|number|boolean|null|undefined =>
    v == null || ['string','number','boolean'].includes(typeof v);

/** Грубая попытка распознать дату-строку (ISO) */
const isIsoDateLike = (s: string) =>
    /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+\-]\d{2}:\d{2})?)?$/.test(s);

/** Ограниченная JSON-строкизация (чтобы не упасть на циклах и не лить «портянки») */
const jsonCompact = (v: unknown, depth = 0): string => {
    try {
        if (v == null) return '';
        if (isPrimitive(v)) return String(v);
        if (Array.isArray(v)) {
            if (depth >= 2) return `[${v.length}]`;
            return `[${v.slice(0, 6).map(x => jsonCompact(x, depth+1)).join(', ')}${v.length>6?'…':''}]`;
        }
        if (typeof v === 'object') {
            const obj = v as Record<string, unknown>;
            if (depth >= 2) return '{…}';
            const entries = Object.entries(obj).slice(0, 8).map(([k,val]) => `${k}: ${jsonCompact(val, depth+1)}`);
            return `{ ${entries.join(', ')}${Object.keys(obj).length>8?' …':''} }`;
        }
        return String(v);
    } catch {
        return String(v);
    }
};

/** Хуки для “узнаваемых” доменов (можно расширять без правки вызовов) */
type DomainFormatter = (v: any) => string | null;
const domainFormatters: DomainFormatter[] = [
    // спец-кейс из твоих данных: { total: { plan, fact } } или с amount
    (v) => {
        if (!v || typeof v !== 'object' || !('total' in v)) return null;
        const t = (v as any).total ?? {};
        const plan = typeof t?.plan === 'object' && t?.plan ? t.plan.amount ?? t.plan : t.plan;
        const fact = typeof t?.fact === 'object' && t?.fact ? t.fact.amount ?? t.fact : t.fact;
        return `plan: ${plan ?? '—'} / fact: ${fact ?? '—'}`;
    },
];

/** Главный форматтер: безопасен, предсказуем, расширяем */
export const formatCellValue = (v: unknown): string => {
    if (v == null) return '';
    if (isPrimitive(v)) {
        // красивые даты
        if (typeof v === 'string' && isIsoDateLike(v)) return v; // или new Date(v).toLocaleString()
        return String(v);
    }
    // прогоним через доменные форматтеры
    for (const fmt of domainFormatters) {
        const out = fmt(v);
        if (typeof out === 'string') return out;
    }
    // общий фолбэк
    return jsonCompact(v);
};

/** Можно редактировать? – только примитивы */
export const isEditableValue = (val: unknown) => isPrimitive(val);

/** Ключ колонки → удобно задавать кастомные рендеры потом */
export const colKey = (wcId?: number, tcId?: number) => `${wcId ?? -1}:${tcId ?? -1}`;
