import React from 'react';
import {TextField} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import * as sub from './SubWormTable.module.scss';

import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import type {SubDisplay} from '@/shared/hooks/useWorkSpaces';
import type {HeaderModelItem} from '@/components/formTable/FormTable';
import {formatCellValue} from '@/shared/utils/cellFormat';
import {useSubWormTable, UseSubWormTableDeps} from "@/components/formTable/subForm/hook/useSubWormTable";



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
                                style={{textAlign: 'center', verticalAlign: 'middle'}}
                            >
                                <button
                                    type="button"
                                    onClick={() => setShowSubHeaders((v) => !v)}
                                    title={showSubHeaders ? 'Скрыть подзаголовки' : 'Показать подзаголовки'}
                                    style={{background: 'none', border: 0, cursor: 'pointer'}}
                                >
                                    {showSubHeaders ? (
                                        <ArrowDropUpIcon style={{color: '#fff'}} />
                                    ) : (
                                        <ArrowDropDownIcon style={{color: '#fff'}} />
                                    )}
                                </button>
                            </th>
                        </tr>

                        {showSubHeaders && (
                            <tr>
                                {headerPlan.flatMap((g) =>
                                    g.labels.slice(0, g.cols.length).map((label, idx) => (
                                        <th key={`sub-g-sub-${g.id}-${idx}`}>{safe(label)}</th>
                                    ))
                                )}
                                <th />
                            </tr>
                        )}
                        </thead>

                        <tbody>
                        {isAddingSub && (
                            <tr>
                                {flatColumnsInRenderOrder.map((col) => (
                                    <td key={`sub-add-wc${col.widget_column_id}-tc${col.table_column_id}`}>
                                        <TextField
                                            size="small"
                                            value={draftSub[col.table_column_id!] ?? ''}
                                            onChange={(e) =>
                                                setDraftSub((prev) => ({
                                                    ...prev,
                                                    [col.table_column_id!]: e.target.value,
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
                                            return (
                                                <td key={`sub-edit-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}>
                                                    <input
                                                        className={sub.inp}
                                                        value={editDraft[col.table_column_id!] ?? ''}
                                                        onChange={(e) =>
                                                            setEditDraft((prev) => ({
                                                                ...prev,
                                                                [col.table_column_id!]: e.target.value,
                                                            }))
                                                        }
                                                        placeholder={col.placeholder ?? col.column_name}
                                                    />
                                                </td>
                                            );
                                        }

                                        return (
                                            <td key={`sub-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}>
                                                {formatCellValue(val)}
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
                              style={{display: 'inline-flex', cursor: 'pointer', marginRight: 10}}
                              onClick={() => startEdit(rowIdx)}
                              title="Редактировать"
                          >
                            <EditIcon className={sub.actionIcon} />
                          </span>
                                                <span
                                                    style={{
                                                        display: 'inline-flex',
                                                        cursor: deletingRowIdx === rowIdx ? 'progress' : 'pointer',
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
