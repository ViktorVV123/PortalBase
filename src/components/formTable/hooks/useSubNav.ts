// src/components/formTable/hooks/useSubNav.ts
import {useCallback, useState} from 'react';

type UseSubNavDeps = {
    formIdForSub: number | null;
    availableOrders: number[];
    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;
};

export function useSubNav({
                              formIdForSub,
                              availableOrders,
                              loadSubDisplay,
                          }: UseSubNavDeps) {
    const [lastPrimary, setLastPrimary] = useState<Record<string, unknown>>({});
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [activeSubOrder, setActiveSubOrder] = useState<number>(0);

    const pkToKey = useCallback((pk: Record<string, unknown>) =>
            Object.keys(pk).sort().map(k => `${k}:${String(pk[k])}`).join('|')
        , []);

    const handleRowClick = useCallback((rowPk: Record<string, unknown>) => {
        if (!formIdForSub) return;
        setLastPrimary(rowPk);
        setSelectedKey(pkToKey(rowPk));

        // выбираем «текущий» order: активный, если валиден; иначе — первый доступный
        const ord = availableOrders.includes(activeSubOrder)
            ? activeSubOrder
            : (availableOrders[0] ?? 0);

        loadSubDisplay(formIdForSub, ord, rowPk);
    }, [formIdForSub, availableOrders, activeSubOrder, loadSubDisplay, pkToKey]);

    const handleTabClick = useCallback((order: number, force = false) => {
        const next = availableOrders.includes(order) ? order : (availableOrders[0] ?? 0);

        if (next !== activeSubOrder) {
            setActiveSubOrder(next);
        }

        if (!formIdForSub || Object.keys(lastPrimary).length === 0) return;

        if (force || next === activeSubOrder) {
            loadSubDisplay(formIdForSub, next, lastPrimary);
        }
    }, [availableOrders, activeSubOrder, formIdForSub, lastPrimary, loadSubDisplay]);

    return {
        lastPrimary, setLastPrimary,
        selectedKey, setSelectedKey,
        activeSubOrder, setActiveSubOrder,
        pkToKey,
        handleRowClick,
        handleTabClick,
    };
}
