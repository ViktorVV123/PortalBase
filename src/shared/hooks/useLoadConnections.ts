import {useCallback, useState} from "react";
import {Connection} from "@/types/typesConnection";
import {api} from "@/services/api";

export const useLoadConnections = () => {


    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadConnections = useCallback(async () => {
        try {
            const {data} = await api.get<Connection[]>('/connections');
            setConnections(data);
        } catch {
            setError('Не удалось загрузить список соединений');
        } finally {
            setLoading(false);
        }
    }, []);

    return { loadConnections, connections, loading, error };
}

