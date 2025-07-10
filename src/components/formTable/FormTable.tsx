import React, {useEffect, useState} from 'react';
import * as s from '@/components/tableColumn/TableColumn.module.scss';
import {FormDisplay, SubDisplay, WidgetForm} from '@/shared/hooks/useWorkSpaces';

type Props = {
    formDisplay: FormDisplay;                     // ← nullable больше не нужен
    loadSubDisplay: (
        formId: number,
        subOrder: number,
        primary?: Record<string, unknown>,          // primary опционален
    ) => void;

    formsByWidget   : Record<number, WidgetForm>;
    selectedWidget  : any;

    subDisplay: SubDisplay | null;
    subLoading: boolean;
    subError  : string | null;
};

export const FormTable: React.FC<Props> = ({
                                               formDisplay, selectedWidget,
                                               subDisplay, subLoading, subError,
                                               formsByWidget, loadSubDisplay,
                                           }) => {

    /* ───────── 1. первый запрос: без фильтра ───────── */
    useEffect(() => {
        if (!selectedWidget) return;

        const widgetForm = formsByWidget[selectedWidget.id];
        if (!widgetForm) return;

        const order = widgetForm.sub_widgets[0]?.widget_order ?? 0;
        loadSubDisplay(widgetForm.form_id, order, {});     // ⬅️ пустой фильтр
    }, [selectedWidget, formsByWidget, loadSubDisplay]);

    /* ───────── 2. активная строка ───────── */
    const [activePk, setActivePk] = useState<string>('');

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
            {/* ——— MAIN GRID ——— */}
            <table className={s.tbl}>
                <thead>
                <tr>{formDisplay.columns.map(c => <th key={c.column_name}>{c.column_name}</th>)}</tr>
                </thead>

                <tbody>
                {formDisplay.data.map((row, i) => {
                    const pkStr = JSON.stringify(row.primary_keys);

                    return (
                        <tr
                            key={i}
                            className={pkStr === activePk ? s.selectedRow : undefined}
                            onClick={() => {
                                const widgetForm = formsByWidget[selectedWidget!.id];
                                if (!widgetForm) return;

                                const order = widgetForm.sub_widgets[0]?.widget_order ?? 0;
                                const pkObj = Object.fromEntries(
                                    Object.entries(row.primary_keys)
                                        .map(([k, v]) => [k, String(v)]),
                                );

                                setActivePk(pkStr);
                                loadSubDisplay(widgetForm.form_id, order, pkObj);  // ⬅️ фильтр
                            }}
                        >
                            {row.values.map((v, j) => <td key={j}>{v}</td>)}
                        </tr>
                    );
                })}
                </tbody>
            </table>

            {/* ——— SUB GRID ——— */}
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
