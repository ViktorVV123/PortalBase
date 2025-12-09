import React from 'react';
import {Checkbox} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import * as sub from './SubWormTable.module.scss';

import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import type {SubDisplay} from '@/shared/hooks/useWorkSpaces';
import type {HeaderModelItem} from '@/components/Form/formTable/FormTable';
import {useSubWormTable, UseSubWormTableDeps} from '@/components/Form/subForm/hook/useSubWormTable';
import {InputCell} from '@/components/Form/mainTable/InputCell';
import {ExtCol, formatByDatatype} from '@/components/Form/formTable/parts/FormatByDatatype';

type SubformProps = {
    subDisplay: SubDisplay | null;
    handleTabClick: (order: number) => void;
    subLoading: boolean;
    subError: string | null;
    formId: number | null;
    subHeaderGroups?: HeaderModelItem[];
    currentWidgetId?: number;
    comboReloadToken: number;
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
        comboReloadToken,

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

        tabs,
        displayedWidgetOrder,
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


    const activeOrder = currentOrder ?? displayedWidgetOrder ?? null;

    return (
        <div className={sub.root}>
            {hasTabs && tabs && (
                <ul className={sub.tabs}>
                    {tabs.map((sw) => {
                        const isActive =
                            activeOrder != null ? sw.widget_order === activeOrder : false;

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

            {subLoading ? (
                <p>Загрузка sub-виджета…</p>
            ) : subError ? (
                <p className={sub.error}>
                    Не удалось загрузить данные для выбранной вкладки саб-формы.
                    <br />
                    {subError}
                </p>
            ) : !subDisplay ? null : (
                <div className={sub.tableScroll}>
                    <table className={sub.tbl}>
                        <thead>
                        <tr>
                            {headerPlan.map((g) => (
                                <th key={`sub-g-top-${g.id}`} colSpan={g.cols.length || 1}>
                                    <span className={sub.ellipsis}>{g.title}</span>
                                </th>
                            ))}
                            <th className={sub.actionsHeadCell}>
                                <button
                                    type="button"
                                    onClick={() => setShowSubHeaders((v) => !v)}
                                    title={showSubHeaders ? 'Скрыть подзаголовки' : 'Показать подзаголовки'}
                                    className={sub.toggleBtn}
                                >
                                    {showSubHeaders ? (
                                        <ArrowDropUpIcon className={sub.toggleIcon}/>
                                    ) : (
                                        <ArrowDropDownIcon className={sub.toggleIcon}/>
                                    )}
                                </button>
                            </th>
                        </tr>

                        {showSubHeaders && (
                            <tr>
                                {headerPlan.map((g) => {
                                    const span = g.cols.length || 1;
                                    const label = safe(g.labels?.[0] ?? '—');
                                    return (
                                        <th key={`sub-g-sub-${g.id}`} colSpan={span}>
                                            <span className={sub.ellipsis}>{label}</span>
                                        </th>
                                    );
                                })}
                                <th className={sub.actionsHeadCell}/>
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
                                            comboReloadToken={comboReloadToken}
                                        />
                                    </td>
                                ))}
                                <td className={sub.actionsCell}/>
                            </tr>
                        )}

                        {subDisplay.data.map((row, rowIdx) => {
                            const isEditingRow = editingRowIdx === rowIdx;

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

                                        if (isEditingRow) {
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
                                                        comboReloadToken={comboReloadToken}
                                                    />
                                                </td>
                                            );
                                        }

                                        const raw = val == null ? '' : String(val);
                                        const display = formatByDatatype(raw, col as ExtCol);
                                        const isCheckboxCol =
                                            (col as ExtCol).type === 'checkbox' ||
                                            (col as ExtCol).type === 'bool';

                                        const toBool = (v: unknown): boolean => {
                                            if (v == null) return false;
                                            if (typeof v === 'boolean') return v;
                                            if (typeof v === 'number') return v !== 0;
                                            const s = String(v).trim().toLowerCase();
                                            return (
                                                s === '1' ||
                                                s === 'true' ||
                                                s === 't' ||
                                                s === 'yes' ||
                                                s === 'да'
                                            );
                                        };

                                        const clickable = !!onOpenDrill && col.form_id != null;

                                        return (
                                            <td
                                                key={`sub-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}
                                            >
                                                {isCheckboxCol ? (
                                                    <Checkbox
                                                        size="small"
                                                        checked={toBool(val)}
                                                        readOnly
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
                                                ) : clickable ? (
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
                                                            // eslint-disable-next-line no-console
                                                            console.debug('[SubWormTable] drill click', {
                                                                formId: col.form_id,
                                                                widget_column_id: col.widget_column_id,
                                                                table_column_id: col.table_column_id,
                                                            });
                                                        }}
                                                        className={sub.linkButton}
                                                        title={`Открыть форму #${col.form_id}`}
                                                    >
                                                        <span className={sub.ellipsis}>{display}</span>
                                                    </button>
                                                ) : (
                                                    <span className={sub.ellipsis}>{display}</span>
                                                )}
                                            </td>
                                        );
                                    })}

                                    <td className={sub.actionsCell}>
                                        {isEditingRow ? (
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
                                                <button
                                                    type="button"
                                                    className={sub.iconBtn}
                                                    onClick={() => startEdit(rowIdx)}
                                                    title="Редактировать"
                                                >
                                                    <EditIcon className={sub.actionIcon}/>
                                                </button>
                                                <button
                                                    type="button"
                                                    className={sub.iconBtn}
                                                    onClick={() => {
                                                        if (deletingRowIdx == null) deleteRow(rowIdx);
                                                    }}
                                                    disabled={deletingRowIdx === rowIdx}
                                                    title="Удалить"
                                                >
                                                    <DeleteIcon className={sub.actionIcon}/>
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
            )}
        </div>
    );
};
