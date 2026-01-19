// src/shared/utils/requiredValidation/requiredValidation.ts

import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';

export type ValidationError = {
    columnName: string;
    tableColumnId: number;
    message: string;
};

export type ValidationResult = {
    isValid: boolean;
    errors: ValidationError[];
    missingFields: string[];
};

/**
 * Проверяет, является ли значение пустым
 */
export function isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (typeof value === 'number') return false; // 0 — это валидное значение
    return false;
}

/**
 * Получить список обязательных колонок
 */
export function getRequiredColumns(columns: ExtCol[]): ExtCol[] {
    return columns.filter(col => col.required === true && col.visible !== false);
}

/**
 * Валидация draft перед отправкой (для добавления)
 */
export function validateAddDraft(
    draft: Record<number, string>,
    columns: ExtCol[]
): ValidationResult {
    const errors: ValidationError[] = [];
    const missingFields: string[] = [];

    const requiredCols = getRequiredColumns(columns);

    for (const col of requiredCols) {
        // Для combobox используем __write_tc_id
        const tcId = (col.__write_tc_id ?? col.table_column_id) ?? null;

        if (tcId === null) continue;

        const value = draft[tcId];

        if (isEmptyValue(value)) {
            // ИСПРАВЛЕНО: ref_column_name вместо table_column_name
            const fieldName = col.column_name || col.ref_column_name || `Поле ${tcId}`;
            errors.push({
                columnName: fieldName,
                tableColumnId: tcId,
                message: `Поле "${fieldName}" обязательно для заполнения`,
            });
            missingFields.push(fieldName);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        missingFields,
    };
}

/**
 * Валидация editDraft перед отправкой (для редактирования)
 * Учитывает текущие значения строки
 */
export function validateEditDraft(
    editDraft: Record<number, string>,
    row: { values: (string | number | null)[] },
    columns: ExtCol[],
    valueIndexByKey: Map<string, number>
): ValidationResult {
    const errors: ValidationError[] = [];
    const missingFields: string[] = [];

    const requiredCols = getRequiredColumns(columns);

    for (const col of requiredCols) {
        const tcId = (col.__write_tc_id ?? col.table_column_id) ?? null;

        if (tcId === null) continue;

        // Проверяем: есть ли значение в draft?
        // Если в draft есть значение — используем его
        // Если нет — берём из текущей строки
        let value: string | number | null;

        if (tcId in editDraft) {
            value = editDraft[tcId];
        } else {
            // Получаем текущее значение из строки
            const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
            const idx = valueIndexByKey.get(key);
            value = idx != null ? row.values[idx] : null;
        }

        if (isEmptyValue(value)) {
            // ИСПРАВЛЕНО: ref_column_name вместо table_column_name
            const fieldName = col.column_name || col.ref_column_name || `Поле ${tcId}`;
            errors.push({
                columnName: fieldName,
                tableColumnId: tcId,
                message: `Поле "${fieldName}" обязательно для заполнения`,
            });
            missingFields.push(fieldName);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        missingFields,
    };
}

/**
 * Форматирует ошибки валидации для показа пользователю
 */
export function formatValidationErrors(result: ValidationResult): string {
    if (result.isValid) return '';

    if (result.missingFields.length === 1) {
        return `Заполните обязательное поле: ${result.missingFields[0]}`;
    }

    return `Заполните обязательные поля:\n• ${result.missingFields.join('\n• ')}`;
}

/**
 * Проверяет, является ли конкретная колонка обязательной
 */
export function isColumnRequired(col: ExtCol): boolean {
    return col.required === true && col.visible !== false;
}

/**
 * Проверяет, пустое ли значение для конкретной колонки в draft
 */
export function isColumnEmptyInDraft(
    col: ExtCol,
    draft: Record<number, string>
): boolean {
    const tcId = (col.__write_tc_id ?? col.table_column_id) ?? null;
    if (tcId === null) return false;
    return isEmptyValue(draft[tcId]);
}