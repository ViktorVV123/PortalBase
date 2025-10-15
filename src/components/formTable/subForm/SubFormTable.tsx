import React, { useMemo, useState } from 'react';
import { TextField } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';

import * as sub from './SubWormTable.module.scss';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';

import { api } from '@/services/api';
import type { SubDisplay, DTable, Widget } from '@/shared/hooks/useWorkSpaces';
import type { HeaderModelItem } from '@/components/formTable/FormTable';

type SubformProps = {
    subDisplay: SubDisplay | null;
    handleTabClick: (order: number) => void;

    subLoading: boolean;
    subError: string | null;

    /** form_id активной формы (тот же, что приходит из FormTable) */
    formId: number | null;

    /** живая модель шапки для саб-таблицы */
    subHeaderGroups?: HeaderModelItem[];

    /** текущий sub_widget_id */
    currentWidgetId?: number;

    /** Редактирование (state из FormTable, отдельные для sub) */
    editingRowIdx: number | null;
    setEditingRowIdx: React.Dispatch<React.SetStateAction<number | null>>;
    editDraft: Record<number, string>;
    setEditDraft: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    editSaving: boolean;
    setEditSaving: React.Dispatch<React.SetStateAction<boolean>>;

    /** Текущий активный порядок вкладки (если нужен внутри саб-таблицы) */
    currentOrder: number | null;

    /** Добавление строки в саб-таблицу (управление — снаружи) */
    isAddingSub: boolean;
    setIsAddingSub: React.Dispatch<React.SetStateAction<boolean>>;
    draftSub: Record<number, string>;
    setDraftSub: React.Dispatch<React.SetStateAction<Record<number, string>>>;
};

export const SubWormTable: React.FC<SubformProps> = ({
                                                         subDisplay,
                                                         handleTabClick,
                                                         subLoading,
                                                         subError,
                                                         formId,
                                                         currentWidgetId,
                                                         setEditingRowIdx,
                                                         setEditDraft,
                                                         setEditSaving,
                                                         editingRowIdx,
                                                         editDraft,
                                                         currentOrder,
                                                         editSaving,
                                                         isAddingSub,
                                                         setIsAddingSub,
                                                         draftSub,
                                                         setDraftSub,
                                                         subHeaderGroups,
                                                     }) => {
    const [deletingRowIdx, setDeletingRowIdx] = useState<number | null>(null);
    const [showSubHeaders, setShowSubHeaders] = useState<boolean>(false);

    const hasTabs = !!subDisplay?.sub_widgets?.length;

    const safe = (v?: string | null) => (v && v.trim() ? v.trim() : '—');

    // ───────── подготовка колонок и шапки ─────────
    const sortedColumns = useMemo(() => {
        const cols = subDisplay?.columns ?? [];
        return [...cols].sort((a, b) => (a.column_order ?? 0) - (b.column_order ?? 0));
    }, [subDisplay?.columns]);

    const headerPlan = useMemo(() => {
        if (subHeaderGroups && subHeaderGroups.length) {
            // сопоставляем группам реальные колонки subDisplay по widget_column_id
            return subHeaderGroups.map((g) => {
                let cols = sortedColumns.filter((c) => c.widget_column_id === g.id);

                // упорядочим референсы согласно refIds (если переданы)
                if (g.refIds && g.refIds.length) {
                    const pos = new Map<number, number>();
                    g.refIds.forEach((id, i) => pos.set(id, i));
                    cols = [...cols].sort((a, b) => {
                        const ai = pos.get(a.table_column_id!) ?? Number.MAX_SAFE_INTEGER;
                        const bi = pos.get(b.table_column_id!) ?? Number.MAX_SAFE_INTEGER;
                        return ai - bi;
                    });
                }

                // подписи берём строго из пришедших labels, подрезаем под фактическое число колонок
                const labels = (g.labels ?? []).slice(0, cols.length);
                while (labels.length < cols.length) labels.push('—');

                return { id: g.id, title: safe(g.title), labels: labels.map(safe), cols };
            });
        }

        // фолбэк: старая группировка по (column_name, widget_column_id)
        const groups: { id: number; title: string; labels: string[]; cols: typeof sortedColumns }[] = [];
        let i = 0;
        while (i < sortedColumns.length) {
            const name = sortedColumns[i].column_name;
            const wcId = sortedColumns[i].widget_column_id;
            const cols: typeof sortedColumns = [];
            while (
                i < sortedColumns.length &&
                sortedColumns[i].column_name === name &&
                sortedColumns[i].widget_column_id === wcId
                ) {
                cols.push(sortedColumns[i]);
                i++;
            }
            groups.push({
                id: wcId,
                title: safe(name) || `Колонка #${wcId}`,
                labels: cols.map(() => '—'),
                cols,
            });
        }
        return groups;
    }, [subHeaderGroups, sortedColumns]);

    const flatColumnsInRenderOrder = useMemo(
        () => headerPlan.flatMap((g) => g.cols),
        [headerPlan]
    );

    const valueIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        (subDisplay?.columns ?? []).forEach((c, i) => {
            map.set(`${c.widget_column_id}:${c.table_column_id ?? -1}`, i);
        });
        return map;
    }, [subDisplay?.columns]);

    // ───────── префлайты ─────────
    const preflightUpdate = async (): Promise<{ ok: boolean }> => {
        if (!currentWidgetId) return { ok: false };
        try {
            const { data: widget } = await api.get<Widget>(`/widgets/${currentWidgetId}`);
            const { data: table } = await api.get<DTable>(`/tables/${widget.table_id}`);
            if (!table?.update_query?.trim()) {
                alert('Для таблицы саб-виджета не настроен UPDATE QUERY.');
                return { ok: false };
            }
        } catch (e) {
            console.warn('preflight (sub/update) failed:', e);
        }
        return { ok: true };
    };

    const preflightDelete = async (): Promise<{ ok: boolean }> => {
        if (!currentWidgetId) return { ok: false };
        try {
            const { data: widget } = await api.get<Widget>(`/widgets/${currentWidgetId}`);
            const { data: table } = await api.get<DTable>(`/tables/${widget.table_id}`);
            if (!table?.delete_query?.trim()) {
                alert('Для таблицы саб-виджета не настроен DELETE QUERY.');
                return { ok: false };
            }
        } catch (e) {
            console.warn('preflight (sub/delete) failed:', e);
        }
        return { ok: true };
    };

    // ───────── РЕДАКТИРОВАНИЕ ─────────
    const startEdit = async (rowIdx: number) => {
        if (!formId || !currentWidgetId || !subDisplay) return;
        const pf = await preflightUpdate();
        if (!pf.ok) return;

        setIsAddingSub(false);

        const row = subDisplay.data[rowIdx];
        const init: Record<number, string> = {};
        flatColumnsInRenderOrder.forEach((col) => {
            const k = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
            const idx = valueIndexByKey.get(k);
            const val = idx != null ? row.values[idx] : '';
            if (col.table_column_id != null) init[col.table_column_id] = (val ?? '').toString();
        });

        setEditingRowIdx(rowIdx);
        setEditDraft(init);
    };

    const cancelEdit = () => {
        setEditingRowIdx(null);
        setEditDraft({});
        setEditSaving(false);
    };

    const submitEdit = async () => {
        if (editingRowIdx == null || !formId || !currentWidgetId || !subDisplay) return;
        const pf = await preflightUpdate();
        if (!pf.ok) return;

        setEditSaving(true);
        try {
            const row = subDisplay.data[editingRowIdx];

            const values = Object.entries(editDraft)
                .filter(([, v]) => v !== '' && v !== undefined && v !== null)
                .map(([table_column_id, value]) => ({
                    table_column_id: Number(table_column_id),
                    value: String(value),
                }));

            const body = {
                pk: {
                    primary_keys: Object.fromEntries(
                        Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
                    ),
                },
                values,
            };

            const url = `/data/${formId}/${currentWidgetId}`;
            try {
                await api.patch(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 404 && String(detail).includes('Update query not found')) {
                    alert('Для саб-формы не настроен UPDATE QUERY. Задайте его и повторите.');
                    return;
                }
                if (status === 404) {
                    await api.patch(`${url}/`, body);
                } else {
                    throw err;
                }
            }

            if (currentOrder != null) handleTabClick(currentOrder);
            cancelEdit();
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(`Не удалось обновить строку: ${status ?? ''} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        } finally {
            setEditSaving(false);
        }
    };

    // ───────── УДАЛЕНИЕ ─────────
    const deleteRow = async (rowIdx: number) => {
        if (!formId || !currentWidgetId || !subDisplay) return;
        const pf = await preflightDelete();
        if (!pf.ok) return;

        const row = subDisplay.data[rowIdx];
        const pkObj = Object.fromEntries(
            Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
        );
        const pkLabel = Object.entries(pkObj)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');

        if (!window.confirm(`Удалить запись (${pkLabel})?`)) return;

        setDeletingRowIdx(rowIdx);
        try {
            const body = { primary_keys: pkObj };
            const url = `/data/${formId}/${currentWidgetId}`;

            try {
                await api.delete(url, { data: body });
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;
                if (status === 404 && String(detail).includes('Delete query not found')) {
                    alert('Для саб-формы не настроен DELETE QUERY. Задайте его и повторите.');
                    return;
                }
                if (status === 404) {
                    await api.delete(`${url}/`, { data: body });
                } else {
                    throw err;
                }
            }

            if (currentOrder != null) handleTabClick(currentOrder);
            if (editingRowIdx === rowIdx) cancelEdit();
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(`Не удалось удалить строку: ${status ?? ''} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        } finally {
            setDeletingRowIdx(null);
        }
    };

    // ───────── UI ─────────
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

                            {/* Тумблер показа подзаголовков — как в FormTable */}
                            <th
                                rowSpan={showSubHeaders ? 1 : 2}
                                style={{ textAlign: 'center', verticalAlign: 'middle' }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setShowSubHeaders((v) => !v)}
                                    aria-label={showSubHeaders ? 'Скрыть подзаголовки' : 'Показать подзаголовки'}
                                    aria-expanded={showSubHeaders}
                                    title={showSubHeaders ? 'Скрыть подзаголовки' : 'Показать подзаголовки'}
                                    style={{ background: 'none', border: 0, cursor: 'pointer' }}
                                >
                                    {showSubHeaders ? <ArrowDropUpIcon style={{ color: '#fff' }} /> : <ArrowDropDownIcon style={{ color: '#fff' }} />}
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
                                        const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                                        const idx = valueIndexByKey.get(key);
                                        const val = idx != null ? row.values[idx] : '';

                                        if (isEditing) {
                                            return (
                                                <td
                                                    key={`sub-edit-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}
                                                >
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
                                            <td
                                                key={`sub-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}
                                            >
                                                {val}
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
                              style={{ display: 'inline-flex', cursor: 'pointer', marginRight: 10 }}
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
