import React from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import LockIcon from '@/assets/image/LockIcon.svg';
import type {FormDisplay} from '@/shared/hooks/useWorkSpaces';
import {api} from '@/services/api';
import {formatCellValue} from '@/shared/utils/cellFormat';
import {ExtCol, formatByDatatype} from "@/components/formTable/parts/FormatByDatatype";
import {InputCell} from "@/components/formTable/parts/InputCell";
import {Checkbox} from "@mui/material";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";


// "логическая" ширина колонок из бэка → проценты
const DEFAULT_COL_WIDTH = 10; // если width не задан
const MIN_COL_WIDTH = 6;      // чтобы колонка не была совсем иголкой
const MAX_COL_WIDTH = 40;     // чтобы одна не съедала весь экран

type HeaderPlanGroup = {
    id: number;
    title: string;
    labels: string[];
    cols: ExtCol[];
};

type RowView = { row: FormDisplay['data'][number]; idx: number };

type Props = {
    headerPlan: HeaderPlanGroup[];
    showSubHeaders: boolean;
    onToggleSubHeaders: () => void;

    isAdding: boolean;
    draft: Record<number, string>;
    onDraftChange: (tcId: number, v: string) => void;

    flatColumnsInRenderOrder: ExtCol[];
    isColReadOnly: (c: ExtCol) => boolean;
    placeholderFor: (c: ExtCol) => string;

    filteredRows: RowView[];
    valueIndexByKey: Map<string, number>;

    selectedKey: string | null;
    pkToKey: (pk: Record<string, unknown>) => string;
    comboReloadToken?: number;
    editingRowIdx: number | null;
    editDraft: Record<number, string>;
    onEditDraftChange: (tcId: number, v: string) => void;
    onSubmitEdit: () => void;
    onCancelEdit: () => void;
    editSaving: boolean;

    onRowClick: (view: RowView) => void;
    onStartEdit: (rowIdx: number) => void;
    onDeleteRow: (rowIdx: number) => void;
    deletingRowIdx: number | null;

    disableDrillWhileEditing?: boolean;

    onOpenDrill?: (
        fid?: number | null,
        meta?: {
            originColumnType?: 'combobox' | null;
            primary?: Record<string, unknown>;
            openedFromEdit?: boolean;
            targetWriteTcId?: number;
        }
    ) => void;

    /** триггер для перезагрузки combobox-опций после CRUD в DrillDialog */


};

/** Кэш вариантов combobox по ключу wcId:writeTcId */
const comboCache = new Map<string, { options: ComboOption[]; columns: ComboColumnMeta[] }>();

type ComboColumnMeta = { ref_column_order: number; width: number; combobox_alias: string | null };
type ComboResp = {
    columns: ComboColumnMeta[];
    data: Array<{ primary: (string | number)[]; show: (string | number)[]; show_hidden: (string | number)[] }>;
};
type ComboOption = {
    id: string;           // primary[0] → как строка
    show: string[];       // то, что backend даёт в show
    showHidden: string[]; // то, что backend даёт в show_hidden
};

/** Собираем красивую подпись из show + show_hidden */
function buildOptionLabel(opt: ComboOption): string {
    const base = opt.show ?? [];
    const extra = (opt.showHidden ?? []).filter(v => !base.includes(v));
    const parts = [...base, ...extra];
    return parts.length ? parts.join(' · ') : opt.id;
}

/** Загружает и кэширует варианты для combobox колонки */
function useComboOptions(widgetColumnId: number, writeTcId: number | null, reloadToken = 0) {
    const [loading, setLoading] = React.useState(false);
    const [options, setOptions] = React.useState<ComboOption[]>([]);
    const [error, setError] = React.useState<string | null>(null);

    const key = `${widgetColumnId}:${writeTcId ?? 'null'}`;

    React.useEffect(() => {
        if (!widgetColumnId || !writeTcId) return;

        const cached = comboCache.get(key);

        // если reloadToken == 0 и есть кэш — используем его
        // если reloadToken > 0 — всегда идём на сервер за свежими данными
        if (!reloadToken && cached) {
            setOptions(cached.options);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        api
            .get<ComboResp>(`/display/combobox/${widgetColumnId}/${writeTcId}`)
            .then(({data}) => {
                if (cancelled) return;
                const opts: ComboOption[] = data.data.map((row) => ({
                    id: String(row.primary?.[0] ?? ''),
                    show: (row.show ?? []).map(v => String(v)),
                    showHidden: (row.show_hidden ?? []).map(v => String(v)),
                }));
                comboCache.set(key, {options: opts, columns: data.columns});
                setOptions(opts);
            })
            .catch((e: any) => {
                if (cancelled) return;
                setError(String(e?.message ?? 'Ошибка загрузки combobox'));
            })
            .finally(() => !cancelled && setLoading(false));

        return () => {
            cancelled = true;
        };
    }, [key, widgetColumnId, writeTcId, reloadToken]);

    return {loading, options, error};
}

/** Рендер ячейки ввода: TextField или Select (для combobox primary) */


/** Хелпер: одинаковая ли группа combobox (для объединения в одну TD) */
function isSameComboGroup(a: ExtCol, b: ExtCol): boolean {
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
function pickPrimaryCombo(cols: ExtCol[]): ExtCol {
    const primary = cols.find(c => c.__is_primary_combo_input);
    return primary ?? cols[0];
}

/** Хелпер: взять показанное значение для визуальной колонки */
function getShown(
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
function getWriteTcIdForComboGroup(group: ExtCol[]): number | null {
    const primary = pickPrimaryCombo(group);
    if (primary.__write_tc_id != null) return primary.__write_tc_id;

    for (const g of group) {
        if (g.__write_tc_id != null) return g.__write_tc_id;
    }

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

const ComboEditDisplay: React.FC<ComboEditDisplayProps> = ({
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

    const {options} = useComboOptions(
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
            let matched: ComboOption | undefined;

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

            display = matched ? buildOptionLabel(matched) : (viewLabel || '—');
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


export const MainTable: React.FC<Props> = (p) => {
    /** стабильный порядок строк (по person_id, как у тебя) */
    const stableRows = React.useMemo(() => {
        const copy = [...p.filteredRows];

        copy.sort((a, b) => {
            const aPk: any = a.row.primary_keys || {};
            const bPk: any = b.row.primary_keys || {};

            const aId = aPk.person_id;
            const bId = bPk.person_id;

            if (aId == null || bId == null) return 0;

            const na = typeof aId === 'number' ? aId : parseInt(String(aId), 10);
            const nb = typeof bId === 'number' ? bId : parseInt(String(bId), 10);

            if (Number.isNaN(na) || Number.isNaN(nb)) return 0;

            return na - nb;
        });

        return copy;
    }, [p.filteredRows]);

    const rlsMeta = React.useMemo(() => {
        const col = p.flatColumnsInRenderOrder.find(c => c.type === 'rls');
        if (!col) return null;

        const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
        const idx = p.valueIndexByKey.get(key);

        if (idx == null) return null;
        return { col, idx };
    }, [p.flatColumnsInRenderOrder, p.valueIndexByKey]);

    // 👉 Правило "строка под RLS?"
    const isRlsLockedValue = (val: unknown): boolean => {
        if (val == null) return false;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val !== 0;

        const s = String(val).trim().toLowerCase();
        return s === '1' || s === 'true' || s === 'да' || s === 'yes';
    };

    const colWidths = React.useMemo(() => {
        return p.flatColumnsInRenderOrder.map((col) => {
            const raw = Number((col as any).width);

            let w = Number.isFinite(raw) && raw > 0
                ? raw
                : DEFAULT_COL_WIDTH;

            if (w < MIN_COL_WIDTH) w = MIN_COL_WIDTH;
            if (w > MAX_COL_WIDTH) w = MAX_COL_WIDTH;

            // интерпретируем как проценты от ширины таблицы
            return `${w}%`;
        });
    }, [p.flatColumnsInRenderOrder]);

    const drillDisabled = p.disableDrillWhileEditing && p.editingRowIdx != null;

    return (
        <div className={s.mainTableScroll}>
            <table className={s.tbl}>
                <colgroup>
                    {p.flatColumnsInRenderOrder.map((col, idx) => (
                        <col
                            key={`col-${col.widget_column_id}-${col.table_column_id ?? 'null'}-${(col as any).combobox_column_id ?? 'null'}`}
                            style={{width: colWidths[idx]}}
                        />
                    ))}
                    {/* actions-колонка: минимальная ширина под иконки + не раздувается остатками ширины */}
                    <col
                        style={{
                            width: '1%',      // браузер старается сделать колонку как можно уже
                            minWidth: 56,     // но не меньше нужного под две иконки
                            maxWidth: 80,
                        }}
                    />
                </colgroup>

                <thead>
                <tr>
                    {p.headerPlan.map(g => (
                        <th key={`g-top-${g.id}`} colSpan={g.cols.length || 1}>
                            <span className={s.ellipsis}>{g.title}</span>
                        </th>
                    ))}
                    <th className={s.actionsCell}>
                        <button
                            type="button"
                            className={s.actionsBtn}
                            onClick={p.onToggleSubHeaders}
                            aria-label={p.showSubHeaders ? 'Скрыть подзаголовки' : 'Показать подзаголовки'}
                        >
                            {p.showSubHeaders ?   <ArrowDropUpIcon /> :   <ArrowDropDownIcon />}



                        </button>
                    </th>
                </tr>
                {p.showSubHeaders && (
                    <tr>
                        {p.headerPlan.map(g => {
                            const span = g.cols.length || 1;
                            const label = (g.labels?.[0] ?? '—');
                            return (
                                <th key={`g-sub-${g.id}`} colSpan={span}>
                                    <span className={s.ellipsis}>{label}</span>
                                </th>
                            );
                        })}
                        <th className={s.actionsCell}/>
                    </tr>
                )}
                </thead>

                <tbody>
                {/* ───────── Добавление ───────── */}
                {p.isAdding && (
                    <tr >
                        {(() => {
                            const cells: React.ReactNode[] = [];
                            const cols = p.flatColumnsInRenderOrder;
                            let i = 0;

                            while (i < cols.length) {
                                const col = cols[i];

                                // Combobox-группа?
                                if (col.type === 'combobox') {
                                    let j = i + 1;
                                    while (j < cols.length && isSameComboGroup(col, cols[j])) j += 1;
                                    const group = cols.slice(i, j);
                                    const span = group.length;
                                    const primary = pickPrimaryCombo(group);
                                    const writeTcId = getWriteTcIdForComboGroup(group);

                                    const ro = false;
                                    const value = writeTcId == null ? '' : (p.draft[writeTcId] ?? '');

                                    cells.push(
                                        <td
                                            key={`add-combo-${primary.widget_column_id}:${writeTcId ?? 'null'}`}
                                            colSpan={span}
                                        >
                                            <InputCell
                                                mode="add"
                                                col={primary}
                                                readOnly={ro}
                                                value={value}
                                                onChange={(v) => {
                                                    if (writeTcId != null) p.onDraftChange(writeTcId, v);
                                                }}
                                                placeholder={p.placeholderFor(primary)}
                                                comboReloadToken={p.comboReloadToken}
                                            />
                                        </td>
                                    );
                                    i = j;
                                    continue;
                                }

                                // Обычная колонка (add)
                                const writeTcId = (col.__write_tc_id ?? col.table_column_id) ?? null;
                                const ro = false;
                                const value = writeTcId == null ? '' : (p.draft[writeTcId] ?? '');

                                cells.push(
                                    <td
                                        key={`add-${col.widget_column_id}:${col.table_column_id ?? -1}`}
                                        className={s.editCell}
                                    >
                                        <div className={s.cellEditor}>
                                            <InputCell
                                                mode="add"
                                                col={col}
                                                readOnly={ro}
                                                value={value}
                                                onChange={(v) => {
                                                    if (writeTcId != null) p.onDraftChange(writeTcId, v);
                                                }}
                                                placeholder={p.placeholderFor(col)}
                                                comboReloadToken={p.comboReloadToken}
                                            />
                                        </div>
                                    </td>
                                );
                                i += 1;
                            }

                            return cells;
                        })()}
                        {/* actions-ячейка при добавлении пока пустая */}
                        <td className={s.actionsCell}/>
                    </tr>
                )}

                {/* ───────── Основные строки ───────── */}
                {stableRows.map(({row, idx: rowIdx}) => {
                    const isEditing = p.editingRowIdx === rowIdx;
                    const rowKey = p.pkToKey(row.primary_keys);

                    const isRowLocked =
                        rlsMeta != null ? isRlsLockedValue(row.values[rlsMeta.idx]) : false;

                    return (
                        <tr
                            key={rowKey}
                            style={{textAlign: 'center'}}
                            className={p.selectedKey === rowKey ? s.selectedRow : undefined}
                            aria-selected={p.selectedKey === rowKey || undefined}
                            onClick={() => {
                                if (isEditing) return;
                                p.onRowClick({row, idx: rowIdx});
                            }}
                        >
                            {(() => {
                                const cells: React.ReactNode[] = [];
                                const cols = p.flatColumnsInRenderOrder;
                                let i = 0;

                                while (i < cols.length) {
                                    const col = cols[i];

                                    // ───── Combobox-группа → одна TD с colSpan
                                    if (col.type === 'combobox') {
                                        let j = i + 1;
                                        while (j < cols.length && isSameComboGroup(col, cols[j])) j += 1;
                                        const group = cols.slice(i, j);
                                        const span = group.length;
                                        const primary = pickPrimaryCombo(group);
                                        const writeTcId = (primary.__write_tc_id ?? primary.table_column_id) ?? null;

                                        if (isEditing) {
                                            cells.push(
                                                <td
                                                    key={`edit-combo-${primary.widget_column_id}:${writeTcId}`}
                                                    colSpan={span}
                                                    className={s.editCell}
                                                >
                                                    <div className={s.cellEditor}>
                                                        <ComboEditDisplay
                                                            group={group}
                                                            row={row}
                                                            valueIndexByKey={p.valueIndexByKey}
                                                            editDraft={p.editDraft}
                                                            onOpenDrill={drillDisabled ? undefined : p.onOpenDrill}
                                                            comboReloadToken={p.comboReloadToken}
                                                            onChangeDraft={p.onEditDraftChange}
                                                        />
                                                    </div>
                                                </td>
                                            );
                                    } else {
                                            // просмотр
                                            const shownParts = group
                                                .map(gcol => getShown(p.valueIndexByKey, row.values, gcol))
                                                .filter(Boolean);
                                            const display = shownParts.length
                                                ? shownParts.map(formatCellValue).join(' · ')
                                                : '—';
                                            const clickable = primary.form_id != null && !!p.onOpenDrill && !drillDisabled;

                                            cells.push(
                                                <td
                                                    key={`view-combo-${primary.widget_column_id}:${writeTcId}`}
                                                    colSpan={span}
                                                >
                                                    {clickable ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                p.onOpenDrill?.(primary.form_id!, {
                                                                    originColumnType: 'combobox',
                                                                    primary: row.primary_keys,
                                                                    openedFromEdit: false,
                                                                });
                                                                // eslint-disable-next-line no-console
                                                                console.debug('[MainTable] drill click (combobox)', {
                                                                    formId: primary.form_id,
                                                                    originColumnType: 'combobox',
                                                                    widget_column_id: primary.widget_column_id,
                                                                    table_column_id: primary.table_column_id,
                                                                });
                                                            }}
                                                            style={{
                                                                padding: 0,
                                                                border: 'none',
                                                                background: 'none',
                                                                cursor: 'pointer',
                                                                textDecoration: 'underline',
                                                                color: 'var(--link,#66b0ff)',
                                                            }}
                                                            title={`Открыть форму #${primary.form_id}`}
                                                        >
                                                            {display}
                                                        </button>
                                                    ) : (
                                                        <span className={s.ellipsis}>{display}</span>
                                                    )}
                                                </td>
                                            );
                                        }

                                        i = j;
                                        continue;
                                    }

                                    // ───── Обычная колонка
                                    const visKey = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                                    const idxVal = p.valueIndexByKey.get(visKey);
                                    const rawVal = idxVal != null ? row.values[idxVal] : null;
                                    const shownVal = getShown(p.valueIndexByKey, row.values, col);
                                    const ro = p.isColReadOnly(col) || col.visible === false;
                                    const writeTcId = (col.__write_tc_id ?? col.table_column_id) ?? null;

                                    if (isEditing) {
                                        cells.push(
                                            <td key={`edit-${visKey}`} className={s.editCell}>
                                                <div className={s.cellEditor}>
                                                    <InputCell
                                                        mode="edit"
                                                        col={col}
                                                        readOnly={ro}
                                                        value={writeTcId == null ? '' : (p.editDraft[writeTcId] ?? '')}
                                                        onChange={(v) => {
                                                            if (writeTcId != null) p.onEditDraftChange(writeTcId, v);
                                                        }}
                                                        placeholder={p.placeholderFor(col)}
                                                        comboReloadToken={p.comboReloadToken}
                                                    />
                                                </div>
                                            </td>
                                        );

                                    } else {
                                        const clickable = col.form_id != null && !!p.onOpenDrill && !drillDisabled;
                                        const pretty = formatByDatatype(shownVal, col as ExtCol);

                                        const isCheckboxCol =
                                            col.type === 'checkbox' ||
                                            (col as ExtCol).type === 'bool';

                                        if (isCheckboxCol) {
                                            const checked = isRlsLockedValue(rawVal);
                                            cells.push(
                                                <td
                                                    key={`cell-${visKey}`}
                                                >
                                                    <Checkbox
                                                        size="small"
                                                        checked={checked}
                                                        disabled
                                                        sx={{
                                                            color: 'rgba(255, 255, 255, 0.4)',
                                                            '&.Mui-checked': {
                                                                color: 'rgba(255, 255, 255, 0.9)',
                                                            },
                                                            '&.Mui-disabled': {
                                                                color: 'rgba(255, 255, 255, 0.7)',
                                                            },
                                                        }}
                                                    />
                                                </td>
                                            );
                                        } else {
                                            const content = pretty || '—';
                                            cells.push(
                                                <td key={`cell-${visKey}`}>
                                                    {clickable ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                p.onOpenDrill?.(col.form_id!, {
                                                                    originColumnType: null,
                                                                    primary: row.primary_keys,
                                                                    openedFromEdit: false,
                                                                });
                                                                // eslint-disable-next-line no-console
                                                                console.debug('[MainTable] drill click (regular)', {
                                                                    formId: col.form_id,
                                                                    originColumnType: col.type ?? null,
                                                                    widget_column_id: col.widget_column_id,
                                                                    table_column_id: col.table_column_id,
                                                                });
                                                            }}
                                                            style={{
                                                                padding: 0,
                                                                border: 'none',
                                                                background: 'none',
                                                                cursor: 'pointer',
                                                                textDecoration: 'underline',
                                                                color: 'var(--link,#66b0ff)',
                                                            }}
                                                            title={`Открыть форму #${col.form_id}`}
                                                        >
                                                            <span className={s.ellipsis}>{content}</span>
                                                        </button>
                                                    ) : (
                                                        <span className={s.ellipsis}>{content}</span>
                                                    )}
                                                </td>
                                            );
                                        }
                                    }

                                    i += 1;
                                }

                                return cells;
                            })()}

                            {/* ───── actions-ячейка ───── */}
                            <td className={s.actionsCell}>
                                {isEditing ? (
                                    (() => {
                                        const hasEditable =
                                            !isRowLocked &&
                                            p.flatColumnsInRenderOrder.some(
                                                c => c.visible !== false && !p.isColReadOnly(c),
                                            );

                                        return (
                                            <>
                                                {hasEditable && (
                                                    <button
                                                        className={s.okBtn}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            p.onSubmitEdit();
                                                        }}
                                                        disabled={p.editSaving}
                                                    >
                                                        {p.editSaving ? '…' : '✓'}
                                                    </button>
                                                )}
                                                <button
                                                    className={s.cancelBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        p.onCancelEdit();
                                                    }}
                                                    disabled={p.editSaving}
                                                >
                                                    ×
                                                </button>
                                            </>
                                        );
                                    })()
                                ) : (
                                    <div className={s.actionsRow}>
                                        {/* EDIT */}
                                        <button
                                            type="button"
                                            className={`${s.actionsBtn} ${isRowLocked ? s.actionsBtnDisabled : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isRowLocked) return;
                                                p.onStartEdit(rowIdx);
                                            }}
                                            title={isRowLocked ? 'Редактирование запрещено (RLS)' : 'Редактировать'}
                                        >
                                            <EditIcon
                                                style={{pointerEvents: isRowLocked ? 'none' : 'auto'}}
                                                className={s.actionIcon}
                                            />
                                        </button>

                                        {/* DELETE */}
                                        <button
                                            type="button"
                                            className={`${s.actionsBtn} ${
                                                isRowLocked || p.deletingRowIdx === rowIdx ? s.actionsBtnDisabled : ''
                                            }`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isRowLocked) return;
                                                if (p.deletingRowIdx == null) p.onDeleteRow(rowIdx);
                                            }}
                                            title={isRowLocked ? 'Удаление запрещено (RLS)' : 'Удалить'}
                                        >
                                            <DeleteIcon
                                                style={{pointerEvents: isRowLocked ? 'none' : 'auto'}}
                                                className={s.actionIcon}
                                            />
                                        </button>

                                        {/* LOCK */}
                                        <span
                                            className={s.lockSlot}
                                            title={isRowLocked ? 'Строка защищена политикой RLS' : undefined}
                                        >
                                                {isRowLocked && <LockIcon className={s.actionIcon}/>}
                                            </span>
                                    </div>
                                )}
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
    );
};