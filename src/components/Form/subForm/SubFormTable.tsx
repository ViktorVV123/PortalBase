import React from 'react';
import { Checkbox } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import * as sub from './SubWormTable.module.scss';

import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import type { SubDisplay } from '@/shared/hooks/useWorkSpaces';
import type { HeaderModelItem } from '@/components/Form/formTable/FormTable';
import { useSubWormTable } from '@/components/Form/subForm/hook/useSubWormTable';
import { InputCell } from '@/components/Form/mainTable/InputCell';
import { ExtCol, formatByDatatype } from '@/components/Form/formTable/parts/FormatByDatatype';
import LockIcon from '@/assets/image/LockIcon.svg';
import * as s from "@/components/setOfTables/SetOfTables.module.scss";

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

const SYNTHETIC_MIN = -1_000_000;
const isSyntheticComboboxId = (tcId: number): boolean => tcId <= SYNTHETIC_MIN;

/** Реальный table_column_id, который нужно ОТПРАВЛЯТЬ на бэк */
const getWriteTcId = (col: ExtCol): number | null => {
    if (col.type === 'combobox') {
        const w = (col as any).__write_tc_id;
        if (typeof w === 'number') return w;

        // фолбэк: если table_column_id вдруг уже реальный (не синтетика)
        const tc = col.table_column_id;
        if (typeof tc === 'number' && !isSyntheticComboboxId(tc)) return tc;

        return null;
    }

    return typeof col.table_column_id === 'number' ? col.table_column_id : null;
};

function isRlsLockedValue(val: unknown): boolean {
    if (val == null) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;

    const s = String(val).trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'да' || s === 'yes' || s === 't';
}




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
    });

    const activeOrder = currentOrder ?? displayedWidgetOrder ?? null;

    const rlsMeta = React.useMemo(() => {
        const col = flatColumnsInRenderOrder.find((c) => (c as ExtCol).type === 'rls');
        if (!col) return null;

        const syntheticTcId =
            col.type === 'combobox' && col.combobox_column_id != null && col.table_column_id != null
                ? -1_000_000 - Number(col.combobox_column_id)
                : col.table_column_id ?? -1;

        const key = `${col.widget_column_id}:${syntheticTcId}`;
        const idx = valueIndexByKey.get(key);
        if (idx == null) return null;

        return { col: col as ExtCol, idx };
    }, [flatColumnsInRenderOrder, valueIndexByKey]);

    // ✅ колонки, которые реально показываем
    const renderCols = React.useMemo(
        () => flatColumnsInRenderOrder.filter((c) => (c as ExtCol).type !== 'rls'),
        [flatColumnsInRenderOrder],
    );

    // ✅ headerPlan без rls (иначе шапка покажет check)
    const renderHeaderPlan = React.useMemo(() => {
        return (headerPlan ?? [])
            .map((g) => {
                const nextCols = (g.cols ?? []).filter((c) => (c as ExtCol).type !== 'rls');
                if (!nextCols.length) return null;

                const nextLabels =
                    Array.isArray(g.labels) && g.labels.length === (g.cols?.length ?? 0)
                        ? g.labels.filter((_, i) => (g.cols[i] as ExtCol | undefined)?.type !== 'rls')
                        : g.labels;

                return { ...g, cols: nextCols, labels: nextLabels };
            })
            .filter(Boolean) as typeof headerPlan;
    }, [headerPlan]);

    return (
        <div className={sub.root}>
            {hasTabs && tabs && (
                <ul className={sub.tabs}>
                    {tabs.map((sw) => {
                        const isActive = activeOrder != null ? sw.widget_order === activeOrder : false;
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
                            {renderHeaderPlan.map((g) => (
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
                                        <ArrowDropUpIcon className={sub.toggleIcon} />
                                    ) : (
                                        <ArrowDropDownIcon className={sub.toggleIcon} />
                                    )}
                                </button>
                            </th>
                        </tr>

                        {showSubHeaders && (
                            <tr>
                                {renderHeaderPlan.flatMap((g) => {
                                    const labels = (g.labels ?? []).slice(0, g.cols.length);
                                    // если labels меньше, добьём "—"
                                    while (labels.length < g.cols.length) labels.push('—');

                                    const nodes: React.ReactNode[] = [];

                                    let i = 0;
                                    while (i < g.cols.length) {
                                        const label = labels[i] ?? '—';

                                        let span = 1;
                                        while (i + span < g.cols.length && (labels[i + span] ?? '—') === label) {
                                            span += 1;
                                        }

                                        nodes.push(
                                            <th key={`g-sub-${g.id}-${i}`} colSpan={span}>
                                                <span className={s.ellipsis}>{label}</span>
                                            </th>
                                        );

                                        i += span;
                                    }

                                    return nodes;
                                })}
                                <th className={s.actionsCell} />
                            </tr>
                        )}
                        </thead>

                        <tbody>
                        {/* строка добавления в саб */}
                        {isAddingSub && (
                            <tr>
                                {renderCols.map((col) => {
                                    const writeTcId = getWriteTcId(col as ExtCol);

                                    return (
                                        <td key={`sub-add-wc${col.widget_column_id}-tc${col.table_column_id}`}>
                                            {writeTcId == null ? (
                                                <span className={sub.ellipsis}>—</span>
                                            ) : (
                                                <InputCell
                                                    mode="add"
                                                    col={col as ExtCol}
                                                    readOnly={false}
                                                    value={draftSub[writeTcId] ?? ''}
                                                    onChange={(v) =>
                                                        setDraftSub((prev) => ({
                                                            ...prev,
                                                            [writeTcId]: v,
                                                        }))
                                                    }
                                                    placeholder={col.placeholder ?? col.column_name}
                                                    comboReloadToken={comboReloadToken}
                                                />
                                            )}
                                        </td>
                                    );
                                })}
                                <td className={sub.actionsCell} />
                            </tr>
                        )}

                        {subDisplay.data.map((row, rowIdx) => {
                            const isEditingRow = editingRowIdx === rowIdx;

                            // ✅ RLS-lock для строки
                            const rlsVal = rlsMeta ? row.values[rlsMeta.idx] : null;
                            const isRowLocked = rlsMeta ? isRlsLockedValue(rlsVal) : false;

                            return (
                                <tr key={rowIdx}>
                                    {/* ✅ было flatColumnsInRenderOrder -> стало renderCols */}
                                    {renderCols.map((col) => {
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
                                            const writeTcId = getWriteTcId(col as ExtCol);

                                            return (
                                                <td key={`sub-edit-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}>
                                                    {writeTcId == null ? (
                                                        <span className={sub.ellipsis}>—</span>
                                                    ) : (
                                                        <InputCell
                                                            mode="edit"
                                                            col={col as ExtCol}
                                                            readOnly={false}
                                                            value={editDraft[writeTcId] ?? ''}
                                                            onChange={(v) =>
                                                                setEditDraft((prev) => ({
                                                                    ...prev,
                                                                    [writeTcId]: v,
                                                                }))
                                                            }
                                                            placeholder={col.placeholder ?? col.column_name}
                                                            comboReloadToken={comboReloadToken}
                                                        />
                                                    )}
                                                </td>
                                            );
                                        }

                                        const isCheckboxCol =
                                            (col as ExtCol).type === 'checkbox' || (col as ExtCol).type === 'bool';

                                        const toBool = (v: unknown): boolean => isRlsLockedValue(v);

                                        const clickable = !!onOpenDrill && col.form_id != null;

                                        const raw = val == null ? '' : String(val);
                                        const display = formatByDatatype(raw, col as ExtCol);

                                        return (
                                            <td key={`sub-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}>
                                                {isCheckboxCol ? (
                                                    <Checkbox
                                                        size="small"
                                                        checked={toBool(val)}
                                                        readOnly
                                                        disabled
                                                        sx={{
                                                            color: 'rgba(255, 255, 255, 0.4)',
                                                            '&.Mui-checked': { color: 'rgba(255, 255, 255, 0.9)' },
                                                            '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.7)' },
                                                        }}
                                                    />
                                                ) : clickable ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onOpenDrill?.(col.form_id!, {
                                                                originColumnType: col.type === 'combobox' ? 'combobox' : null,
                                                                primary: row.primary_keys as Record<string, unknown>,
                                                                openedFromEdit: false,
                                                                targetWriteTcId: getWriteTcId(col as ExtCol) ?? undefined,
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

                                    {/* ✅ actions */}
                                    <td className={sub.actionsCell}>
                                        {isEditingRow ? (
                                            <>
                                                {/* если строка вдруг залочена — не даём сохранить */}
                                                {!isRowLocked && (
                                                    <button
                                                        className={sub.okBtn}
                                                        onClick={submitEdit}
                                                        disabled={editSaving}
                                                        title="Сохранить"
                                                    >
                                                        {editSaving ? '…' : '✓'}
                                                    </button>
                                                )}
                                                <button
                                                    className={sub.cancelBtn}
                                                    onClick={cancelEdit}
                                                    disabled={editSaving}
                                                    title="Отменить"
                                                >
                                                    ×
                                                </button>
                                                {isRowLocked && (
                                                    <span title="Строка защищена политикой RLS">
                              <LockIcon className={sub.actionIcon} />
                            </span>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className={sub.iconBtn}
                                                    onClick={() => {
                                                        if (isRowLocked) return;
                                                        startEdit(rowIdx);
                                                    }}
                                                    style={{ pointerEvents: isRowLocked ? 'none' : 'auto' }}
                                                    disabled={isRowLocked}
                                                    title={isRowLocked ? 'Редактирование запрещено (RLS)' : 'Редактировать'}
                                                >
                                                    <EditIcon className={sub.actionIcon} />
                                                </button>

                                                <button
                                                    type="button"
                                                    className={sub.iconBtn}
                                                    style={{ pointerEvents: isRowLocked ? 'none' : 'auto' }}
                                                    onClick={() => {
                                                        if (isRowLocked) return;
                                                        if (deletingRowIdx == null) deleteRow(rowIdx);
                                                    }}
                                                    disabled={isRowLocked || deletingRowIdx === rowIdx}
                                                    title={isRowLocked ? 'Удаление запрещено (RLS)' : 'Удалить'}
                                                >
                                                    <DeleteIcon className={sub.actionIcon} />
                                                </button>

                                                {isRowLocked && (
                                                    <span  className={sub.lockSlot}
                                                           title="Строка защищена политикой RLS">
                              <LockIcon className={sub.actionIcon} />
                            </span>
                                                )}
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