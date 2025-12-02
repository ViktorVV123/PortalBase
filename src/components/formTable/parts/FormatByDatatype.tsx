import {formatCellValue} from "@/shared/utils/cellFormat";
import {FormDisplay} from "@/shared/hooks/useWorkSpaces";


export type ExtCol = FormDisplay['columns'][number] & {
    __write_tc_id?: number;             // реальный tcId для записи (для combobox)
    __is_primary_combo_input?: boolean; // только одна колонка combobox редактируемая

    // 👇 добавляем, чтобы TS знал про тип данных колонки
    datatype?: string | null;
};

export function formatByDatatype(raw: string, col: ExtCol): string {
    const v = (raw ?? '').trim();
    if (!v) return '';

    const dt = col.datatype as string | undefined;

    try {
        switch (dt) {
            case 'date': {
                // 2025-02-01 → 01.02.2025
                const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (!m) return formatCellValue(v);
                const [, y, mm, dd] = m;
                return `${dd}.${mm}.${y}`;
            }

            case 'time':
            case 'timetz': {
                // 09:51:46.035343+03:00 → 09:51:46 (+03:00)
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
                // 2025-12-01T09:51:46.035343+03:00 → 01.12.2025 09:51:46 (+03:00)
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