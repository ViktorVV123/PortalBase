import React from 'react';
import { TextField } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import * as sub from './SubWormTable.module.scss';

import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import type { SubDisplay } from '@/shared/hooks/useWorkSpaces';
import type { HeaderModelItem } from '@/components/formTable/FormTable';
import { formatCellValue } from '@/shared/utils/cellFormat';
import { useSubWormTable, UseSubWormTableDeps } from '@/components/formTable/subForm/hook/useSubWormTable';
import {InputCell} from "@/components/formTable/parts/InputCell";
import {ExtCol, formatByDatatype} from "@/components/formTable/parts/FormatByDatatype";

type SubformProps = {
    subDisplay: SubDisplay | null;
    handleTabClick: (order: number) => void;
    subLoading: boolean;
    subError: string | null;
    formId: number | null;
    subHeaderGroups?: HeaderModelItem[];
    currentWidgetId?: number;

    editingRowIdx: number | null;
    setEditingRowIdx: React.Dispatch<React.SetStateAction<number | null>>;
    editDraft: Record<number, string>;
    setEditDraft: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    editSaving: boolean;
    setEditSaving: React.Dispatch<React.SetStateAction<boolean>>;

    currentOrder: number | null;

    isAddingSub: boolean;
    setIsAddingSub: React.Dispatch<React.SetStateAction<boolean>>;
    draftSub: Record<number, string>;
    setDraftSub: React.Dispatch<React.SetStateAction<Record<number, string>>>;

    /** 🔗 открытие DrillDialog / других форм, как в MainTable */
    onOpenDrill?: (
        fid?: number | null,
        meta?: {
            originColumnType?: 'combobox' | null;
            primary?: Record<string, unknown>;
            openedFromEdit?: boolean;
            targetWriteTcId?: number;
        },
    ) => void;
};

export const SubWormTable: React.FC<SubformProps> = (props) => {
    const {
        subDisplay,
        handleTabClick,
        subLoading,
        subError,
        formId,
        currentWidgetId,
        subHeaderGroups,
        currentOrder,
        editingRowIdx,
        setEditingRowIdx,
        editDraft,
        setEditDraft,
        editSaving,
        setEditSaving,
        isAddingSub,
        setIsAddingSub,
        draftSub,
        setDraftSub,
        onOpenDrill,
    } = props;

    const {
        deletingRowIdx,
        showSubHeaders,
        setShowSubHeaders,
        hasTabs,
        safe,
        headerPlan,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        startEdit,
        cancelEdit,
        submitEdit,
        deleteRow,
    } = useSubWormTable({
        subDisplay,
        formId,
        currentWidgetId,
        currentOrder,
        subHeaderGroups,
        handleTabClick,
        editingRowIdx,
        setEditingRowIdx,
        editDraft,
        setEditDraft,
        editSaving,
        setEditSaving,
        isAddingSub,
        setIsAddingSub,
        draftSub,
        setDraftSub,
    } as UseSubWormTableDeps);

    return (
        <div className={sub.root}>
            {hasTabs && subDisplay && (
                <ul className={sub.tabs}>
                    {subDisplay.sub_widgets.map((sw) => {
                        const isActive = sw.widget_order === subDisplay.displayed_widget.widget_order;
                        return (
                            <li key={sw.widget_order}>
                                <button
                                    className={isActive ? sub.tabActive : sub.tab}
                                    onClick={() => handleTabClick(sw.widget_order)}
                                >
                                    {sw.name}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {!subDisplay ? null : subLoading ? (
                <p>Загрузка sub-виджета…</p>
            ) : subError ? (
                <p className={sub.error}>{subError}</p>
            ) : (
                <div className={sub.tableScroll}>
                    <table className={sub.tbl}>
                        <thead>
                        <tr>
                            {headerPlan.map((g) => (
                                <th key={`sub-g-top-${g.id}`} colSpan={g.cols.length || 1}>
                                    {g.title}
                                </th>
                            ))}
                            <th
                                rowSpan={showSubHeaders ? 1 : 2}
                                style={{ textAlign: 'center', verticalAlign: 'middle' }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setShowSubHeaders((v) => !v)}
                                    title={showSubHeaders ? 'Скрыть подзаголовки' : 'Показать подзаголовки'}
                                    style={{ background: 'none', border: 0, cursor: 'pointer' }}
                                >
                                    {showSubHeaders ? (
                                        <ArrowDropUpIcon style={{ color: '#fff' }} />
                                    ) : (
                                        <ArrowDropDownIcon style={{ color: '#fff' }} />
                                    )}
                                </button>
                            </th>
                        </tr>

                        {showSubHeaders && (
                            <tr>
                                {headerPlan.flatMap((g) =>
                                    g.labels.slice(0, g.cols.length).map((label, idx) => (
                                        <th key={`sub-g-sub-${g.id}-${idx}`}>{safe(label)}</th>
                                    )),
                                )}
                                <th />
                            </tr>
                        )}
                        </thead>

                        <tbody>
                        {/* строка добавления в саб */}
                        {isAddingSub && (
                            <tr>
                                {flatColumnsInRenderOrder.map((col) => (
                                    <td key={`sub-add-wc${col.widget_column_id}-tc${col.table_column_id}`}>
                                        <InputCell
                                            mode="add"
                                            col={col as ExtCol}
                                            readOnly={false}
                                            value={draftSub[col.table_column_id!] ?? ''}
                                            onChange={(v) =>
                                                setDraftSub((prev) => ({
                                                    ...prev,
                                                    [col.table_column_id!]: v,
                                                }))
                                            }
                                            placeholder={col.placeholder ?? col.column_name}
                                        />
                                    </td>
                                ))}
                                <td />
                            </tr>
                        )}
                        {subDisplay.data.map((row, rowIdx) => {
                            const isEditing = editingRowIdx === rowIdx;

                            return (
                                <tr key={rowIdx}>
                                    {flatColumnsInRenderOrder.map((col) => {
                                        const syntheticTcId =
                                            col.type === 'combobox' &&
                                            col.combobox_column_id != null &&
                                            col.table_column_id != null
                                                ? -1_000_000 - Number(col.combobox_column_id)
                                                : col.table_column_id ?? -1;

                                        const key = `${col.widget_column_id}:${syntheticTcId}`;
                                        const idx = valueIndexByKey.get(key);
                                        const val = idx != null ? row.values[idx] : '';

                                        if (isEditing) {
                                            const tcId = col.table_column_id!;
                                            return (
                                                <td
                                                    key={`sub-edit-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}
                                                >
                                                    <InputCell
                                                        mode="edit"
                                                        col={col as ExtCol}
                                                        readOnly={false}
                                                        value={editDraft[tcId] ?? ''}
                                                        onChange={(v) =>
                                                            setEditDraft((prev) => ({
                                                                ...prev,
                                                                [tcId]: v,
                                                            }))
                                                        }
                                                        placeholder={col.placeholder ?? col.column_name}
                                                    />
                                                </td>
                                            );
                                        }

                                        const raw = val == null ? '' : String(val);
                                        const display = formatByDatatype(raw, col as ExtCol);
                                        const clickable = !!onOpenDrill && col.form_id != null;

                                        return (
                                            <td
                                                key={`sub-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}
                                            >
                                                {clickable ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onOpenDrill?.(col.form_id!, {
                                                                originColumnType:
                                                                    col.type === 'combobox' ? 'combobox' : null,
                                                                primary: row.primary_keys as Record<
                                                                    string,
                                                                    unknown
                                                                >,
                                                                openedFromEdit: false,
                                                            });
                                                            console.debug('[SubWormTable] drill click', {
                                                                formId: col.form_id,
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
                                                        {display}
                                                    </button>
                                                ) : (
                                                    <>{display}</>
                                                )}
                                            </td>
                                        );
                                    })}

                                    <td className={sub.actionsCell}>
                                        {isEditing ? (
                                            <>
                                                <button
                                                    className={sub.okBtn}
                                                    onClick={submitEdit}
                                                    disabled={editSaving}
                                                    title="Сохранить"
                                                >
                                                    {editSaving ? '…' : '✓'}
                                                </button>
                                                <button
                                                    className={sub.cancelBtn}
                                                    onClick={cancelEdit}
                                                    disabled={editSaving}
                                                    title="Отменить"
                                                >
                                                    ×
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                    <span
                                                        style={{
                                                            display: 'inline-flex',
                                                            cursor: 'pointer',
                                                            marginRight: 10,
                                                        }}
                                                        onClick={() => startEdit(rowIdx)}
                                                        title="Редактировать"
                                                    >
                                                        <EditIcon className={sub.actionIcon} />
                                                    </span>
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        cursor:
                                                            deletingRowIdx === rowIdx ? 'progress' : 'pointer',
                                                        opacity: deletingRowIdx === rowIdx ? 0.6 : 1,
                                                    }}
                                                    onClick={() => {
                                                        if (deletingRowIdx == null) deleteRow(rowIdx);
                                                    }}
                                                    title="Удалить"
                                                >
                                                        <DeleteIcon className={sub.actionIcon} />
                                                    </span>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
