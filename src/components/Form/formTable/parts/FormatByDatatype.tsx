// src/components/Form/parts/FormatByDatatype.ts
import { formatCellValue } from '@/shared/utils/cellFormat';
import { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import { format, parseISO } from 'date-fns';

export type CanonicalType = 'date' | 'time' | 'timetz' | 'timestamp' | 'timestamptz';

export type ExtCol = FormDisplay['columns'][number] & {
    __write_tc_id?: number;
    __is_primary_combo_input?: boolean;
    type?: string | null ; // сюда бэк кладёт свой тип: date/time/timestampwtz/…
};

export function getCanonicalType(col: ExtCol): CanonicalType | undefined {
    const t = (col.type ?? '').toLowerCase();

    switch (t) {
        case 'date':
            return 'date';
        case 'time':
            return 'time';
        case 'timetz':
        case 'timewtz':
            return 'timetz';
        case 'timestamp':
            return 'timestamp';
        case 'timestamptz':
        case 'timestampwtz':
            return 'timestamptz';
        default:
            return undefined;
    }
}

export function formatByDatatype(raw: string, col: ExtCol): string {
    const v = (raw ?? '').trim();
    if (!v) return '';

    const dt = getCanonicalType(col);

    try {
        switch (dt) {
            case 'date': {
                // 2025-02-01 → 01.02.2025
                const src = v.length > 10 ? v.slice(0, 10) : v;
                const date = parseISO(src.length > 10 ? src : `${src}T00:00:00`);
                return format(date, 'dd.MM.yyyy');
            }

            case 'time': {
                // просто HH:mm:ss
                const m = v.match(/^(\d{2}:\d{2}:\d{2})/);
                return m ? m[1] : formatCellValue(v);
            }

            case 'timetz': {
                // 13:25:47+04:00 → (локальное время) 15:25:47 (+04:00)
                const m = v.match(/^(\d{2}:\d{2}(?::\d{2})?)([+-]\d{2}:\d{2}|Z)?/);
                if (!m) return formatCellValue(v);
                const time = m[1].length === 5 ? `${m[1]}:00` : m[1];
                const offset = m[2] ?? '';
                const iso = `1970-01-01T${time}${offset}`;
                const date = parseISO(iso);
                const localTime = format(date, 'HH:mm:ss');
                return offset ? `${localTime} (${offset})` : localTime;
            }

            case 'timestamp': {
                const date = parseISO(v);
                return format(date, 'dd.MM.yyyy HH:mm:ss');
            }

            case 'timestamptz': {
                // 2025-12-16T16:26:00+03:00
                const offsetMatch = v.match(/([+-]\d{2}:\d{2}|Z)$/);
                const offset = offsetMatch ? offsetMatch[1] : '';

                const date = parseISO(v); // учитывает offset
                const base = format(date, 'dd.MM.yyyy HH:mm:ss'); // локальная зона браузера

                return offset ? `${base} (${offset})` : base;
            }

            default:
                return formatCellValue(v);
        }
    } catch {
        return formatCellValue(v);
    }
}
