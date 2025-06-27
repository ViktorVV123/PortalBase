import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import * as s from './TablesRow.module.scss';
import { useTableColumns } from '@/shared/hooks/useTableColumns';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';

interface Table {
    id: number;
    workspace_id: number;
    name: string;
    description: string;
    published: boolean;
}

interface Props {
    workspaceId: number | null;
    tables: Table[];
    loadTables: (wsId: number | null, published?: boolean) => void;
}

export const TablesRow = ({ workspaceId, tables, loadTables }: Props) => {
    /* published-фильтр */
    const [showPublished, setShowPublished] =
        useState<'all' | 'only' | 'hide'>('all');

    /* ------- tables list ------- */
    const fetchTables = useCallback(
        (id: number, onlyPublished?: boolean) => loadTables(id, onlyPublished),
        [loadTables],
    );

    useEffect(() => {
        if (workspaceId == null) return;
        fetchTables(
            workspaceId,
            showPublished === 'all' ? undefined : showPublished === 'only',
        );
    }, [workspaceId, showPublished, fetchTables]);

    const visibleTables = useMemo(
        () => tables.filter(t => t.workspace_id === workspaceId),
        [tables, workspaceId],
    );

    /* выбранная таблица */
    const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

    /* если поменяли workspace → выбираем первую доступную таблицу */
    useEffect(() => {
        if (!visibleTables.length) {
            setSelectedTableId(null);
        } else if (!visibleTables.some(t => t.id === selectedTableId)) {
            setSelectedTableId(visibleTables[0].id);
        }
    }, [visibleTables, selectedTableId]);

    /* ------- columns ------- */
    const {
        columns,
        loading: columnsLoading,
        error: columnsError,
        loadColumns,
        updateColumn,
        deleteColumn
    } = useTableColumns();

    useEffect(() => {
        if (selectedTableId != null) loadColumns(selectedTableId);
    }, [selectedTableId, loadColumns]);

    /* ------- edit mode ------- */
    const [editingId, setEditingId] = useState<number | null>(null);
    const [draft, setDraft]         = useState<Record<string, any>>({});
    const rowRef = useRef<HTMLTableRowElement | null>(null);

    const startEdit = (c: typeof columns[number]) => {
        setEditingId(c.id);
        setDraft({ ...c });
    };

    const finishEdit = async (save: boolean) => {
        if (save && editingId !== null) {
            const { id, ...payload } = draft;
            await updateColumn(editingId, payload);
        }
        setEditingId(null);
    };

    /* клик вне редактируемой строки */
    useEffect(() => {
        if (editingId === null) return;
        const outside = (e: MouseEvent) => {
            if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
                finishEdit(true);
            }
        };
        document.addEventListener('mousedown', outside);
        return () => document.removeEventListener('mousedown', outside);
    }, [editingId, draft]); // eslint-disable-line react-hooks/exhaustive-deps

    const onDraft = (k: string, v: any) => setDraft(p => ({ ...p, [k]: v }));

    /* ------- UI ------- */
    return (
        <div>
            {/* список таблиц */}
            <div className={s.row}>
                {visibleTables.map(t => (
                    <div
                        key={t.id}
                        className={`${s.tile} ${t.id === selectedTableId ? s.active : ''}`}
                        onClick={() => setSelectedTableId(t.id)}
                    >
                        {t.name}
                    </div>
                ))}

                <label className={s.switcher}>
                    <input
                        type="checkbox"
                        checked={showPublished === 'only'}
                        onChange={() =>
                            setShowPublished(p => (p === 'only' ? 'hide' : 'only'))
                        }
                    />
                    published
                </label>
            </div>

            {/* список столбцов */}
            <div className={s.columns}>
                {columnsLoading && <p>Загрузка столбцов…</p>}
                {columnsError && <p className={s.error}>{columnsError}</p>}

                {!columnsLoading && !columnsError && (
                    <div className={s.tableWrapper}>
                        <table className={s.table}>
                            <thead>
                            <tr>
                                <th>name</th>
                                <th className={s.wide}>description</th>
                                <th>datatype</th>
                                <th>length</th>
                                <th>precision</th>
                                <th>primary</th>
                                <th>increment</th>
                                <th>required</th>
                                <th>datetime</th>
                                <th />
                                <th />
                            </tr>
                            </thead>

                            <tbody>
                            {columns.map(col => {
                                const isEdit = editingId === col.id;
                                return (
                                    <tr
                                        key={col.id}
                                        ref={isEdit ? rowRef : undefined}

                                    >
                                        {/* name */}
                                        <td>
                                            {isEdit ? (
                                                <input
                                                    value={draft.name}
                                                    onChange={e => onDraft('name', e.target.value)}
                                                />
                                            ) : (
                                                col.name
                                            )}
                                        </td>

                                        {/* description */}
                                        <td className={s.ellipsis}>
                                            {isEdit ? (
                                                <input
                                                    value={draft.description ?? ''}
                                                    onChange={e => onDraft('description', e.target.value)}
                                                />
                                            ) : (
                                                col.description ?? '—'
                                            )}
                                        </td>

                                        {/* datatype */}
                                        <td className={s.code}>
                                            {isEdit ? (
                                                <input
                                                    value={draft.datatype}
                                                    onChange={e => onDraft('datatype', e.target.value)}
                                                />
                                            ) : (
                                                col.datatype
                                            )}
                                        </td>

                                        {/* length */}
                                        <td>
                                            {isEdit ? (
                                                <input
                                                    type="number"
                                                    value={draft.length ?? ''}
                                                    onChange={e =>
                                                        onDraft(
                                                            'length',
                                                            e.target.value === ''
                                                                ? null
                                                                : Number(e.target.value),
                                                        )
                                                    }
                                                />
                                            ) : col.length ?? '—'}
                                        </td>

                                        {/* precision */}
                                        <td>
                                            {isEdit ? (
                                                <input
                                                    type="number"
                                                    value={draft.precision ?? ''}
                                                    onChange={e =>
                                                        onDraft(
                                                            'precision',
                                                            e.target.value === ''
                                                                ? null
                                                                : Number(e.target.value),
                                                        )
                                                    }
                                                />
                                            ) : col.precision ?? '—'}
                                        </td>

                                        {/* флаги */}
                                        {(
                                            ['primary', 'increment', 'required', 'datetime'] as const
                                        ).map(k => (
                                            <td key={k}>
                                                {isEdit ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={draft[k]}
                                                        onChange={e => onDraft(k, e.target.checked)}
                                                    />
                                                ) : col[k] ? (
                                                    '✔︎'
                                                ) : (
                                                    ''
                                                )}
                                            </td>
                                        ))}

                                        {/* actions */}
                                        <td style={{ cursor: 'pointer' }}>
                                            {isEdit ? (
                                                <span  onClick={() => finishEdit(true)}>
                            ✓
                          </span>
                                            ) : (
                                                <EditIcon onClick={() => startEdit(col)} />
                                            )}
                                        </td>
                                        <td style={{ cursor: 'pointer' }}>
                                            {isEdit ? (
                                                <span  onClick={() => finishEdit(false)}>
                            ✕
                          </span>
                                            ) : (
                                                <DeleteIcon onClick={() => {
                                                    if (window.confirm(`Удалить столбец «${col.name}»?`)) {
                                                        deleteColumn(col.id);
                                                    }
                                                }} /* TODO: deleteColumn */ />
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
