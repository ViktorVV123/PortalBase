// src/shared/utils/rowStyles.ts

import type { CSSProperties } from 'react';

export type RowStylesMap = Record<string, CSSProperties>;

/**
 * Извлекает стили из JSON-колонки для конкретной строки.
 *
 * Стили в JSON хранятся по table_column_name (например "description"),
 * но нам нужно вернуть маппинг по column_name (например "Комментарий").
 *
 * @param rowValues - массив значений строки
 * @param stylesValueIndex - индекс колонки стилей в массиве values
 * @param tableColumnNameMap - маппинг table_column_name → column_name
 */
export function extractRowStyles(
    rowValues: (string | number | boolean | null | object)[],
    stylesValueIndex: number | null,
    tableColumnNameMap?: Map<string, string>,
): RowStylesMap {
    if (stylesValueIndex == null) return {};

    const stylesValue = rowValues[stylesValueIndex];

    // Если нет значения или это не объект — пустой маппинг
    if (!stylesValue || typeof stylesValue !== 'object' || Array.isArray(stylesValue)) {
        return {};
    }

    // stylesValue = { "description": { backgroundColor: "#3b82f6" }, "visible_svod": { ... } }
    const rawStyles = stylesValue as Record<string, CSSProperties>;

    // Если нет маппинга — возвращаем как есть (fallback на старое поведение)
    if (!tableColumnNameMap || tableColumnNameMap.size === 0) {
        return rawStyles;
    }

    // Преобразуем ключи из table_column_name в column_name
    const result: RowStylesMap = {};

    for (const [tableColName, style] of Object.entries(rawStyles)) {
        const columnName = tableColumnNameMap.get(tableColName);
        if (columnName && style) {
            result[columnName] = style;
        } else if (style) {
            // Fallback: если не нашли в маппинге, используем как есть
            result[tableColName] = style;
        }
    }

    return result;
}

/**
 * Получает стиль для конкретной ячейки по column_name
 */
export function getCellStyle(
    rowStyles: RowStylesMap,
    columnName: string | null | undefined,
): CSSProperties | undefined {
    if (!columnName || !rowStyles[columnName]) return undefined;
    return rowStyles[columnName];
}