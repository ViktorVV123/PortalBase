// connections

// src/shared/hooks/stores/useConnectionsStore.ts

import { useCallback, useRef, useState } from 'react';
import { api } from '@/services/api';
import type { Connection, LoadStatus } from './types';

export interface UseConnectionsStoreReturn {
    // State
    connections: Connection[];
    loading: boolean;
    error: string | null;

    // Actions
    loadConnections: (opts?: { force?: boolean }) => Promise<void>;
    deleteConnection: (id: number) => Promise<void>;
    createConnection: (data: any) => Promise<Connection>;
    updateConnection: (id: number, data: any) => Promise<Connection>;
}

export function useConnectionsStore(): UseConnectionsStoreReturn {
    const [connections, setConnections] = useState<Connection[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const statusRef = useRef<LoadStatus>('idle');

    /**
     * Загрузка списка connections
     */
    const loadConnections = useCallback(async (opts?: { force?: boolean }) => {
        const force = opts?.force ?? false;

        if (
            !force &&
            (statusRef.current === 'loading' ||
                statusRef.current === 'forbidden' ||
                statusRef.current === 'loaded')
        ) {
            return;
        }

        statusRef.current = 'loading';
        setLoading(true);

        try {
            const { data } = await api.get<Connection[]>('/connections/');
            setConnections(data.slice().sort((a, b) => a.id - b.id));
            setError(null);
            statusRef.current = 'loaded';
        } catch (e: any) {
            const status = e?.response?.status;

            if (status === 403) {
                statusRef.current = 'forbidden';
                setError('У вас нет доступа к списку подключений');
            } else {
                statusRef.current = 'idle';
                setError('Не удалось загрузить список соединений');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Удаление connection
     */
    const deleteConnection = useCallback(async (id: number) => {
        try {
            await api.delete(`/connections/${id}`);
            setConnections(prev => prev.filter(c => c.id !== id));
        } catch {
            // Можно использовать toast вместо alert
            console.error('Не удалось удалить подключение');
            throw new Error('Не удалось удалить подключение');
        }
    }, []);

    /**
     * Создание connection
     */
    const createConnection = useCallback(async (data: any): Promise<Connection> => {
        const { data: newConn } = await api.post<Connection>('/connections/sqlalchemy', data);

        setConnections(prev => [...prev, newConn].sort((a, b) => a.id - b.id));

        return newConn;
    }, []);

    /**
     * Обновление connection
     */
    const updateConnection = useCallback(async (
        id: number,
        data: any
    ): Promise<Connection> => {
        const { data: updated } = await api.patch<Connection>(
            `/connections/sqlalchemy/${id}`,
            data
        );

        setConnections(prev =>
            prev.map(c => c.id === id ? { ...c, ...updated } : c)
        );

        return updated;
    }, []);

    return {
        // State
        connections,
        loading,
        error,

        // Actions
        loadConnections,
        deleteConnection,
        createConnection,
        updateConnection,
    };
}