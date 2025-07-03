import React, {useCallback, useEffect, useRef, useState} from 'react';
import * as s from './TablesRow.module.scss';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import {useWorkspaceTables} from "@/shared/hooks/useWorkspaceTables";
import {useColumnEdit} from "@/shared/hooks/useColumnEdit";
import AddIcon from "@/assets/image/AddIcon.svg";
import {useTableCrud} from "@/shared/hooks/useTableCrud";
import {NewTableModal} from "@/components/modals/newTableModal/NewTableModal";
import {TableDraft} from "@/types/tableDraft";


export interface Table {
    id: number;
    workspace_id: number;
    name: string; /* … */
    published: boolean
}

interface Props {
    workspaceId: number | null;
    tables: Table[];
    loadTables: (wsId: number | null, published?: boolean) => void;
    onTableSelect: any


}

export const TablesRow = ({workspaceId, tables, loadTables, onTableSelect}: Props) => {
    /* --- таблицы --- */
    const {
        visibleTables, selectedId, setSelectedId,
        togglePublished, showOnlyPublished,
    } =
        useWorkspaceTables({workspaceId, tables, loadTables});

    const column = useColumnEdit(selectedId);


    const {createTable, publishTable} = useTableCrud(loadTables);
    const [showModal, setShowModal] = useState(false);
    const selectedTable = tables.find(t => t.id === selectedId) ?? null;

    const handleCreate = useCallback(
        async (payload: TableDraft) => {
            if (workspaceId == null) return;
            const newId = await createTable(workspaceId, payload);
            setSelectedId(newId);      // instant select
            onTableSelect(newId);
        },
        [workspaceId, createTable, setSelectedId, onTableSelect],
    );

    /* 1. следим за изменением списка таблиц */
    /* ---------- эффект №1: управляем selectedId ---------- */
    useEffect(() => {
        /** если таблиц нет — сбрасываем выбор ОДИН раз */
        if (visibleTables.length === 0) {
            if (selectedId !== null) setSelectedId(null);          // вызываем только при смене
        } else if (!visibleTables.some(t => t.id === selectedId)) {
            /** авто-выбор первой появившейся таблицы */
            setSelectedId(visibleTables[0].id);
        }
    }, [visibleTables, selectedId]);

    /* ---------- эффект №2: очищаем колонки, когда таблицы пропали ---------- */
    /** вспомогательный хук, чтобы знать предыдущее значение */
    function usePrevious<T>(value: T) {
        const ref = useRef(value);
        useEffect(() => {
            ref.current = value;
        }, [value]);
        return ref.current;
    }

    const prevCount = usePrevious(visibleTables.length);

    useEffect(() => {
        if (prevCount > 0 && visibleTables.length === 0) {
            column.reset();                      // вызываем ровно ОДИН раз при переходе →0
        }
    }, [visibleTables.length, prevCount, column.reset]);
    /* 2. сообщаем Main, КОГДА selectedId изменился */
    useEffect(() => {
        // вызываем колбэк ВСЕГДА, даже если selectedId === null
        onTableSelect(selectedId);
    }, [selectedId, onTableSelect]);
    /* ---------- UI ---------- */

    const handlePublish = async () => {
        if (!selectedTable) return;

        const {ok, msg} = await publishTable(selectedTable.id, workspaceId);
        if (!ok && msg) {
            alert(msg);        // можно заменить на toast / snackbar по вкусу
        }
    };


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
                        checked={showOnlyPublished}
                        onChange={togglePublished}
                    />
                    published
                </label>

                <AddIcon onClick={() => setShowModal(true)}/>

                <NewTableModal
                    open={showModal}
                    onClose={() => setShowModal(false)}
                    onSubmit={handleCreate}
                />

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

                        {selectedTable && !selectedTable.published && (
                            <button onClick={handlePublish}>
                                Опубликовать
                            </button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};



