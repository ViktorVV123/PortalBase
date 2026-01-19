import { useEffect, useMemo, useState } from 'react';
import { api } from '@/services/api';
import type { SubDisplay, DTable, Widget, FormDisplay } from '@/shared/hooks/useWorkSpaces';
import type { HeaderModelItem } from '@/components/Form/formTable/FormTable';
import { isEditableValue } from '@/shared/utils/cellFormat';
import { useHeaderPlan } from '@/components/Form/formTable/hooks/useHeaderPlan';
import { loadComboOptionsOnce } from '@/components/Form/mainTable/InputCell';
import type { ExtCol } from '@/components/Form/formTable/parts/FormatByDatatype';
import { validateEditDraft } from '@/shared/utils/requiredValidation/requiredValidation';

export type UseSubWormTableDeps = {
    subDisplay: SubDisplay | null;
    formId: number | null;
    currentWidgetId?: number;
    currentOrder: number | null;
    subHeaderGroups?: HeaderModelItem[];
    handleTabClick: (order: number) => void;

    setSubDisplay?: React.Dispatch<React.SetStateAction<SubDisplay | null>>;

    editingRowIdx: number | null;
    setEditingRowIdx: React.Dispatch<React.SetStateAction<number | null>>;
    editDraft: Record<number, string>;
    setEditDraft: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    editSaving: boolean;
    setEditSaving: React.Dispatch<React.SetStateAction<boolean>>;

    isAddingSub: boolean;
    setIsAddingSub: React.Dispatch<React.SetStateAction<boolean>>;
    draftSub: Record<number, string>;
    setDraftSub: React.Dispatch<React.SetStateAction<Record<number, string>>>;

    // NEW: Валидация
    showSubValidationErrors?: boolean;
    setShowSubValidationErrors?: React.Dispatch<React.SetStateAction<boolean>>;
    setSubValidationMissingFields?: React.Dispatch<React.SetStateAction<string[]>>;
    resetSubValidation?: () => void;
};

const SYNTHETIC_MIN = -1_000_000;
const isSyntheticComboboxId = (tcId: number): boolean => tcId <= SYNTHETIC_MIN;

export function useSubWormTable({
                                    subDisplay,
                                    formId,
                                    currentWidgetId,
                                    currentOrder,
                                    subHeaderGroups,
                                    handleTabClick,

                                    editingRowIdx,
                                    setEditingRowIdx,
                                    editDraft,
                                    setEditDraft,
                                    editSaving,
                                    setEditSaving,

                                    isAddingSub,
                                    setIsAddingSub,
                                    draftSub,
                                    setDraftSub,

                                    // NEW: Валидация
                                    showSubValidationErrors,
                                    setShowSubValidationErrors,
                                    setSubValidationMissingFields,
                                    resetSubValidation,
                                }: UseSubWormTableDeps) {
    const [deletingRowIdx, setDeletingRowIdx] = useState<number | null>(null);
    const [showSubHeaders, setShowSubHeaders] = useState(false);
    const [tabs, setTabs] = useState<SubDisplay['sub_widgets'] | null>(null);
    const [displayedWidgetOrder, setDisplayedWidgetOrder] = useState<number | null>(null);

    const hasTabs = !!tabs?.length;
    const safe = (v?: string | null) => (v && v.trim() ? v.trim() : '—');

    useEffect(() => {
        if (subDisplay?.sub_widgets?.length) {
            setTabs(subDisplay.sub_widgets);
            setDisplayedWidgetOrder(subDisplay.displayed_widget?.widget_order ?? null);
        }
    }, [subDisplay]);

    // ——— подготовка колонок и шапки через useHeaderPlan ———
    const pseudoFormDisplay = useMemo(() => {
        if (!subDisplay) return null;
        return { columns: subDisplay.columns } as unknown as FormDisplay;
    }, [subDisplay]);

    const { headerPlan: baseHeaderPlan } = useHeaderPlan(pseudoFormDisplay);

    const headerPlan = useMemo(() => {
        if (!baseHeaderPlan) return [];
        if (!subHeaderGroups?.length) return baseHeaderPlan;

        const byId = new Map(baseHeaderPlan.map((g) => [g.id, g]));
        return subHeaderGroups.map((g) => {
            const base = byId.get(g.id);
            let cols = [...(base?.cols ?? [])];

            if (g.refIds?.length) {
                const pos = new Map<number, number>();
                g.refIds.forEach((id, i) => pos.set(id, i));
                cols.sort((a, b) => {
                    const ai = pos.get(a.table_column_id!) ?? Number.MAX_SAFE_INTEGER;
                    const bi = pos.get(b.table_column_id!) ?? Number.MAX_SAFE_INTEGER;
                    return ai - bi;
                });
            }

            const labels = (g.labels ?? []).slice(0, cols.length);
            while (labels.length < cols.length) labels.push('—');

            return {
                id: g.id,
                title: safe(g.title ?? base?.title ?? ''),
                labels: labels.map(safe),
                cols,
            };
        });
    }, [baseHeaderPlan, subHeaderGroups]);

    const flatColumnsInRenderOrder = useMemo(() => headerPlan.flatMap((g) => g.cols), [headerPlan]);

    // Колонки как ExtCol[] для валидации
    const subColumnsAsExtCol = useMemo(() => {
        return (subDisplay?.columns ?? []) as ExtCol[];
    }, [subDisplay?.columns]);

    const valueIndexByKey = useMemo(() => {
        const map = new Map<string, number>();
        (subDisplay?.columns ?? []).forEach((c, i) => {
            const syntheticTcId =
                c.type === 'combobox' && c.combobox_column_id != null && c.table_column_id != null
                    ? -1_000_000 - Number(c.combobox_column_id)
                    : c.table_column_id ?? -1;

            map.set(`${c.widget_column_id}:${syntheticTcId}`, i);
        });
        return map;
    }, [subDisplay?.columns]);

    // ——— префлайты ———
    const preflightUpdate = async (): Promise<{ ok: boolean }> => {
        if (!currentWidgetId) return { ok: false };
        try {
            const { data: widget } = await api.get<Widget>(`/widgets/${currentWidgetId}`);
            const { data: table } = await api.get<DTable>(`/tables/${widget.table_id}`);
            if (!table?.update_query?.trim()) {
                alert('Для таблицы саб-виджета не настроен UPDATE QUERY.');
                return { ok: false };
            }
        } catch (e) {
            console.warn('preflight (sub/update) failed:', e);
        }
        return { ok: true };
    };

    const preflightDelete = async (): Promise<{ ok: boolean }> => {
        if (!currentWidgetId) return { ok: false };
        try {
            const { data: widget } = await api.get<Widget>(`/widgets/${currentWidgetId}`);
            const { data: table } = await api.get<DTable>(`/tables/${widget.table_id}`);
            if (!table?.delete_query?.trim()) {
                alert('Для таблицы саб-виджета не настроен DELETE QUERY.');
                return { ok: false };
            }
        } catch (e) {
            console.warn('preflight (sub/delete) failed:', e);
        }
        return { ok: true };
    };

    // ——— редактирование ———
    const startEdit = async (rowIdx: number) => {
        if (!formId || !currentWidgetId || !subDisplay) return;
        const pf = await preflightUpdate();
        if (!pf.ok) return;

        setIsAddingSub(false);
        resetSubValidation?.(); // Сбрасываем ошибки валидации

        const row = subDisplay.data[rowIdx];
        const init: Record<number, string> = {};

        // Собираем combobox колонки для маппинга
        const comboGroups = new Map<string, {
            wcId: number;
            writeTcId: number;
            tokens: string[];
        }>();

        flatColumnsInRenderOrder.forEach((col) => {
            const writeTcId =
                col.type === 'combobox'
                    ? ((col as any).__write_tc_id ?? col.table_column_id ?? null)
                    : (col.table_column_id ?? null);

            if (writeTcId == null || isSyntheticComboboxId(writeTcId)) return;

            // Получаем отображаемое значение
            const syntheticTcId =
                col.type === 'combobox' && col.combobox_column_id != null && col.table_column_id != null
                    ? -1_000_000 - Number(col.combobox_column_id)
                    : col.table_column_id ?? -1;

            const key = `${col.widget_column_id}:${syntheticTcId}`;
            const idx = valueIndexByKey.get(key);
            const val = idx != null ? row.values[idx] : '';
            const shownStr = val == null ? '' : String(val).trim();

            if (col.type === 'combobox') {
                // Для combobox собираем токены для последующего маппинга
                const gKey = `${col.widget_column_id}:${writeTcId}`;
                const g = comboGroups.get(gKey) ?? {
                    wcId: col.widget_column_id,
                    writeTcId,
                    tokens: [] as string[],
                };
                if (shownStr) g.tokens.push(shownStr);
                comboGroups.set(gKey, g);
            } else {
                // Обычные колонки
                if (isEditableValue(val)) {
                    init[writeTcId] = shownStr;
                }
            }
        });

        // Маппинг combobox: загружаем опции и ищем UUID по отображаемому значению
        const groups = Array.from(comboGroups.values());
        for (const g of groups) {
            try {
                const options = await loadComboOptionsOnce(g.wcId, g.writeTcId);

                const tokens = g.tokens.map((t) => t.toLowerCase());

                let bestId: string | null = null;
                let bestScore = 0;
                let bestCount = 0;

                for (const o of options) {
                    // Проверяем совпадение по show и showHidden
                    const hay = [...o.show, ...o.showHidden].map((x) => x.toLowerCase());

                    const score = tokens.reduce(
                        (acc, t) => acc + (hay.includes(t) ? 1 : 0),
                        0
                    );

                    if (score > bestScore) {
                        bestScore = score;
                        bestCount = 1;
                        bestId = o.id;
                    } else if (score === bestScore && score > 0) {
                        bestCount += 1;
                    }
                }

                // Записываем найденный UUID (или пустую строку если не нашли)
                init[g.writeTcId] =
                    bestScore > 0 && bestCount === 1 && bestId ? bestId : '';

                console.debug('[useSubWormTable] combobox mapping:', {
                    wcId: g.wcId,
                    writeTcId: g.writeTcId,
                    tokens: g.tokens,
                    foundId: init[g.writeTcId],
                    bestScore,
                    bestCount,
                });
            } catch (e) {
                console.warn('[useSubWormTable] Failed to load combo options:', g, e);
                init[g.writeTcId] = '';
            }
        }

        console.debug('[useSubWormTable] startEdit → init:', init);

        setEditingRowIdx(rowIdx);
        setEditDraft(init);
    };

    const cancelEdit = () => {
        setEditingRowIdx(null);
        setEditDraft({});
        setEditSaving(false);
        resetSubValidation?.(); // Сбрасываем ошибки валидации
    };

    const submitEdit = async () => {
        if (editingRowIdx == null || !formId || !currentWidgetId || !subDisplay) return;

        // ═══════════════════════════════════════════════════════════
        // ВАЛИДАЦИЯ REQUIRED ПОЛЕЙ
        // ═══════════════════════════════════════════════════════════
        const row = subDisplay.data[editingRowIdx];

        console.group('[useSubWormTable] submitEdit VALIDATION');
        console.log('editDraft:', editDraft);
        console.log('subColumnsAsExtCol:', subColumnsAsExtCol.map(c => ({
            column_name: c.column_name,
            table_column_id: c.table_column_id,
            __write_tc_id: (c as any).__write_tc_id,
            required: c.required,
            type: c.type,
        })));

        const validation = validateEditDraft(
            editDraft,
            row,
            subColumnsAsExtCol,
            valueIndexByKey
        );

        console.log('VALIDATION RESULT:', validation);
        console.groupEnd();

        if (!validation.isValid) {
            console.warn('[useSubWormTable] EDIT VALIDATION FAILED — показываем ошибки');
            setShowSubValidationErrors?.(true);
            setSubValidationMissingFields?.(validation.missingFields);
            return; // НЕ отправляем на сервер
        }

        const pf = await preflightUpdate();
        if (!pf.ok) return;

        setEditSaving(true);
        try {
            const values = Object.entries(editDraft)
                .filter(([tcIdStr]) => !isSyntheticComboboxId(Number(tcIdStr)))
                .map(([tcIdStr, value]) => {
                    const tcId = Number(tcIdStr);
                    const s = value == null ? '' : String(value).trim();
                    return { table_column_id: tcId, value: s === '' ? null : s };
                });

            const body = {
                pk: {
                    primary_keys: Object.fromEntries(
                        Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
                    ),
                },
                values,
            };

            console.debug('[useSubWormTable] submitEdit → body:', body);

            const url = `/data/${formId}/${currentWidgetId}`;
            try {
                await api.patch(url, body);
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 403) {
                    console.warn('[submitEdit] 403 Forbidden', { url, body, detail });
                    alert('У вас не хватает прав на редактирование записи');
                    return;
                }
                if (status === 404 && String(detail).includes('Update query not found')) {
                    alert('Для саб-формы не настроен UPDATE QUERY. Задайте его и повторите.');
                    return;
                }
                if (status === 404) {
                    await api.patch(`${url}/`, body);
                } else {
                    throw err;
                }
            }

            if (currentOrder != null) handleTabClick(currentOrder);
            cancelEdit();
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(
                `Не удалось обновить строку: ${status ?? ''} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`
            );
        } finally {
            setEditSaving(false);
        }
    };

    // ——— удаление ———
    const deleteRow = async (rowIdx: number) => {
        if (!formId || !currentWidgetId || !subDisplay) return;
        const pf = await preflightDelete();
        if (!pf.ok) return;

        const row = subDisplay.data[rowIdx];
        const pkObj = Object.fromEntries(
            Object.entries(row.primary_keys).map(([k, v]) => [k, String(v)])
        );
        const pkLabel = Object.entries(pkObj)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');

        if (!window.confirm(`Удалить запись (${pkLabel})?`)) return;

        setDeletingRowIdx(rowIdx);
        try {
            const body = { primary_keys: pkObj };
            const url = `/data/${formId}/${currentWidgetId}`;

            try {
                await api.delete(url, { data: body });
            } catch (err: any) {
                const status = err?.response?.status;
                const detail = err?.response?.data?.detail ?? err?.response?.data ?? err?.message;

                if (status === 404 && String(detail).includes('Delete query not found')) {
                    alert('Для саб-формы не настроен DELETE QUERY. Задайте его и повторите.');
                    return;
                }
                if (status === 404) {
                    await api.delete(`${url}/`, { data: body });
                } else {
                    throw err;
                }
            }

            if (currentOrder != null) handleTabClick(currentOrder);
            if (editingRowIdx === rowIdx) cancelEdit();
        } catch (e: any) {
            const status = e?.response?.status;
            const msg = e?.response?.data ?? e?.message;
            alert(
                `Не удалось удалить строку: ${status ?? ''} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`
            );
        } finally {
            setDeletingRowIdx(null);
        }
    };

    return {
        deletingRowIdx,
        showSubHeaders,
        setShowSubHeaders,
        hasTabs,
        safe,

        headerPlan,
        flatColumnsInRenderOrder,
        valueIndexByKey,

        tabs,
        displayedWidgetOrder,

        startEdit,
        cancelEdit,
        submitEdit,
        deleteRow,

        isAddingSub,
        setIsAddingSub,
        draftSub,
        setDraftSub,

        editingRowIdx,
        setEditingRowIdx,
        editDraft,
        setEditDraft,
        editSaving,
        setEditSaving,
    };
}