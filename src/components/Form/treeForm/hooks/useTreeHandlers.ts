import { useCallback } from 'react';
import { api } from '@/services/api';
import type { FormDisplay, FormTreeColumn } from '@/shared/hooks/useWorkSpaces';

type Filter = { table_column_id: number; value: string | number };

type Deps = {
    selectedFormId: number | null;
    // состояние фильтров/дерева
    activeFilters: Filter[];
    setActiveFilters: React.Dispatch<React.SetStateAction<Filter[]>>;
    setNestedTrees: React.Dispatch<React.SetStateAction<Record<string, FormTreeColumn[]>>>;
    setActiveExpandedKey: React.Dispatch<React.SetStateAction<string | null>>;

    // синхронизация основного отображения
    setFormDisplay: (v: FormDisplay) => void;
    setSubDisplay: (v: any) => void; // SubDisplay | null — чтобы не тянуть тип сюда
};

const toApiFilters = (filters: Filter[]) =>
    filters.map((f) => ({
        ...f,
        value: String(f.value),
    }));

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

            const newFilter: Filter = { table_column_id, value };
            const filters: Filter[] = [
                ...activeFilters.filter((f) => f.table_column_id !== table_column_id),
                newFilter,
            ];

            try {
                const { data } = await api.post<FormDisplay>(
                    `/display/${selectedFormId}/main`,
                    toApiFilters(filters),
                );
                setFormDisplay(data);
                setActiveFilters(filters);
                setSubDisplay(null);
            } catch (e) {
                console.warn('❌ Ошибка nested фильтра:', e);
            }
        },
        [selectedFormId, activeFilters, setFormDisplay, setActiveFilters, setSubDisplay],
    );

    // клик по значению в древе (верхний уровень): ставим единственный фильтр и догружаем поддерево
    const handleTreeValueClick = useCallback(
        async (table_column_id: number, value: string | number) => {
            if (!selectedFormId) return;

            const filters: Filter[] = [{ table_column_id, value }];
            const apiFilters = toApiFilters(filters);

            try {
                // 1) обновляем основной main
                const { data: mainData } = await api.post<FormDisplay>(
                    `/display/${selectedFormId}/main`,
                    apiFilters,
                );
                setFormDisplay(mainData);
                setActiveFilters(filters);
                setSubDisplay(null);

                // 2) поддерево (nested)
                const { data } = await api.post<FormTreeColumn[] | FormTreeColumn>(
                    `/display/${selectedFormId}/tree`,
                    apiFilters,
                );
                const normalized = Array.isArray(data) ? data : [data];

                // ключ оставляем на "сыром" value, чтобы совпадало с TreeFormTable (там тоже `${columnId}-${v}`)
                const key = `${table_column_id}-${value}`;
                setNestedTrees((prev) => ({ ...prev, [key]: normalized }));
                setActiveExpandedKey(key);
            } catch (e) {
                console.warn('❌ Ошибка handleTreeValueClick:', e);
            }
        },
        [selectedFormId, setFormDisplay, setActiveFilters, setSubDisplay, setNestedTrees, setActiveExpandedKey],
    );

    return { handleNestedValueClick, handleTreeValueClick };
}
