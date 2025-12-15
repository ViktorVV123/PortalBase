  // workspaces

  // src/shared/hooks/stores/useWorkspacesStore.ts

  import { useCallback, useRef, useState } from 'react';
  import { api } from '@/services/api';
  import type { LoadStatus } from './types';

  // Используем существующий тип из typesWorkSpaces
  import type { WorkSpaceTypes } from '@/types/typesWorkSpaces';

  export interface UseWorkspacesStoreReturn {
      // State
      workSpaces: WorkSpaceTypes[];
      loading: boolean;
      error: string | null;

      // Actions
      loadWorkSpaces: (opts?: { force?: boolean }) => Promise<void>;
      deleteWorkspace: (wsId: number) => Promise<void>;
      updateWorkspace: (id: number, patch: Partial<WorkSpaceTypes>) => Promise<WorkSpaceTypes>;
  }

  export function useWorkspacesStore(): UseWorkspacesStoreReturn {
      const [workSpaces, setWorkSpaces] = useState<WorkSpaceTypes[]>([]);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);

      const statusRef = useRef<LoadStatus>('idle');

      /**
       * Загрузка списка workspaces
       */
      const loadWorkSpaces = useCallback(async (opts?: { force?: boolean }) => {
          const force = opts?.force ?? false;

          // Проверяем статус, чтобы не делать лишних запросов
          if (!force) {
              if (
                  statusRef.current === 'loading' ||
                  statusRef.current === 'loaded' ||
                  statusRef.current === 'forbidden'
              ) {
                  return;
              }
          }

          statusRef.current = 'loading';
          setLoading(true);
          setError(null);

          try {
              const { data } = await api.get<WorkSpaceTypes[]>('/workspaces/');
              setWorkSpaces(data.sort((a, b) => a.id - b.id));
              statusRef.current = 'loaded';
          } catch (e: any) {
              const status = e?.response?.status;

              if (status === 403) {
                  statusRef.current = 'forbidden';
                  setError('У вас нет доступа к рабочим пространствам');
              } else {
                  statusRef.current = 'idle';
                  setError('Не удалось загрузить рабочие пространства');
              }
          } finally {
              setLoading(false);
          }
      }, []);

      /**
       * Удаление workspace
       */
      const deleteWorkspace = useCallback(async (wsId: number) => {
          // Оптимистичное удаление
          const prevWorkSpaces = workSpaces;
          setWorkSpaces(prev => prev.filter(w => w.id !== wsId));

          try {
              await api.delete(`/workspaces/${wsId}`);
          } catch {
              // Откат при ошибке
              setWorkSpaces(prevWorkSpaces);
              // Можно также перезагрузить список
              await loadWorkSpaces({ force: true });
          }
      }, [workSpaces, loadWorkSpaces]);

      /**
       * Обновление workspace
       */
      const updateWorkspace = useCallback(async (
          id: number,
          patch: Partial<WorkSpaceTypes>
      ): Promise<WorkSpaceTypes> => {
          const { data } = await api.patch<WorkSpaceTypes>(`/workspaces/${id}`, patch);

          setWorkSpaces(prev =>
              prev.map(ws => ws.id === id ? { ...ws, ...data } : ws)
          );

          return data;
      }, []);

      return {
          // State
          workSpaces,
          loading,
          error,

          // Actions
          loadWorkSpaces,
          deleteWorkspace,
          updateWorkspace,
      };
  }