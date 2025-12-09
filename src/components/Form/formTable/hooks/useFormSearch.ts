// src/components/Form/hooks/useFormSearch.ts
import {useEffect, useMemo, useState} from 'react';
import type {FormDisplay} from '@/shared/hooks/useWorkSpaces';
import {useDebounced} from '@/shared/hooks/useDebounced';
import {useFuzzyRows} from '@/shared/hooks/useFuzzySearch';

type Options = {
    threshold?: number;
    distance?: number;
    debounceMs?: number;
};

export function useFormSearch(
    formDisplay: FormDisplay,
    flatColumnsInRenderOrder: FormDisplay['columns'],
    valueIndexByKey: Map<string, number>,
    searchBarEnabled: boolean | undefined | null,
    opts: Options = {}
) {
    const {
        threshold = 0.35,
        distance = 120,
        debounceMs = 250,
    } = opts;

    const [q, setQ] = useState('');
    const dq = useDebounced(q, debounceMs);

    const {filtered} = useFuzzyRows(
        formDisplay,
        flatColumnsInRenderOrder,
        valueIndexByKey,
        dq,
        {threshold, distance}
    );

    // если поиск выключён конфигом формы — очищаем строку
    useEffect(() => {
        if (!searchBarEnabled && q) setQ('');
    }, [searchBarEnabled, q]);

    const filteredRows = useMemo(() => filtered, [filtered]);

    return {
        showSearch: !!searchBarEnabled,
        q,
        setQ,
        filteredRows,
    };
}
