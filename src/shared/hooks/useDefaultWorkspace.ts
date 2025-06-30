import { useEffect } from 'react';
import { WorkSpaceTypes } from '@/types/typesWorkSpaces';


/**
 * Если список workspace уже загружен, а selectedId ещё null —
 * выбирает первый workspace и сообщает о его connection.
 */
export const useDefaultWorkspace = (
    workspaces: WorkSpaceTypes[],
    selectedId: number | null,
    setSelectedId: (id: number) => void,
    onSelectConnection: (connectionId: number) => void,
) => {
    useEffect(() => {
        if (workspaces.length && selectedId === null) {
            const first = workspaces[0];
            setSelectedId(first.id);
            onSelectConnection(first.connection_id);
        }
    }, [workspaces, selectedId, setSelectedId, onSelectConnection]);
};
