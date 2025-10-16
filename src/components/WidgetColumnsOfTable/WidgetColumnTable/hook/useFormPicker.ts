// src/components/WidgetColumnsOfTable/hooks/useFormPicker.ts
import {useCallback, useEffect, useMemo, useState} from 'react';
import {RefItem} from "@/components/WidgetColumnsOfTable/types";


export type UseFormPickerDeps = {
    /** формы, пришедшие снаружи */
    formsById?: Record<number, { form_id: number; name?: string }>;
    /** лениво подгрузить формы, если их нет */
    loadWidgetForms?: () => void;

    /** API: обновить reference (PATCH) */
    callUpdateReference: (wcId: number, tableColumnId: number, patch: { form_id: number | null }) => Promise<unknown>;

    /** локальный стор для ссылок (для быстрой перерисовки после save) */
    setLocalRefs: React.Dispatch<React.SetStateAction<Record<number, RefItem[]>>>;
};

export type FormOption = { id: number | null; name: string };

export function useFormPicker({
                                  formsById,
                                  loadWidgetForms,
                                  callUpdateReference,
                                  setLocalRefs,
                              }: UseFormPickerDeps) {
    /** список опций для селектора форм */
    const formOptions: FormOption[] = useMemo(() => {
        const base: FormOption[] = [{ id: null, name: '— Без формы —' }];
        const rest: FormOption[] = Object.values(formsById ?? {}).map(f => ({
            id: (f?.form_id as number) ?? null,
            name: f?.name || `Форма #${f?.form_id}`,
        }));
        return base.concat(rest);
    }, [formsById]);

    /** мапа id -> name (для отображения под заголовком группы) */
    const formNameById = useMemo(() => {
        const map: Record<string, string> = { 'null': '— Без формы —' };
        for (const f of formOptions) map[String(f.id)] = f.name;
        return map;
    }, [formOptions]);

    /** автозагрузка форм, если пусто */
    useEffect(() => {
        if (!formsById || Object.keys(formsById).length === 0) {
            loadWidgetForms?.();
        }
    }, [formsById, loadWidgetForms]);

    /** состояние диалога выбора формы */
    const [formDlg, setFormDlg] = useState<{
        open: boolean; wcId: number | null; tblColId: number | null; value: number | null;
    }>({ open: false, wcId: null, tblColId: null, value: null });

    const openFormDialog = useCallback((wcId: number, tblColId: number, currentVal?: number | null) => {
        setFormDlg({ open: true, wcId, tblColId, value: currentVal ?? null });
    }, []);

    const closeFormDialog = useCallback(() => {
        setFormDlg(p => ({ ...p, open: false }));
    }, []);

    const saveFormDialog = useCallback(async () => {
        const { wcId, tblColId, value } = formDlg;
        if (!wcId || !tblColId) return;

        const normalized: number | null =
            value == null ? null : (Number.isFinite(Number(value)) ? Number(value) : null);

        try {
            await callUpdateReference(wcId, tblColId, { form_id: normalized });

            // локально обновим form/form_id у нужного reference
            setLocalRefs(prev => ({
                ...prev,
                [wcId]: (prev[wcId] ?? []).map(item =>
                    item.table_column?.id === tblColId
                        ? ({ ...item, form: normalized, form_id: normalized } as RefItem)
                        : item
                ),
            }));

            closeFormDialog();
        } catch (e) {
            // глушим, лог пусть будет на уровне вызывающего
            // (или можно сюда добавить console.warn)
            console.warn('[useFormPicker] save failed:', e);
        }
    }, [formDlg, callUpdateReference, setLocalRefs, closeFormDialog]);

    return {
        // списки и мапы
        formOptions,
        formNameById,

        // диалог
        formDlg,
        setFormDlg,
        openFormDialog,
        closeFormDialog,
        saveFormDialog,
    };
}
