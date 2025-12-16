// src/components/Form/subForm/hook/useSubCrud.ts

import { useCallback, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { SubDisplay } from '@/shared/hooks/useWorkSpaces';

export type UseSubCrudDeps = {
    formIdForSub: number | null;
    currentWidgetId?: number;
    currentOrder: number | null;
    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;
    lastPrimary: Record<string, unknown>;
    subDisplay: SubDisplay | null;
};

export type UseSubCrudResult = {
    isAddingSub: boolean;
    setIsAddingSub: (v: boolean) => void;
    draftSub: Record<number, string>;
    setDraftSub: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    savingSub: boolean;

    startAddSub: () => Promise<void>;
    cancelAddSub: () => void;
    submitAddSub: () => Promise<void>;

    subEditableTcIds: number[];
};

// ═══════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════

/** Проверка: это синтетический ID от combobox? */
const isSyntheticComboboxId = (tcId: number): boolean => {
    return tcId < -1_000_000 + 1; // т.е. tcId <= -1_000_000
};

/** Получить реальный write_tc_id для колонки */
const getWriteTcId = (col: any): number | null => {
    // Для combobox используем __write_tc_id или ищем реальный table_column_id
    if (col.type === 'combobox') {
        return col.__write_tc_id ?? null;
    }
    return col.table_column_id ?? null;
};

export function useSubCrud({
                               formIdForSub,
                               currentWidgetId,
                               currentOrder,
                               loadSubDisplay,
                               lastPrimary,
                               subDisplay,
                           }: UseSubCrudDeps): UseSubCrudResult {
    const [isAddingSub, setIsAddingSub] = useState(false);
    const [draftSub, setDraftSub] = useState<Record<number, string>>({});
    const [savingSub, setSavingSub] = useState(false);

    // ═══════════════════════════════════════════════════════════
    // COMPUTED: колонки для редактирования
    // ═══════════════════════════════════════════════════════════

    const subColumnsById = useMemo(() => {
        const map = new Map<number, SubDisplay['columns'][number]>();
        const cols = subDisplay?.columns ?? [];
        for (const c of cols) {
            if (c.table_column_id != null) {
                map.set(c.table_column_id as number, c);
            }
        }
        return map;
    }, [subDisplay?.columns]);

    // Редактируемые table_column_id (только реальные, не синтетические)
    const subEditableTcIds = useMemo(() => {
        const cols = subDisplay?.columns ?? [];
        const ids: number[] = [];
        const seen = new Set<number>();

        for (const c of cols) {
            const col = c as any;

            // Пропускаем primary, increment, readonly
            if (col.primary || col.increment || col.readonly) continue;

            // Определяем реальный ID для записи
            let writeTcId: number | null = null;

            if (col.type === 'combobox') {
                // Для combobox берём __write_tc_id или реальный table_column_id
                writeTcId = col.__write_tc_id ?? col.table_column_id ?? null;

                // Если это синтетический ID — пропускаем
                if (writeTcId != null && isSyntheticComboboxId(writeTcId)) {
                    // Попробуем найти реальный ID
                    writeTcId = col.__write_tc_id ?? null;
                }
            } else {
                writeTcId = col.table_column_id ?? null;
            }

            // Добавляем только реальные, уникальные ID
            if (writeTcId != null && !isSyntheticComboboxId(writeTcId) && !seen.has(writeTcId)) {
                seen.add(writeTcId);
                ids.push(writeTcId);
            }
        }

        return ids;
    }, [subDisplay?.columns]);

    // ═══════════════════════════════════════════════════════════
    // PREFLIGHT
    // ═══════════════════════════════════════════════════════════

    const preflightInsertSub = useCallback(async (): Promise<{ ok: boolean }> => {
        if (!currentWidgetId) return { ok: false };
        try {
            const { data: widget } = await api.get(`/widgets/${currentWidgetId}`);
            const { data: table } = await api.get(`/tables/${widget.table_id}`);
            if (!table?.insert_query?.trim()) {
                alert('Для таблицы саб-виджета не настроен INSERT QUERY. Задайте его в метаданных таблицы.');
                return { ok: false };
            }
        } catch (e) {
            console.warn('preflight (sub/insert) failed:', e);
        }
        return { ok: true };
    }, [currentWidgetId]);

    // ═══════════════════════════════════════════════════════════
    // START ADD
    // ═══════════════════════════════════════════════════════════

    const startAddSub = useCallback(async () => {
        if (!formIdForSub || !currentWidgetId) return;

        if (!lastPrimary || Object.keys(lastPrimary).length === 0) {
            alert('Сначала выберите строку в основной таблице, чтобы добавить связанную запись в саб-таблицу.');
            return;
        }

        const pf = await preflightInsertSub();
        if (!pf.ok) return;

        // Инициализируем draft только реальными ID
        const init: Record<number, string> = {};
        subEditableTcIds.forEach((tcId) => {
            init[tcId] = '';
        });

        setDraftSub(init);
        setIsAddingSub(true);
    }, [formIdForSub, currentWidgetId, lastPrimary, preflightInsertSub, subEditableTcIds]);

    // ═══════════════════════════════════════════════════════════
    // CANCEL ADD
    // ═══════════════════════════════════════════════════════════

    const cancelAddSub = useCallback(() => {
        setIsAddingSub(false);
        setDraftSub({});
    }, []);

    // ═══════════════════════════════════════════════════════════
    // SUBMIT ADD
    // ═══════════════════════════════════════════════════════════

    const submitAddSub = useCallback(async () => {
        if (!formIdForSub || !currentWidgetId) return;

        if (!lastPrimary || Object.keys(lastPrimary).length === 0) {
            alert('Сначала выберите строку в основной таблице.');
            return;
        }

        const pf = await preflightInsertSub();
        if (!pf.ok) return;

        setSavingSub(true);
        try {
            // Фильтруем только реальные table_column_id (не синтетические)
            const values = Object.entries(draftSub)
                .filter(([tcIdStr]) => {
                    const tcId = Number(tcIdStr);
                    // Пропускаем синтетические ID от combobox
                    return !isSyntheticComboboxId(tcId);
                })
                .map(([tcIdStr, value]) => {
                    const tcId = Number(tcIdStr);
                    const col = subColumnsById.get(tcId);

                    const isCheckbox =
                        (col as any)?.type === 'checkbox' ||
                        (col as any)?.type === 'bool';

                    const s = value == null ? '' : String(value).trim();

                    let final: string | null;
                    if (isCheckbox) {
                        final = s === '' ? 'false' : s;
                    } else {
                        final = s === '' ? null : s;
                    }

                    return {
                        table_column_id: tcId,
                        value: final,
                    };
                });

            const body = {
                pk: {
                    primary_keys: Object.fromEntries(
                        Object.entries(lastPrimary).map(([k, v]) => [k, String(v)])
                    ),
                },
                values,
            };

            console.debug('[useSubCrud] submitAddSub → body:', body);

            const url = `/data/${formIdForSub}/${currentWidgetId}`;
            try {
                await api.post(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 403) {
                    console.warn('[submitAddSub] 403 Forbidden', { url, body, detail });
                    alert('У вас не хватает прав на добавление новой записи');
                    return;
                }

                if (status === 404 && String(detail).includes('Insert query not found')) {
                    alert('Для саб-формы не настроен INSERT QUERY. Задайте его и повторите.');
                    return;
                }
                if (status === 404) {
                    await api.post(`${url}/`, body);
                } else {
                    throw err;
                }
            }

            // Перезагрузить текущий саб-виджет
            if (currentOrder != null) {
                loadSubDisplay(formIdForSub, currentOrder, lastPrimary);
            }
            setIsAddingSub(false);
            setDraftSub({});
        } finally {
            setSavingSub(false);
        }
    }, [
        formIdForSub,
        currentWidgetId,
        lastPrimary,
        draftSub,
        currentOrder,
        preflightInsertSub,
        loadSubDisplay,
        subColumnsById,
    ]);

    return {
        isAddingSub,
        setIsAddingSub,
        draftSub,
        setDraftSub,
        savingSub,
        startAddSub,
        cancelAddSub,
        submitAddSub,
        subEditableTcIds,
    };
}