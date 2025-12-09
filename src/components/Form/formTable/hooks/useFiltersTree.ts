import {useCallback, useEffect, useState} from 'react';
import {api} from '@/services/api';
import type {FormDisplay, FormTreeColumn} from '@/shared/hooks/useWorkSpaces';

export function useFiltersTree(
    selectedFormId: number | null,
    setFormDisplay: (v: FormDisplay) => void,
) {
    const [activeFilters, setActiveFilters] = useState<Array<{ table_column_id: number; value: string | number }>>([]);
    const [nestedTrees, setNestedTrees] = useState<Record<string, FormTreeColumn[]>>({});
    const [activeExpandedKey, setActiveExpandedKey] = useState<string | null>(null);

    useEffect(() => {
        // сброс при смене формы
        setActiveFilters([]);
        setNestedTrees({});
        setActiveExpandedKey(null);
    }, [selectedFormId]);

    const resetFiltersHard = useCallback(async () => {
        if (!selectedFormId) return;
        const {data} = await api.post<FormDisplay>(`/display/${selectedFormId}/main`, []);
        setFormDisplay(data);
        setNestedTrees({});
        setActiveExpandedKey(null);
        setActiveFilters([]);
    }, [selectedFormId, setFormDisplay]);

    return {
        activeFilters, setActiveFilters,
        nestedTrees, setNestedTrees,
        activeExpandedKey, setActiveExpandedKey,
        resetFiltersHard,
    };
}
