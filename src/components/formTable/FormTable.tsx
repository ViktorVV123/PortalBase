import React, {useEffect, useState, useCallback} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {
    FormDisplay,
    SubDisplay,
    WidgetForm,
    FormTreeColumn
} from '@/shared/hooks/useWorkSpaces';
import {api} from "@/services/api";

type Props = {
    formDisplay: FormDisplay;
    loadSubDisplay: (
        formId: number,
        subOrder: number,
        primary?: Record<string, unknown>,
    ) => void;
    formsByWidget: Record<number, WidgetForm>;
    selectedWidget: any;
    selectedFormId: number | null;
    subDisplay: SubDisplay | null;
    subLoading: boolean;
    subError: string | null;
    formTrees: Record<number, FormTreeColumn[]>;
    loadFilteredFormDisplay:any
};

export const FormTable: React.FC<Props> = ({
                                               formDisplay,
                                               selectedWidget,
                                               selectedFormId,
                                               subDisplay,
                                               subLoading,
                                               subError,
                                               formsByWidget,
                                               loadSubDisplay,
                                               formTrees,
                                               loadFilteredFormDisplay,
                                           }) => {
    const [lastPrimary, setLastPrimary] = useState<Record<string, unknown>>({});
    const [activeSubOrder, setActiveSubOrder] = useState<number>(0);
    const [expandedTrees, setExpandedTrees] = useState<Record<string, FormTreeColumn[]>>({});



    useEffect(() => {
        if (!selectedWidget) return;

        const widgetForm = formsByWidget[selectedWidget.id];
        if (!widgetForm) return;

        const order0 = widgetForm.sub_widgets[0]?.widget_order ?? 0;

        setActiveSubOrder(order0);
        loadSubDisplay(widgetForm.form_id, order0, {});
    }, [selectedWidget, formsByWidget, loadSubDisplay]);

    const handleRowClick = (rowPk: Record<string, unknown>) => {
        const widgetForm = formsByWidget[selectedWidget!.id];
        if (!widgetForm) return;

        setLastPrimary(rowPk);
        loadSubDisplay(widgetForm.form_id, activeSubOrder, rowPk);
    };

    const handleTabClick = (order: number) => {
        if (order === activeSubOrder) return;
        const widgetForm = formsByWidget[selectedWidget!.id];
        if (!widgetForm) return;

        setActiveSubOrder(order);
        loadSubDisplay(widgetForm.form_id, order, lastPrimary);
    };

    const tree = selectedFormId ? formTrees[selectedFormId] : null;
    const widgetForm = selectedWidget ? formsByWidget[selectedWidget.id] : null;

    const handleTreeValueClick = async (
        table_column_id: number,
        value: string | number
    ) => {
        if (!selectedFormId) return;

        const key = `${table_column_id}-${value}`;

        try {
            // 1. Подгружаем вложенные значения
            const { data } = await api.post<FormTreeColumn[] | FormTreeColumn>(
                `/display/${selectedFormId}/tree`,
                [{ table_column_id, value }]
            );
            const normalized = Array.isArray(data) ? data : [data];
            setExpandedTrees(prev => ({ ...prev, [key]: normalized }));

            // 2. Обновляем main grid
            await loadFilteredFormDisplay(selectedFormId, { table_column_id, value });
        } catch (e) {
            console.warn('Не удалось загрузить вложенные или основные значения:', e);
        }
    };

    return (
        <div style={{display: 'flex', gap: 10}}>
            {/* TREE BLOCK */}
            {tree && tree.length > 0 && (
                <div>
                    {tree.map(({ name, values }, idx) => {
                        const currentTreeField = widgetForm?.tree_fields?.[idx];
                        const columnId = currentTreeField?.table_column_id;

                        return (
                            <div key={`${name}-${idx}`} style={{ marginBottom: 16 }}>
                                <h4>{name}</h4>
                                <table className={s.tblTree}>
                                    <thead>
                                    <tr>
                                        <th>{name}</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {values.map((v, i) => {
                                        const key = `${columnId}-${v}`;
                                        const nestedTree = expandedTrees[key];

                                        return (
                                            <React.Fragment key={i}>
                                                <tr>
                                                    <td
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => columnId != null && handleTreeValueClick(columnId, v)}
                                                    >
                                                        {v}
                                                    </td>
                                                </tr>
                                                {Array.isArray(nestedTree) &&
                                                    nestedTree.map(({ name, values }, j) => (
                                                        <tr key={`nested-${i}-${j}`}>
                                                            <td style={{ paddingLeft: 20 }}>
                                                                <strong>{name}:</strong> {values.join(', ')}
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </React.Fragment>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* MAIN + SUB */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                <table className={s.tbl}>
                    <thead>
                    <tr>{formDisplay.columns.map(c => <th key={c.column_name}>{c.column_name}</th>)}</tr>
                    </thead>
                    <tbody>
                    {formDisplay.data.map((row, i) => {
                        const pkObj = Object.fromEntries(
                            Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
                        );
                        return (
                            <tr key={i} onClick={() => handleRowClick(pkObj)}>
                                {row.values.map((v, j) => <td key={j}>{v}</td>)}
                            </tr>
                        );
                    })}
                    </tbody>
                </table>

                {subDisplay?.sub_widgets.length > 1 && (
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
        </div>
    );
};
