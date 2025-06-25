// hooks/useTables.ts
import { useCallback, useState } from 'react';
import { api } from '@/services/api';

export interface DTable {
    id: number;
    workspace_id: number;
    name: string;
    description: string;
    published: boolean;
}

export const useTables = () => {
    const [tables, setTables] = useState<DTable[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);

    const loadTables = useCallback(
        async (workspaceId: number, published?: boolean) => {
            setLoading(true);
            try {
                const { data } = await api.get<DTable[]>(
                    '/tables',
                    {
                        params: {
                            workspace_id: workspaceId,
                            /* undefined → бэк вернёт все; иначе true / false */
                            published: published ?? undefined,
                        },
                    },
                );
                setTables(data);
            } catch {
                setError('Не удалось загрузить таблицы');
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    return { tables, loading, error, loadTables };
};
