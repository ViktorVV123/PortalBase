import React, {useEffect} from 'react';
import * as s from './TablesRow.module.scss';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import {useWorkspaceTables} from "@/shared/hooks/useWorkspaceTables";
import {useColumnEdit} from "@/shared/hooks/useColumnEdit";


export interface Table {
    id: number;
    workspace_id: number;
    name: string; /* … */
}

interface Props {
    workspaceId: number | null;
    tables: Table[];
    loadTables: (wsId: number | null, published?: boolean) => void;
    onTableSelect?: (tableId: number) => void;   // ← новый проп
    handleTableSelect:any

}

export const TablesRow = ({workspaceId, tables, loadTables,onTableSelect,handleTableSelect}: Props) => {
    /* --- таблицы --- */
    const {
        published,
        togglePublished,
        visibleTables,
        selectedId,
        setSelectedId,
    } = useWorkspaceTables({workspaceId, tables, loadTables});

    /* --- столбцы + редактирование --- */
    const column = useColumnEdit(selectedId);

    useEffect(() => {
        if (!visibleTables.length) {
            setSelectedId(null);   // таблиц нет → ничего не выбрано
            column.reset();        // очищаем список колонок
        } else if (!visibleTables.some(t => t.id === selectedId)) {
            setSelectedId(visibleTables[0].id);  // авто-выбор первой таблицы
        }
    }, [visibleTables, selectedId, column]);


    /* ---------- UI ---------- */
    return (
        <>
            {/* переключатель таблиц */}
            <div className={s.row}>
                {visibleTables.map(t => (
                    <div
                        key={t.id}
                        className={`${s.tile} ${t.id === selectedId ? s.active : ''}`}
                        onClick={() => setSelectedId(t.id)}
                    >
                        {t.name}
                    </div>
                ))}

                <label className={s.switcher}>
                    <input
                        type="checkbox"
                        checked={published === 'only'}
                        onChange={togglePublished}
                    />
                    published
                </label>
            </div>

            {/* таблица колонок */}
            <div className={s.columns}>
                {column.loading && <p>Загрузка столбцов…</p>}
                {column.error && <p className={s.error}>{column.error}</p>}

                {!column.loading && !column.error && (
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
                                <th/>
                                <th/>
                            </tr>
                            </thead>
                            <tbody>
                            {column.columns.map(col => {
                                const isEdit = column.editingId === col.id;
                                return (
                                    <tr
                                        key={col.id}
                                        ref={isEdit ? column.rowRef : undefined}
                                    >
                                        {/* name */}
                                        <td>
                                            {isEdit ? (
                                                <input
                                                    value={column.draft.name}
                                                    onChange={e =>
                                                        column.onDraft('name', e.target.value)
                                                    }
                                                />
                                            ) : (
                                                col.name
                                            )}
                                        </td>
                                        <td className={s.ellipsis}>
                                            {isEdit ? (
                                                <input
                                                    value={column.draft.description ?? ''}
                                                    onChange={e => column.onDraft('description', e.target.value)}
                                                />
                                            ) : (
                                                col.description ?? '—'
                                            )}
                                        </td>
                                        <td className={s.code}>
                                            {isEdit ? (
                                                <input
                                                    value={column.draft.datatype}
                                                    onChange={e => column.onDraft('datatype', e.target.value)}
                                                />
                                            ) : (
                                                col.datatype
                                            )}
                                        </td>
                                        <td>
                                            {isEdit ? (
                                                <input
                                                    type="number"
                                                    value={column.draft.length ?? ''}
                                                    onChange={e =>
                                                        column.onDraft(
                                                            'length',
                                                            e.target.value === ''
                                                                ? null
                                                                : Number(e.target.value),
                                                        )
                                                    }
                                                />
                                            ) : col.length ?? '—'}
                                        </td>
                                        <td>
                                            {isEdit ? (
                                                <input
                                                    type="number"
                                                    value={column.draft.precision ?? ''}
                                                    onChange={e =>
                                                        column.onDraft(
                                                            'precision',
                                                            e.target.value === ''
                                                                ? null
                                                                : Number(e.target.value),
                                                        )
                                                    }
                                                />
                                            ) : col.precision ?? '—'}
                                        </td>
                                        {(
                                            ['primary', 'increment', 'required', 'datetime'] as const
                                        ).map(k => (
                                            <td key={k}>
                                                {isEdit ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={column.draft[k]}
                                                        onChange={e => column.onDraft(k, e.target.checked)}
                                                    />
                                                ) : col[k] ? (
                                                    '✔︎'
                                                ) : (
                                                    ''
                                                )}
                                            </td>
                                        ))}


                                        {/* действия */}
                                        <td>
                                            {isEdit ? (
                                                <span onClick={() => column.finishEdit(true)}>✓</span>
                                            ) : (
                                                <EditIcon onClick={() => column.startEdit(col)}/>
                                            )}
                                        </td>
                                        <td>
                                            {isEdit ? (
                                                <span onClick={() => column.finishEdit(false)}>✕</span>
                                            ) : (
                                                <DeleteIcon
                                                    onClick={() =>
                                                        window.confirm(`Удалить «${col.name}»?`) &&
                                                        column.deleteColumn(col.id)
                                                    }
                                                />
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
        </>
    );
};



