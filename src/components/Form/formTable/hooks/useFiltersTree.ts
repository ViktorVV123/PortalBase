// useFiltersTree.ts — с защитой от setState после unmount и пагинацией
import { useCallback, useEffect, useState, useRef } from 'react';
import { api } from '@/services/api';
import type { FormDisplay, FormTreeColumn } from '@/shared/hooks/useWorkSpaces';
import { MAIN_TABLE_PAGE_SIZE } from '@/shared/hooks/useWorkSpaces';

export function useFiltersTree(
    selectedFormId: number | null,
    setFormDisplay: (v: FormDisplay) => void,
) {
    const [activeFilters, setActiveFilters] = useState<Array<{ table_column_id: number; value: string | number }>>([]);
    const [nestedTrees, setNestedTrees] = useState<Record<string, FormTreeColumn[]>>({});
    const [activeExpandedKey, setActiveExpandedKey] = useState<string | null>(null);

    // ═══════════════════════════════════════════════════════════
    // Защита от setState после unmount
    // ═══════════════════════════════════════════════════════════
    const unmountedRef = useRef(false);

    useEffect(() => {
        unmountedRef.current = false;

        // Сброс при смене формы
        setActiveFilters([]);
        setNestedTrees({});
        setActiveExpandedKey(null);

        return () => {
            unmountedRef.current = true;
        };
    }, [selectedFormId]);

    /**
     * Сброс фильтров с запросом данных С ПАГИНАЦИЕЙ
     * ВАЖНО: используем limit и page для корректной работы infinite scroll
     */
    const resetFiltersHard = useCallback(async () => {
        if (!selectedFormId) return;

        // Проверка перед запросом
        if (unmountedRef.current) return;

        try {
            // ═══════════════════════════════════════════════════════════
            // ИСПРАВЛЕНИЕ: добавляем параметры пагинации
            // ═══════════════════════════════════════════════════════════
            const params = new URLSearchParams({
                limit: String(MAIN_TABLE_PAGE_SIZE),
                page: '1',
            });

            const { data } = await api.post<FormDisplay>(
                `/display/${selectedFormId}/main?${params}`,
                []
            );

            // Проверка после запроса (компонент мог размонтироваться пока ждали ответ)
            if (unmountedRef.current) return;

            setFormDisplay(data);
            setNestedTrees({});
            setActiveExpandedKey(null);
            setActiveFilters([]);
        } catch (e) {
            // Игнорируем ошибки если компонент размонтирован
            if (unmountedRef.current) return;
            console.error('[resetFiltersHard] Failed:', e);
        }
    }, [selectedFormId, setFormDisplay]);

    return {
        activeFilters, setActiveFilters,
        nestedTrees, setNestedTrees,
        activeExpandedKey, setActiveExpandedKey,
        resetFiltersHard,
    };
}
