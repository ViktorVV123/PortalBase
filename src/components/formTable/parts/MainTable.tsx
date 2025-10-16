import React from 'react';
import { TextField } from '@mui/material';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';
import {formatCellValue} from "@/shared/utils/cellFormat";

type HeaderPlanGroup = {
    id: number;
    title: string;
    labels: string[];
    cols: FormDisplay['columns'];
};

type RowView = { row: FormDisplay['data'][number]; idx: number };

type Props = {
    headerPlan: HeaderPlanGroup[];
    showSubHeaders: boolean;
    onToggleSubHeaders: () => void;

    isAdding: boolean;
    draft: Record<number, string>;
    onDraftChange: (tcId: number, v: string) => void;

    flatColumnsInRenderOrder: FormDisplay['columns'];
    isColReadOnly: (c: FormDisplay['columns'][number]) => boolean;
    placeholderFor: (c: FormDisplay['columns'][number]) => string;

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

    onOpenDrill: (formId: number) => void;
};

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
                        {p.headerPlan.map(g =>
                            g.labels.slice(0, g.cols.length).map((label, idx) => (
                                <th key={`g-sub-${g.id}-${idx}`}>{label}</th>
                            ))
                        )}
                        <th />
                    </tr>
                )}
                </thead>

                <tbody>
                {p.isAdding && (
                    <tr>
                        {p.flatColumnsInRenderOrder.map(col => {
                            const tcId = col.table_column_id ?? null;
                            const ro = p.isColReadOnly(col);
                            return (
                                <td key={`add-wc${col.widget_column_id}-tc${tcId}`} style={{ textAlign: 'center' }}>
                                    {ro || tcId == null ? (
                                        <span className={s.readonlyValue} style={{ opacity: 0.6 }}>—</span>
                                    ) : (
                                        <TextField
                                            size="small"
                                            value={p.draft[tcId] ?? ''}
                                            onChange={e => p.onDraftChange(tcId, e.target.value)}
                                            placeholder={p.placeholderFor(col)}
                                        />
                                    )}
                                </td>
                            );
                        })}
                        <td />
                    </tr>
                )}

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
                            {p.flatColumnsInRenderOrder.map(col => {
                                const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                                const idx = p.valueIndexByKey.get(key);
                                const val = idx != null ? row.values[idx] : '';
                                const ro = p.isColReadOnly(col);
                                const tcId = col.table_column_id ?? null;

                                if (isEditing) {
                                    return (
                                        <td key={`edit-r${rowIdx}-wc${col.widget_column_id}-tc${tcId}`} style={{ textAlign: 'center' }}>
                                            {ro || tcId == null ? (
                                                <span className={s.readonlyValue} title="Только для чтения">
                                                        {String(val ?? '')}
                                                    </span>
                                            ) : (
                                                <TextField
                                                    size="small"
                                                    value={p.editDraft[tcId] ?? String(val ?? '')}
                                                    onChange={e => p.onEditDraftChange(tcId, e.target.value)}
                                                    onClick={e => e.stopPropagation()}
                                                    placeholder={p.placeholderFor(col)}
                                                />
                                            )}
                                        </td>
                                    );
                                }

                                const clickable = col.form_id != null;
                                return (
                                    <td key={`r${rowIdx}-wc${col.widget_column_id}-tc${tcId}`}>
                                        {clickable ? (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); p.onOpenDrill(col.form_id!); }}
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
                                                {formatCellValue(val)}
                                            </button>
                                        ) : (
                                            <>{formatCellValue(val)}</>
                                        )}

                                    </td>
                                );
                            })}

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
