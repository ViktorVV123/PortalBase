import React, {useEffect, useState} from 'react';
import * as s from '@/components/tableColumn/TableColumn.module.scss';
import {FormDisplay, SubDisplay, WidgetForm} from '@/shared/hooks/useWorkSpaces';

type Props = {
    formDisplay: FormDisplay;
    loadSubDisplay: (
        formId: number,
        subOrder: number,
        primary?: Record<string, unknown>,
    ) => void;

    formsByWidget  : Record<number, WidgetForm>;
    selectedWidget : any;

    subDisplay: SubDisplay | null;
    subLoading: boolean;
    subError  : string | null;
};

export const FormTable: React.FC<Props> = ({
                                               formDisplay, selectedWidget,
                                               subDisplay, subLoading, subError,
                                               formsByWidget, loadSubDisplay,
                                           }) => {

    /* — последняя выбранная PK и subOrder — */
    const [lastPrimary,   setLastPrimary]   = useState<Record<string, unknown>>({});
    const [activeSubOrder, setActiveSubOrder] = useState<number>(0);

    /* — первая загрузка sub: без фильтра и order=0 — */
    useEffect(() => {
        if (!selectedWidget) return;

        const widgetForm = formsByWidget[selectedWidget.id];
        if (!widgetForm) return;

        const order0 = widgetForm.sub_widgets[0]?.widget_order ?? 0;

        setActiveSubOrder(order0);
        loadSubDisplay(widgetForm.form_id, order0, {});   // вся таблица
    }, [selectedWidget, formsByWidget, loadSubDisplay]);

    /* — клик по строке main-grid — */
    const handleRowClick = (rowPk: Record<string, unknown>) => {
        const widgetForm = formsByWidget[selectedWidget!.id];
        if (!widgetForm) return;

        setLastPrimary(rowPk);                           // сохраняем фильтр
        loadSubDisplay(widgetForm.form_id, activeSubOrder, rowPk);
    };

    /* — клик по табу sub-виджета — */
    const handleTabClick = (order: number) => {
        if (order === activeSubOrder) return;            // уже открыт
        const widgetForm = formsByWidget[selectedWidget!.id];
        if (!widgetForm) return;

        setActiveSubOrder(order);
        loadSubDisplay(widgetForm.form_id, order, lastPrimary);
    };

    /* ──────────────────────────────────────────────── */
    return (
        <div style={{display:'flex', flexDirection:'column', gap:20}}>

            {/* ——— MAIN GRID ——— */}
            <table className={s.tbl}>
                <thead>
                <tr>{formDisplay.columns.map(c => <th key={c.column_name}>{c.column_name}</th>)}</tr>
                </thead>
                <tbody>
                {formDisplay.data.map((row,i) => {
                    const pkObj = Object.fromEntries(
                        Object.entries(row.primary_keys).map(([k,v]) => [k, String(v)])
                    );
                    return (
                        <tr key={i} onClick={() => handleRowClick(pkObj)}>
                            {row.values.map((v,j) => <td key={j}>{v}</td>)}
                        </tr>
                    );
                })}
                </tbody>
            </table>

            {/* ——— SUB-TABS (если несколько) ——— */}
            {subDisplay?.sub_widgets.length > 1 && (
                <ul className={s.tabs}>
                    {subDisplay.sub_widgets.map(sw => {
                        const isActive =
                            sw.widget_order === subDisplay.displayed_widget.widget_order;

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
                        {subDisplay.data.map((r,i) => (
                            <tr key={i}>{r.values.map((v,j) => <td key={j}>{v}</td>)}</tr>
                        ))}
                        </tbody>
                    </table>
                )
            )}
        </div>
    );
};
