import React from 'react';
import {Typography} from "@mui/material";
import Editicon from "@/assets/image/EditIcon.svg";
import * as s from "@/components/setOfTables/SetOfTables.module.scss";
import DeleteIcon from "@/assets/image/DeleteIcon.svg";
import {useWorkSpaces, WidgetColumn} from "@/shared/hooks/useWorkSpaces";
import {WcReference} from "@/components/WidgetColumnsOfTable/WidgetColumnsOfTable";


type WidgetColumnsMainTableProps = {
    widgetColumns: WidgetColumn[];
    referencesMap: Record<number, WcReference[]>;
    handleDeleteReference: (wcId: number, tblColId: number) => void;

};

export const WidgetColumnsMainTable: React.FC<WidgetColumnsMainTableProps> = ({
                                                                                  widgetColumns,
                                                                                  referencesMap,
                                                                                  handleDeleteReference,

                                                                              }) => {

    const {updateReference} = useWorkSpaces();

    /* текущее редактируемое reference */
    const [editing, setEditing] = React.useState<{
        wcId: number;
        colId: number;
    } | null>(null);

    /* локальная форма */
    const [form, setForm] = React.useState<{
        width: number;
        combobox_visible: boolean;
        combobox_primary: boolean;
        ref_column_order: number;
    }>({
        width: 0,
        combobox_visible: false,
        combobox_primary: false,
        ref_column_order: 0,
    });

    const startEdit = (wcId: number, r: WcReference) => {
        setEditing({ wcId, colId: r.table_column.id });
        setForm({
            width: r.width ?? 0,
            combobox_visible: r.combobox_visible,
            combobox_primary: r.combobox_primary,
            ref_column_order: r.ref_column_order ?? 0,
        });
    };

    const cancel = () => setEditing(null);

    const save = async () => {
        if (!editing) return;
        const upd = await updateReference(
            editing.wcId,
            editing.colId,
            form,
        );
        /* подменяем в локальном кэше */
        referencesMap[editing.wcId] = (referencesMap[editing.wcId] || []).map(
            (r) =>
                r.table_column.id === editing.colId ? { ...r, ...upd } : r,
        );
        cancel();
    };

    /* helpers для checkbox / input */
    const bind =
        (key: keyof typeof form) =>
            (e: React.ChangeEvent<HTMLInputElement>) => {
                setForm((v) => ({
                    ...v,
                    [key]: e.target.type === 'checkbox'
                        ? e.target.checked
                        : +e.target.value,
                }));
            };

    /* ─────────── UI ─────────── */
    return (
        <div>
            <h3 style={{ margin: '24px 0 8px' }}>References</h3>

            {widgetColumns.map((wc) => {
                const refs = referencesMap[wc.id] ?? [];
                return (
                    <div key={`ref-${wc.id}`} style={{ marginBottom: 24 }}>
                        <h4 style={{ marginBottom: 6 }}>
                            WidgetColumn&nbsp;{wc.id}
                        </h4>

                        {refs.length ? (
                            <table className={s.tbl}>
                                <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Datatype</th>
                                    <th>Width</th>
                                    <th>combobox_visible</th>
                                    <th>combobox_primary</th>
                                    <th>ref_column_order</th>
                                    <th />
                                </tr>
                                </thead>
                                <tbody>
                                {refs.map((r) => {
                                    const isEd =
                                        editing?.wcId === wc.id &&
                                        editing.colId === r.table_column.id;

                                    return (
                                        <tr key={r.table_column.id}>
                                            <td>{r.table_column.name}</td>
                                            <td>{r.table_column.datatype}</td>

                                            {/* width */}
                                            <td>
                                                {isEd ? (
                                                    <input
                                                        type="number"
                                                        className={s.inp}
                                                        value={form.width}
                                                        onChange={bind(
                                                            'width',
                                                        )}
                                                        style={{
                                                            width: 70,
                                                        }}
                                                    />
                                                ) : (
                                                    r.width
                                                )}
                                            </td>

                                            {/* combobox_visible */}
                                            <td style={{ textAlign: 'center' }}>
                                                {isEd ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            form.combobox_visible
                                                        }
                                                        onChange={bind(
                                                            'combobox_visible',
                                                        )}
                                                    />
                                                ) : r.combobox_visible ? (
                                                    '✔'
                                                ) : (
                                                    ''
                                                )}
                                            </td>

                                            {/* combobox_primary */}
                                            <td style={{ textAlign: 'center' }}>
                                                {isEd ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            form.combobox_primary
                                                        }
                                                        onChange={bind(
                                                            'combobox_primary',
                                                        )}
                                                    />
                                                ) : r.combobox_primary ? (
                                                    '✔'
                                                ) : (
                                                    ''
                                                )}
                                            </td>

                                            {/* ref_column_order */}
                                            <td style={{ textAlign: 'center' }}>
                                                {isEd ? (
                                                    <input
                                                        type="number"
                                                        className={s.inp}
                                                        style={{ width: 50 }}
                                                        value={
                                                            form.ref_column_order
                                                        }
                                                        onChange={bind(
                                                            'ref_column_order',
                                                        )}
                                                    />
                                                ) : (
                                                    r.ref_column_order
                                                )}
                                            </td>

                                            {/* actions */}
                                            <td style={{ textAlign: 'center' }}>
                                                {isEd ? (
                                                    <>
                                                        <button
                                                            className={s.okBtn}
                                                            onClick={save}
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            className={s.cancelBtn}
                                                            onClick={cancel}
                                                        >
                                                            ✕
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Editicon
                                                            className={s.actionIcon}
                                                            onClick={() =>
                                                                startEdit(
                                                                    wc.id,
                                                                    r,
                                                                )
                                                            }
                                                        />
                                                        <DeleteIcon
                                                            className={s.actionIcon}
                                                            onClick={() =>
                                                                handleDeleteReference(
                                                                    wc.id,
                                                                    r.table_column.id,
                                                                )
                                                            }
                                                        />
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        ) : (
                            <p
                                style={{
                                    fontStyle: 'italic',
                                    color: '#777',
                                }}
                            >
                                reference не найдены
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
