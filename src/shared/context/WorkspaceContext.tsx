// src/app/contexts/WorkspaceContext.tsx
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { WorkSpaceTypes }  from '@/types/typesWorkSpaces';
import {useWorkSpaces} from "@/shared/hooks/useWorkSpaces";


type WorkspaceCtx = {
    /* данные */
    workSpaces: WorkSpaceTypes[];
    selectedWs: WorkSpaceTypes | null;
    tables    : any;

    /* действия */
    selectWorkspace : (wsId: number) => void;
    reloadWorkspaces: () => void;
    loadTables      : (wsId: number) => void;
    updateWorkspace : typeof useWorkSpaces extends () => infer R
        ? R extends { updateWorkspace: infer F } ? F : never
        : never;
    deleteWorkspace : typeof useWorkSpaces extends () => infer R
        ? R extends { deleteWorkspace: infer F } ? F : never
        : never;
};

const WorkspaceContext = createContext<WorkspaceCtx | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const {
        workSpaces,
        loadWorkSpaces,
        tables,
        loadTables,
        updateWorkspace,
        deleteWorkspace,
    } = useWorkSpaces();

    const [selectedWsId, setSelectedWsId] = useState<number | null>(null);

    const selectedWs = useMemo(
        () => workSpaces.find(w => w.id === selectedWsId) ?? null,
        [workSpaces, selectedWsId],
    );

    const selectWorkspace = useCallback((wsId: number) => {
        setSelectedWsId(wsId);
        loadTables(wsId);
    }, [loadTables]);

    useEffect(loadWorkSpaces, [loadWorkSpaces]);

    const value = useMemo(() => ({
        workSpaces,
        selectedWs,
        tables,
        selectWorkspace,
        reloadWorkspaces: loadWorkSpaces,
        loadTables,
        updateWorkspace,
        deleteWorkspace,
    }), [
        workSpaces,
        selectedWs,
        tables,
        selectWorkspace,
        loadWorkSpaces,
        loadTables,
        updateWorkspace,
        deleteWorkspace,
    ]);

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspaceContext = () => {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) throw new Error('useWorkspaceContext must be used inside <WorkspaceProvider>');
    return ctx;
};
