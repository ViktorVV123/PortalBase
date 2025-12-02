import {formatCellValue} from "@/shared/utils/cellFormat";
import {FormDisplay} from "@/shared/hooks/useWorkSpaces";


export type CanonicalType = 'date' | 'time' | 'timetz' | 'timestamp' | 'timestamptz';

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


export type ExtCol = FormDisplay['columns'][number] & {
    __write_tc_id?: number;
    __is_primary_combo_input?: boolean;
    datatype?: string | null;
};

export function formatByDatatype(raw: string, col: ExtCol): string {
    const v = (raw ?? '').trim();
    if (!v) return '';

    const dt = getCanonicalType(col);

    try {
        switch (dt) {
            case 'date': {
                const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (!m) return formatCellValue(v);
                const [, y, mm, dd] = m;
                return `${dd}.${mm}.${y}`;
            }

            case 'time':
            case 'timetz': {
                // 13:25:47+04:00 → 13:25:47 (+04:00)
                const m = v.match(
                    /^(\d{2}:\d{2}(?::\d{2})?)([+-]\d{2}:\d{2}|Z)?/
                );
                if (!m) return formatCellValue(v);
                const time = m[1];
                const tz = m[2];
                return tz ? `${time} (${tz})` : time;
            }

            case 'timestamp':
            case 'timestamptz': {
                // 2025-12-16T16:26:00+03:00 → 16.12.2025 16:26:00 (+03:00)
                const m = v.match(
                    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2}|Z)?/
                );
                if (!m) return formatCellValue(v);
                const [, y, mm, dd, time, tz] = m;
                const base = `${dd}.${mm}.${y} ${time}`;
                return tz ? `${base} (${tz})` : base;
            }

            default:
                return formatCellValue(v);
        }
    } catch {
        return formatCellValue(v);
    }
}
