// shared/hooks/useTableCrud.ts
import {useCallback} from 'react';
import {api} from '@/services/api';
import {Table} from '@/components/TablesRow/TablesRow';
import {TableDraft} from "@/types/tableDraft";


    export const useTableCrud = (tables: Table[], setTables: (t: Table[]) => void) => {
        const createTable = useCallback(
            async (wsId: number, draft: TableDraft) => {
                const {data} = await api.post<Table>('/tables', {
                    ...draft,
                    workspace_id: wsId,
                });
                setTables([...tables, data].sort((a, b) => a.id - b.id));
                return data.id;
            },
            [tables, setTables],
        );

        return {createTable};
    };
