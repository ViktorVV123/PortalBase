// shared/hooks/useTableCrud.ts
import { useCallback } from 'react';
import { api } from '@/services/api';
import { TableDraft } from '@/types/tableDraft';
import axios from "axios";

export const useTableCrud = (
    loadTables: (wsId: number | null, published?: boolean) => void,
) => {
    /* CREATE ─ после POST сразу перезапрашиваем список */
    const createTable = useCallback(
        async (wsId: number, draft: TableDraft) => {
            const { data } = await api.post('/tables', {
                ...draft,
                workspace_id: wsId,
            });

            await loadTables(wsId);      // ← дубликатов больше не будет
            return data.id as number;
        },
        [loadTables],
    );

    /* PUBLISH ─ PATCH + перезапрос */
    const publishTable = useCallback(
        async (id: number, wsId: number | null): Promise<{ ok: boolean; msg?: string }> => {
                  try {
                        await api.patch(`/tables/${id}/publish`);
                        await loadTables(wsId);                      // успех → подтянуть список
                        return { ok: true };
                      } catch (e) {
                        /* 400 – бизнес-правило (нет PRIMARY или DATETIME) */
                            if (axios.isAxiosError(e) && e.response?.status === 400) {
                              return {
                                    ok: false,
                                    msg:
                                  e.response.data?.message ??
                                  'В таблице должен быть хотя бы один столбец PRIMARY и один DATETIME.',
                                  };
                            }
                        console.error('publishTable error', e);
                        return { ok: false, msg: 'Не удалось опубликовать таблицу.' };
                      }
                },
            [loadTables],
    );

    return { createTable, publishTable };
};
