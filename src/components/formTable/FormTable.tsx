import React, {useState} from 'react';
import * as s from "@/components/tableColumn/TableColumn.module.scss";
import {FormDisplay, SubDisplay, } from "@/shared/hooks/useWorkSpaces";


type FormTableProps = {
    formDisplay: FormDisplay | null;
    loadSubDisplay: (
        formId: number,
        subOrder: number,
        primary: Record<string, unknown>
    ) => void;

    formsByWidget:any
    selectedWidget:any
    subDisplay: SubDisplay | null;
    subLoading: boolean;
    subError: string | null;

}

export const FormTable = ({
                              formDisplay, selectedWidget,
                              subDisplay, subLoading, subError,
                              formsByWidget, loadSubDisplay
                          }: FormTableProps) => {
    /* id выбранной строки: сериализуем primary_keys */
    const [activePk, setActivePk] = useState<string>('');

    return (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <table className={s.tbl}>
                <thead>
                <tr>{formDisplay.columns.map(c => <th key={c.column_name}>{c.column_name}</th>)}</tr>
                </thead>

                <tbody>
                {formDisplay.data.map((row,i) => {
                    const pkStr = JSON.stringify(row.primary_keys);   // стабильный идентификатор

                    return (
                        <tr
                            key={i}
                            className={pkStr === activePk ? s.selectedRow : undefined}
                            onClick={() => {
                                const widgetForm = formsByWidget[selectedWidget!.id];
                                if (!widgetForm) return;

                                const order = widgetForm.sub_widgets[0]?.widget_order ?? 0;
                                /* API ждёт строки */
                                const pkObj = Object.fromEntries(
                                    Object.entries(row.primary_keys).map(([k,v]) => [k, String(v)])
                                );

                                /* выделяем строку */
                                setActivePk(pkStr);

                                /* грузим sub-таблицу */
                                loadSubDisplay(widgetForm.form_id, order, pkObj);
                            }}
                        >
                            {row.values.map((v,j) => <td key={j}>{v}</td>)}
                        </tr>
                    );
                })}
                </tbody>
            </table>

            {/* sub-таблица */}
            {subDisplay && (
                subLoading ? <p>Загрузка sub-виджета…</p>
                    : subError  ? <p className={s.error}>{subError}</p>
                        : (
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