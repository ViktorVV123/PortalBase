import {useCallback} from 'react';
import {api} from '@/services/api';
import type {FormDisplay, FormTreeColumn} from '@/shared/hooks/useWorkSpaces';

type Deps = {
    selectedFormId: number | null;

    // состояние фильтров/дерева
    activeFilters: { table_column_id: number; value: string | number }[];
    setActiveFilters: React.Dispatch<React.SetStateAction<Deps['activeFilters']>>;
    setNestedTrees: React.Dispatch<React.SetStateAction<Record<string, FormTreeColumn[]>>>;
    setActiveExpandedKey: React.Dispatch<React.SetStateAction<string | null>>;

    // синхронизация основного отображения
    setFormDisplay: (v: FormDisplay) => void;
    setSubDisplay: (v: any) => void; // SubDisplay | null — чтобы не тянуть тип сюда
};

export function useTreeHandlers({
                                    selectedFormId,
                                    activeFilters,
                                    setActiveFilters,
                                    setNestedTrees,
                                    setActiveExpandedKey,
                                    setFormDisplay,
                                    setSubDisplay,
                                }: Deps) {
    // клик по nested-значению: добавляем/заменяем фильтр по конкретному table_column_id
    const handleNestedValueClick = useCallback(
        async (table_column_id: number, value: string | number) => {
            if (!selectedFormId) return;

            const newFilter = { table_column_id, value };
            const filters = [
                ...activeFilters.filter(f => f.table_column_id !== table_column_id),
                newFilter,
            ];

            try {
                const { data } = await api.post<FormDisplay>(`/display/${selectedFormId}/main`, filters);
                setFormDisplay(data);
                setActiveFilters(filters);
                setSubDisplay(null);
            } catch (e) {
                console.warn('❌ Ошибка nested фильтра:', e);
            }
        },
        [selectedFormId, activeFilters, setFormDisplay, setActiveFilters, setSubDisplay]
    );

    // клик по значению в древе (верхний уровень): ставим единственный фильтр и догружаем поддерево
    const handleTreeValueClick = useCallback(
        async (table_column_id: number, value: string | number) => {
            if (!selectedFormId) return;

            const filters = [{ table_column_id, value }];

            try {
                // 1) обновляем основной main
                const { data: mainData } = await api.post<FormDisplay>(`/display/${selectedFormId}/main`, filters);
                setFormDisplay(mainData);
                setActiveFilters(filters);
                setSubDisplay(null);

                // 2) поддерево (nested)
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
        },
        [selectedFormId, setFormDisplay, setActiveFilters, setSubDisplay, setNestedTrees, setActiveExpandedKey]
    );

    return { handleNestedValueClick, handleTreeValueClick };
}
