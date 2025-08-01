import React, {useEffect, useState} from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import {
    FormDisplay,
    SubDisplay,
    WidgetForm,
    FormTreeColumn, Widget
} from '@/shared/hooks/useWorkSpaces';
import {api} from "@/services/api";
import {SubWormTable} from "@/components/formTable/SubFormTable";
import {TreeFormTable} from "@/components/formTable/TreeFormTable";

type Props = {
    formDisplay: FormDisplay;
    loadSubDisplay: (
        formId: number,
        subOrder: number,
        primary?: Record<string, unknown>,
    ) => void;
    formsByWidget: Record<number, WidgetForm>;
    selectedWidget: Widget | null;
    selectedFormId: number | null;
    subDisplay: SubDisplay | null;
    subLoading: boolean;
    subError: string | null;
    formTrees: Record<number, FormTreeColumn[]>;
    loadFilteredFormDisplay: (formId: number, filter: {
        table_column_id: number;
        value: string | number
    }) => Promise<void>;
    setFormDisplay: (value: FormDisplay | null) => void;
    setSubDisplay: (value: SubDisplay | null) => void;

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
                                               loadFilteredFormDisplay, setFormDisplay,
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
        setActiveExpandedKey(null)
        try {
            // 1. main таблица
            const {data: mainData} = await api.post<FormDisplay>(
                `/display/${selectedFormId}/main`,
                []
            );
            setFormDisplay(mainData);

            // 2. sabDisplay — без primary_keys
            const widgetForm = formsByWidget[selectedWidget.id];
            const subOrder = widgetForm?.sub_widgets[0]?.widget_order ?? 0;

            const {data: subData} = await api.post<SubDisplay>(
                `/display/${selectedFormId}/sub`,
                {primary_keys: {}},                         // сброс pk
                {params: {sub_widget_order: subOrder}}
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

        const filters = [{table_column_id, value}];

        console.log('[TREE CLICK] → POST /main + /tree', {
            formId: selectedFormId,
            payload: filters
        });

        try {
            // Обновить main таблицу
            const {data: mainData} = await api.post<FormDisplay>(
                `/display/${selectedFormId}/main`,
                filters
            );
            setFormDisplay(mainData);

            // Обновить фильтры
            setActiveFilters(filters);

            // Загрузить вложенное дерево
            const {data} = await api.post<FormTreeColumn[] | FormTreeColumn>(
                `/display/${selectedFormId}/tree`,
                filters
            );
            const normalized = Array.isArray(data) ? data : [data];

            const key = `${table_column_id}-${value}`;
            setNestedTrees(prev => ({...prev, [key]: normalized}));
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

        const newFilter = {table_column_id, value};

        // Удаляем старые фильтры по этому же столбцу
        const filters = [
            ...activeFilters.filter(f => f.table_column_id !== table_column_id),
            newFilter
        ];

        try {
            setActiveFilters(filters);
            console.log('📤 [POST /main] sending nested filters:', filters);

            const {data} = await api.post<FormDisplay>(
                `/display/${selectedFormId}/main`,
                filters
            );
            setFormDisplay(data);
        } catch (e) {
            console.warn('❌ Ошибка nested фильтра:', e);
        }
    };


    const groupedHeaders = formDisplay.columns.reduce((acc, col) => {
        const last = acc[acc.length - 1];
        if (last && last.name === col.column_name) {
            last.count += 1;
        } else {
            acc.push({name: col.column_name, count: 1});
        }
        return acc;
    }, [] as { name: string; count: number }[]);


    return (
        <div style={{display: 'flex', gap: 10}}>
            {/* TREE BLOCK */}
            <TreeFormTable tree={tree} widgetForm={widgetForm} activeExpandedKey={activeExpandedKey}
                           handleNestedValueClick={handleNestedValueClick} nestedTrees={nestedTrees}
                           handleTreeValueClick={handleTreeValueClick} handleResetFilters={handleResetFilters}/>
            {/* MAIN + SUB */}
            <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
                <table className={s.tbl}>
                    <thead>
                    <tr>
                        {groupedHeaders.map((header, idx) => (
                            <th key={`${header.name}-${idx}`} colSpan={header.count}>
                                {header.name}
                            </th>
                        ))}
                    </tr>

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

                <SubWormTable subLoading={subLoading} subError={subError} subDisplay={subDisplay}
                              handleTabClick={handleTabClick}/>
            </div>
        </div>
    );
};
