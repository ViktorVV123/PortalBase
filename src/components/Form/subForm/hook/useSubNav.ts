// src/components/Form/subForm/hook/useSubNav.ts

import { useCallback, useEffect, useState } from 'react';
import type { FormDisplay } from '@/shared/hooks/useWorkSpaces';

type RowView = { row: FormDisplay['data'][number]; idx: number };

type UseSubNavArgs = {
    formIdForSub: number | null;
    availableOrders: number[];
    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;
};

export function useSubNav({ formIdForSub, availableOrders, loadSubDisplay }: UseSubNavArgs) {
    const [lastPrimary, setLastPrimary] = useState<Record<string, unknown>>({});
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [activeSubOrder, setActiveSubOrder] = useState<number>(availableOrders[0] ?? 0);

    // ═══════════════════════════════════════════════════════════
    // СБРОС ПРИ СМЕНЕ ФОРМЫ
    // ═══════════════════════════════════════════════════════════

    useEffect(() => {
        // При смене формы сбрасываем выбор
        setLastPrimary({});
        setSelectedKey(null);
        setActiveSubOrder(availableOrders[0] ?? 0);
    }, [formIdForSub]); // Сброс при смене formId

    // Обновляем activeSubOrder если availableOrders изменились
    useEffect(() => {
        if (!availableOrders.includes(activeSubOrder)) {
            setActiveSubOrder(availableOrders[0] ?? 0);
        }
    }, [availableOrders, activeSubOrder]);

    const pkToKey = useCallback(
        (pk: Record<string, unknown>) =>
            Object.keys(pk)
                .sort()
                .map((k) => `${k}:${String(pk[k])}`)
                .join('|'),
        [],
    );

    const handleRowClick = useCallback(
        (view: RowView) => {
            const primary = view.row.primary_keys as Record<string, unknown>;
            if (!primary) return;

            setLastPrimary(primary);
            setSelectedKey(pkToKey(primary));

            const fid = formIdForSub;
            const order = activeSubOrder || availableOrders[0];

            if (fid && order != null) {
                loadSubDisplay(fid, order, primary);
            }
        },
        [formIdForSub, activeSubOrder, availableOrders, pkToKey, loadSubDisplay],
    );

    const handleTabClick = useCallback(
        (order: number) => {
            setActiveSubOrder(order);
            const fid = formIdForSub;

            // Загружаем только если есть выбранная строка
            if (fid && Object.keys(lastPrimary).length > 0) {
                loadSubDisplay(fid, order, lastPrimary);
            }
        },
        [formIdForSub, lastPrimary, loadSubDisplay],
    );

    return {
        lastPrimary,
        setLastPrimary,
        selectedKey,
        setSelectedKey,
        activeSubOrder,
        setActiveSubOrder,
        pkToKey,
        handleRowClick,
        handleTabClick,
    };
}