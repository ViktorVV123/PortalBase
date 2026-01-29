import React from 'react';
import { Checkbox, Tooltip, IconButton } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
import * as cls from "@/components/table/tableToolbar/TableToolbar.module.scss";
import { ButtonForm } from "@/shared/buttonForm/ButtonForm";
import { isColumnRequired, isEmptyValue } from '@/shared/utils/requiredValidation/requiredValidation';
import { isSameComboGroup, getWriteTcIdForComboGroup } from '@/shared/utils/comboGroupUtils';
import { formatCellValue } from '@/shared/utils/cellFormat';

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

    onOpenDrill?: (
        fid?: number | null,
        meta?: {
            originColumnType?: 'combobox' | null;
            primary?: Record<string, unknown>;
            openedFromEdit?: boolean;
            targetWriteTcId?: number;
        },
    ) => void;

    submitAdd?: any;
    saving?: any;
    selectedWidget?: any;
    buttonClassName?: any;
    selectFormId?: any;
    startAdd?: any;
    cancelAdd?: any;

    showValidationErrors?: boolean;
    setShowValidationErrors?: React.Dispatch<React.SetStateAction<boolean>>;
    setValidationMissingFields?: React.Dispatch<React.SetStateAction<string[]>>;
    resetValidation?: () => void;
};

const SYNTHETIC_MIN = -1_000_000;
const isSyntheticComboboxId = (tcId: number): boolean => tcId <= SYNTHETIC_MIN;

const getWriteTcId = (col: ExtCol): number | null => {
    if (col.type === 'combobox') {
        const w = (col as any).__write_tc_id;
        if (typeof w === 'number') return w;
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

// ═══════════════════════════════════════════════════════════
// Выбирает "primary" колонку из combobox группы
// ═══════════════════════════════════════════════════════════
function pickPrimaryCombo(group: ExtCol[]): ExtCol {
    return group.find((c) => (c as any).__is_primary_combo_input) ?? group[0];
}

// ═══════════════════════════════════════════════════════════
// Получает отображаемое значение для колонки
// ═══════════════════════════════════════════════════════════
function getShown(
    valueIndexByKey: Map<string, number>,
    values: unknown[],
    col: ExtCol
): string {
    const syntheticTcId =
        col.type === 'combobox' && col.combobox_column_id != null && col.table_column_id != null
            ? SYNTHETIC_MIN - Number(col.combobox_column_id)
            : col.table_column_id ?? -1;

    const key = `${col.widget_column_id}:${syntheticTcId}`;
    const idx = valueIndexByKey.get(key);
    if (idx == null) return '';

    const val = values[idx];
    return val == null ? '' : String(val).trim();
}

// ═══════════════════════════════════════════════════════════
// Компонент заголовка с required меткой
// ═══════════════════════════════════════════════════════════

type HeaderCellProps = {
    title: string;
    cols: ExtCol[];
    colSpan: number;
};

const HeaderCell: React.FC<HeaderCellProps> = ({ title, cols, colSpan }) => {
    const hasRequired = cols.some(c => isColumnRequired(c));

    return (
        <th colSpan={colSpan}>
            <span className={sub.ellipsis}>
                {title}
                {hasRequired && (
                    <Tooltip title="Обязательное поле" arrow placement="top">
                        <span className={sub.requiredMark}>*</span>
                    </Tooltip>
                )}
            </span>
        </th>
    );
};

// ═══════════════════════════════════════════════════════════
// Компонент ячейки редактирования с кнопкой drill для combobox
// ═══════════════════════════════════════════════════════════

type EditCellWithDrillProps = {
    col: ExtCol;
    writeTcId: number | null;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    comboReloadToken: number;
    showError: boolean;
    onOpenDrill?: SubformProps['onOpenDrill'];
    rowPrimaryKeys?: Record<string, unknown>;
    mode: 'add' | 'edit';
};

const EditCellWithDrill: React.FC<EditCellWithDrillProps> = ({
                                                                 col,
                                                                 writeTcId,
                                                                 value,
                                                                 onChange,
                                                                 placeholder,
                                                                 comboReloadToken,
                                                                 showError,
                                                                 onOpenDrill,
                                                                 rowPrimaryKeys,
                                                                 mode,
                                                             }) => {
    if (writeTcId == null) {
        return <span className={sub.ellipsis}>—</span>;
    }

    const isCombobox = col.type === 'combobox';
    const hasDrill = isCombobox && col.form_id != null && !!onOpenDrill;

    return (
        <div className={sub.cellEditor}>
            <InputCell
                mode={mode}
                col={col}
                readOnly={false}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                comboReloadToken={comboReloadToken}
                showError={showError}
            />

            {hasDrill && (
                <Tooltip title="Открыть справочник" arrow>
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenDrill?.(col.form_id!, {
                                originColumnType: 'combobox',
                                primary: rowPrimaryKeys,
                                openedFromEdit: true,
                                targetWriteTcId: writeTcId ?? undefined,
                            });
                        }}
                        sx={{
                            ml: 0.5,
                            p: 0.5,
                            color: 'var(--link, #66b0ff)',
                            '&:hover': { backgroundColor: 'rgba(102, 176, 255, 0.1)' },
                        }}
                    >
                        <OpenInNewIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Tooltip>
            )}
        </div>
    );
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
        submitAdd,
        saving,
        selectedWidget,
        buttonClassName,
        selectFormId,
        startAdd,
        cancelAdd,
        showValidationErrors = false,
        setShowValidationErrors,
        setValidationMissingFields,
        resetValidation,
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
        showSubValidationErrors: showValidationErrors,
        setShowSubValidationErrors: setShowValidationErrors,
        setSubValidationMissingFields: setValidationMissingFields,
        resetSubValidation: resetValidation,
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

    // ✅ колонки без rls
    const renderCols = React.useMemo(
        () => flatColumnsInRenderOrder.filter((c) => (c as ExtCol).type !== 'rls'),
        [flatColumnsInRenderOrder],
    );

    // ✅ headerPlan без rls
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

    // ═══════════════════════════════════════════════════════════
    // RENDER CELLS с группировкой combobox (как в MainTable)
    // ═══════════════════════════════════════════════════════════

    const renderAddRowCells = () => {
        const cells: React.ReactNode[] = [];
        const cols = renderCols as ExtCol[];
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

                const value = writeTcId == null ? '' : (draftSub[writeTcId] ?? '');
                const isReq = isColumnRequired(primary);
                const isEmpty = isEmptyValue(value);
                const hasError = showValidationErrors && isReq && isEmpty;

                cells.push(
                    <td
                        key={`sub-add-combo-${primary.widget_column_id}:${writeTcId ?? 'null'}`}
                        colSpan={span}
                        className={sub.editCell}
                    >
                        <EditCellWithDrill
                            col={primary}
                            writeTcId={writeTcId}
                            value={value}
                            onChange={(v) => {
                                if (writeTcId != null) setDraftSub((prev) => ({ ...prev, [writeTcId]: v }));
                            }}
                            placeholder={isReq ? `${primary.placeholder ?? primary.column_name} *` : (primary.placeholder ?? primary.column_name)}
                            comboReloadToken={comboReloadToken}
                            showError={hasError}
                            onOpenDrill={onOpenDrill}
                            rowPrimaryKeys={undefined}
                            mode="add"
                        />
                    </td>
                );
                i = j;
                continue;
            }

            // Обычная колонка
            const writeTcId = getWriteTcId(col);
            const value = writeTcId == null ? '' : (draftSub[writeTcId] ?? '');
            const isReq = isColumnRequired(col);
            const isEmpty = isEmptyValue(value);
            const hasError = showValidationErrors && isReq && isEmpty;

            cells.push(
                <td
                    key={`sub-add-${col.widget_column_id}:${col.table_column_id}`}
                    className={sub.editCell}
                >
                    <EditCellWithDrill
                        col={col}
                        writeTcId={writeTcId}
                        value={value}
                        onChange={(v) => {
                            if (writeTcId != null) setDraftSub((prev) => ({ ...prev, [writeTcId]: v }));
                        }}
                        placeholder={isReq ? `${col.placeholder ?? col.column_name} *` : (col.placeholder ?? col.column_name)}
                        comboReloadToken={comboReloadToken}
                        showError={hasError}
                        onOpenDrill={onOpenDrill}
                        rowPrimaryKeys={undefined}
                        mode="add"
                    />
                </td>
            );
            i += 1;
        }

        return cells;
    };

    const renderDataRowCells = (row: SubDisplay['data'][number], rowIdx: number, isEditingRow: boolean) => {
        const cells: React.ReactNode[] = [];
        const cols = renderCols as ExtCol[];
        let i = 0;

        while (i < cols.length) {
            const col = cols[i];

            // ───── Combobox-группа ─────
            if (col.type === 'combobox') {
                let j = i + 1;
                while (j < cols.length && isSameComboGroup(col, cols[j])) j += 1;
                const group = cols.slice(i, j);
                const span = group.length;
                const primary = pickPrimaryCombo(group);
                const writeTcId = getWriteTcIdForComboGroup(group);

                if (isEditingRow) {
                    const value = writeTcId == null ? '' : (editDraft[writeTcId] ?? '');
                    const isReq = isColumnRequired(primary);
                    const isEmpty = isEmptyValue(value);
                    const hasError = showValidationErrors && isReq && isEmpty;

                    cells.push(
                        <td
                            key={`sub-edit-combo-r${rowIdx}-${primary.widget_column_id}:${writeTcId}`}
                            colSpan={span}
                            className={sub.editCell}
                        >
                            <EditCellWithDrill
                                col={primary}
                                writeTcId={writeTcId}
                                value={value}
                                onChange={(v) => {
                                    if (writeTcId != null) setEditDraft((prev) => ({ ...prev, [writeTcId]: v }));
                                }}
                                placeholder={isReq ? `${primary.placeholder ?? primary.column_name} *` : (primary.placeholder ?? primary.column_name)}
                                comboReloadToken={comboReloadToken}
                                showError={hasError}
                                onOpenDrill={onOpenDrill}
                                rowPrimaryKeys={row.primary_keys as Record<string, unknown>}
                                mode="edit"
                            />
                        </td>
                    );
                } else {
                    // View mode — показываем объединённые значения из всех колонок группы
                    const shownParts = group
                        .map((gcol) => getShown(valueIndexByKey, row.values, gcol))
                        .filter(Boolean);
                    const display = shownParts.length
                        ? shownParts.map(formatCellValue).join(' · ')
                        : '—';
                    const clickable = primary.form_id != null && !!onOpenDrill;

                    cells.push(
                        <td
                            key={`sub-view-combo-r${rowIdx}-${primary.widget_column_id}:${writeTcId}`}
                            colSpan={span}
                        >
                            {clickable ? (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenDrill?.(primary.form_id!, {
                                            originColumnType: 'combobox',
                                            primary: row.primary_keys as Record<string, unknown>,
                                            openedFromEdit: false,
                                            targetWriteTcId: writeTcId ?? undefined,
                                        });
                                    }}
                                    className={sub.linkButton}
                                    title={`Открыть форму #${primary.form_id}`}
                                >
                                    <span className={sub.ellipsis}>{display}</span>
                                </button>
                            ) : (
                                <span className={sub.ellipsis}>{display}</span>
                            )}
                        </td>
                    );
                }

                i = j;
                continue;
            }

            // ───── Обычная колонка ─────
            const syntheticTcId =
                col.type === 'combobox' && col.combobox_column_id != null && col.table_column_id != null
                    ? -1_000_000 - Number(col.combobox_column_id)
                    : col.table_column_id ?? -1;

            const key = `${col.widget_column_id}:${syntheticTcId}`;
            const idx = valueIndexByKey.get(key);
            const val = idx != null ? row.values[idx] : '';

            if (isEditingRow) {
                const writeTcId = getWriteTcId(col);
                const value = writeTcId == null ? '' : (editDraft[writeTcId] ?? '');
                const isReq = isColumnRequired(col);
                const isEmpty = isEmptyValue(value);
                const hasError = showValidationErrors && isReq && isEmpty;

                cells.push(
                    <td
                        key={`sub-edit-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}
                        className={sub.editCell}
                    >
                        <EditCellWithDrill
                            col={col}
                            writeTcId={writeTcId}
                            value={value}
                            onChange={(v) => {
                                if (writeTcId != null) setEditDraft((prev) => ({ ...prev, [writeTcId]: v }));
                            }}
                            placeholder={isReq ? `${col.placeholder ?? col.column_name} *` : (col.placeholder ?? col.column_name)}
                            comboReloadToken={comboReloadToken}
                            showError={hasError}
                            onOpenDrill={onOpenDrill}
                            rowPrimaryKeys={row.primary_keys as Record<string, unknown>}
                            mode="edit"
                        />
                    </td>
                );
            } else {
                const isCheckboxCol = col.type === 'checkbox' || col.type === 'bool';
                const toBool = (v: unknown): boolean => isRlsLockedValue(v);
                const clickable = !!onOpenDrill && col.form_id != null;
                const raw = val == null ? '' : String(val);
                const display = formatByDatatype(raw, col);

                cells.push(
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
                                        targetWriteTcId: getWriteTcId(col) ?? undefined,
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
            }

            i += 1;
        }

        return cells;
    };

    return (
        <div className={sub.root}>
            <div style={{ display: 'flex' }}>
                {hasTabs && tabs && (
                    <ul className={sub.tabs}>
                        {tabs.map((sw) => {
                            const isActive = activeOrder != null ? sw.widget_order === activeOrder : false;
                            return (
                                <li key={sw.widget_order}>
                                    <button
                                        className={isActive ? sub.tabActive : sub.tab}
                                        onClick={() => {
                                            if (editingRowIdx != null) cancelEdit();
                                            if (isAddingSub) cancelAdd?.();
                                            setShowSubHeaders(false);
                                            handleTabClick(sw.widget_order);
                                        }}
                                    >
                                        {sw.name}
                                    </button>
                                </li>
                            );
                        })}
                        <ButtonForm
                            cancelAdd={cancelAdd}
                            startAdd={startAdd}
                            isAdding={!!isAddingSub}
                            submitAdd={submitAdd}
                            saving={saving}
                            selectedWidget={selectedWidget}
                            selectedFormId={selectFormId}
                            buttonClassName={cls.iconBtn}
                        />
                    </ul>
                )}
            </div>

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
                                <HeaderCell
                                    key={`sub-g-top-${g.id}`}
                                    title={g.title}
                                    cols={g.cols as ExtCol[]}
                                    colSpan={g.cols.length || 1}
                                />
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
                                    while (labels.length < g.cols.length) labels.push('—');

                                    const nodes: React.ReactNode[] = [];
                                    let i = 0;

                                    while (i < g.cols.length) {
                                        const label = labels[i] ?? '—';
                                        const col = g.cols[i] as ExtCol;

                                        let span = 1;
                                        while (i + span < g.cols.length && (labels[i + span] ?? '—') === label) {
                                            span += 1;
                                        }

                                        const isReq = isColumnRequired(col);

                                        nodes.push(
                                            <th key={`g-sub-${g.id}-${i}`} colSpan={span}>
                                                <span className={s.ellipsis}>
                                                    {label}
                                                    {isReq && <span className={sub.requiredMark}>*</span>}
                                                </span>
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
                            <tr className={sub.addRow}>
                                {renderAddRowCells()}
                                <td className={sub.actionsCell} />
                            </tr>
                        )}

                        {subDisplay.data.map((row, rowIdx) => {
                            const isEditingRow = editingRowIdx === rowIdx;
                            const rlsVal = rlsMeta ? row.values[rlsMeta.idx] : null;
                            const isRowLocked = rlsMeta ? isRlsLockedValue(rlsVal) : false;

                            return (
                                <tr key={rowIdx}>
                                    {renderDataRowCells(row, rowIdx, isEditingRow)}

                                    <td className={sub.actionsCell}>
                                        {isEditingRow ? (
                                            <>
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
                                                    <span className={sub.lockSlot} title="Строка защищена политикой RLS">
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