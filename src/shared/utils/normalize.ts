// лёгкая нормализация для русских слов и опечаток
export function normalizeText(s: unknown): string {

    return String(s ?? '')
        .replace(/ё/g, 'е')
        .replace(/Ё/g, 'Е')
        .toLowerCase()
        .normalize('NFKD')    // @ts-ignore
        .replace(/\p{Diacritic}/gu, '');
}