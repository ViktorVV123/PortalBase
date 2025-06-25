import {useCallback, useState} from "react";
import {api} from "@/services/api";
import {WorkSpaceTypes} from "@/types/typesWorkSpaces";

export const useWorkSpaces = () => {

    const [workSpaces, setWorkSpaces] = useState<WorkSpaceTypes[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadWorkSpaces = useCallback(async () => {
        try{
            const {data} = await api.get<WorkSpaceTypes[]>('/workspaces');
            setWorkSpaces(data);
        }catch {
            setError('Не удалось загрузить список соединений');
        }finally {
            setLoading(false);
        }
    },[])


    const deleteWorkspace = useCallback(
        async (wsId: number) => {
            try {
                await api.delete(`/workspaces/${wsId}`);
                setWorkSpaces(prev => prev.filter(w => w.id !== wsId));
            } catch {
                setError('Ошибка при удалении workspace');
            }
        },
        []          // ← обязательный второй аргумент – массив deps
    );


    /* ─ обновление ─ */
    const updateWorkspace = useCallback(
        async (wsId: number, patch: Partial<Omit<WorkSpaceTypes, 'id'>>) => {
            try {
                const { data } = await api.patch<WorkSpaceTypes>(`/workspaces/${wsId}`, patch);
                /* заменяем элемент в состоянии */
                setWorkSpaces(prev =>
                    prev.map(w => (w.id === wsId ? { ...w, ...data } : w)),
                );
            } catch {
                setError('Ошибка при обновлении workspace');
            }
        },
        [],
    );

    return {loadWorkSpaces,workSpaces,loading,error,deleteWorkspace,updateWorkspace}
}