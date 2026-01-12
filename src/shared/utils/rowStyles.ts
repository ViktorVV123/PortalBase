// src/shared/utils/rowStyles.ts

export type RowStylesMap = Record<string, React.CSSProperties>;

/**
 * Извлекает стили из JSON-колонки для конкретной строки
 */
export function extractRowStyles(
    rowValues: (string | number | null | object)[],
    stylesValueIndex: number | null,
): RowStylesMap {
    if (stylesValueIndex == null) return {};

    const stylesValue = rowValues[stylesValueIndex];

    // Если нет значения или это не объект — пустой маппинг
    if (!stylesValue || typeof stylesValue !== 'object' || Array.isArray(stylesValue)) {
        return {};
    }

    // stylesValue = { "name": { color: "blue" }, "floor": { backgroundColor: "blue" } }
    return stylesValue as RowStylesMap;
}

/**
 * Получает стиль для конкретной ячейки по column_name
 */
export function getCellStyle(
    rowStyles: RowStylesMap,
    columnName: string | null | undefined,
): React.CSSProperties | undefined {
    if (!columnName || !rowStyles[columnName]) return undefined;
    return rowStyles[columnName];
}