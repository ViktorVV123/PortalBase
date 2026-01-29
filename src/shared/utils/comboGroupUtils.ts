// src/shared/utils/comboGroupUtils.ts
// Утилиты для группировки combobox колонок (общий код для MainTable и SubTable)

import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';

/**
 * Проверяет, принадлежат ли две колонки одной combobox группе
 * Группа определяется по: widget_column_id + write_tc_id (table_column_id)
 */
export function isSameComboGroup(a: ExtCol, b: ExtCol): boolean {
    if (!a || !b) return false;
    if (a.type !== 'combobox' || b.type !== 'combobox') return false;

    const aWrite = (a as any).__write_tc_id ?? a.table_column_id ?? null;
    const bWrite = (b as any).__write_tc_id ?? b.table_column_id ?? null;

    return (
        a.widget_column_id === b.widget_column_id &&
        aWrite != null && bWrite != null && aWrite === bWrite
    );
}

/**
 * Получает write_tc_id для группы combobox колонок
 * Предпочитает primary колонку, иначе первую с __write_tc_id
 */
export function getWriteTcIdForComboGroup(group: ExtCol[]): number | null {
    const primary = group.find((c) => (c as any).__is_primary_combo_input) ?? group[0];
    if ((primary as any)?.__write_tc_id != null) return (primary as any).__write_tc_id;

    for (const g of group) {
        if ((g as any).__write_tc_id != null) return (g as any).__write_tc_id;
    }
    return null;
}

export type ComboGroup = {
    wcId: number;
    writeTcId: number;
    columns: ExtCol[];
    tokens: string[];
};

/**
 * Группирует combobox колонки по widget_column_id + write_tc_id
 * Возвращает Map<groupKey, ComboGroup>
 */
export function groupComboColumns(columns: ExtCol[]): Map<string, ComboGroup> {
    const groups = new Map<string, ComboGroup>();

    for (const col of columns) {
        if (col.type !== 'combobox') continue;

        const writeTcId = (col as any).__write_tc_id ?? col.table_column_id ?? null;
        if (writeTcId == null) continue;

        const groupKey = `${col.widget_column_id}:${writeTcId}`;

        let group = groups.get(groupKey);
        if (!group) {
            group = {
                wcId: col.widget_column_id,
                writeTcId,
                columns: [],
                tokens: [],
            };
            groups.set(groupKey, group);
        }

        group.columns.push(col);
    }

    return groups;
}

/**
 * Собирает все уникальные write_tc_id для колонок (с группировкой combobox)
 */
export function collectWriteTcIds(columns: ExtCol[]): number[] {
    const ids: number[] = [];
    const seen = new Set<number>();

    for (let i = 0; i < columns.length; ) {
        const c = columns[i];

        if (c.type === 'combobox') {
            // Собираем группу combobox
            let j = i + 1;
            while (j < columns.length && isSameComboGroup(c, columns[j])) j++;

            const group = columns.slice(i, j);
            const writeTcId = getWriteTcIdForComboGroup(group);

            if (writeTcId != null && !seen.has(writeTcId)) {
                seen.add(writeTcId);
                ids.push(writeTcId);
            }

            i = j;
            continue;
        }

        // Обычная колонка
        const writeTcId = (c as any).__write_tc_id ?? c.table_column_id ?? null;
        if (writeTcId != null && !seen.has(writeTcId)) {
            seen.add(writeTcId);
            ids.push(writeTcId);
        }

        i++;
    }

    return ids;
}

/**
 * Строит маппинг table_column_id → write_tc_id (с учётом combobox групп)
 */
export function buildTableColumnToWriteIdMap(columns: ExtCol[]): Map<number, number> {
    const map = new Map<number, number>();

    for (let i = 0; i < columns.length; ) {
        const c = columns[i];

        if (c.type === 'combobox') {
            // Собираем группу combobox
            let j = i + 1;
            while (j < columns.length && isSameComboGroup(c, columns[j])) j++;

            const group = columns.slice(i, j);
            const writeTcId = getWriteTcIdForComboGroup(group);

            if (writeTcId != null) {
                map.set(writeTcId, writeTcId);
                for (const col of group) {
                    const originalTcId = (col as any).__write_tc_id ?? col.table_column_id;
                    if (originalTcId != null) map.set(originalTcId, writeTcId);
                }
            }

            i = j;
            continue;
        }

        // Обычная колонка
        const writeTcId = (c as any).__write_tc_id ?? c.table_column_id ?? null;
        const originalTcId = c.table_column_id ?? null;
        if (originalTcId != null && writeTcId != null) {
            map.set(originalTcId, writeTcId);
        }

        i++;
    }

    return map;
}

/**
 * Инициализирует draft для добавления строки (с группировкой combobox)
 */
export function initDraftForAdd(
    columns: ExtCol[],
    options?: {
        activeFilters?: Array<{ table_column_id: number; value: string | number }>;
    }
): { draft: Record<number, string>; autoFilledFields: Set<number> } {
    const draft: Record<number, string> = {};
    const seen = new Set<number>();
    const autoFilledFields = new Set<number>();

    for (let i = 0; i < columns.length; ) {
        const c = columns[i];

        if (c.type === 'combobox') {
            // Собираем группу combobox
            let j = i + 1;
            while (j < columns.length && isSameComboGroup(c, columns[j])) j++;

            const group = columns.slice(i, j);
            const writeTcId = getWriteTcIdForComboGroup(group);

            if (writeTcId != null && !seen.has(writeTcId)) {
                draft[writeTcId] = '';
                seen.add(writeTcId);
            }

            i = j;
            continue;
        }

        // Обычная колонка
        const writeTcId = (c as any).__write_tc_id ?? c.table_column_id ?? null;
        if (writeTcId != null && !seen.has(writeTcId)) {
            const isTriState = c.type === 'checkboxNull';
            const isCheckbox = c.type === 'checkbox' || c.type === 'bool';

            if (isTriState) {
                draft[writeTcId] = 'null';
            } else if (isCheckbox) {
                draft[writeTcId] = 'false';
            } else {
                draft[writeTcId] = String(c.default ?? '');
            }

            seen.add(writeTcId);
        }

        i++;
    }

    // Применяем фильтры если есть
    if (options?.activeFilters?.length) {
        const tableColumnToWriteId = buildTableColumnToWriteIdMap(columns);

        for (const filter of options.activeFilters) {
            const writeTcId = tableColumnToWriteId.get(filter.table_column_id);
            if (writeTcId != null && seen.has(writeTcId)) {
                draft[writeTcId] = String(filter.value);
                autoFilledFields.add(writeTcId);
            }
        }
    }

    return { draft, autoFilledFields };
}

// ═══════════════════════════════════════════════════════════
// УТИЛИТЫ ДЛЯ CHECKBOX
// ═══════════════════════════════════════════════════════════

export function normalizeCheckboxValue(value: string, isTriState: boolean): string | null {
    const s = value.trim().toLowerCase();
    const isTrue = ['true', '1', 't', 'yes', 'да'].includes(s);

    if (isTriState) {
        if (s === 'null' || s === '') return null;
        return isTrue ? 'true' : 'false';
    }
    return isTrue ? 'true' : 'false';
}

export function parseCheckboxFromDisplay(value: unknown, isTriState: boolean): string {
    const s = value == null ? '' : String(value).trim().toLowerCase();
    const isTrue = ['true', '1', 't', 'yes', 'да'].includes(s);

    if (isTriState) {
        if (value === null || value === undefined || s === '') return 'null';
        return isTrue ? 'true' : 'false';
    }
    return isTrue ? 'true' : 'false';
}