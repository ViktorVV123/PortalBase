// src/shared/utils/generateTableSql.ts
import type { Column } from '@/shared/hooks/useWorkSpaces';

type GeneratedSql = {
    select_query: string;
    insert_query: string;
    update_query: string;
    delete_query: string;
};

function needsQuotes(datatype: string): boolean {
    const noQuotes = [
        'int', 'int4', 'int8', 'float', 'float4', 'float8',
        'numeric', 'decimal', 'real', 'double',
        'bigint', 'smallint', 'serial', 'bigserial',
        'boolean', 'bool',
    ];
    const dt = datatype.toLowerCase();
    return !noQuotes.some(t => dt.includes(t));
}

function formatPlaceholder(colName: string, datatype: string): string {
    return needsQuotes(datatype) ? `'@${colName}:'` : `@${colName}:`;
}

/**
 * Достаёт имя таблицы из SELECT: после FROM до первого пробела/;.
 * Пример: "SELECT ... FROM schema.table t WHERE ..." -> "schema.table"
 */
export function extractTableNameFromSelect(selectQuery: string): string | null {
    if (!selectQuery) return null;

    // нормализуем пробелы/переносы
    const normalized = selectQuery.replace(/\s+/g, ' ').trim();

    // берём токен после FROM
    const m = normalized.match(/\bfrom\b\s+([^\s;]+)/i);
    return m?.[1] ?? null;
}

/**
 * Генерирует SQL запросы на основе колонок таблицы
 */
export function generateTableSql(tableName: string, columns: Column[]): GeneratedSql {
    if (!columns.length) {
        return { select_query: '', insert_query: '', update_query: '', delete_query: '' };
    }

    const pkColumns = columns.filter(c => c.primary);
    const nonPkColumns = columns.filter(c => !c.primary);

    const insertColumns = columns.filter(c => !(c.primary && c.increment));
    const allColNames = columns.map(c => c.name);

    const select_query = `SELECT ${allColNames.join(', ')} FROM ${tableName}`;

    const insertColNames = insertColumns.map(c => c.name);
    const insertValues = insertColumns.map(c => formatPlaceholder(c.name, c.datatype));
    const insert_query =
        insertColNames.length > 0
            ? `INSERT INTO ${tableName} (${insertColNames.join(', ')}) VALUES (${insertValues.join(', ')})`
            : '';

    // UPDATE
    const setClauses = nonPkColumns.map(c => `${c.name}=${formatPlaceholder(c.name, c.datatype)}`);
    const whereClauses = pkColumns.map(c => `${c.name}=${formatPlaceholder(c.name, c.datatype)}`);

    const update_query =
        setClauses.length === 0
            ? ''
            : whereClauses.length > 0
                ? `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`
                : `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE /* TODO: add PK/condition */`;

    // DELETE
    const delete_query =
        whereClauses.length > 0
            ? `DELETE FROM ${tableName} WHERE ${whereClauses.join(' AND ')}`
            : `DELETE FROM ${tableName} WHERE /* TODO: add PK/condition */`;

    return { select_query, insert_query, update_query, delete_query };
}