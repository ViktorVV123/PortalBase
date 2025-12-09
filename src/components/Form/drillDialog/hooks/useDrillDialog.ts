import {useCallback, useState} from 'react';
import {api} from '@/services/api';
import type {FormDisplay} from '@/shared/hooks/useWorkSpaces';

type DrillState = {
    open: boolean;
    formId: number | null;
    loading: boolean;
    display: FormDisplay | null;
    error?: string;
};

export function useDrillDialog() {
    const [state, setState] = useState<DrillState>({
        open: false,
        formId: null,
        loading: false,
        display: null,
    });

    const open = useCallback(async (formId?: number) => {
        if (!formId) return;
        setState({open: true, formId, loading: true, display: null});
        try {
            const {data} = await api.post<FormDisplay>(`/display/${formId}/main`, []);
            setState({open: true, formId, loading: false, display: data});
        } catch (e: any) {
            const msg = e?.response?.data ?? e?.message ?? 'Не удалось загрузить форму';
            setState({open: true, formId, loading: false, display: null, error: String(msg)});
        }
    }, []);

    const close = useCallback(() => {
        setState({open: false, formId: null, loading: false, display: null});
    }, []);

    return { ...state, openDialog: open, closeDialog: close };
}
