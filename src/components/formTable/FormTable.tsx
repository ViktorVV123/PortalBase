import React, {useEffect, useState, useCallback} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import FilterOffIcon from '@/assets/image/FilterOffIcon.svg';
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
    loadFilteredFormDisplay: (formId: number, filter: { table_column_id: number; value: string | number }) => Promise<void>;
    setFormDisplay:any
    setSubDisplay:any

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
                                               loadFilteredFormDisplay,setFormDisplay,
                                               setSubDisplay

                                           }) => {
    const [lastPrimary, setLastPrimary] = useState<Record<string, unknown>>({});
    const [activeSubOrder, setActiveSubOrder] = useState<number>(0);
    const [activeFilters, setActiveFilters] = useState<
        { table_column_id: number; value: string | number }[]
    >([]);
    const [nestedTrees, setNestedTrees] = useState<Record<string, FormTreeColumn[]>>({});
    const [activeExpandedKey, setActiveExpandedKey] = useState<string | null>(null);


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
    const handleResetFilters = async () => {
        if (!selectedFormId || !selectedWidget) return;

        setActiveFilters([]);

        try {
            // 1. main таблица
            const { data: mainData } = await api.post<FormDisplay>(
                `/display/${selectedFormId}/main`,
                []
            );
            setFormDisplay(mainData);

            // 2. sabDisplay — без primary_keys
            const widgetForm = formsByWidget[selectedWidget.id];
            const subOrder = widgetForm?.sub_widgets[0]?.widget_order ?? 0;

            const { data: subData } = await api.post<SubDisplay>(
                `/display/${selectedFormId}/sub`,
                { primary_keys: {} },                         // сброс pk
                { params: { sub_widget_order: subOrder } }
            );
            setSubDisplay(subData);

            // 3. сброс активного саб-ордера
            setActiveSubOrder(subOrder);

            console.log('✅ Сброс фильтров + сабтаблицы выполнен');
        } catch (e) {
            console.warn('❌ Ошибка при полном сбросе:', e);
        }
    };


    const tree = selectedFormId ? formTrees[selectedFormId] : null;
    const widgetForm = selectedWidget ? formsByWidget[selectedWidget.id] : null;

    const handleTreeValueClick = async (
        table_column_id: number,
        value: string | number
    ) => {
        if (!selectedFormId) return;

        const filters = [{ table_column_id, value }];

        console.log('[TREE CLICK] → POST /main + /tree', {
            formId: selectedFormId,
            payload: filters
        });

        try {
            // Обновить main таблицу
            const { data: mainData } = await api.post<FormDisplay>(
                `/display/${selectedFormId}/main`,
                filters
            );
            setFormDisplay(mainData);

            // Обновить фильтры
            setActiveFilters(filters);

            // Загрузить вложенное дерево
            const { data } = await api.post<FormTreeColumn[] | FormTreeColumn>(
                `/display/${selectedFormId}/tree`,
                filters
            );
            const normalized = Array.isArray(data) ? data : [data];

            const key = `${table_column_id}-${value}`;
            setNestedTrees(prev => ({ ...prev, [key]: normalized }));
            setActiveExpandedKey(key);
        } catch (e) {
            console.warn('❌ Ошибка handleTreeValueClick:', e);
        }
    };



    const handleNestedValueClick = async (
        table_column_id: number,
        value: string | number
    ) => {
        if (!selectedFormId) return;

        const newFilter = { table_column_id, value };

        // Удаляем старые фильтры по этому же столбцу
        const filters = [
            ...activeFilters.filter(f => f.table_column_id !== table_column_id),
            newFilter
        ];

        try {
            setActiveFilters(filters);
            console.log('📤 [POST /main] sending nested filters:', filters);

            const { data } = await api.post<FormDisplay>(
                `/display/${selectedFormId}/main`,
                filters
            );
            setFormDisplay(data);
        } catch (e) {
            console.warn('❌ Ошибка nested фильтра:', e);
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
                                <table className={s.tblTree}>
                                    <thead>
                                    <tr><th>{name}</th></tr>
                                    <tr>
                                        <td onClick={handleResetFilters} style={{ textAlign: 'center' }}>
                                            <FilterOffIcon width={16} height={16} cursor={'pointer'} />
                                        </td>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {values.map((v, i) => {
                                        const key = `${columnId}-${v}`;
                                        const isExpanded = key === activeExpandedKey;

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

                                                {isExpanded && nestedTrees[key]?.map(({ name, values, table_column_id }, j) =>
                                                    values.map((val, k) => (
                                                        <tr key={`nested-${i}-${j}-${k}`}>
                                                            <td
                                                                style={{ paddingLeft: 20, cursor: 'pointer' }}
                                                                onClick={() => handleNestedValueClick(table_column_id, val)}
                                                            >
                                                                <strong>{name}:</strong> {val}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
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
        </div>
    );
};
