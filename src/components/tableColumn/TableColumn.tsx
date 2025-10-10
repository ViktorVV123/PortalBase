import React, {useState} from 'react';
import * as s from "@/components/setOfTables/SetOfTables.module.scss";
import EditIcon from "@/assets/image/EditIcon.svg";
import DeleteIcon from "@/assets/image/DeleteIcon.svg";
import {Column, DTable} from "@/shared/hooks/useWorkSpaces";
import {api} from "@/services/api";
import AddIcon from '@mui/icons-material/AddBox';
import CancelIcon from '@mui/icons-material/Cancel';
import SaveIcon from '@mui/icons-material/Save';
import AddBox from '@mui/icons-material/AddToPhotos';
import {TableListView} from "@/components/tableColumn/TableListView";

type TableColumnProps = {
    columns: Column[];
    /** id активной таблицы — нужен для POST */
    tableId?: number;
    deleteColumnTable: (id: number) => void;
    updateTableColumn: (id: number, p: Partial<Omit<Column, 'id'>>) => void;
    /** опционально: коллбек после успешного создания */
    onCreated?: (newCol: Column) => void;


    selectedTable: DTable | null;
    updateTableMeta: (id: number, patch: Partial<DTable>) => void;
    publishTable:(id: number) =>void
};

type NewCol = {
    name: string;
    description: string;
    datatype: string;
    length: number | '' ;
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
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<Partial<Column>>({});

    // --- создание новой строки
    const [isAdding, setIsAdding] = useState(false);
    const [newCol, setNewCol] = useState<NewCol>(initialNewCol);
    const [savingNew, setSavingNew] = useState(false);

    const startAdd = () => {
        setIsAdding(true);
        setNewCol(initialNewCol);
    };
    const cancelAdd = () => {
        setIsAdding(false);
        setNewCol(initialNewCol);
    };

    const handleNewChange = (field: keyof NewCol, value: any) =>
        setNewCol(prev => ({...prev, [field]: value}));

    const cleanNewPayload = (n: NewCol) => {
        const payload: any = {
            table_id: tableId,
            name: n.name.trim(),
            description: n.description.trim() || '',
            datatype: n.datatype.trim(),
            primary: !!n.primary,
            increment: !!n.increment,
            required: !!n.required,
        };
        // length/precision — опциональные: отправляем только если число
        if (n.length !== '' && Number.isFinite(n.length)) payload.length = Number(n.length);
        if (n.precision !== '' && Number.isFinite(n.precision)) payload.precision = Number(n.precision);
        return payload;
    };

    const saveNew = async () => {
        if (!newCol.name.trim() || !newCol.datatype.trim()) {
            alert('Укажите минимум name и datatype');
            return;
        }
        setSavingNew(true);
        try {
            const body = cleanNewPayload(newCol);
            // Swagger: POST https://csc-fv.pro.lukoil.com/api/tables/columns/
            const {data} = await api.post<Column>('/tables/columns/', body);
            onCreated?.(data);
            cancelAdd();
        } catch (e:any) {
            console.error(e);
            alert('Не удалось создать столбец');
        } finally {
            setSavingNew(false);
        }
    };

    // --- редактирование существующей
    const startEdit = (col: Column) => {
        setEditingId(col.id);
        setEditValues({
            name: col.name,
            description: col.description ?? '',
            datatype: col.datatype,
            length: col.length ?? '',
            precision: col.precision ?? '',
            primary: col.primary,
            increment: col.increment,
            required: col.required,
            datetime: col.datetime,
        });
    };
    const cancelEdit = () => {
        setEditingId(null);
        setEditValues({});
    };

    const handleChange = (field: keyof Column, value: any) =>
        setEditValues(prev => ({...prev, [field]: value}));

    const cleanPatch = (p: Partial<Column>): Partial<Column> => {
        const patch: any = {...p};
        // '' → удалить поле
        ['length', 'precision'].forEach(k => {
            if (patch[k] === '' || patch[k] === undefined) delete patch[k];
            else if (typeof patch[k] === 'string') {
                const n = Number(patch[k]);
                if (Number.isFinite(n)) patch[k] = n; else delete patch[k];
            }
        });
        // убрать неизменённые неопределённости
        Object.keys(patch).forEach(k => {
            if (patch[k] === undefined) delete patch[k];
        });
        return patch;
    };
    const saveEdit = async () => {
        if (editingId == null) return;
        await updateTableColumn(editingId, cleanPatch(editValues));
        cancelEdit();
    };

    return (
        <div className={s.tableWrapper}>
            <div style={{display:'flex', gap:8, marginBottom:8}}>

                <TableListView startAdd={startAdd} isAdding={isAdding} cancelAdd={cancelAdd} savingNew={savingNew}
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
                    <th></th>
                </tr>
                </thead>

                <tbody>
                {isAdding && (
                    <tr>
                        <td>{tableId}</td>
                        <td>—</td>
                        <td>
                            <input
                                value={newCol.name}
                                onChange={e => handleNewChange('name', e.target.value)}
                                className={s.inp}
                                placeholder="name"
                            />
                        </td>
                        <td>
                            <input
                                value={newCol.description}
                                onChange={e => handleNewChange('description', e.target.value)}
                                className={s.inp}
                                placeholder="description"
                            />
                        </td>
                        <td>
                            <input
                                value={newCol.datatype}
                                onChange={e => handleNewChange('datatype', e.target.value)}
                                className={s.inp}
                                placeholder="datatype"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={newCol.length}
                                onChange={e => handleNewChange('length', e.currentTarget.value === '' ? '' : e.currentTarget.valueAsNumber)}
                                className={s.inpN}
                                placeholder="length"
                            />
                        </td>
                        <td>
                            <input
                                type="number"
                                value={newCol.precision}
                                onChange={e => handleNewChange('precision', e.currentTarget.value === '' ? '' : e.currentTarget.valueAsNumber)}
                                className={s.inpN}
                                placeholder="precision"
                            />
                        </td>
                        {(['primary','increment','required'] as const).map(flag => (
                            <td key={flag} style={{textAlign:'center'}}>
                                <input
                                    type="checkbox"
                                    checked={newCol[flag]}
                                    onChange={e => handleNewChange(flag, e.target.checked)}
                                />
                            </td>
                        ))}
                        <td className={s.actionsCell}>
                            {/* Дублируем кнопки на случай, если удобно жать из строки */}
                            <button className={s.okBtn} onClick={saveNew} disabled={savingNew}>✓</button>
                            <button className={s.cancelBtn} onClick={cancelAdd} disabled={savingNew}>✕</button>
                        </td>
                    </tr>
                )}

                {columns.map(col => {
                    const isEditing = editingId === col.id;
                    return (
                        <tr key={col.id}>
                            <td>{col.table_id}</td>
                            <td>{col.id}</td>

                            <td>
                                {isEditing ? (
                                    <input
                                        value={editValues.name as string}
                                        onChange={e => handleChange('name', e.target.value)}
                                        className={s.inp}
                                    />
                                ) : col.name}
                            </td>

                            <td>
                                {isEditing ? (
                                    <input
                                        value={editValues.description as string}
                                        onChange={e => handleChange('description', e.target.value)}
                                        className={s.inp}
                                    />
                                ) : col.description}
                            </td>

                            <td>
                                {isEditing ? (
                                    <input
                                        value={editValues.datatype as string}
                                        onChange={e => handleChange('datatype', e.target.value)}
                                        className={s.inp}
                                    />
                                ) : col.datatype}
                            </td>

                            <td>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editValues.length as string | number}
                                        onChange={e => handleChange('length', e.currentTarget.value === '' ? '' : e.currentTarget.valueAsNumber)}
                                        className={s.inpN}
                                    />
                                ) : (col.length ?? '—')}
                            </td>

                            <td>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editValues.precision as string | number}
                                        onChange={e => handleChange('precision', e.currentTarget.value === '' ? '' : e.currentTarget.valueAsNumber)}
                                        className={s.inpN}
                                    />
                                ) : (col.precision ?? '—')}
                            </td>

                            {(['primary','increment','required'] as const).map(flag => (
                                <td key={flag} style={{textAlign:'center'}}>
                                    {isEditing ? (
                                        <input
                                            type="checkbox"
                                            checked={!!(editValues[flag] as boolean)}
                                            onChange={e => handleChange(flag, e.target.checked)}
                                        />
                                    ) : (col[flag] ? '✔︎' : '')}
                                </td>
                            ))}

                            <td className={s.actionsCell}>
                                {isEditing ? (
                                    <>
                                        <button className={s.okBtn} onClick={saveEdit}>✓</button>
                                        <button className={s.cancelBtn} onClick={cancelEdit}>✕</button>
                                    </>
                                ) : (
                                    <>
                                        <EditIcon className={s.actionIcon} onClick={() => startEdit(col)} />
                                        <DeleteIcon className={s.actionIcon}
                                                    onClick={() => confirm('Удалить?') && deleteColumnTable(col.id)} />
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
