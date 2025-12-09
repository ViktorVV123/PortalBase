// src/components/Form/mainTable/MainTableCombo.tsx
import React from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import { formatCellValue } from '@/shared/utils/cellFormat';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';

// ⬇️ Берём общие вещи из InputCell, не дублируем
import {
    useComboOptions,
    buildOptionLabel,
} from '@/components/Form/mainTable/InputCell';

/** Хелпер: одинаковая ли группа combobox (для объединения в одну TD) */
export function isSameComboGroup(a: ExtCol, b: ExtCol): boolean {
    if (!a || !b) return false;
    const aWrite = (a.__write_tc_id ?? a.table_column_id) ?? null;
    const bWrite = (b.__write_tc_id ?? b.table_column_id) ?? null;
    return (
        a.type === 'combobox' &&
        b.type === 'combobox' &&
        a.widget_column_id === b.widget_column_id &&
        aWrite != null &&
        bWrite != null &&
        aWrite === bWrite
    );
}

/** Хелпер: найти первичную колонку в combobox-группе (где Select / drill) */
export function pickPrimaryCombo(cols: ExtCol[]): ExtCol {
    const primary = cols.find(c => c.__is_primary_combo_input);
    return primary ?? cols[0];
}

/** Хелпер: взять показанное значение для визуальной колонки */
export function getShown(
    valIndexByKey: Map<string, number>,
    rowValues: (string | number | null)[],
    col: ExtCol,
) {
    const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
    const idx = valIndexByKey.get(key);
    const shownVal = idx != null ? rowValues[idx] : '';
    return shownVal == null ? '' : String(shownVal);
}

/** Для combobox-группы вернуть реальный write_tc_id (один на всю группу) */
export function getWriteTcIdForComboGroup(group: ExtCol[]): number | null {
    const primary = pickPrimaryCombo(group);
    if (primary.__write_tc_id != null) return primary.__write_tc_id;

    for (const g of group) {
        if (g.__write_tc_id != null) return g.__write_tc_id;
    }

    // eslint-disable-next-line no-console
    console.warn('[MainTable][add] combobox group has no __write_tc_id', group);
    return null;
}

/** Отображение combobox в режиме редактирования с учётом editDraft */
type ComboEditDisplayProps = {
    group: ExtCol[];
    row: FormDisplay['data'][number];
    valueIndexByKey: Map<string, number>;
    editDraft: Record<number, string>;
    onOpenDrill?: (
        fid?: number | null,
        meta?: {
            originColumnType?: 'combobox' | null;
            primary?: Record<string, unknown>;
            openedFromEdit?: boolean;
            targetWriteTcId?: number;
        }
    ) => void;
    comboReloadToken?: number;
    /** 👉 колбэк, чтобы менять draft по write_tc_id */
    onChangeDraft: (tcId: number, v: string) => void;
};

export const ComboEditDisplay: React.FC<ComboEditDisplayProps> = ({
                                                                      group,
                                                                      row,
                                                                      valueIndexByKey,
                                                                      editDraft,
                                                                      onOpenDrill,
                                                                      comboReloadToken,
                                                                      onChangeDraft,
                                                                  }) => {
    const primary = pickPrimaryCombo(group);
    const writeTcId = (primary.__write_tc_id ?? primary.table_column_id) ?? null;

    const { options } = useComboOptions(
        primary.widget_column_id,
        writeTcId ?? null,
        comboReloadToken ?? 0,
    );

    // есть ли вообще ключ в draft для этого writeTcId
    const hasDraftKey =
        writeTcId != null &&
        Object.prototype.hasOwnProperty.call(editDraft, writeTcId);

    const draftId = writeTcId != null ? editDraft[writeTcId] : '';

    let display: string;

    if (hasDraftKey) {
        // 👇 пользователь уже вносил изменения (или мы их проставили в startEdit)

        if (!draftId) {
            // явное пустое значение → показываем пусто
            display = '—';
        } else {
            // есть draftId → пробуем красиво отрисовать по options
            if (options.length) {
                const opt = options.find(o => o.id === draftId);
                display = opt ? buildOptionLabel(opt) : draftId;
            } else {
                display = draftId;
            }
        }
    } else {
        // 👇 fallback: ещё ни разу не трогали draft, берём текущий текст из row.values
        const viewParts = group
            .map(gcol => getShown(valueIndexByKey, row.values, gcol))
            .filter(Boolean);
        const viewLabel = viewParts.length
            ? viewParts.map(formatCellValue).join(' · ')
            : '';

        if (options.length && viewLabel) {
            const normalizedView = viewLabel.trim();
            let matched: { id: string } | undefined;

            for (const opt of options) {
                const full = buildOptionLabel(opt).trim();
                const hidden = (opt.showHidden ?? []).join(' · ').trim();

                if (!full && !hidden) continue;

                if (
                    full === normalizedView ||
                    hidden === normalizedView ||
                    full.endsWith(` · ${normalizedView}`) ||
                    normalizedView.endsWith(` · ${hidden}`)
                ) {
                    matched = opt;
                    break;
                }
            }

            display = matched ? buildOptionLabel(matched as any) : (viewLabel || '—');
        } else {
            display = viewLabel || '—';
        }
    }

    const clickable = primary.form_id != null && !!onOpenDrill;

    return (
        <div className={s.comboEditInner}>
            {clickable ? (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenDrill?.(primary.form_id!, {
                            originColumnType: 'combobox',
                            primary: row.primary_keys,
                            openedFromEdit: true,
                            targetWriteTcId: writeTcId ?? undefined,
                        });
                        // eslint-disable-next-line no-console
                        console.debug('[MainTable] drill click (combobox, edit mode)', {
                            formId: primary.form_id,
                            widget_column_id: primary.widget_column_id,
                            table_column_id: primary.table_column_id,
                            targetWriteTcId: writeTcId,
                        });
                    }}
                    className={s.comboText}
                    title={display}
                    style={{
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        color: 'var(--link,#66b0ff)',
                    }}
                >
                    {display}
                </button>
            ) : (
                <span className={s.comboText} title={display}>
                    {display}
                </span>
            )}

            {writeTcId != null && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        // явное очищение: кладём пустую строку в draft
                        onChangeDraft(writeTcId, '');
                    }}
                    title="Очистить значение"
                    className={s.comboClearBtn}
                >
                    ×
                </button>
            )}
        </div>
    );
};
