// src/components/Form/mainTable/hook/useTableMeta.ts
// Загружает метаданные таблицы (tableId + query флаги) один раз при смене формы

import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { Widget, DTable } from '@/shared/hooks/useWorkSpaces';

export type TableMetaCache = {
    tableId: number;
    hasInsertQuery: boolean;
    hasUpdateQuery: boolean;
    hasDeleteQuery: boolean;
} | null;

type UseTableMetaArgs = {
    selectedWidget: Widget | null;
    selectedFormId: number | null;
    /** main_widget_id из formDisplay (если есть) */
    mainWidgetId?: number | null;
};

type UseTableMetaResult = {
    tableMetaCache: TableMetaCache;
    tableMetaLoading: boolean;
    tableMetaError: string | null;
    /** Принудительно перезагрузить метаданные */
    reloadTableMeta: () => void;
};

export function useTableMeta({
                                 selectedWidget,
                                 selectedFormId,
                                 mainWidgetId,
                             }: UseTableMetaArgs): UseTableMetaResult {
    const [tableMetaCache, setTableMetaCache] = useState<TableMetaCache>(null);
    const [tableMetaLoading, setTableMetaLoading] = useState(false);
    const [tableMetaError, setTableMetaError] = useState<string | null>(null);
    const [reloadTrigger, setReloadTrigger] = useState(0);

    const reloadTableMeta = () => setReloadTrigger((v) => v + 1);

    useEffect(() => {
        // Сбрасываем при смене формы
        setTableMetaCache(null);
        setTableMetaError(null);

        // Определяем widgetId
        const widgetId = selectedWidget?.id ?? mainWidgetId ?? null;

        if (!widgetId) {
            return;
        }

        let cancelled = false;

        const loadMeta = async () => {
            setTableMetaLoading(true);
            setTableMetaError(null);

            try {
                // 1. Получаем tableId из виджета (или берём из selectedWidget если есть)
                let tableId: number | null = (selectedWidget as any)?.table_id ?? null;

                if (!tableId) {
                    const { data: widgetMeta } = await api.get<{ id: number; table_id: number }>(
                        `/widgets/${widgetId}`
                    );
                    tableId = widgetMeta?.table_id ?? null;
                }

                if (cancelled) return;

                if (!tableId) {
                    setTableMetaError('Не удалось определить tableId');
                    return;
                }

                // 2. Получаем метаданные таблицы
                const { data: table } = await api.get<DTable>(`/tables/${tableId}`);

                if (cancelled) return;

                // 3. Сохраняем в кэш
                setTableMetaCache({
                    tableId,
                    hasInsertQuery: !!(table?.insert_query?.trim()),
                    hasUpdateQuery: !!(table?.update_query?.trim()),
                    hasDeleteQuery: !!(table?.delete_query?.trim()),
                });

            } catch (e: any) {
                if (cancelled) return;
                console.warn('[useTableMeta] Failed to load:', e);
                setTableMetaError(e?.message ?? 'Ошибка загрузки метаданных');
            } finally {
                if (!cancelled) {
                    setTableMetaLoading(false);
                }
            }
        };

        loadMeta();

        return () => {
            cancelled = true;
        };
    }, [selectedFormId, selectedWidget?.id, mainWidgetId, reloadTrigger]);

    return {
        tableMetaCache,
        tableMetaLoading,
        tableMetaError,
        reloadTableMeta,
    };
}