export function toInputValue(raw: string, type?: string): string {
    if (!raw) return '';

    switch (type) {
        case 'date':
            return raw.slice(0, 10);

        case 'time':
        case 'timetz': {
            const m = raw.match(/^(\d{2}:\d{2}(?::\d{2})?)/);
            return m ? m[1] : '';
        }

        case 'timestamp':
        case 'timestamptz': {
            const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
            if (!m) return '';
            return `${m[1]}T${m[2]}`;
        }

        default:
            return raw;
    }
}

export function fromInputValue(raw: string, type?: string): string {
    if (!raw) return '';

    switch (type) {
        case 'time':
        case 'timetz':
            if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
            return raw;

        case 'timestamp':
        case 'timestamptz':
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
            return raw;

        default:
            return raw;
    }
}
