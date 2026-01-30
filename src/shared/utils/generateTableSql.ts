// src/shared/utils/generateTableSql.ts
import type { Column } from '@/shared/hooks/useWorkSpaces';

type GeneratedSql = {
    select_query: string;
    insert_query: string;
    update_query: string;
    delete_query: string;
};

/**
 * Проверяет, нужны ли кавычки для значения (строковые типы)
 */
function needsValueQuotes(datatype: string): boolean {
    const noQuotes = [
        'int', 'int4', 'int8', 'float', 'float4', 'float8',
        'numeric', 'decimal', 'real', 'double',
        'bigint', 'smallint', 'serial', 'bigserial',
        'boolean', 'bool',
    ];
    const dt = datatype.toLowerCase();
    return !noQuotes.some(t => dt.includes(t));
}

/**
 * Форматирует placeholder для значения
 */
function formatPlaceholder(colName: string, datatype: string): string {
    return needsValueQuotes(datatype) ? `'@${colName}:'` : `@${colName}:`;
}

/**
 * Оборачивает идентификатор (таблицу/колонку) в двойные кавычки для PostgreSQL
 * Это необходимо для:
 * - Имён с заглавными буквами (PostgreSQL приводит к lowercase без кавычек)
 * - Зарезервированных слов (user, order, table и т.д.)
 * - Имён со спецсимволами
 *
 * Безопасно использовать всегда — для обычных имён тоже работает.
 */
function quoteIdentifier(name: string): string {
    // Если уже в кавычках — не трогаем
    if (name.startsWith('"') && name.endsWith('"')) {
        return name;
    }

    // Экранируем внутренние кавычки (редко, но возможно)
    const escaped = name.replace(/"/g, '""');
    return `"${escaped}"`;
}

/**
 * Оборачивает имя таблицы (может быть schema.table или просто table)
 */
function quoteTableName(tableName: string): string {
    // Если содержит точку — это schema.table
    if (tableName.includes('.')) {
        const parts = tableName.split('.');
        return parts.map(quoteIdentifier).join('.');
    }
    return quoteIdentifier(tableName);
}

/**
 * Достаёт имя таблицы из SELECT: после FROM до первого пробела/;.
 * Пример: "SELECT ... FROM schema.table t WHERE ..." -> "schema.table"
 * Пример: "SELECT ... FROM "Schema"."Table" t WHERE ..." -> "Schema"."Table"
 */
export function extractTableNameFromSelect(selectQuery: string): string | null {
    if (!selectQuery) return null;

    // нормализуем пробелы/переносы
    const normalized = selectQuery.replace(/\s+/g, ' ').trim();

    // Пробуем найти таблицу в кавычках (может быть "schema"."table" или "table")
    const quotedMatch = normalized.match(/\bfrom\b\s+("(?:[^"]+|"")*"(?:\."(?:[^"]+|"")*")?)/i);
    if (quotedMatch) {
        return quotedMatch[1];
    }

    // Обычный случай без кавычек
    const m = normalized.match(/\bfrom\b\s+([^\s;]+)/i);
    return m?.[1] ?? null;
}

/**
 * Генерирует SQL запросы на основе колонок таблицы
 * Все идентификаторы оборачиваются в двойные кавычки для PostgreSQL
 */
export function generateTableSql(tableName: string, columns: Column[]): GeneratedSql {
    if (!columns.length) {
        return { select_query: '', insert_query: '', update_query: '', delete_query: '' };
    }

    const pkColumns = columns.filter(c => c.primary);
    const nonPkColumns = columns.filter(c => !c.primary);
    const insertColumns = columns.filter(c => !c.primary);

    // Оборачиваем имя таблицы в кавычки
    const quotedTable = quoteTableName(tableName);

    // Оборачиваем имена колонок в кавычки
    const allColNames = columns.map(c => quoteIdentifier(c.name));

    // SELECT
    const select_query = `SELECT ${allColNames.join(', ')} FROM ${quotedTable}`;

    // INSERT
    const insertColNames = insertColumns.map(c => quoteIdentifier(c.name));
    const insertValues = insertColumns.map(c => formatPlaceholder(c.name, c.datatype));
    const insert_query =
        insertColNames.length > 0
            ? `INSERT INTO ${quotedTable} (${insertColNames.join(', ')}) VALUES (${insertValues.join(', ')})`
            : '';

    // UPDATE
    const setClauses = nonPkColumns.map(c =>
        `${quoteIdentifier(c.name)}=${formatPlaceholder(c.name, c.datatype)}`
    );
    const whereClauses = pkColumns.map(c =>
        `${quoteIdentifier(c.name)}=${formatPlaceholder(c.name, c.datatype)}`
    );

    const update_query =
        setClauses.length === 0
            ? ''
            : whereClauses.length > 0
                ? `UPDATE ${quotedTable} SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')}`
                : `UPDATE ${quotedTable} SET ${setClauses.join(', ')} WHERE /* TODO: add PK/condition */`;

    // DELETE
    const delete_query =
        whereClauses.length > 0
            ? `DELETE FROM ${quotedTable} WHERE ${whereClauses.join(' AND ')}`
            : `DELETE FROM ${quotedTable} WHERE /* TODO: add PK/condition */`;

    return { select_query, insert_query, update_query, delete_query };
}