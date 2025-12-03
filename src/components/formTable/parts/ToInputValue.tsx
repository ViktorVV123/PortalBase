import {format, parseISO} from "date-fns";

export function toInputValue(raw: string, type?: string): string {
    if (!raw) return '';

    switch (type) {
        case 'date': {
            // "2025-02-01" или "2025-02-01T10:00:00+03:00"
            const base = raw.length > 10 ? raw.slice(0, 10) : raw;
            const date = parseISO(base.length > 10 ? base : `${base}T00:00:00`);
            return format(date, 'yyyy-MM-dd');
        }

        case 'time': {
            // без таймзоны — просто нормализуем до HH:mm:ss
            const m = raw.match(/^(\d{2}:\d{2}:\d{2})/);
            if (m) return m[1];
            const mShort = raw.match(/^(\d{2}:\d{2})/);
            return mShort ? `${mShort[1]}:00` : '';
        }

        case 'timetz': {
            // 13:25:47+04:00 → локальное время браузера (например, 15:25:47)
            const m = raw.match(/^(\d{2}:\d{2}(?::\d{2})?)([+-]\d{2}:\d{2}|Z)?/);
            if (!m) return '';
            const timePart = m[1].length === 5 ? `${m[1]}:00` : m[1];
            const offset = m[2] ?? '';
            const iso = `1970-01-01T${timePart}${offset}`;
            const date = parseISO(iso);
            return format(date, 'HH:mm:ss');
        }

        case 'timestamp': {
            // без таймзоны — просто нормализация
            const date = parseISO(raw);
            return format(date, "yyyy-MM-dd'T'HH:mm:ss");
        }

        case 'timestamptz': {
            // 2025-12-16T16:26:00+03:00 → локальное время браузера
            const date = parseISO(raw); // offset учитывается
            return format(date, "yyyy-MM-dd'T'HH:mm:ss");
        }

        default:
            return raw;
    }
}

// src/components/formTable/parts/FromInputValue.ts
function getBrowserOffsetSuffix(): string {
    const d = new Date();
    const offsetMin = d.getTimezoneOffset(); // минуты "от UTC": Москва → -180

    if (offsetMin === 0) return 'Z';

    const total = Math.abs(offsetMin);
    const sign = offsetMin <= 0 ? '+' : '-'; // offsetMin < 0 → зона восточнее UTC (плюс)
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');

    return `${sign}${hh}:${mm}`;
}

export function fromInputValue(raw: string, type?: string): string {
    if (!raw) return '';

    const tz = getBrowserOffsetSuffix();

    switch (type) {
        case 'time':
            // 10:00 → 10:00:00
            if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
            return raw;

        case 'timetz': {
            // HTML <input type="time"> → HH:mm или HH:mm:ss
            let v = raw;
            if (/^\d{2}:\d{2}$/.test(v)) v = `${v}:00`;
            if (/^\d{2}:\d{2}:\d{2}$/.test(v)) return `${v}${tz}`;
            return raw;
        }

        case 'timestamp': {
            // 2025-02-01T10:00 → 2025-02-01T10:00:00
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
            return raw;
        }

        case 'timestamptz': {
            // 2025-02-01T10:00 → 2025-02-01T10:00:00+06:00 (для браузера с +06)
            let v = raw;
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) v = `${v}:00`;
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v)) return `${v}${tz}`;
            return raw;
        }

        default:
            return raw;
    }
}

