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
    return {loadWorkSpaces,workSpaces,loading,error}
}