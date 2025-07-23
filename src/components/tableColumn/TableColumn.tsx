import React, {useState} from 'react';
import * as s from "@/components/setOfTables/SetOfTables.module.scss";
import EditIcon from "@/assets/image/EditIcon.svg";
import DeleteIcon from "@/assets/image/DeleteIcon.svg";
import {Column} from "@/shared/hooks/useWorkSpaces";


type tableColumnProps = {
    columns:Column[]
    deleteColumnTable:(id: number) => void;
    updateTableColumn: (id: number, p: Partial<Omit<Column, 'id'>>) => void;
}

export const TableColumn = ({columns,deleteColumnTable,updateTableColumn}:tableColumnProps) => {

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValues, setEditValues] = useState<Partial<Column>>({});
    const startEdit = (col: Column) => {
        setEditingId(col.id);
        setEditValues({        // копируем все редактируемые поля
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

        // ↴ превращаем '' → null  /  убираем поля, которые не меняли
        ['length', 'precision'].forEach(k => {
            if (patch[k] === '' || patch[k] === undefined) delete patch[k];
        });

        return patch;
    };

    const saveEdit = async () => {
        if (editingId == null) return;
        await updateTableColumn(editingId, cleanPatch(editValues));
        cancelEdit();
    };



    return (
            <table className={s.tbl}>
                <thead>
                <tr>
                    <th>name</th>
                    <th>description</th>
                    <th>datatype</th>
                    <th>length</th>
                    <th>precision</th>
                    <th>primary</th>
                    <th>increment</th>
                    <th>required</th>
                    <th>datetime</th>
                    <th></th>
                </tr>
                </thead>
                <tbody>
                {columns.map(col => {
                    const isEditing = editingId === col.id;

                    return (
                        <tr key={col.id}>
                            {/** -------- NAME -------- */}
                            <td>
                                {isEditing ? (
                                    <input
                                        value={editValues.name as string}
                                        onChange={e => handleChange('name', e.target.value)}
                                        className={s.inp}
                                    />
                                ) : col.name}
                            </td>

                            {/** -------- DESCRIPTION -------- */}
                            <td>
                                {isEditing ? (
                                    <input
                                        value={editValues.description as string}
                                        onChange={e => handleChange('description', e.target.value)}
                                        className={s.inp}
                                    />
                                ) : col.description}
                            </td>

                            {/** -------- DATATYPE -------- */}
                            <td>
                                {isEditing ? (
                                    <input
                                        value={editValues.datatype as string}
                                        onChange={e => handleChange('datatype', e.target.value)}
                                        className={s.inp}
                                    />
                                ) : col.datatype}
                            </td>

                            {/** -------- LENGTH / PRECISION -------- */}
                            <td>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editValues.length as string | number}
                                        onChange={e => handleChange('length', e.target.valueAsNumber || '')}
                                        className={s.inpN}
                                    />
                                ) : col.length ?? '—'}
                            </td>
                            <td>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={editValues.precision as string | number}
                                        onChange={e => handleChange('precision', e.target.valueAsNumber || '')}
                                        className={s.inpN}
                                    />
                                ) : col.precision ?? '—'}
                            </td>

                            {/** -------- FLAGS (checkbox) -------- */}
                            {(['primary', 'increment', 'required', 'datetime'] as const).map(flag => (
                                <td key={flag} style={{textAlign: 'center'}}>
                                    {isEditing ? (
                                        <input
                                            type="checkbox"
                                            checked={editValues[flag] as boolean}
                                            onChange={e => handleChange(flag, e.target.checked)}
                                        />
                                    ) : (col[flag] ? '✔︎' : '')}
                                </td>
                            ))}

                            {/** -------- ACTIONS -------- */}
                            <td className={s.actionsCell}>
                                {isEditing ? (
                                    <>
                                        <button className={s.okBtn} onClick={saveEdit}>✓</button>
                                        <button className={s.cancelBtn} onClick={cancelEdit}>✕
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <EditIcon className={s.actionIcon}
                                                  onClick={() => startEdit(col)}/>
                                        <DeleteIcon className={s.actionIcon}
                                                    onClick={() => confirm('Удалить?') && deleteColumnTable(col.id)}/>
                                    </>
                                )}
                            </td>
                        </tr>
                    );
                })}
                </tbody>

            </table>
    );
};
