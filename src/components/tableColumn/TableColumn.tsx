import React, { useCallback, useMemo, useState } from 'react';
import * as s from '@/components/setOfTables/SetOfTables.module.scss';
import EditIcon from '@/assets/image/EditIcon.svg';
import DeleteIcon from '@/assets/image/DeleteIcon.svg';
import { Column, DTable } from '@/shared/hooks/useWorkSpaces';
import { api } from '@/services/api';
import { TableListView } from '@/components/tableColumn/TableListView';
import { EllipsizeSmart } from '@/shared/utils/EllipsizeSmart';

type TableColumnProps = {
    columns: Column[];
    /** id активной таблицы — нужен для POST */
    tableId?: number;
    deleteColumnTable?: (id: number) => void | Promise<void>;
    updateTableColumn?: (id: number, p: Partial<Omit<Column, 'id'>>) => void | Promise<void>;
    /** опционально: коллбек после успешного создания */
    onCreated?: (newCol: Column) => void;

    selectedTable?: DTable | null;
    updateTableMeta?: (id: number, patch: Partial<DTable>) => void | Promise<void>;
    publishTable?: (id: number) => void | Promise<void>;
};

type NewCol = {
    name: string;
    description: string;
    datatype: string;
    length: number | '';
    precision: number | '';
    primary: boolean;
    increment: boolean;
    required: boolean;
};

const initialNewCol: NewCol = {
    name: '',
    description: '',
    datatype: '',
    length: '',
    precision: '',
    primary: false,
    increment: false,
    required: true,
};

export const TableColumn: React.FC<TableColumnProps> = ({
                                                            columns,
                                                            tableId,
                                                            deleteColumnTable,
                                                            updateTableColumn,
                                                            onCreated,
                                                            selectedTable,
                                                            updateTableMeta,
                                                            publishTable,
                                                        }) => {
    // редактирование существующей строки
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<Partial<Column>>({});

    // создание
    const [isAdding, setIsAdding] = useState(false);
    const [newCol, setNewCol] = useState<NewCol>(initialNewCol);
    const [savingNew, setSavingNew] = useState(false);

    const canCreate = useMemo(
        () => Boolean(tableId && newCol.name.trim() && newCol.datatype.trim()),
        [tableId, newCol.name, newCol.datatype]
    );

    // helpers
    const toNumberIfFinite = (v: unknown) => {
        if (v === '' || v === undefined || v === null) return undefined;
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : undefined;
    };

    const cleanNewPayload = useCallback(
        (n: NewCol) => {
            const payload: Partial<Column> & { table_id: number } = {
                table_id: tableId!,
                name: n.name.trim(),
                description: n.description.trim() || '',
                datatype: n.datatype.trim(),
                primary: !!n.primary,
                increment: !!n.increment,
                required: !!n.required,
            };
            const len = toNumberIfFinite(n.length);
            const prec = toNumberIfFinite(n.precision);
            if (len !== undefined) payload.length = len;
            if (prec !== undefined) payload.precision = prec;
            return payload;
        },
        [tableId]
    );

    // add flow
    const startAdd = useCallback(() => {
        setIsAdding(true);
        setNewCol(initialNewCol);
        // запретим одновременное редактирование
        setEditingId(null);
        setEditValues({});
    }, []);

    const cancelAdd = useCallback(() => {
        setIsAdding(false);
        setNewCol(initialNewCol);
        setSavingNew(false);
    }, []);

    const handleNewChange = useCallback(<K extends keyof NewCol>(field: K, value: NewCol[K]) => {
        setNewCol((prev) => ({ ...prev, [field]: value }));
    }, []);

    const saveNew = useCallback(async () => {
        if (!tableId) {
            alert('Не выбран tableId — создание невозможно.');
            return;
        }
        if (!canCreate) {
            alert('Укажите минимум name и datatype');
            return;
        }
        setSavingNew(true);
        try {
            const body = cleanNewPayload(newCol);
            const { data } = await api.post<Column>('/tables/columns/', body);
            onCreated?.(data);
            cancelAdd();
        } catch (e) {
            console.error(e);
            alert('Не удалось создать столбец');
        } finally {
            setSavingNew(false);
        }
    }, [tableId, canCreate, cleanNewPayload, newCol, onCreated, cancelAdd]);

    // edit flow
    const startEdit = useCallback((col: Column) => {
        // не даём редактировать две строки одновременно
        setIsAdding(false);
        setSavingNew(false);
        setEditingId(col.id);
        setEditValues({
            name: col.name,
            description: col.description ?? '',
            datatype: col.datatype,
            length: (col.length ?? '') as number | '',
            precision: (col.precision ?? '') as number | '',
            primary: col.primary,
            increment: col.increment,
            required: col.required,
            datetime: col.datetime,
        });
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
        setEditValues({});
    }, []);

    const handleChange = useCallback(<K extends keyof Column>(field: K, value: Column[K]) => {
        setEditValues((prev) => ({ ...prev, [field]: value }));
    }, []);

    const cleanPatch = useCallback((p: Partial<Column>): Partial<Column> => {
        const patch: Partial<Column> = { ...p };

        // нормализуем length/precision
        (['length', 'precision'] as const).forEach((k) => {
            const v = (patch as any)[k];
            if (v === '' || v === undefined || v === null) {
                delete (patch as any)[k];
            } else {
                const n = toNumberIfFinite(v);
                if (n === undefined) delete (patch as any)[k];
                else (patch as any)[k] = n;
            }
        });

        // удаляем undefined, чтобы не слать мусор
        Object.keys(patch).forEach((k) => {
            if ((patch as any)[k] === undefined) delete (patch as any)[k];
        });

        return patch;
    }, []);

    const saveEdit = useCallback(async () => {
        if (editingId == null || !updateTableColumn) return;
        await updateTableColumn(editingId, cleanPatch(editValues));
        cancelEdit();
    }, [editingId, updateTableColumn, cleanPatch, editValues, cancelEdit]);

    // input helpers (клавиатура)
    const onInputKeyDownAdd = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && canCreate && !savingNew) {
                e.preventDefault();
                void saveNew();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                cancelAdd();
            }
        },
        [canCreate, savingNew, saveNew, cancelAdd]
    );

    const onInputKeyDownEdit = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                void saveEdit();
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        },
        [saveEdit, cancelEdit]
    );

    return (
        <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <TableListView
                    startAdd={startAdd}
                    isAdding={isAdding}
                    cancelAdd={cancelAdd}
                    savingNew={savingNew}
                    publishTable={publishTable}
                    selectedTable={selectedTable}
                    updateTableMeta={updateTableMeta}
                />
            </div>

            <table className={s.tbl}>
                <thead>
                <tr>
                    <th>id_table</th>
                    <th>id_column</th>
                    <th>name</th>
                    <th>description</th>
                    <th>datatype</th>
                    <th>length</th>
                    <th>precision</th>
                    <th>primary</th>
                    <th>increment</th>
                    <th>required</th>
                    <th />
                </tr>
                </thead>

                <tbody>
                {/* ─── Добавление новой строки ─── */}
                {isAdding && (
                    <tr>
                        <td>{tableId ?? '—'}</td>
                        <td>—</td>
                        <td>
                            <input
                                value={newCol.name}
                                onChange={(e) => handleNewChange('name', e.target.value)}
                                onKeyDown={onInputKeyDownAdd}
                                className={s.inp}
                                placeholder="name"
                                aria-label="name"
                            />
                        </td>
                        <td>
                            <input
                                value={newCol.description}
                                onChange={(e) => handleNewChange('description', e.target.value)}
                                onKeyDown={onInputKeyDownAdd}
                                className={s.inp}
                                placeholder="description"
                                aria-label="description"
                            />
                        </td>
                        <td>
                            <input
                                value={newCol.datatype}
                                onChange={(e) => handleNewChange('datatype', e.target.value)}
                                onKeyDown={onInputKeyDownAdd}
                                className={s.inp}
                                placeholder="datatype"
                                aria-label="datatype"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={newCol.length}
                                onChange={(e) =>
                                    handleNewChange('length', e.currentTarget.value === '' ? '' : e.currentTarget.valueAsNumber)
                                }
                                onKeyDown={onInputKeyDownAdd}
                                className={s.inpN}
                                placeholder="length"
                                aria-label="length"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={newCol.precision}
                                onChange={(e) =>
                                    handleNewChange('precision', e.currentTarget.value === '' ? '' : e.currentTarget.valueAsNumber)
                                }
                                onKeyDown={onInputKeyDownAdd}
                                className={s.inpN}
                                placeholder="precision"
                                aria-label="precision"
                            />
                        </td>
                        {(['primary', 'increment', 'required'] as const).map((flag) => (
                            <td key={flag} style={{ textAlign: 'center' }}>
                                <input
                                    type="checkbox"
                                    checked={newCol[flag]}
                                    onChange={(e) => handleNewChange(flag, e.target.checked)}
                                    aria-label={flag}
                                />
                            </td>
                        ))}
                        <td className={s.actionsCell}>
                            <button className={s.okBtn} onClick={saveNew} disabled={!canCreate || savingNew} aria-label="save">
                                ✓
                            </button>
                            <button className={s.cancelBtn} onClick={cancelAdd} disabled={savingNew} aria-label="cancel">
                                ✕
                            </button>
                        </td>
                    </tr>
                )}

                {/* ─── Список существующих колонок ─── */}
                {columns.map((col) => {
                    const isEditing = editingId === col.id;
                    return (
                        <tr key={col.id}>
                            <td>{col.table_id}</td>
                            <td>{col.id}</td>

                            <td>
                                {isEditing ? (
                                    <input
                                        value={(editValues.name as string) ?? ''}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                        onKeyDown={onInputKeyDownEdit}
                                        className={s.inp}
                                        aria-label="name"
                                    />
                                ) : (
                                    col.name
                                )}
                            </td>

                            <td>
                                {isEditing ? (
                                    <input
                                        value={(editValues.description as string) ?? ''}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        onKeyDown={onInputKeyDownEdit}
                                        className={s.inp}
                                        aria-label="description"
                                    />
                                ) : (
                                    <EllipsizeSmart text={col.description} maxLines={1} />
                                )}
                            </td>

                            <td>
                                {isEditing ? (
                                    <input
                                        value={(editValues.datatype as string) ?? ''}
                                        onChange={(e) => handleChange('datatype', e.target.value)}
                                        onKeyDown={onInputKeyDownEdit}
                                        className={s.inp}
                                        aria-label="datatype"
                                    />
                                ) : (
                                    col.datatype
                                )}
                            </td>

                            <td>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={(editValues.length as number | '') ?? ''}
                                        onChange={(e) =>
                                            handleChange('length', e.currentTarget.value === '' ? '' : e.currentTarget.valueAsNumber)
                                        }
                                        onKeyDown={onInputKeyDownEdit}
                                        className={s.inpN}
                                        aria-label="length"
                                    />
                                ) : (
                                    col.length ?? '—'
                                )}
                            </td>

                            <td>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={(editValues.precision as number | '') ?? ''}
                                        onChange={(e) =>
                                            handleChange('precision', e.currentTarget.value === '' ? '' : e.currentTarget.valueAsNumber)
                                        }
                                        onKeyDown={onInputKeyDownEdit}
                                        className={s.inpN}
                                        aria-label="precision"
                                    />
                                ) : (
                                    col.precision ?? '—'
                                )}
                            </td>

                            {(['primary', 'increment', 'required'] as const).map((flag) => (
                                <td key={flag} style={{ textAlign: 'center' }}>
                                    {isEditing ? (
                                        <input
                                            type="checkbox"
                                            checked={Boolean(editValues[flag] as boolean | undefined ?? col[flag])}
                                            onChange={(e) => handleChange(flag, e.target.checked)}
                                            aria-label={flag}
                                        />
                                    ) : (
                                        col[flag] ? '✔︎' : ''
                                    )}
                                </td>
                            ))}

                            <td className={s.actionsCell}>
                                {isEditing ? (
                                    <>
                                        <button className={s.okBtn} onClick={saveEdit} aria-label="save-row">
                                            ✓
                                        </button>
                                        <button className={s.cancelBtn} onClick={cancelEdit} aria-label="cancel-row">
                                            ✕
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <EditIcon className={s.actionIcon} onClick={() => startEdit(col)} />
                                        <DeleteIcon
                                            className={s.actionIcon}
                                            onClick={() => {
                                                if (!deleteColumnTable) return;
                                                if (confirm('Удалить столбец?')) void deleteColumnTable(col.id);
                                            }}
                                        />
                                    </>
                                )}
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
    );
};
