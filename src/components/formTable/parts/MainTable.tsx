// MainTable.tsx
import React from 'react';
import { MenuItem, Select, TextField } from '@mui/material';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import { api } from '@/services/api';
import { formatCellValue } from '@/shared/utils/cellFormat';

// Расширенная колонка из useHeaderPlan (там добавляем служебные поля)
type ExtCol = FormDisplay['columns'][number] & {
    __write_tc_id?: number;             // реальный tcId для записи (для combobox)
    __is_primary_combo_input?: boolean; // только одна колонка combobox редактируемая
};

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

    editingRowIdx: number | null;
    editDraft: Record<number, string>;
    onEditDraftChange: (tcId: number, v: string) => void;
    onSubmitEdit: () => void;
    onCancelEdit: () => void;
    editSaving: boolean;

    onRowClick: (pkObj: Record<string, unknown>) => void;
    onStartEdit: (rowIdx: number) => void;
    onDeleteRow: (rowIdx: number) => void;
    deletingRowIdx: number | null;

    /** ВАЖНО: второй аргумент — тип кликнутой колонки */
    onOpenDrill?: (fid?: number | null, meta?: { originColumnType?: 'combobox' | null }) => void;
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
    show: string[];       // для короткой подписи
    showHidden: string[]; // для подсказки
};

/** Загружает и кэширует варианты для combobox колонки */
function useComboOptions(widgetColumnId: number, writeTcId: number | null) {
    const [loading, setLoading] = React.useState(false);
    const [options, setOptions] = React.useState<ComboOption[]>([]);
    const [error, setError] = React.useState<string | null>(null);

    const key = `${widgetColumnId}:${writeTcId ?? 'null'}`;

    React.useEffect(() => {
        if (!widgetColumnId || !writeTcId) return;

        const cached = comboCache.get(key);
        if (cached) {
            setOptions(cached.options);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        api
            .get<ComboResp>(`/display/combobox/${widgetColumnId}/${writeTcId}`)
            .then(({ data }) => {
                if (cancelled) return;
                const opts: ComboOption[] = data.data.map((row) => ({
                    id: String(row.primary?.[0] ?? ''),          // важное место: ID = primary[0]
                    show: (row.show ?? []).map(v => String(v)),  // видимая краткая подпись
                    showHidden: (row.show_hidden ?? []).map(v => String(v)), // полная подпись/подсказка
                }));
                comboCache.set(key, { options: opts, columns: data.columns });
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
    }, [key, widgetColumnId, writeTcId]);

    return { loading, options, error };
}

/** Рендер ячейки ввода: TextField или Select (для combobox primary) */
function InputCell({
                       mode, // 'add' | 'edit'
                       col,
                       value,
                       onChange,
                       readOnly,
                       placeholder,
                   }: {
    mode: 'add' | 'edit';
    col: ExtCol;
    value: string;
    onChange: (v: string) => void;
    readOnly: boolean;
    placeholder: string;
}) {
    const writeTcId = (col.__write_tc_id ?? col.table_column_id) ?? null;

    if (readOnly || writeTcId == null) {
        return <span className={s.readonlyValue} title="Только для чтения">{value || '—'}</span>;
    }

    const isComboPrimary = col.type === 'combobox' && col.__is_primary_combo_input;
    if (isComboPrimary) {
        const { options } = useComboOptions(col.widget_column_id, writeTcId);
        return (
            <Select
                size="small"
                fullWidth
                value={value ?? ''}
                displayEmpty
                onChange={(e) => onChange(String(e.target.value ?? ''))}
                renderValue={(val) => {
                    if (!val) return <span style={{ opacity: 0.6 }}>{placeholder || '—'}</span>;
                    const opt = options.find(o => o.id === val);
                    return opt ? opt.show.join(' · ') : String(val);
                }}
            >
                <MenuItem value=""><em>—</em></MenuItem>
                {options.map(o => (
                    <MenuItem key={o.id} value={o.id} title={o.showHidden.join(' / ')}>
                        {o.show.join(' · ')}
                    </MenuItem>
                ))}
            </Select>
        );
    }

    return (
        <TextField
            size="small"
            fullWidth
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
        />
    );
}

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

/** Хелпер: найти первичную колонку в combobox-группе (где Select) */
function pickPrimaryCombo(cols: ExtCol[]): ExtCol {
    const primary = cols.find(c => c.__is_primary_combo_input);
    return primary ?? cols[0];
}

/** Хелпер: взять показанное значение для визуальной колонки */
function getShown(valIndexByKey: Map<string, number>, rowValues: (string | number | null)[], col: ExtCol) {
    const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
    const idx = valIndexByKey.get(key);
    const shownVal = idx != null ? rowValues[idx] : '';
    return shownVal == null ? '' : String(shownVal);
}

export const MainTable: React.FC<Props> = (p) => {
    return (
        <div className={s.tableScroll}>
            <table className={s.tbl}>
                <thead>
                <tr>
                    {p.headerPlan.map(g => (
                        <th key={`g-top-${g.id}`} colSpan={g.cols.length || 1}>{g.title}</th>
                    ))}
                    <th rowSpan={p.showSubHeaders ? 1 : 2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                        <button
                            type="button"
                            onClick={p.onToggleSubHeaders}
                            style={{ background: 'none', border: 0, cursor: 'pointer', color: 'white' }}
                            aria-label={p.showSubHeaders ? 'Скрыть подзаголовки' : 'Показать подзаголовки'}
                        >
                            {p.showSubHeaders ? '▴' : '▾'}
                        </button>
                    </th>
                </tr>
                {p.showSubHeaders && (
                    <tr>
                        {p.headerPlan.map(g => {
                            const span = g.cols.length || 1;
                            const label = (g.labels?.[0] ?? '—'); // одна подпись на весь widget_column
                            return (
                                <th key={`g-sub-${g.id}`} colSpan={span}>
                                    {label}
                                </th>
                            );
                        })}
                        <th />
                    </tr>
                )}
                </thead>

                <tbody>
                {/* ───────── Добавление: объединяем combobox-группы в одну TD ───────── */}
                {p.isAdding && (
                    <tr>
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
                                    const writeTcId = (primary.__write_tc_id ?? primary.table_column_id) ?? null;
                                    const ro = p.isColReadOnly(primary);
                                    const value = writeTcId == null ? '' : (p.draft[writeTcId] ?? '');

                                    cells.push(
                                        <td key={`add-combo-${primary.widget_column_id}:${writeTcId}`} colSpan={span} style={{ textAlign: 'center' }}>
                                            <InputCell
                                                mode="add"
                                                col={primary}
                                                readOnly={ro}
                                                value={value}
                                                onChange={(v) => {
                                                    if (writeTcId != null) p.onDraftChange(writeTcId, v);
                                                }}
                                                placeholder={p.placeholderFor(primary)}
                                            />
                                        </td>
                                    );
                                    i = j;
                                    continue;
                                }

                                // Обычная колонка
                                const writeTcId = (col.__write_tc_id ?? col.table_column_id) ?? null;
                                const ro = p.isColReadOnly(col);
                                const value = writeTcId == null ? '' : (p.draft[writeTcId] ?? '');
                                cells.push(
                                    <td key={`add-${col.widget_column_id}:${col.table_column_id ?? -1}`} style={{ textAlign: 'center' }}>
                                        <InputCell
                                            mode="add"
                                            col={col}
                                            readOnly={ro}
                                            value={value}
                                            onChange={(v) => { if (writeTcId != null) p.onDraftChange(writeTcId, v); }}
                                            placeholder={p.placeholderFor(col)}
                                        />
                                    </td>
                                );
                                i += 1;
                            }
                            return cells;
                        })()}
                        <td />
                    </tr>
                )}

                {/* ───────── Основные строки ───────── */}
                {p.filteredRows.map(({ row, idx: rowIdx }) => {
                    const isEditing = p.editingRowIdx === rowIdx;
                    const rowKey = p.pkToKey(row.primary_keys);

                    return (
                        <tr
                            key={rowIdx}
                            className={p.selectedKey === rowKey ? s.selectedRow : undefined}
                            aria-selected={p.selectedKey === rowKey || undefined}
                            onClick={() => {
                                if (isEditing) return;
                                const pkObj = Object.fromEntries(
                                    Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
                                );
                                p.onRowClick(pkObj);
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
                                        const ro = p.isColReadOnly(primary);

                                        if (isEditing) {
                                            const value = writeTcId == null ? '' : (p.editDraft[writeTcId] ?? '');
                                            cells.push(
                                                <td key={`edit-combo-${primary.widget_column_id}:${writeTcId}`} colSpan={span} style={{ textAlign: 'center' }}>
                                                    <InputCell
                                                        mode="edit"
                                                        col={primary}
                                                        readOnly={ro}
                                                        value={value}
                                                        onChange={(v) => { if (writeTcId != null) p.onEditDraftChange(writeTcId, v); }}
                                                        placeholder={p.placeholderFor(primary)}
                                                    />
                                                </td>
                                            );
                                        } else {
                                            // просмотр: склеим видимые значения всех визуальных столбцов группы
                                            const shownParts = group.map(gcol => getShown(p.valueIndexByKey, row.values, gcol)).filter(Boolean);
                                            const display = shownParts.length ? shownParts.map(formatCellValue).join(' · ') : '—';
                                            const clickable = primary.form_id != null && !!p.onOpenDrill;

                                            cells.push(
                                                <td key={`view-combo-${primary.widget_column_id}:${writeTcId}`} colSpan={span}>
                                                    {clickable ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                p.onOpenDrill?.(primary.form_id!, { originColumnType: 'combobox' });
                                                                console.debug('[MainTable] drill click (combobox)', {
                                                                    formId: primary.form_id,
                                                                    originColumnType: 'combobox',
                                                                    widget_column_id: primary.widget_column_id,
                                                                    table_column_id: primary.table_column_id
                                                                });
                                                            }}
                                                            style={{
                                                                padding: 0,
                                                                border: 'none',
                                                                background: 'none',
                                                                cursor: 'pointer',
                                                                textDecoration: 'underline',
                                                                color: 'var(--link,#66b0ff)'
                                                            }}
                                                            title={`Открыть форму #${primary.form_id}`}
                                                        >
                                                            {display}
                                                        </button>
                                                    ) : (
                                                        <>{display}</>
                                                    )}
                                                </td>
                                            );
                                        }

                                        i = j;
                                        continue;
                                    }

                                    // ───── Обычная колонка (не combobox)
                                    const visKey = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                                    const shownVal = getShown(p.valueIndexByKey, row.values, col);
                                    const ro = p.isColReadOnly(col);
                                    const writeTcId = (col.__write_tc_id ?? col.table_column_id) ?? null;

                                    if (isEditing) {
                                        cells.push(
                                            <td key={`edit-${visKey}`} style={{ textAlign: 'center' }}>
                                                <InputCell
                                                    mode="edit"
                                                    col={col}
                                                    readOnly={ro}
                                                    value={writeTcId == null ? '' : (p.editDraft[writeTcId] ?? '')}
                                                    onChange={(v) => { if (writeTcId != null) p.onEditDraftChange(writeTcId, v); }}
                                                    placeholder={p.placeholderFor(col)}
                                                />
                                            </td>
                                        );
                                    } else {
                                        const clickable = col.form_id != null && !!p.onOpenDrill;
                                        cells.push(
                                            <td key={`cell-${visKey}`}>
                                                {clickable ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            p.onOpenDrill?.(col.form_id!, { originColumnType: null });
                                                            console.debug('[MainTable] drill click (regular)', {
                                                                formId: col.form_id,
                                                                originColumnType: col.type ?? null,
                                                                widget_column_id: col.widget_column_id,
                                                                table_column_id: col.table_column_id
                                                            });
                                                        }}
                                                        style={{
                                                            padding: 0,
                                                            border: 'none',
                                                            background: 'none',
                                                            cursor: 'pointer',
                                                            textDecoration: 'underline',
                                                            color: 'var(--link,#66b0ff)'
                                                        }}
                                                        title={`Открыть форму #${col.form_id}`}
                                                    >
                                                        {formatCellValue(shownVal)}
                                                    </button>
                                                ) : (
                                                    <>{formatCellValue(shownVal)}</>
                                                )}
                                            </td>
                                        );
                                    }

                                    i += 1;
                                }

                                return cells;
                            })()}

                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {isEditing ? (
                                    (() => {
                                        const hasEditable = p.flatColumnsInRenderOrder.some(c => !p.isColReadOnly(c));
                                        return (
                                            <>
                                                {hasEditable && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); p.onSubmitEdit(); }}
                                                        disabled={p.editSaving}
                                                    >
                                                        {p.editSaving ? 'Сохр...' : '✓'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); p.onCancelEdit(); }}
                                                    disabled={p.editSaving}
                                                    style={{ marginLeft: hasEditable ? 8 : 0 }}
                                                >
                                                    х
                                                </button>
                                            </>
                                        );
                                    })()
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            style={{ background: 'none', border: 0, cursor: 'pointer', marginRight: 10 }}
                                            onClick={(e) => { e.stopPropagation(); p.onStartEdit(rowIdx); }}
                                            title="Редактировать"
                                        >
                                            <EditIcon className={s.actionIcon} />
                                        </button>
                                        <button
                                            type="button"
                                            style={{ background: 'none', border: 0, cursor: 'pointer', opacity: p.deletingRowIdx === rowIdx ? 0.6 : 1 }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (p.deletingRowIdx == null) p.onDeleteRow(rowIdx);
                                            }}
                                            title="Удалить"
                                        >
                                            <DeleteIcon className={s.actionIcon} />
                                        </button>
                                    </>
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
