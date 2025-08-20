/*
import React from 'react';
import * as s from "@/components/setOfTables/SetOfTables.module.scss";
import {SubDisplay} from "@/shared/hooks/useWorkSpaces";

type SubformProps = {
    subDisplay:SubDisplay | null;
    handleTabClick:(order: number) => void;
    subLoading:any
    subError:any
}

export const SubWormTable = ({subDisplay,handleTabClick,subLoading,subError}:SubformProps) => {
    return (
        <div>
            {subDisplay?.sub_widgets.length > 0 && (
                <ul className={s.tabs}>
                    {subDisplay.sub_widgets.map(sw => {
                        const isActive = sw.widget_order === subDisplay.displayed_widget.widget_order;
                        return (
                            <li key={sw.widget_order}>
                                <button
                                    className={isActive ? s.tabActive : s.tab}
                                    onClick={() => handleTabClick(sw.widget_order)}
                                >
                                    {sw.name}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {subDisplay && (
                subLoading ? (
                    <p>Загрузка sub-виджета…</p>
                ) : subError ? (
                    <p className={s.error}>{subError}</p>
                ) : (
                    <table className={s.tbl}>
                        <thead>
                        <tr>{subDisplay.columns.map(c => <th key={c.column_name}>{c.column_name}</th>)}</tr>
                        </thead>
                        <tbody>
                        {subDisplay.data.map((r, i) => (
                            <tr key={i}>{r.values.map((v, j) => <td key={j}>{v}</td>)}</tr>
                        ))}
                        </tbody>
                    </table>
                )
            )}
        </div>
    );
};
*/



import React, { useMemo, useState } from 'react';
import * as s from "@/components/setOfTables/SetOfTables.module.scss";
import { SubDisplay, DTable, Widget } from "@/shared/hooks/useWorkSpaces";
import { api } from "@/services/api";

type SubformProps = {
    subDisplay: SubDisplay | null;
    handleTabClick: (order: number) => void;
    subLoading: any;
    subError: any;

    /** 🔹 нужен для POST /data/{form_id}/{widget_id} */
    formId: number | null;

    /** 🔹 маппинг: widget_order -> sub_widget_id (берём из WidgetForm.sub_widgets) */
    subWidgetIdByOrder: Record<number, number>;
};

export const SubWormTable = ({
                                 subDisplay,
                                 handleTabClick,
                                 subLoading,
                                 subError,
                                 formId,
                                 subWidgetIdByOrder,
                             }: SubformProps) => {
    const hasTabs = (subDisplay?.sub_widgets?.length ?? 0) > 0;

    // ───────── подготовка колонок и шапки ─────────
    const sortedColumns = useMemo(() => {
        const cols = subDisplay?.columns ?? [];
        return [...cols].sort((a, b) => (a.column_order ?? 0) - (b.column_order ?? 0));
    }, [subDisplay?.columns]);

    const headerPlan = useMemo(() => {
        const groups: {
            id: number;
            title: string;
            labels: string[];
            cols: typeof sortedColumns;
        }[] = [];

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

            const labels = cols.map((c: any) => c.subcolumn_name ?? "—");

            groups.push({
                id: wcId,
                title: name ?? `Колонка #${wcId}`,
                labels,
                cols,
            });
        }
        return groups;
    }, [sortedColumns]);

    const flatColumnsInRenderOrder = useMemo(
        () => headerPlan.flatMap((g) => g.cols),
        [headerPlan]
    );

    const valueIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        (subDisplay?.columns ?? []).forEach((c, i) => {
            const key = `${c.widget_column_id}:${c.table_column_id ?? -1}`;
            map.set(key, i);
        });
        return map;
    }, [subDisplay?.columns]);

    // ───────── добавление строки (инлайн) ─────────
    const [isAdding, setIsAdding] = useState(false);
    const [draft, setDraft] = useState<Record<number, string>>({});
    const [saving, setSaving] = useState(false);

    const currentOrder = subDisplay?.displayed_widget?.widget_order ?? null;
    const currentWidgetId =
        currentOrder != null ? subWidgetIdByOrder[currentOrder] : undefined;

    const startAdd = async () => {
        if (!formId || !currentWidgetId) {
            alert("Нет formId или sub_widget_id для вставки");
            return;
        }

        // (опциональный префлайт insert_query у таблицы саб-виджета)
        try {
            const { data: widget } = await api.get<Widget>(`/widgets/${currentWidgetId}`);
            const { data: table } = await api.get<DTable>(`/tables/${widget.table_id}`);
            if (!table?.insert_query || !table.insert_query.trim()) {
                alert("Для таблицы саб-виджета не настроен INSERT QUERY.");
                return;
            }
        } catch (e) {
            // не блокируем — просто предупредили
            console.warn("preflight (sub) failed:", e);
        }

        setIsAdding(true);
        const init: Record<number, string> = {};
        flatColumnsInRenderOrder.forEach((c) => {
            if (c.table_column_id != null) init[c.table_column_id] = "";
        });
        setDraft(init);
    };

    const cancelAdd = () => {
        setIsAdding(false);
        setDraft({});
    };

    const submitAdd = async () => {
        if (!formId || !currentWidgetId) return;
        setSaving(true);
        try {
            const values = Object.entries(draft)
                .filter(([, v]) => v !== "" && v !== undefined && v !== null)
                .map(([table_column_id, value]) => ({
                    table_column_id: Number(table_column_id),
                    value: String(value),
                }));

            const body = { pk: {}, values };
            const url = `/data/${formId}/${currentWidgetId}`;

            try {
                await api.post(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 404 && String(detail).includes("Insert query not found")) {
                    alert("Для саб-формы не настроен INSERT QUERY. Задайте его и повторите.");
                    return;
                }
                if (status === 404) {
                    await api.post(`${url}/`, body);
                } else {
                    throw err;
                }
            }

            // перезагрузим активную вкладку
            if (currentOrder != null) {
                handleTabClick(currentOrder);
            }

            setIsAdding(false);
            setDraft({});
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(`Не удалось добавить строку в саб-виджет: ${status ?? ""} ${
                typeof msg === "string" ? msg : JSON.stringify(msg)
            }`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            {hasTabs && (
                <ul className={s.tabs}>
                    {subDisplay!.sub_widgets.map((sw) => {
                        const isActive =
                            sw.widget_order === subDisplay!.displayed_widget.widget_order;
                        return (
                            <li key={sw.widget_order}>
                                <button
                                    className={isActive ? s.tabActive : s.tab}
                                    onClick={() => handleTabClick(sw.widget_order)}
                                >
                                    {sw.name}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {/* панель действий */}
            <div style={{ display: "flex", gap: 10, margin: "8px 0" }}>
                {!isAdding ? (
                    <button
                        onClick={startAdd}
                        disabled={!formId || !currentWidgetId || subLoading}
                        title={!formId || !currentWidgetId ? "Нет formId или sub_widget_id" : "Добавить строку"}
                    >
                        Добавить ---
                    </button>
                ) : (
                    <>
                        <button onClick={submitAdd} disabled={saving}>
                            {saving ? "Сохранение…" : "Сохранить"}
                        </button>
                        <button onClick={cancelAdd} disabled={saving}>
                            Отменить
                        </button>
                    </>
                )}
            </div>

            {!subDisplay ? null : subLoading ? (
                <p>Загрузка sub-виджета…</p>
            ) : subError ? (
                <p className={s.error}>{subError}</p>
            ) : (
                <table className={s.tbl}>
                    <thead>
                    <tr>
                        {headerPlan.map((g) => (
                            <th key={`sub-g-top-${g.id}`} colSpan={g.cols.length || 1}>
                                {g.title}
                            </th>
                        ))}
                    </tr>
                    <tr>
                        {headerPlan.map((g) =>
                            g.labels.slice(0, g.cols.length).map((label, idx) => (
                                <th key={`sub-g-sub-${g.id}-${idx}`}>{label}</th>
                            ))
                        )}
                    </tr>
                    </thead>

                    <tbody>
                    {/* инлайн-строка ввода */}
                    {isAdding && (
                        <tr>
                            {flatColumnsInRenderOrder.map((col) => (
                                <td key={`sub-add-wc${col.widget_column_id}-tc${col.table_column_id}`}>
                                    <input
                                        value={draft[col.table_column_id] ?? ""}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            setDraft((prev) => ({ ...prev, [col.table_column_id]: v }));
                                        }}
                                        placeholder={col.placeholder ?? col.column_name}
                                    />
                                </td>
                            ))}
                        </tr>
                    )}

                    {subDisplay.data.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                            {flatColumnsInRenderOrder.map((col) => {
                                const key = `${col.widget_column_id}:${col.table_column_id ?? -1}`;
                                const idx = valueIndexByKey.get(key);
                                const val = idx != null ? row.values[idx] : "";
                                return (
                                    <td key={`sub-r${rowIdx}-wc${col.widget_column_id}-tc${col.table_column_id}`}>
                                        {val}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};
