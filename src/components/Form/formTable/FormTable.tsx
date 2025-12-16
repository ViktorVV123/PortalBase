// src/components/Form/formTable/FormTable.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material';
import { dark } from '@/shared/themeUI/themeModal/ThemeModalUI';
import { api } from '@/services/api';

import type {
    FormDisplay,
    SubDisplay,
    WidgetForm,
    Widget,
    FormTreeColumn,
} from '@/shared/hooks/useWorkSpaces';

import { FormProvider } from '@/components/Form/context';
import { FormTableContent } from './FormTableContent';

// ─────────────────────────────────────────────────────────────
// ТИПЫ (для обратной совместимости с SetOfTables)
// ─────────────────────────────────────────────────────────────

export type HeaderModelItem = {
    id: number;
    title: string;
    labels: string[];
    visible?: boolean;
    refIds?: number[];
    span: number;
};

type Props = {
    formDisplay: FormDisplay;
    loadSubDisplay: (formId: number, subOrder: number, primary?: Record<string, unknown>) => void;
    formsByWidget: Record<number, WidgetForm>;
    selectedWidget: Widget | null;
    selectedFormId: number | null;
    subDisplay: SubDisplay | null;
    subLoading: boolean;
    subError: string | null;
    formTrees: Record<number, FormTreeColumn[]>;
    loadFilteredFormDisplay: (formId: number, filter: {
        table_column_id: number;
        value: string | number;
    }) => Promise<void>;
    setFormDisplay: (value: FormDisplay | null) => void;
    setSubDisplay: (value: SubDisplay | null) => void;
    headerGroups?: HeaderModelItem[];
    formsById: Record<number, WidgetForm>;
};

// ─────────────────────────────────────────────────────────────
// КОМПОНЕНТ-ОБЁРТКА (сохраняет старый API пропсов)
// ─────────────────────────────────────────────────────────────

export const FormTable: React.FC<Props> = (props) => {
    const {
        formDisplay,
        selectedWidget,
        selectedFormId,
        subDisplay,
        subLoading,
        subError,
        formsByWidget,
        loadSubDisplay,
        formTrees,
        setFormDisplay,
        setSubDisplay,
        formsById,
        loadFilteredFormDisplay,
    } = props;

    // Локальное состояние для liveTree (как было раньше)
    const [liveTree, setLiveTree] = useState<FormTreeColumn[] | null>(null);

    const tree = selectedFormId ? formTrees[selectedFormId] : null;

    useEffect(() => {
        setLiveTree(tree ?? null);
    }, [tree, selectedFormId]);

    // Загрузка дерева

    const loadFormTree = useCallback(async (formId: number) => {
        try {
            const { data } = await api.post<FormTreeColumn[] | FormTreeColumn>(
                `/display/${formId}/tree`
            );
            const normalized = Array.isArray(data) ? data : [data];

            const hasValidTree = normalized.length > 0 &&
                normalized.some(t => t.values && t.values.length > 0);

            setLiveTree(hasValidTree ? normalized : null);
        } catch (e: any) {
            if (e?.response?.status === 404) {
                setLiveTree(null);
            } else {
                console.warn('Не удалось загрузить дерево:', e);
            }
        }
    }, []);

    useEffect(() => {
        const handleFormMutated = async (e: CustomEvent<{ formId: number }>) => {
            const mutatedFormId = e.detail?.formId;

            if (mutatedFormId && mutatedFormId === selectedFormId) {
                console.debug('[FormTable] Form mutated, reloading tree...', mutatedFormId);
                await loadFormTree(mutatedFormId);
            }
        };

        window.addEventListener('portal:form-mutated', handleFormMutated as EventListener);

        return () => {
            window.removeEventListener('portal:form-mutated', handleFormMutated as EventListener);
        };
    }, [selectedFormId, loadFormTree]);

    // Определяем currentForm для провайдера
    const currentForm = useMemo<WidgetForm | null>(() => {
        if (selectedFormId != null) return formsById[selectedFormId] ?? null;
        if (selectedWidget) return formsByWidget[selectedWidget.id] ?? null;
        return null;
    }, [selectedFormId, selectedWidget, formsById, formsByWidget]);

    return (
        <ThemeProvider theme={dark}>
            <FormProvider
                selectedFormId={selectedFormId}
                selectedWidget={selectedWidget}
                formsById={formsById}
                formsByWidget={formsByWidget}
                columns={[]} // FormTable не использует columns напрямую
                formDisplay={formDisplay}
                setFormDisplay={setFormDisplay}
                subDisplay={subDisplay}
                setSubDisplay={setSubDisplay}
                formTrees={formTrees}
                formLoading={false}
                formError={null}
                subLoading={subLoading}
                subError={subError}
                loadSubDisplay={loadSubDisplay}
                loadFilteredFormDisplay={loadFilteredFormDisplay}
                loadFormTree={loadFormTree}
            >
                <FormTableContent
                    liveTree={liveTree}
                    setLiveTree={setLiveTree}
                    currentForm={currentForm}
                />
            </FormProvider>
        </ThemeProvider>
    );
};