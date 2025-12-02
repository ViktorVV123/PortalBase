// Нормализуем значение из бэка → в формат для HTML-инпута
export function toInputValue(raw: string, datatype?: string): string {
    if (!raw) return '';

    switch (datatype) {
        case 'date':
            // 2025-02-01T10:00:00 → 2025-02-01
            return raw.slice(0, 10);

        case 'time':
        case 'timetz': {
            // 09:51:46.035343+03:00 → 09:51:46
            const m = raw.match(/^(\d{2}:\d{2}(?::\d{2})?)/);
            return m ? m[1] : '';
        }

        case 'timestamp':
        case 'timestamptz': {
            // 2025-12-01T09:51:46.035343+03:00 → 2025-12-01T09:51:46
            const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
            if (!m) return '';
            return `${m[1]}T${m[2]}`;
        }

        default:
            return raw;
    }
}

// Нормализуем значение из HTML-инпута → в строку для бэка
export function fromInputValue(raw: string, datatype?: string): string {
    if (!raw) return '';

    switch (datatype) {
        case 'time':
        case 'timetz':
            // 10:00 → 10:00:00
            if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
            return raw;

        case 'timestamp':
        case 'timestamptz':
            // 2025-02-01T10:00 → 2025-02-01T10:00:00
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
            return raw;

        default:
            return raw;
    }
}
